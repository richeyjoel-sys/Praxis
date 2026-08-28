// The one state tree, in two halves:
//   doc — everything the planner authored. Undoable, persisted.
//   ui  — where they are and what is open. Not undoable; a few keys persisted.
// Nothing derived is stored: see src/model/select.ts.

import type {
  DraftTool,
  Selection,
  SiteV2,
  Act,
  ActType,
  EventMeta,
  Hotel,
  HotelMeta,
  Layers,
  MoveMod,
  MoveVehicle,
  PlacedItem,
  PlanTool,
  PlanUnderlay,
  Role,
  RoomDef,
  SignType,
  Site,
  Transport,
  UploadedIcon,
} from '@/model/types'

export interface Doc {
  xActs: Record<string, Act[]> // custom movements, keyed `${hotel}|${iso}`
  veh: Record<string, unknown> // legacy; kept for forward compatibility of saved plans
  roleAdj: Record<string, number> // `${hotel}|${iso}|${shift}|${role}` → ±
  caps: Record<string, string> // captain names, same key
  xRoles: Role[]
  tports: Transport[]
  hidden: Record<string, true> // matrix groups taken off the day
  hmeta: Record<string, HotelMeta>
  xHotels: Hotel[]
  mv: Record<string, MoveVehicle> // transport per movement
  tmod: Record<string, MoveMod> // overrides per movement
  grp: Record<string, number[]> // group sizes per movement
  gsz: Record<string, number> // delegates-per-group per movement
  xRooms: RoomDef[]
  rname: Record<string, string> // room renames
  sites: Record<string, Site> // v1, kept only to migrate old saves
  sites2: Record<string, SiteV2> // keyed by hotel name — the planner rework model
  xActTypes: ActType[]
  atmeta: Record<string, Partial<ActType>> // overrides on built-in activity types
  signs: SignType[]
  rolemeta: Record<string, Partial<Role>>
  xIcons: UploadedIcon[]
  items: Record<string, PlacedItem[]> // keyed `${hotel}|${iso}`
  ev: EventMeta
  floors: number
}

export type View = 'builder' | 'planner' | 'report'
export type PlannerMode = 'plan' | 'live'
export type Drawer = 'place' | 'space' | 'layers' | 'plans' | null
export type StudioTab = 'act' | 'role' | 'tport' | 'sign'

export interface PendingUpload {
  name: string
  src: string | null
  note: string
  reading?: boolean
  failed?: boolean
}

export interface Ui {
  // persisted
  hotel: string | null // hotel name; null = home map
  date: string | null // ISO; null = first date
  shift: 'am' | 'mid' | 'pm'
  view: View
  pmode: PlannerMode
  units: 'ft' | 'm'
  layers: Partial<Layers>
  // transient
  mins: number
  playing: boolean
  speed: number
  openMoves: Record<string, boolean>
  stepShut: Record<string, boolean>
  studio: boolean
  studioTab: StudioTab
  setup: boolean
  hotelCard: { name: string; top: number } | null
  drawer: Drawer
  stage: 'build' | 'fill' | 'run' // the planner's one progression
  dtool: DraftTool
  ptool: PlanTool | null
  psuite: string
  lvl: number
  sel: Selection | null
  msel: Selection[] | null // several things grabbed at once (marquee)
  finder: null | 'looking' | 'done'
  pendingUp: PendingUpload | null
  logoCols: string[]
  restored: boolean
}

export interface Persisted {
  doc: Doc
  ui: Pick<Ui, 'hotel' | 'date' | 'shift' | 'view' | 'pmode' | 'units' | 'layers'>
}

export type { PlanUnderlay }
