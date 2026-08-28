// Every user edit, as a named action over the store. Each one goes through
// mutate() (undoable) or set() (transient). Components call these; they never
// write to the store directly.

import { useStore } from './store'
import type { Model } from '@/model/select'
import type { Shift } from '@/model/library'
import { ICON_BY, SWATCH } from '@/model/library'
import type { Act, Dir, DraftTool, ItemV2, ManySnap, MapPull, PlanTool, PlanUnderlay, Road, Selection, SignType, SiteFrame, SiteV2, SpaceV2, Transport, Role, ActType, HotelMeta, EventMeta, Wall } from '@/model/types'
import { uid } from '@/lib/ids'
import { blankSite } from '@/model/site2'

const S = () => useStore.getState()

// ---- navigation ----
export const goHome = () => S().set((u) => void (u.hotel = null))
export const goHotel = (name: string) => S().set((u) => void (u.hotel = name))
export const setDate = (iso: string) => S().set((u) => void (u.date = iso))
export const setView = (view: 'builder' | 'planner' | 'report') => S().set((u) => void (u.view = view))
export const setPmode = (pmode: 'plan' | 'live') =>
  S().set((u) => {
    u.pmode = pmode
    u.ptool = null
    if (pmode === 'live') u.stage = 'run'
    else if (u.stage === 'run') u.stage = 'build'
  })
/** The planner's one progression: Build → Fill → Run. Run is the live model. */
export const setStage = (st: 'build' | 'fill' | 'run') =>
  S().set((u) => {
    u.stage = st
    u.pmode = st === 'run' ? 'live' : 'plan'
    u.ptool = null
    u.drawer = null
    if (st !== 'build') u.dtool = 'select'
  })
export const setMins = (mins: number) => S().set((u) => void (u.mins = mins))
export const scrub = (mins: number) =>
  S().set((u) => {
    u.mins = mins
    u.playing = false
  })
export const togglePlay = () => S().set((u) => void (u.playing = !u.playing))
export const setSpeed = (v: number) => S().set((u) => void (u.speed = v))
export const goShift = (sh: Shift, firstStart: number | null) =>
  S().set((u) => {
    u.shift = sh.id
    u.mins = Math.max(sh.from, Math.min(sh.to - 5, firstStart != null ? firstStart - 30 : sh.from + 60))
  })

// ---- studio / panels ----
export const openStudio = (tab: 'act' | 'role' | 'tport' | 'sign' = 'act') =>
  S().set((u) => {
    u.studio = true
    u.studioTab = tab
  })
export const closeStudio = () => S().set((u) => void (u.studio = false))
export const setStudioTab = (tab: 'act' | 'role' | 'tport' | 'sign') => S().set((u) => void (u.studioTab = tab))
export const toggleSetup = () => S().set((u) => void (u.setup = !u.setup))
export const closeSetup = () => S().set((u) => void (u.setup = false))
export const openHotelCard = (name: string, top: number) => S().set((u) => void (u.hotelCard = { name, top }))
export const closeHotelCard = () => S().set((u) => void (u.hotelCard = null))

// ---- movements ----
export function addAct(m: Model, sh: Shift, code?: string) {
  const id = uid('a')
  const k = m.actKey()
  const start = Math.min(sh.to - 30, sh.from + 60)
  const type = code ? m.lib()[code] : null
  const act: Act = {
    id,
    n: type ? type.l : 'New movement',
    s: start,
    e: Math.min(1350, start + 180),
    d: 100,
    gr: 1,
    m: 'Bus',
    c: code || 'X',
    g: '✦',
    custom: true,
  }
  S().mutate((d, u) => {
    ;(d.xActs[k] = d.xActs[k] || []).push(act)
    u.openMoves = { ['x|' + id]: true }
  })
}
export function patchAct(m: Model, id: string, patch: Partial<Act>) {
  const k = m.actKey()
  S().mutate((d) => {
    const list = d.xActs[k] || []
    const a = list.find((x) => x.id === id)
    if (a) Object.assign(a, patch)
  })
}
export function removeAct(m: Model, id: string) {
  const k = m.actKey()
  S().mutate((d) => {
    d.xActs[k] = (d.xActs[k] || []).filter((x) => x.id !== id)
  })
}
/** A matrix group is hidden, one the user added is deleted outright; both are one Undo away. */
export function dropAct(m: Model, a: Act) {
  if (a.id) return removeAct(m, a.id)
  const k = m.key(a)
  S().mutate((d) => void (d.hidden[k] = true))
}
export const toggleMove = (key: string) =>
  S().set((u) => {
    u.openMoves = u.openMoves[key] ? {} : { [key]: true }
  })
