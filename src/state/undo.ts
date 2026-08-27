// Undo stack — pure, no React, no DOM.
// Every user edit goes through mutate(); the stack holds snapshots of the
// undoable slice of state (the prototype snapshots 22 keys, 24 deep).

export const UNDO_DEPTH = 24

export interface UndoStack<S> {
  past: S[]
  future: S[]
}

export function emptyUndo<S>(): UndoStack<S> {
  return { past: [], future: [] }
}

/** Record `snapshot` as the state before an edit. Drops the redo branch. */
export function push<S>(stack: UndoStack<S>, snapshot: S, depth = UNDO_DEPTH): UndoStack<S> {
  const past = [...stack.past, snapshot]
  if (past.length > depth) past.splice(0, past.length - depth)
  return { past, future: [] }
}

/** Pop the last snapshot; `current` moves to the redo branch. */
export function undo<S>(stack: UndoStack<S>, current: S): { stack: UndoStack<S>; state: S } | null {
  const prev = stack.past.at(-1)
  if (prev === undefined) return null
  return {
    stack: { past: stack.past.slice(0, -1), future: [current, ...stack.future] },
    state: prev,
  }
}

export function redo<S>(stack: UndoStack<S>, current: S): { stack: UndoStack<S>; state: S } | null {
  const next = stack.future[0]
  if (next === undefined) return null
  return {
    stack: { past: [...stack.past, current], future: stack.future.slice(1) },
    state: next,
  }
}
