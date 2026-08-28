// Praxis domain types — the shape of everything the planner authors and
// everything the data module supplies. Metres everywhere; minutes since
// midnight for times; hex strings for colours.

// ---- matrix data (generated from the Mucho Matrix workbook) ----

export interface Hotel {
  code: string // 'HBF'
  name: string // 'Hilton San Diego Bayfront' — the key everywhere
  short: string
  addr?: string
  delegates: number
  custom?: boolean // added by the user, not from the matrix
}

export type Mode = 'Bus' | 'Walking'

/** One movement group from the matrix (or a custom one the user added). */
export interface Act {
  c: string // activity type code: CNV, EG, FS, … or a user type id
  n: string // name
  g: string // glyph fallback
  s: number // start, minutes since midnight
  e: number // end
  m: Mode
  d: number // delegates
  gr: number // row count in the matrix (group count)
  bo?: number
  bb?: number
  id?: string // only custom movements carry an id
  custom?: boolean
  dir?: Dir
  q?: string // queuing space id
  icon?: string
}

export interface DayData {
  acts: Act[]
  inHouse: number
}

export interface Matrix {
  dates: string[] // ISO
  hotels: Hotel[]
  byKey: Record<string, DayData> // `${hotel.name}|${iso}`
}

// ---- libraries (global, shared by all hotels) ----

export interface ActType {
  c: string
  l: string
  icon: string
  d?: string // svg path, resolved from icon
  hex: string
  tint: string
  mine?: boolean
}

export interface Role {
  id: string
  l: string
  g: string
  icon: string
  hex: string
  custom?: boolean
}

export interface Transport {
  id: string
  l: string
  g: string
  icon: string
  hex: string
  seats: number
  custom?: boolean
}

export type SignPer = 'group' | 'space' | 'none'
export interface SignType {
  id: string
  l: string
  icon: string
  hex: string
  per: SignPer
  custom?: boolean
}

export interface UploadedIcon {
  id: string
  l: string
  src: string // data URL
}

// ---- per-movement overrides ----

export type Dir = 'out' | 'both' | 'in'

/** Overrides keyed by movement key: time, direction, name, icon, queue, signs, walk-queue. */
export interface MoveMod {
  s?: number
  e?: number
  dir?: Dir
  nm?: string
  icon?: string
  q?: string
  sg?: Record<string, number>
  wq?: 0 | 1
}

/** Transport choice per movement: type id ('walk' for on foot) and vehicle count. */
export interface MoveVehicle {
  t: string
  n: number | null
}

// ---- site / plan geometry ----

export interface RoomGeom {
  x?: number
  y?: number
  w?: number
  d?: number
  lvl?: number
  rot?: number
}

export interface PlanUnderlay {
  src: string // data:image/…
  name?: string
  wM?: number
  hM?: number
  ar?: number
  ox?: number
  oy?: number
  calibrated?: boolean
  // legacy shape from an older incorporate flow
  w?: number
  h?: number
  x?: number
  y?: number
}

export interface Site {
  w: number
  d: number
  kerb: number
  street: number
  rooms?: Record<string, RoomGeom>
  plan?: PlanUnderlay | null
  established?: boolean
  seeded?: boolean
  tracedFrom?: 'map' | 'plan' | 'measured'
  bays?: number
}

export type RoomTone = 'quiet' | 'lit' | 'furn' | 'kerb' | 'street'
export interface RoomDef {
  id: string
  l: string
  sub: string
  tone: RoomTone
  x?: number
  y?: number
  w?: number
  d?: number
  custom?: boolean
}

/** A room with resolved geometry (metres). */
export interface Room extends RoomDef {
  x: number
  y: number
  w: number
  d: number
}

export type ItemKind = 'furn' | 'sign' | 'people' | 'veh'
export interface PlacedItem {
  id: string
  kind: ItemKind
  t: string
  l: string
  room: string | null // null = open ground, x/y in metres
  x: number
  y: number
  rot?: number
  hex?: string | null
  auto?: 0 | 1 // 1 = derived from the builder, not user-owned
  g?: string
}

// ---- hotel metadata ----
export interface HotelMeta {
  short?: string
  address?: string
  addr?: string
  contact?: string
  phone?: string
  rooms?: string
  distance?: string
  kerb?: string
  parking?: string
  notes?: string
  photo?: string
}

// ---- event ----
export interface EventMeta {
  name?: string
  logo?: string
  logoName?: string
  theme?: { a: string; b: string }
  addDates?: string[]
  dropDates?: string[]
}

// ---- the simulation contract ----

export interface GeoRoom {
  x: number
  y: number
  w: number
  d: number
  headM?: number
}
export interface SimGeo {
  rooms: Record<string, GeoRoom>
  buildW: number
  buildD: number
  kerbY: number
  kerbDepth: number
  streetY: number
  streetDepth: number
  bays: number[]
}
export interface SimMove {
  key: string
  name: string
  hex: string
  s: number
  e: number
  dir: Dir
  sizes: number[]
  rides: boolean
  cap: number
  vcount: number
  vlen: number
  vwid: number
  vhex: string
  vname: string
  queueRoom: string
  walkQueue: boolean
}
export interface SimPlan {
  geo: SimGeo
  moves: SimMove[]
}

export type PersonState =
  | 'entering'
  | 'queuing'
  | 'walking to the kerb'
  | 'waiting to board'
  | 'walking out'
  | 'walking in from the coach'