export const setMovesOpen = (keys: string[], open: boolean) =>
  S().set((u) => {
    keys.forEach((k) => (u.openMoves[k] = open))
  })
export const toggleStep = (key: string, step: number, open: boolean) =>
  S().set((u) => void (u.stepShut[key + '|' + step] = open))
export const setAllSteps = (key: string, shut: boolean) =>
  S().set((u) => {
    for (let i = 1; i <= 6; i++) u.stepShut[key + '|' + i] = shut
  })

export function patchMove(m: Model, a: Act, p: Record<string, unknown>) {
  const k = m.key(a)
  S().mutate((d) => {
    d.tmod[k] = { ...(d.tmod[k] || {}), ...p }
  })
}
export const setDir = (m: Model, a: Act, dir: Dir) => patchMove(m, a, { dir })
export function shiftTime(m: Model, a: Act, which: 's' | 'e', delta: number) {
  const k = m.key(a)
  const o = m.doc.tmod[k] || {}
  const s0 = o.s != null ? o.s : a.s
  const e0 = o.e != null ? o.e : a.e
  const next =
    which === 's'
      ? { s: Math.max(0, Math.min(1435, s0 + delta)), e: Math.max(s0 + delta + 5, e0) }
      : { s: s0, e: Math.max(s0 + 5, Math.min(1439, e0 + delta)) }
  patchMove(m, a, next)
}
export function setMode(m: Model, a: Act, id: string) {
  const k = m.key(a)
  S().mutate((d) => void (d.mv[k] = { t: id, n: null }))
}
export function bumpVehicles(m: Model, a: Act, delta: number) {
  const k = m.key(a)
  const n = Math.max(0, m.vcount(a) + delta)
  const id = m.modeId(a)
  S().mutate((d) => void (d.mv[k] = { t: id, n }))
}
export function setGroupCount(m: Model, a: Act, delta: number) {
  const k = m.key(a)
  const cur = m.sizes(a)
  const n = Math.max(1, Math.min(12, cur.length + delta))
  if (n === cur.length) return
  const total = cur.reduce((t, v) => t + v, 0)
  const each = Math.floor(total / n)
  const out = Array.from({ length: n }, (_, i) => (i === n - 1 ? total - each * (n - 1) : each))
  S().mutate((d) => void (d.grp[k] = out))
}
export function setTotal(m: Model, a: Act, delta: number) {
  const k = m.key(a)
  const total = Math.max(0, m.sizes(a).reduce((t, v) => t + v, 0) + delta)
  const out = m.split(total, m.gsize(a))
  S().mutate((d) => void (d.grp[k] = out))
}
export function setGsize(m: Model, a: Act, delta: number) {
  const k = m.key(a)
  const size = Math.max(5, Math.min(200, m.gsize(a) + delta))
  const total = m.sizes(a).reduce((t, v) => t + v, 0)
  const out = m.split(total, size)
  S().mutate((d) => {
    d.gsz[k] = size
    d.grp[k] = out
  })
}
export function setGroupSize(m: Model, a: Act, i: number, delta: number) {
  const k = m.key(a)
  const cur = m.sizes(a).slice()
  cur[i] = Math.max(0, (cur[i] || 0) + delta)
  S().mutate((d) => void (d.grp[k] = cur))
}
export function bumpSign(m: Model, a: Act, t: SignType, delta: number) {
  const o = (m.doc.tmod[m.key(a)] || {}).sg || {}
  patchMove(m, a, { sg: { ...o, [t.id]: Math.max(0, m.signCount(a, t) + delta) } })
}

