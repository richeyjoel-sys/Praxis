// The model: everything derived from (doc, ui, matrix), pure.
// This is where "the builder decides" lives — movement keys, cover ratios,
// transport, group splits, signage counts, site geometry, the simulation
// plan and the derived plan objects. Nothing here touches the DOM or React.
//
// createModel() returns an object whose expensive results are memoised for
// the life of that instance; make a new one whenever doc or ui changes.

import type { Doc, Ui } from '@/state/types'
import type {
  Act,
  ActType,
  Dir,
  GeoRoom,
  Hotel,
  HotelMeta,
  ItemV2,
  Matrix,
  Role,
  SignType,
  SimPlan,
  SiteFrame,
  SiteV2,
  SpaceV2,
  Transport,
} from './types'
import {
  ACT,
  ACT_ORDER,
  DEF_SIGNS,
  DEF_TPORTS,
  ICON_BY,
  ROLES,
  SEATS,
  SHIFTS,
  shiftOf,
  type Shift,
} from './library'
import { vehicleBox } from './scene'
import { bayXs, migrateSite, resolveFrame } from './site2'

/** A movement as the UI sees it: the matrix group plus every override applied. */
export interface Move extends Act {
  k0: string // stable key — pinned to the ORIGINAL time so a retimed movement keeps its edits
  d0: number // matrix delegate count before any group override
  s0: number // original start
  gn?: number
}

export interface Cover {
  [role: string]: number
  pickup: number
  greeter: number
  desk: number
  bus: number
  all: number
}

export interface LiveMove {
  a: Move
  bay: number
  phase: 'Loading' | 'Returning' | 'Out'
  tone: 'in' | 'out' | 'away'
}

export interface Model {
  doc: Doc
  ui: Ui
  matrix: Matrix
  // libraries
  lib(): Record<string, ActType>
  libList(): ActType[]
  actOf(a: Pick<Act, 'c'>): ActType
  allRoles(): Role[]
  tports(): Transport[]
  signTypes(): SignType[]
  // calendar & hotels
  dateList(): string[]
  iso(): string
  hotels(): Hotel[]
  hotel(): Hotel | null
  hotelName(): string
  meta(name: string): HotelMeta
  day(name?: string, iso?: string): { acts: Act[]; inHouse: number }
  actKey(): string
  // movements
  key(a: Act): string
  acts(): Move[]
  custom(): Act[]
  actsIn(sh: Shift): Move[]
  sortT(a: Move): number
  // transport
  modeId(a: Act): string
  modeT(a: Act): Transport | null
  vcount(a: Act): number
  tcount(a: Act, t: Transport): number
  seatsOf(a: Act): number
  coaches(a: Act): number
  dirOf(a: Act): Dir
  // groups
  sizes(a: Act): number[]
  gsize(a: Act): number
  split(total: number, size: number): number[]
  walkQueue(a: Act): boolean
  signCount(a: Act, t: SignType): number
  // cover
  base(sh: Shift): Cover
  cover(sh: Shift): Cover
  adjKey(sh: Shift, role: string): string
  capKey(sh: Shift, role: string): string
  bayMap(): Record<string, number>
  shiftNow(): Shift
  live(): LiveMove[]
  // site (v2)
  site2(): SiteV2
  frame2(): SiteFrame
  spaces2(): SpaceV2[]
  spaceNames(): Record<string, string>
  itemsOf2(): ItemV2[]
  lvl(): number
  maxLvl(): number
  geoRooms(): Record<string, GeoRoom>
  simPlan(): SimPlan
  defaultQueue(): string
  derived2(): ItemV2[]
  iconList(): { id: string; l: string; up?: boolean }[]
}

function memo<T>(fn: () => T): () => T {
  let done = false
  let v: T
  return () => {
    if (!done) {
      v = fn()
      done = true
    }
    return v
  }
}