export interface SimPerson {
  x: number
  y: number
  hex: string
  mv: string
  st: PersonState
  grp: number
  room?: string
  rel?: number
  eta?: number
}
export type VehicleState =
  | 'approaching'
  | 'at kerb'
  | 'loading'
  | 'departing'
  | 'returning'
  | 'unloading'
export interface SimVehicle {
  x: number
  y: number
  l: number
  w: number
  hex: string
  label: string
  occ: number
  cap: number
  state: VehicleState
}
export interface SimCounts {
  queuing: number
  walking: number
  kerb: number
  boarding: number
  aboard: number
  busesAtKerb: number
  arriving: number
}
export interface World {
  people: SimPerson[]
  vehicles: SimVehicle[]
  counts: SimCounts
}

// ---- the scene contract between the app and the two view surfaces ----
// This is what the prototype exposed as window.__praxisScene(); the Plan
// surface and the Go live model read it every frame and write back through
// the callbacks. Nothing about the view lives in app state.

export interface PlanTool {
  kind: ItemKind
  t: string
  l: string
  g: string
  sub?: string
}
export interface PlanHit {
  title: string
  kind: string
  src: string
  where?: string
  year?: string
  note?: string
  rooms?: string[]
}
export interface HotelGeo {
  lat: number
  lon: number
  exact: boolean
}
export type Layers = Record<'delegates' | 'volunteers' | 'vehicles' | 'queues' | 'zones' | 'labels', boolean>
// ══════════════════════════════════════════════════════════════════════════
// Site model v2 — the planner rework (Aug 2026).
// One flow: blank → underlay (+scale) → walls → place → live.
// Everything is in world metres on the ground plane; z runs toward the kerb.
// ══════════════════════════════════════════════════════════════════════════

/** A run of wall drawn with the wall tool: a polyline of [x, z] vertices. */
export interface Wall {
  id: string
  pts: [number, number][]
}

/** A drawn road: a centreline polyline with a width — bends, side streets,
 *  staging loops. The frame's base street stays underneath as the arrival road. */
export interface Road {
  id: string
  pts: [number, number][]
  w: number // metres
}

/** A named region the simulation can queue in — drawn, not implied. */
export interface SpaceV2 {
  id: string
  l: string
  x: number
  y: number // z, metres
  w: number
  d: number
  lvl?: number
}

/** An object placed on the site, at real world coordinates. */
export interface ItemV2 {
  id: string
  kind: ItemKind
  t: string
  l: string
  x: number
  z: number
  rot?: number
  lvl?: number
  hex?: string | null
  auto?: 0 | 1 // 1 = derived from the builder, not user-owned
}

/** A pulled OSM composite, georeferenced so tracing over it is to scale. */
export interface MapPull {
  src: string
  mpp: number // metres per pixel
  px: number // where the hotel sits inside the composite, pixels
  py: number
  w: number
  h: number
}

export interface SiteFrame {
  w: number // ground width shown
  d: number // building ground depth (kerb starts at z = d)
  kerb: number
  street: number
}

export interface SiteV2 {
  v: 2
  established: boolean
  underlay: PlanUnderlay | null
  map: MapPull | null
  walls: Wall[]
  wallH: number // metres — the "how tall are the walls" answer
  roads: Road[]
  spaces: SpaceV2[]
  items: ItemV2[]
  frame: SiteFrame
  scaled?: 1 // the planner set a real scale (calibrated, or from the georeferenced map)
}

export type DraftTool = 'select' | 'wall' | 'road' | 'space' | 'cal'
export interface Selection {
  kind: 'item' | 'wall' | 'road' | 'space'
  id: string
}

/** The scene the two planner surfaces read every frame (v2). */
export interface SceneV2 {
  mode: 'draft' | 'live'
  site: SiteV2
  frame: SiteFrame // resolved: grown to hold the walls
  mins: number
  hotelName: string
  cover: Record<string, number>
  roleHex: Record<string, string>
  plan: SimPlan
  derived: ItemV2[] // what the builder decided, world-positioned
  spaceNames: Record<string, string>
  layers: Layers
  units: 'ft' | 'm'
  tool: DraftTool
  place: PlanTool | null // armed object, wins over tool
  sel: Selection | null
  level: number
  hotelGeo: HotelGeo | null
  // callbacks — every one dispatches a named action
  onSelect: (sel: Selection | null) => void
  onMoveItem: (id: string, x: number, z: number) => void
  onRotateItem: (id: string, d: number) => void
  onDuplicateItem: (id: string) => void
  onPatchWall: (id: string, pts: [number, number][]) => void
  onAddWall: (pts: [number, number][]) => void
  onAddRoad: (pts: [number, number][]) => void
  onPatchRoad: (id: string, p: { pts?: [number, number][]; w?: number }) => void
  onAddSpace: (r: { x: number; y: number; w: number; d: number }) => void
  onPatchSpace: (id: string, p: Partial<SpaceV2>) => void
  onRenameSpace: (id: string, l: string) => void
  onDeleteSel: () => void
  onPlace: (tool: PlanTool, x: number, z: number) => void
  onPlaced: () => void
  onCalibrate: (p: { factor: number; anchorX: number; anchorZ: number }) => void
  onOwn: (id: string) => void // adopt a derived object
  onMap: (m: MapPull) => void // a pulled map becomes part of the site
}