// ---- roles & captains ----
export function bumpRole(m: Model, sh: Shift, role: string, delta: number) {
  const k = m.adjKey(sh, role)
  S().mutate((d) => void (d.roleAdj[k] = (d.roleAdj[k] || 0) + delta))
}
export function setCaptain(m: Model, sh: Shift, role: string, name: string) {
  const k = m.capKey(sh, role)
  S().mutate((d) => void (d.caps[k] = name))
}

// ---- libraries (studio) ----
export function addActType() {
  const c = uid('g')
  S().mutate((d) => {
    d.xActTypes.push({ c, l: 'New activity', icon: 'star', d: ICON_BY.star!.d, hex: SWATCH[0]!, tint: '#eceffd', mine: true })
  })
}
export function patchActType(t: ActType, p: Partial<ActType>) {
  S().mutate((d) => {
    if (t.mine) {
      const x = d.xActTypes.find((z) => z.c === t.c)
      if (x) Object.assign(x, p)
    } else d.atmeta[t.c] = { ...(d.atmeta[t.c] || {}), ...p }
  })
}
export const removeActType = (c: string) =>
  S().mutate((d) => void (d.xActTypes = d.xActTypes.filter((t) => t.c !== c)))

export function addRole() {
  S().mutate((d) => {
    d.xRoles.push({ id: uid('r'), l: 'New role', g: '◆', icon: 'person', hex: SWATCH[3]!, custom: true })
  })
}
export function patchRole(r: Role, p: Partial<Role>, locked: boolean) {
  S().mutate((d) => {
    if (locked) d.rolemeta[r.id] = { ...(d.rolemeta[r.id] || {}), ...p }
    else {
      const x = d.xRoles.find((z) => z.id === r.id)
      if (x) Object.assign(x, p)
    }
  })
}
export const removeRole = (id: string) => S().mutate((d) => void (d.xRoles = d.xRoles.filter((r) => r.id !== id)))

export function addTport(m: Model) {
  const list = m.tports()
  S().mutate((d) => {
    d.tports = [...list, { id: uid('t'), l: 'New transport', g: '◆', icon: 'van', hex: SWATCH[4]!, seats: 4, custom: true }]
  })
}
export function patchTport(m: Model, id: string, p: Partial<Transport>) {
  const list = m.tports()
  S().mutate((d) => {
    d.tports = list.map((t) => (t.id === id ? { ...t, ...p } : t))
  })
}
export function removeTport(m: Model, id: string) {
  const list = m.tports()
  S().mutate((d) => void (d.tports = list.filter((t) => t.id !== id)))
}

export function addSign(m: Model) {
  const list = m.signTypes()
  S().mutate((d) => {
    d.signs = [...list, { id: uid('s'), l: 'New sign', icon: 'sign', hex: SWATCH[2]!, per: 'space', custom: true }]
  })
}
export function patchSign(m: Model, id: string, p: Partial<SignType>) {
  const list = m.signTypes()
  S().mutate((d) => void (d.signs = list.map((t) => (t.id === id ? { ...t, ...p } : t))))
}
export function removeSign(m: Model, id: string) {
  const list = m.signTypes()
  S().mutate((d) => void (d.signs = list.filter((t) => t.id !== id)))
}

export function addUploadedIcon(name: string, src: string): string {
  const id = uid('u')
  S().mutate((d) => {
    d.xIcons.push({ id, l: name.replace(/\.[^.]+$/, ''), src })
  })
  return id
}

