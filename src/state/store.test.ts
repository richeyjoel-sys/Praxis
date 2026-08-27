import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'

describe('store', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.getState().reset()
  })

  it('mutate is undoable, set is not', () => {
    const s = useStore.getState()
    s.mutate((d) => {
      d.ev.name = 'Renamed'
    })
    s.set((u) => {
      u.view = 'planner'
    })
    expect(useStore.getState().doc.ev.name).toBe('Renamed')
    expect(useStore.getState().history.past).toHaveLength(1)
    useStore.getState().undo()
    expect(useStore.getState().doc.ev.name).toBeUndefined()
    expect(useStore.getState().ui.view).toBe('planner')
  })

  it('a no-op producer does not push history', () => {
    useStore.getState().mutate(() => {})
    expect(useStore.getState().history.past).toHaveLength(0)
  })

  it('mutate can also touch ui without making the ui change undoable', () => {
    useStore.getState().mutate((d, u) => {
      d.floors = 1
      u.lvl = 1
    })
    useStore.getState().undo()
    expect(useStore.getState().doc.floors).toBe(0)
    expect(useStore.getState().ui.lvl).toBe(1)
  })

  it('redo restores an undone edit', () => {
    useStore.getState().mutate((d) => void (d.floors = 3))
    useStore.getState().undo()
    useStore.getState().redo()
    expect(useStore.getState().doc.floors).toBe(3)
  })
})
