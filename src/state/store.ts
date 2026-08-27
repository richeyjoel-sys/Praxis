// The one store. Zustand + immer.
//
//   mutate(producer)  — every user edit to the doc. Snapshots the doc onto a
//                       24-deep stack first, so ⌘Z undoes anything.
//   set(producer)     — transient UI changes. Not undoable, partly persisted.
//   undo() / redo()
//
// Persistence is debounced to localStorage; a corrupt entry is ignored.

import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import { debounce, load, save } from './persist'
import { emptyUndo, push, redo as redoStack, undo as undoStack, type UndoStack } from './undo'
import type { Doc, Persisted, Ui } from './types'
import { DEF_SIGNS, DEF_TPORTS } from '@/model/library'

export interface Store {
  doc: Doc
  ui: Ui
  history: UndoStack<Doc>
  mutate: (producer: (doc: Draft<Doc>, ui: Draft<Ui>) => void) => void
  set: (producer: (ui: Draft<Ui>) => void) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

export function initialDoc(): Doc {
  return {
    xActs: {},
    veh: {},
    roleAdj: {},
    caps: {},
    xRoles: [],
    tports: DEF_TPORTS,
    hidden: {},
    hmeta: {},
    xHotels: [],
    mv: {},
    tmod: {},
    grp: {},
    gsz: {},
    xRooms: [],
    rname: {},
    sites: {},
    xActTypes: [],
    atmeta: {},
    signs: DEF_SIGNS,
    rolemeta: {},
    xIcons: [],
    items: {},
    ev: {},
    floors: 0,
  }
}

export function initialUi(): Ui {
  return {
    hotel: null,
    date: null,
    shift: 'am',
    view: 'builder',
    pmode: 'live',
    units: 'ft',
    layers: {},
    mins: 480,
    playing: false,
    speed: 60,
    openMoves: {},
    stepShut: {},
    studio: false,
    studioTab: 'act',
    setup: false,
    hotelCard: null,
    drawer: 'place',
    ptl: 'select',
    ptool: null,
    psuite: 'furn',
    lvl: 0,
    sitePick: null,
    ipick: null,
    finder: null,
    pendingUp: null,
    logoCols: [],
    restored: false,
  }
}

function hydrate(): { doc: Doc; ui: Ui } {
  const saved = load<Persisted>()
  if (!saved || !saved.doc) return { doc: initialDoc(), ui: initialUi() }
  const doc: Doc = { ...initialDoc(), ...saved.doc }
  if (!doc.tports?.length) doc.tports = DEF_TPORTS
  if (!doc.signs?.length) doc.signs = DEF_SIGNS
  const ui: Ui = { ...initialUi(), ...(saved.ui || {}), restored: true }
  return { doc, ui }
}

function persistable(doc: Doc, ui: Ui): Persisted {
  const { hotel, date, shift, view, pmode, units, layers } = ui
  return { doc, ui: { hotel, date, shift, view, pmode, units, layers } }
}

const persist = debounce((doc: Doc, ui: Ui) => save(persistable(doc, ui)), 350)

export const useStore = create<Store>((set, get) => ({
  ...hydrate(),
  history: emptyUndo<Doc>(),

  mutate: (producer) => {
    const { doc, ui, history } = get()
    let nextUi = ui
    const nextDoc = produce(doc, (d) => {
      nextUi = produce(ui, (u) => {
        producer(d, u)
      })
    })
    if (nextDoc === doc && nextUi === ui) return
    set({
      doc: nextDoc,
      ui: nextUi,
      history: nextDoc === doc ? history : push(history, doc),
    })
    persist(nextDoc, nextUi)
  },

  set: (producer) => {
    const { doc, ui } = get()
    const next = produce(ui, producer)
    if (next === ui) return
    set({ ui: next })
    persist(doc, next)
  },

  undo: () => {
    const { doc, ui, history } = get()
    const r = undoStack(history, doc)
    if (!r) return
    set({ doc: r.state, history: r.stack, ui: { ...ui, hotelCard: null } })
    persist(r.state, ui)
  },

  redo: () => {
    const { doc, ui, history } = get()
    const r = redoStack(history, doc)
    if (!r) return
    set({ doc: r.state, history: r.stack })
    persist(r.state, ui)
  },

  reset: () => {
    const doc = initialDoc()
    const ui = initialUi()
    set({ doc, ui, history: emptyUndo() })
    persist.flush(doc, ui)
  },
}))

export const useDoc = <T>(sel: (d: Doc) => T): T => useStore((s) => sel(s.doc))
export const useUi = <T>(sel: (u: Ui) => T): T => useStore((s) => sel(s.ui))
