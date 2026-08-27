// Praxis state tree.
// STUB — the full ~45-key shape is ported from Praxis.dc.html once the
// prototype is staged. Only the surface-level keys the app shell needs live
// here now; every key below is expected to survive the port.

export type Surface = 'builder' | 'planner'
export type PlannerMode = 'plan' | 'live'
export type ShiftId = 'morning' | 'midday' | 'evening'

export interface EventMeta {
  name: string
  dates: string[] // ISO dates, ordered
  logoDataUrl: string | null
  palette: { primary: string; accent: string } | null
}

export interface PlanState {
  event: EventMeta
  surface: Surface
  plannerMode: PlannerMode
  hotelId: string
  date: string
  shift: ShiftId // the ONE shift selector in the whole app
}

/** Keys snapshotted for undo. Transient UI keys (surface, mode) are excluded. */
export const UNDOABLE_KEYS = ['event'] as const satisfies readonly (keyof PlanState)[]
export type UndoSlice = Pick<PlanState, (typeof UNDOABLE_KEYS)[number]>