// ---- hotels ----
export function setHotelMeta(name: string, patch: HotelMeta) {
  S().mutate((d) => {
    d.hmeta[name] = { ...(d.hmeta[name] || {}), ...patch }
  })
}
export function addHotel() {
  const n = S().doc.xHotels.length + 1
  const name = 'New hotel ' + n
  S().mutate((d, u) => {
    d.xHotels.push({ name, short: name, code: 'NH' + n, delegates: 0, custom: true })
    u.hotelCard = { name, top: 120 }
  })
}
export function removeHotel(name: string) {
  S().mutate((d, u) => {
    d.xHotels = d.xHotels.filter((h) => h.name !== name)
    u.hotelCard = null
    u.hotel = null
  })
}

// ---- event & dates ----
export const setEv = (p: Partial<EventMeta>) => S().mutate((d) => void (d.ev = { ...(d.ev || {}), ...p }))
export function shiftDate(m: Model, iso: string, drop: boolean) {
  const ev = m.doc.ev || {}
  const was = m.iso()
  const patch: Partial<EventMeta> = drop
    ? { dropDates: [...new Set([...(ev.dropDates || []), iso])], addDates: (ev.addDates || []).filter((d) => d !== iso) }
    : { addDates: [...new Set([...(ev.addDates || []), iso])], dropDates: (ev.dropDates || []).filter((d) => d !== iso) }
  S().mutate((d, u) => {
    d.ev = { ...(d.ev || {}), ...patch }
    // the day you were on must stay the day you are on, or the nearest one left
    const hide = new Set(d.ev.dropDates || [])
    const next = [...new Set([...m.matrix.dates, ...(d.ev.addDates || [])])].filter((x) => !hide.has(x)).sort()
    if (!next.includes(was)) {
      const i = Math.max(0, Math.min(next.length - 1, m.dateList().indexOf(was)))
      u.date = next[i] || next[0] || null
    }
  })
}
// ---- site v2: blank → underlay → walls → place → live ----

/** Write a patch onto the hotel's site, migrating a legacy save on first touch. */
export function patchSite2(m: Model, p: Partial<SiteV2>) {
  const nm = m.hotelName()
  const cur = m.site2()
  S().mutate((d) => {
    d.sites2[nm] = { ...cur, ...p }
  })
}
export const setWallH = (m: Model, h: number) => patchSite2(m, { wallH: Math.max(2, Math.min(12, h)) })
export const setFrame = (m: Model, p: Partial<SiteFrame>) =>
  patchSite2(m, { frame: { ...m.site2().frame, ...p } })
export const setUnderlay2 = (m: Model, u: PlanUnderlay | null) => patchSite2(m, { underlay: u, established: true })
export const setMap2 = (m: Model, map: MapPull | null) =>
  patchSite2(m, map ? { map, established: true, scaled: 1 } : { map, established: true })
export const establish2 = (m: Model) => patchSite2(m, { established: true })
/** Turn the underlay/map imagery so the building sits square to the workspace. */
export const rotSite = (m: Model, deltaDeg: number) => {
  const r = ((m.site2().rot || 0) + deltaDeg) % 360
  patchSite2(m, { rot: +r.toFixed(2) })
}
/** Rotate a whole wall about its centroid — aligning a trace after the fact. */
export function rotateWall(m: Model, id: string, deg: number) {
  const w = m.site2().walls.find((x) => x.id === id)
  if (!w) return
  const cx = w.pts.reduce((t, p) => t + p[0], 0) / w.pts.length
  const cz = w.pts.reduce((t, p) => t + p[1], 0) / w.pts.length
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  patchWall(
    m,
    id,
    w.pts.map(([x, z]) => [+(cx + (x - cx) * cos - (z - cz) * sin).toFixed(2), +(cz + (x - cx) * sin + (z - cz) * cos).toFixed(2)] as [number, number]),
  )
}
/** Set a straight (two-point) wall's length, holding its start and direction. */
export function setWallLen(m: Model, id: string, lenM: number) {
  const w = m.site2().walls.find((x) => x.id === id)
  if (!w || w.pts.length !== 2) return
  const [a, b] = [w.pts[0]!, w.pts[1]!]
  const cur = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  const k = Math.max(0.5, lenM) / cur
  patchWall(m, id, [a, [+(a[0] + (b[0] - a[0]) * k).toFixed(2), +(a[1] + (b[1] - a[1]) * k).toFixed(2)]])
}

