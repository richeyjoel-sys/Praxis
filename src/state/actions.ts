// Every user edit, as a named action over the store. Each one goes through
// mutate() (undoable) or set() (transient). Components call these; they never
// write to the store directly.

import { useStore } from './store'
import type { Model } from '@/model/select'
import type { Shift } from '@/model/library'
import { ICON_BY, SWATCH } from '@/model/library'
import type { Act, Dir, PlacedItem, PlanTool, RoomGeom, Site, SignType, Transport, Role, ActType, HotelMeta, EventMeta } from '@/model/types'
import { uid } from '@/lib/ids'

const S = () => useStore.getState()

// ---- navigation ----
export const goHome = () => S().set((u) => void (u.hotel = null))
export const goHotel = (name: string) => S().set((u) => void (u.hotel = name))
export const setDate = (iso: string) => S().set((u) => void (u.date = iso))
export const setView = (view: 'builder' | 'planner') => S().set((u) => void (u.view = view))
export const setPmode = (pmode: 'plan' | 'live') =>
  S().set((u) => {
    u.pmode = pmode
    u.ptool = null
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

// ---- site & rooms ----
export function patchSite(m: Model, p: Partial<Site>) {
  const nm = m.hotelName()
  const cur = m.site()
  S().mutate((d) => {
    d.sites[nm] = { ...(d.sites[nm] || {}), w: cur.w, d: cur.d, kerb: cur.kerb, street: cur.street, seeded: true, ...p }
  })
}
export function patchRoom(m: Model, id: string, p: RoomGeom) {
  const site = m.site()
  const cur = site.rooms || {}
  if (p.w != null) p = { ...p, w: Math.max(2, p.w) }
  if (p.d != null) p = { ...p, d: Math.max(2, p.d) }
  patchSite(m, { rooms: { ...cur, [id]: { ...(cur[id] || {}), ...p } } })
}
export function addRoom(m: Model, forMove?: Act) {
  const id = uid('z')
  S().mutate((d) => {
    d.xRooms.push({ id, l: 'New space', sub: '', tone: 'quiet', custom: true })
  })
  if (forMove) patchMove(m, forMove, { q: id })
  return id
}
export const renameRoom = (id: string, l: string) => S().mutate((d) => void (d.rname[id] = l))
export function removeRoom(id: string) {
  S().mutate((d, u) => {
    d.xRooms = d.xRooms.filter((r) => r.id !== id)
    d.hidden['room:' + id] = true
    u.sitePick = null
  })
}
export function addFloor(m: Model) {
  const next = m.maxLvl() + 1
  S().mutate((d, u) => {
    d.floors = next
    u.lvl = next
  })
}
export const setLevel = (lvl: number) => S().set((u) => void (u.lvl = lvl))

// ---- placed objects ----
export function placeItem(m: Model, tool: PlanTool, room: string | null, x: number, y: number) {
  const k = m.actKey()
  const id = uid('i')
  const it: PlacedItem = { id, kind: tool.kind, t: tool.t, l: tool.l, room, x, y, hex: tool.kind === 'veh' ? '#5b6470' : null }
  S().mutate((d, u) => {
    ;(d.items[k] = d.items[k] || []).push(it)
    u.ipick = id
  })
}
export function patchItem(m: Model, id: string, p: Partial<PlacedItem>) {
  const k = m.actKey()
  S().mutate((d) => {
    const it = (d.items[k] || []).find((x) => x.id === id)
    if (it) Object.assign(it, p)
  })
}
export function removeItem(m: Model, id: string) {
  const k = m.actKey()
  S().mutate((d, u) => {
    d.items[k] = (d.items[k] || []).filter((x) => x.id !== id)
    if (u.ipick === id) u.ipick = null
  })
}
export function duplicateItem(m: Model, id: string) {
  const it = m.itemsOf().find((x) => x.id === id)
  if (!it) return
  const k = m.actKey()
  const nid = uid('i')
  const copy: PlacedItem = { ...it, id: nid, x: (it.x || 0) + (it.room ? 6 : 2), y: it.y }
  S().mutate((d, u) => {
    ;(d.items[k] = d.items[k] || []).push(copy)
    u.ipick = nid
  })
}
export function rotateItem(m: Model, id: string, delta: number) {
  const it = m.itemsOf().find((x) => x.id === id)
  if (it) patchItem(m, id, { rot: ((it.rot || 0) + delta + 360) % 360 })
}
/** The builder's derived objects become real objects you can move and delete. */
export function importDerived(m: Model) {
  const der = m.derived()
  if (!der.length) return
  const k = m.actKey()
  const made = der.map((d) => ({ ...d, auto: 0 as const, id: uid('i') }))
  S().mutate((d, u) => {
    d.items[k] = [...(d.items[k] || []), ...made]
    u.drawer = 'space'
  })
}
export function ownDerived(m: Model, id: string) {
  const d0 = m.derived().find((o) => o.id === id)
  if (!d0) return
  const k = m.actKey()
  const it: PlacedItem = { ...d0, auto: 0, id: uid('i') }
  S().mutate((d, u) => {
    ;(d.items[k] = d.items[k] || []).push(it)
    u.ipick = it.id
  })
}

// ---- plan tools ----
export const setPlanTool = (id: 'select' | 'trace' | 'cal') =>
  S().set((u) => {
    u.ptl = u.ptl === id ? 'select' : id
    u.ptool = null
  })
export const armTool = (tool: PlanTool | null) => S().set((u) => void (u.ptool = tool))
export const setSuite = (id: string) =>
  S().set((u) => {
    u.psuite = id
    u.ptool = null
  })
export const setDrawer = (d: 'place' | 'space' | 'layers' | 'plans' | null) => S().set((u) => void (u.drawer = d))
export const pickSite = (id: string | null) =>
  S().set((u) => {
    u.sitePick = id
    u.ipick = null
    if (id) u.drawer = 'space'
  })
export const pickItem = (id: string | null) =>
  S().set((u) => {
    u.ipick = id
    u.sitePick = null
    if (id) u.drawer = 'space'
  })
export const toggleLayer = (id: string) =>
  S().set((u) => {
    const on = (u.layers as Record<string, boolean | undefined>)[id] !== false
    ;(u.layers as Record<string, boolean>)[id] = !on
  })
export const setUnits = (units: 'ft' | 'm') => S().set((u) => void (u.units = units))
export const setFinder = (f: null | 'looking' | 'done') => S().set((u) => void (u.finder = f))
export const setPendingUpload = (p: import('./types').PendingUpload | null) => S().set((u) => void (u.pendingUp = p))
export const setLogoCols = (cols: string[]) => S().set((u) => void (u.logoCols = cols))