export function createModel(doc: Doc, ui: Ui, matrix: Matrix): Model {
  const m = {} as Model
  m.doc = doc
  m.ui = ui
  m.matrix = matrix

  // ---- libraries ----
  m.lib = memo(() => {
    const over = doc.atmeta || {}
    const out: Record<string, ActType> = {}
    ACT_ORDER.concat(['X']).forEach((c) => {
      out[c] = { ...ACT[c]!, c }
    })
    ;(doc.xActTypes || []).forEach((t) => {
      out[t.c] = { ...t }
    })
    Object.keys(over).forEach((c) => {
      if (out[c]) out[c] = { ...out[c]!, ...over[c] }
    })
    Object.keys(out).forEach((c) => {
      const ic = out[c]!.icon && ICON_BY[out[c]!.icon]
      if (ic) out[c] = { ...out[c]!, d: ic.d }
    })
    return out
  })
  m.libList = memo(() =>
    Object.keys(m.lib())
      .filter((c) => c !== 'X')
      .map((c) => ({ ...m.lib()[c]!, c })),
  )
  m.actOf = (a) => m.lib()[a.c] || m.lib().X!

  m.allRoles = memo(() => {
    const rm = doc.rolemeta || {}
    return ROLES.concat(doc.xRoles || []).map((r) => (rm[r.id] ? { ...r, ...rm[r.id] } : r))
  })
  m.tports = memo(() => {
    const saved = doc.tports
    if (!saved || !saved.length) return DEF_TPORTS
    // a plan saved before the icon set existed still gets the default types' icons
    return saved.map((t) => {
      const d = DEF_TPORTS.find((x) => x.id === t.id)
      return t.icon || !d ? t : { ...t, icon: d.icon }
    })
  })
  m.signTypes = memo(() => {
    const saved = doc.signs
    if (!saved || !saved.length) return DEF_SIGNS
    return saved.map((t) => {
      if (t.per) return t
      const d = DEF_SIGNS.find((x) => x.id === t.id)
      return d ? { ...t, per: d.per } : { ...t, per: 'space' as const }
    })
  })

  // ---- calendar & hotels ----
  m.dateList = memo(() => {
    const ev = doc.ev || {}
    const hide = new Set(ev.dropDates || [])
    return [...new Set([...matrix.dates, ...(ev.addDates || [])])].filter((d) => !hide.has(d)).sort()
  })
  m.iso = () => {
    const list = m.dateList()
    if (ui.date && list.includes(ui.date)) return ui.date
    return list[0] || ''
  }
  m.hotels = memo(() => {
    const hm = doc.hmeta || {}
    return matrix.hotels
      .concat(doc.xHotels || [])
      .map((h) => (hm[h.name]?.short ? { ...h, short: hm[h.name]!.short! } : h))
  })
  m.hotel = () => (ui.hotel === null ? null : m.hotels().find((h) => h.name === ui.hotel) || null)
  m.hotelName = () => m.hotel()?.name || ''
  m.meta = (name) => (doc.hmeta || {})[name] || {}
  m.day = (name, iso) =>
    matrix.byKey[(name || m.hotelName()) + '|' + (iso || m.iso())] || { acts: [], inHouse: 0 }
  m.actKey = () => m.hotelName() + '|' + m.iso()

  // ---- movements ----
  m.key = (a) => (a as Move).k0 || (a.id ? 'x|' + a.id : m.iso() + '|' + a.s + '|' + a.n)
  m.custom = () => doc.xActs[m.actKey()] || []
  m.sortT = (a) => (ui.openMoves[m.key(a)] && a.s0 != null ? a.s0 : a.s)
  m.acts = memo(() => {
    const hidden = doc.hidden || {}
    const tm = doc.tmod || {}
    return m
      .day()
      .acts.concat(m.custom())
      .filter((a) => !hidden[m.key(a)])
      .map((a): Move => {
        const k = m.key(a)
        const o = tm[k]
        const g = (doc.grp || {})[k]
        const out: Move = { ...a, k0: k, d0: a.d, s0: a.s }
        if (o) {
          if (o.s != null) out.s = o.s
          if (o.e != null) out.e = o.e
          if (o.dir) out.dir = o.dir
          if (o.nm) out.n = o.nm
          if (o.icon) out.icon = o.icon
          if (o.q) out.q = o.q
        }
        if (g && g.length) {
          out.d = g.reduce((t, v) => t + v, 0)
          out.gn = g.length
        }
        return out
      })
      .sort((a, b) => m.sortT(a) - m.sortT(b))
  })
  m.actsIn = (sh) => m.acts().filter((a) => a.s >= sh.from && a.s < sh.to)

  // ---- transport ----
  m.modeId = (a) => {
    const v = (doc.mv || {})[m.key(a)]
    if (v && v.t !== undefined) return v.t
    return a.m === 'Bus' ? 'coach' : 'walk'
  }
  m.modeT = (a) => {
    const id = m.modeId(a)
    return id === 'walk' ? null : m.tports().find((t) => t.id === id) || null
  }
  m.vcount = (a) => {
    const t = m.modeT(a)
    if (!t) return 0
    const v = (doc.mv || {})[m.key(a)]
    if (v && v.n != null) return v.n
    return Math.max(1, Math.ceil(a.d / (t.seats || SEATS)))
  }
  m.tcount = (a, t) => {
    const cur = m.modeT(a)
    return cur && cur.id === t.id ? m.vcount(a) : 0
  }
  m.seatsOf = (a) => {
    const t = m.modeT(a)
    return t ? m.vcount(a) * (t.seats || 0) : 0
  }
  m.coaches = (a) => {
    const t = m.modeT(a)
    return t && t.seats >= 20 ? m.vcount(a) : 0
  }
  m.dirOf = (a) => a.dir || (a.m === 'Bus' ? 'both' : 'out')

  // ---- groups ----
  m.sizes = (a) => {
    const g = (doc.grp || {})[m.key(a)]
    return g && g.length ? g : [(a as Move).d0 != null ? (a as Move).d0 : a.d]
  }
  m.gsize = (a) => (doc.gsz || {})[m.key(a)] || 50
  m.split = (total, size) => {
    const n = Math.max(1, Math.ceil(total / Math.max(1, size)))
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - size * (n - 1) : size)).map((v) =>
      Math.max(0, v),
    )
  }
  // a walking party only queues if you say it does; anything on wheels always does
  m.walkQueue = (a) => {
    if (m.modeT(a)) return true
    return !!((doc.tmod || {})[m.key(a)] || {}).wq
  }
  m.signCount = (a, t) => {
    const o = ((doc.tmod || {})[m.key(a)] || {}).sg || {}
    if (o[t.id] != null) return o[t.id]!
    if (!a.q || !m.walkQueue(a)) return 0
    return t.per === 'group' ? m.sizes(a).length : t.per === 'space' ? 1 : 0
  }

  // ---- cover: proposed ratios, then the user's adjustment on top ----
  m.base = (sh) => {
    const a = m.actsIn(sh)
    const bus = a.filter((x) => x.m === 'Bus').reduce((t, x) => t + x.d, 0)
    const all = a.reduce((t, x) => t + x.d, 0)
    return { pickup: Math.ceil(bus / 50), greeter: Math.ceil(all / 150), desk: a.length ? 2 : 0, bus, all }
  }
  m.adjKey = (sh, r) => `${m.hotelName()}|${m.iso()}|${sh.id}|${r}`
  m.capKey = m.adjKey
  m.cover = (sh) => {
    const b = m.base(sh)
    const out: Cover = { ...b }
    m.allRoles().forEach((r) => {
      out[r.id] = Math.max(0, (b[r.id] || 0) + (doc.roleAdj[m.adjKey(sh, r.id)] || 0))
    })
    return out
  }
  // first bay free at the moment this coach starts loading, so simultaneous
  // movements never share one
  m.bayMap = memo(() => {
    const free = [0, 0, 0]
    const map: Record<string, number> = {}
    m.acts()
      .filter((x) => {
        const t = m.modeT(x)
        return t && t.seats >= 20
      })
      .forEach((a) => {
        const from = a.s - 45
        const until = a.e + 30
        let bay = free.findIndex((f) => f <= from)
        if (bay < 0) bay = free.indexOf(Math.min(...free))
        free[bay] = until
        map[m.key(a)] = bay
      })
    return map
  })
  m.shiftNow = () => shiftOf(ui.mins)
  m.live = memo(() => {
    const t = ui.mins
    const bm = m.bayMap()
    return m
      .acts()
      .map((a): LiveMove | null => {
        const b = bm[m.key(a)]
        const bay = a.m === 'Bus' && b != null ? b : -1
        if (t >= a.s - 45 && t < a.s) return { a, bay, phase: 'Loading', tone: 'in' }
        if (t >= a.e && t < a.e + 30) return { a, bay, phase: 'Returning', tone: 'out' }
        if (t >= a.s && t < a.e) return { a, bay, phase: 'Out', tone: 'away' }
        return null
      })
      .filter((x): x is LiveMove => !!x)
  })

  // ---- site (v2): blank until real ----
  m.site2 = memo((): SiteV2 => {
    const nm = m.hotelName()
    const saved = (doc.sites2 || {})[nm]
    if (saved) return saved
    return migrateSite(nm, (doc.sites || {})[nm])
  })
  m.frame2 = memo(() => resolveFrame(m.site2()))
  m.spaces2 = () => m.site2().spaces
  m.spaceNames = memo(() => {
    const o: Record<string, string> = {}
    m.spaces2().forEach((s) => (o[s.id] = s.l))
    o.kerb = 'Front drive'
    return o
  })
  m.itemsOf2 = () => m.site2().items
  m.lvl = () => ui.lvl || 0
  m.maxLvl = () => Math.max(doc.floors || 0, ...m.spaces2().map((s) => s.lvl || 0), 0)

  // every space a movement can queue in — the kerb included, so a queue on
  // the kerb is measured, not silently skipped
  m.geoRooms = memo(() => {
    const f = m.frame2()
    const kerbY = f.d + 1
    const out: Record<string, GeoRoom> = {}
    m.spaces2().forEach((s) => {
      out[s.id] = { x: s.x, y: s.y, w: s.w, d: s.d, headM: 1.6 }
    })
    out.kerb = { x: 1, y: kerbY + 0.4, w: f.w - 2, d: f.kerb - 0.8, headM: 0.6 }
    return out
  })

  // ---- the simulation: plan in, world out ----
  m.simPlan = memo((): SimPlan => {
    const f = m.frame2()
    const kerbY = f.d + 1
    const streetY = kerbY + f.kerb + 0.6
    return {
      geo: {
        rooms: m.geoRooms(),
        buildW: f.w,
        buildD: f.d,
        kerbY,
        kerbDepth: f.kerb,
        streetY,
        streetDepth: f.street,
        bays: bayXs(f),
      },
      moves: m
        .acts()
        .map((x) => {
          const t = m.modeT(x)
          const vbox = t ? vehicleBox(t) : { l: 0, w: 0 }
          return {
            key: m.key(x),
            name: x.n,
            hex: m.actOf(x).hex,
            s: x.s,
            e: x.e,
            dir: m.dirOf(x),
            sizes: m.sizes(x),
            rides: !!t,
            cap: t ? t.seats || 1 : 0,
            vcount: m.vcount(x),
            vlen: vbox.l,
            vwid: vbox.w,
            vhex: t ? t.hex : '#888',
            vname: t ? t.l : '',
            queueRoom: x.q && m.geoRooms()[x.q] ? x.q : m.defaultQueue(),
            walkQueue: m.walkQueue(x),
          }
        })
        .filter((mv) => mv.sizes.reduce((t, v) => t + v, 0) > 0),
    }
  })
  /** Where a movement queues when nothing was chosen: the lobby if one exists, else nowhere. */
  m.defaultQueue = () => {
    const sp = m.spaces2()
    const lobby = sp.find((s) => s.id === 'lobby' || /lobby/i.test(s.l))
    return lobby ? lobby.id : ''
  }

  // what the builder decided, drawn without being placed by hand:
  // welcome desks from the desk cover, one lollipop per group and one A-frame
  // per queuing space, laid on a grid inside the space they serve
  m.derived2 = memo((): ItemV2[] => {
    const out: ItemV2[] = []
    const geo = m.geoRooms()
    const cov = m.cover(shiftOf(ui.mins))
    const lobbyId = m.defaultQueue()
    const lobby = lobbyId ? geo[lobbyId] : undefined
    if (lobby)
      for (let i = 0; i < Math.min(4, cov.desk || 0); i++)
        out.push({
          id: '',
          kind: 'furn',
          t: 'desk',
          l: 'Welcome desk',
          x: lobby.x + (0.16 + i * 0.21) * lobby.w,
          z: lobby.y + 0.2 * lobby.d,
          auto: 1,
        })
    const perRoom: Record<string, string[]> = {}
    m.acts()
      .slice(0, 14)
      .forEach((a2) => {
        const q = a2.q && geo[a2.q] ? a2.q : lobbyId
        if (!q) return
        perRoom[q] = perRoom[q] || []
        const groups = Math.min(3, m.sizes(a2).length || 1)
        for (let k = 0; k < groups; k++) perRoom[q]!.push('lollipop')
      })
    const LB: Record<string, string> = { lollipop: 'Lollipop sign', aframe: 'A-frame', arrowsign: 'Directional arrow' }
    Object.keys(perRoom).forEach((q) => {
      const r = geo[q]
      if (!r) return
      const list = perRoom[q]!.concat(['aframe', 'arrowsign'])
      const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.8)))
      const rows = Math.ceil(list.length / cols)
      list.forEach((t2, i) => {
        const cx = i % cols
        const cy = Math.floor(i / cols)
        out.push({
          id: '',
          kind: 'sign',
          t: t2,
          l: LB[t2] || 'Sign',
          auto: 1,
          x: r.x + (0.08 + (cols === 1 ? 0.42 : (cx / (cols - 1)) * 0.84)) * r.w,
          z: r.y + (0.62 + (rows === 1 ? 0 : (cy / (rows - 1)) * 0.3)) * r.d,
        })
      })
    })
    out.forEach((o, i) => (o.id = 'd' + i)) // a stable id, so right-clicking one adopts THAT one
    return out
  })


  m.iconList = () =>
    (doc.xIcons || [])
      .map((u): { id: string; l: string; up?: boolean } => ({ id: u.id, l: u.l, up: true }))
      .concat(Object.values(ICON_BY).map((i) => ({ id: i.id, l: i.l })))

  return m
}

export { SHIFTS, shiftOf }
export type { Shift }