export function addRoad(m: Model, pts: [number, number][]) {
  if (pts.length < 2) return
  const r: Road = { id: uid('rd'), pts, w: 8 }
  patchSite2(m, { roads: [...m.site2().roads, r], established: true })
  A_select({ kind: 'road', id: r.id })
}
export function patchRoad(m: Model, id: string, p: { pts?: [number, number][]; w?: number }) {
  patchSite2(m, { roads: m.site2().roads.map((r) => (r.id === id ? { ...r, ...p } : r)) })
}
export function deleteRoad(m: Model, id: string) {
  patchSite2(m, { roads: m.site2().roads.filter((r) => r.id !== id) })
  A_select(null)
}

export function addWall(m: Model, pts: [number, number][]) {
  if (pts.length < 2) return
  const w: Wall = { id: uid('w'), pts }
  patchSite2(m, { walls: [...m.site2().walls, w] })
  A_select({ kind: 'wall', id: w.id })
}
export function patchWall(m: Model, id: string, pts: [number, number][]) {
  patchSite2(m, { walls: m.site2().walls.map((w) => (w.id === id ? { ...w, pts } : w)) })
}
export function deleteWall(m: Model, id: string) {
  patchSite2(m, { walls: m.site2().walls.filter((w) => w.id !== id) })
  A_select(null)
}

export function addSpace2(m: Model, r?: { x: number; y: number; w: number; d: number }, forMove?: Act): string {
  const site = m.site2()
  const id = uid('z')
  const n = site.spaces.length
  const rect = r || { x: 2 + (n % 3) * 14, y: 2 + Math.floor(n / 3) * 11, w: 12, d: 9 }
  patchSite2(m, {
    spaces: [...site.spaces, { id, l: 'New space', ...rect, lvl: m.lvl() }],
    established: true,
  })
  if (forMove) patchMove(m, forMove, { q: id })
  return id
}
export function patchSpace2(m: Model, id: string, p: Partial<SpaceV2>) {
  patchSite2(m, { spaces: m.site2().spaces.map((s) => (s.id === id ? { ...s, ...p } : s)) })
}
export const renameSpace2 = (m: Model, id: string, l: string) => patchSpace2(m, id, { l })
export function deleteSpace2(m: Model, id: string) {
  patchSite2(m, { spaces: m.site2().spaces.filter((s) => s.id !== id) })
  A_select(null)
}

