// The one state tree. Zustand + immer.
//
//   mutate(producer)  — every user edit. Snapshots the undoable slice onto a
//                       24-deep stack first, so ⌘Z undoes anything.
//   set(producer)     — transient UI changes (which surface is open, zoom).
//                       Not undoable, still persisted.
//   undo() / redo()
//
// Persistence is debounced to localStorage; a corrupt entry is ignored.

import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import { debounce, load, save } from './persist'
import { emptyUndo, push, redo as redoStack, undo as undoStack, type UndoStack } from './undo'
import { UNDOABLE_KEYS, type PlanState, type UndoSlice } from './types'

export interface Store {
  plan: PlanState
  history: UndoStack<UndoSlice>
  mutate: (producer: (draft: Draft<PlanState>) => void) => void
  set: (producer: (draft: Draft<PlanState>) => void) => void
  undo: () => void
  redo: () => void
  canUndo: () => number
  reset: () => void
}

export function initialPlan(): PlanState {
  return {
    event: {
      name: 'IC26 San Diego',
      dates: [],
      logoDataUrl: null,
      palette: null,
    },
    surface: 'builder',
    plannerMode: 'plan',
    hotelId: '',
    date: '',
    shift: 'morning',
  }
}

function sliceOf(plan: PlanState): UndoSlice {
  const out = {} as UndoSlice
  for (const k of UNDOABLE_KEYS) (out as Record<string, unknown>)[k] = plan[k]
  return out
}

const persist = debounce((plan: PlanState) => save(plan), 400)

export const useStore = create<Store>((set, get) => ({
  plan: load<PlanState>() ?? initialPlan(),
  history: emptyUndo<UndoSlice>(),

  mutate: (producer) => {
    const { plan, history } = get()
    const next = produce(plan, producer)
    if (next === plan) return
    set({ plan: next, history: push(history, sliceOf(plan)) })
    persist(next)
  },

  set: (producer) => {
    const next = produce(get().plan, producer)
    set({ plan: next })
    persist(next)
  },

  undo: () => {
    const { plan, history } = get()
    const r = undoStack(history, sliceOf(plan))
    if (!r) return
    const next = { ...plan, ...r.state }
    set({ plan: next, history: r.stack })
    persist(next)
  },

  redo: () => {
    const { plan, history } = get()
    const r = redoStack(history, sliceOf(plan))
    if (!r) return
    const next = { ...plan, ...r.state }
    set({ plan: next, history: r.stack })
    persist(next)
  },

  canUndo: () => get().history.past.length,

  reset: () => {
    const next = initialPlan()
    set({ plan: next, history: emptyUndo() })
    persist.flush(next)
  },
}))

/** Convenience selector hook. */
export const usePlan = <T>(sel: (p: PlanState) => T): T => useStore((s) => sel(s.plan))
