import { beforeEach, describe, expect, it } from 'vitest'
import { initialPlan, useStore } from './store'

describe('store', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.getState().reset()
  })

  it('mutate is undoable, set is not', () => {
    const s = useStore.getState()
    s.mutate((d) => {
      d.event.name = 'Renamed'
    })
    s.set((d) => {
      d.surface = 'planner'
    })
    expect(useStore.getState().plan.event.name).toBe('Renamed')
    expect(useStore.getState().canUndo()).toBe(1)
    useStore.getState().undo()
    expect(useStore.getState().plan.event.name).toBe(initialPlan().event.name)
    // transient key untouched by undo
    expect(useStore.getState().plan.surface).toBe('planner')
  })

  it('a no-op producer does not push history', () => {
    useStore.getState().mutate(() => {})
    expect(useStore.getState().canUndo()).toBe(0)
  })
})