export function placeItem2(m: Model, tool: PlanTool, x: number, z: number) {
  const it: ItemV2 = {
    id: uid('i'),
    kind: tool.kind,
    t: tool.t,
    l: tool.l,
    x,
    z,
    rot: 0,
    lvl: m.lvl(),
    hex: tool.kind === 'veh' ? '#5b6470' : null,
  }
  patchSite2(m, { items: [...m.site2().items, it], established: true })
  A_select({ kind: 'item', id: it.id })
}
export function patchItem2(m: Model, id: string, p: Partial<ItemV2>) {
  patchSite2(m, { items: m.site2().items.map((it) => (it.id === id ? { ...it, ...p } : it)) })
}
export const moveItem2 = (m: Model, id: string, x: number, z: number) => patchItem2(m, id, { x, z })
export function rotateItem2(m: Model, id: string, delta: number) {
  const it = m.itemsOf2().find((x) => x.id === id)
  if (it) patchItem2(m, id, { rot: ((it.rot || 0) + delta + 360) % 360 })
}
export function duplicateItem2(m: Model, id: string) {
  const it = m.itemsOf2().find((x) => x.id === id)
  if (!it) return
  const copy: ItemV2 = { ...it, id: uid('i'), x: it.x + 1.5, z: it.z + 1 }
  patchSite2(m, { items: [...m.site2().items, copy] })
  A_select({ kind: 'item', id: copy.id })
}
export function deleteItem2(m: Model, id: string) {
  patchSite2(m, { items: m.site2().items.filter((it) => it.id !== id) })
  A_select(null)
}
/** Delete whatever is selected — item, wall or space. */
export function deleteSelection(m: Model) {
  const u = S().ui
  const many = u.msel
  if (many && many.length) {
    const of = (k: Selection['kind']) => new Set(many.filter((x) => x.kind === k).map((x) => x.id))
    const it = of('item')
    const wl = of('wall')
    const rd = of('road')
    const sp = of('space')
    const site = m.site2()
    patchSite2(m, {
      items: site.items.filter((x) => !it.has(x.id)),
      walls: site.walls.filter((x) => !wl.has(x.id)),
      roads: site.roads.filter((x) => !rd.has(x.id)),
      spaces: site.spaces.filter((x) => !sp.has(x.id)),
    })
    selectMany([])
    return
  }
  const sel = u.sel
  if (!sel) return
  if (sel.kind === 'item') deleteItem2(m, sel.id)
  else if (sel.kind === 'wall') deleteWall(m, sel.id)
  else if (sel.kind === 'road') deleteRoad(m, sel.id)
  else deleteSpace2(m, sel.id)
}
/** Start this hotel over: everything drawn and placed goes; Undo brings it back. */
export function clearSite2(m: Model) {
  patchSite2(m, blankSite())
  A_select(null)
}
/** Drag a whole grabbed set at once — positions come from the drag-start snapshot. */
export function moveMany(m: Model, snap: ManySnap, dx: number, dz: number) {
  const site = m.site2()
  const it = new Map(snap.items.map((q) => [q.id, q]))
  const wl = new Map(snap.walls.map((q) => [q.id, q]))
  const rd = new Map(snap.roads.map((q) => [q.id, q]))
  const sp = new Map(snap.spaces.map((q) => [q.id, q]))
  patchSite2(m, {
    items: site.items.map((x) => {
      const q = it.get(x.id)
      return q ? { ...x, x: +(q.x + dx).toFixed(2), z: +(q.z + dz).toFixed(2) } : x
    }),
    walls: site.walls.map((x) => {
      const q = wl.get(x.id)
      return q ? { ...x, pts: q.pts.map(([px, pz]) => [+(px + dx).toFixed(2), +(pz + dz).toFixed(2)] as [number, number]) } : x
    }),
    roads: site.roads.map((x) => {
      const q = rd.get(x.id)
      return q ? { ...x, pts: q.pts.map(([px, pz]) => [+(px + dx).toFixed(2), +(pz + dz).toFixed(2)] as [number, number]) } : x
    }),
    spaces: site.spaces.map((x) => {
      const q = sp.get(x.id)
      return q ? { ...x, x: +(q.x + dx).toFixed(2), y: +(q.y + dz).toFixed(2) } : x
    }),
  })
}

/** Populate from the builder: the day's roles, desks and signs become real
 *  objects you can move, rotate and delete. */
export function importDerived2(m: Model) {
  const der = m.populateItems()
  if (!der.length) return
  const made = der.map((d) => ({ ...d, auto: 0 as const, id: uid('i') }))
  patchSite2(m, { items: [...m.site2().items, ...made] })
}
export function ownDerived2(m: Model, id: string) {
  const d0 = m.derived2().find((o) => o.id === id)
  if (!d0) return
  const it: ItemV2 = { ...d0, auto: 0, id: uid('i') }
  patchSite2(m, { items: [...m.site2().items, it] })
  A_select({ kind: 'item', id: it.id })
}

/** One known distance sets the scale: map, underlay, walls, spaces and items grow together. */
export function calibrate2(m: Model, p: { factor: number; anchorX: number; anchorZ: number }) {
  const site = m.site2()
  const f = Math.max(0.05, Math.min(20, p.factor))
  const sx = (v: number) => +(p.anchorX + (v - p.anchorX) * f).toFixed(2)
  const sz = (v: number) => +(p.anchorZ + (v - p.anchorZ) * f).toFixed(2)
  const pl = site.underlay
  // the map imagery rescales with everything else: its metres-per-pixel scales
  // by the factor, and its anchor pixel is re-solved so the image's world
  // position transforms about the same anchor as the drawing
  let map2 = site.map
  if (map2) {
    const newFw = +Math.max(20, site.frame.w * f).toFixed(1)
    const newFd = +Math.max(14, site.frame.d * f).toFixed(1)
    const oldLeftX = site.frame.w / 2 - map2.px * map2.mpp
    const oldTopZ = site.frame.d / 2 - map2.py * map2.mpp
    const mpp2 = map2.mpp * f
    map2 = {
      ...map2,
      mpp: mpp2,
      px: +((newFw / 2 - sx(oldLeftX)) / mpp2).toFixed(3),
      py: +((newFd / 2 - sz(oldTopZ)) / mpp2).toFixed(3),
    }
  }
  patchSite2(m, {
    walls: site.walls.map((w) => ({ ...w, pts: w.pts.map(([x, z]) => [sx(x), sz(z)] as [number, number]) })),
    spaces: site.spaces.map((s) => ({
      ...s,
      x: sx(s.x),
      y: sz(s.y),
      w: +Math.max(1, s.w * f).toFixed(2),
      d: +Math.max(1, s.d * f).toFixed(2),
    })),
    items: site.items.map((it) => ({ ...it, x: sx(it.x), z: sz(it.z) })),
    underlay: pl?.src
      ? {
          ...pl,
          wM: +((pl.wM || site.frame.w) * f).toFixed(2),
          hM: +((pl.hM || site.frame.w * 0.7) * f).toFixed(2),
          ox: sx(pl.ox || 0),
          oy: sz(pl.oy || 0),
          calibrated: true,
        }
      : pl,
    map: map2,
    frame: {
      ...site.frame,
      w: +Math.max(20, site.frame.w * f).toFixed(1),
      d: +Math.max(14, site.frame.d * f).toFixed(1),
    },
    scaled: 1,
  })
}

// ---- planner ui ----
function A_select(sel: Selection | null) {
  S().set((u) => {
    u.sel = sel
    u.msel = null
    if (sel) u.drawer = 'space'
  })
}
export const select = A_select
/** Several things grabbed at once — a marquee's haul. */
export const selectMany = (sels: Selection[]) =>
  S().set((u) => {
    u.msel = sels.length ? sels : null
    u.sel = null
  })
export const setDraftTool = (id: DraftTool) =>
  S().set((u) => {
    u.dtool = id
    u.ptool = null
  })
export const armTool = (tool: PlanTool | null) =>
  S().set((u) => {
    u.ptool = tool
    if (tool) u.dtool = 'select'
  })
export const setSuite = (id: string) =>
  S().set((u) => {
    u.psuite = id
    u.ptool = null
  })
export const setDrawer = (d: 'place' | 'space' | 'layers' | 'plans' | null) => S().set((u) => void (u.drawer = d))
export const toggleLayer = (id: string) =>
  S().set((u) => {
    const on = (u.layers as Record<string, boolean | undefined>)[id] !== false
    ;(u.layers as Record<string, boolean>)[id] = !on
  })
export const setUnits = (units: 'ft' | 'm') => S().set((u) => void (u.units = units))
export const setFinder = (f: null | 'looking' | 'done') => S().set((u) => void (u.finder = f))
export const setPendingUpload = (p: import('./types').PendingUpload | null) => S().set((u) => void (u.pendingUp = p))
export const setLogoCols = (cols: string[]) => S().set((u) => void (u.logoCols = cols))
export function addFloor(m: Model) {
  const next = m.maxLvl() + 1
  S().mutate((d, u) => {
    d.floors = next
    u.lvl = next
  })
}
export const setLevel = (lvl: number) => S().set((u) => void (u.lvl = lvl))
