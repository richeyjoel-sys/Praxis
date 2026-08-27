import { describe, expect, it } from 'vitest'
import { emptyUndo, push, redo, undo } from './undo'

describe('undo stack', () => {
  it('undoes in reverse order and redoes forward', () => {
    let stack = emptyUndo<number>()
    stack = push(stack, 1)
    stack = push(stack, 2)
    const u1 = undo(stack, 3)!
    expect(u1.state).toBe(2)
    const u2 = undo(u1.stack, u1.state)!
    expect(u2.state).toBe(1)
    expect(undo(u2.stack, u2.state)).toBeNull()
    const r = redo(u2.stack, u2.state)!
    expect(r.state).toBe(2)
  })

  it('caps depth', () => {
    let stack = emptyUndo<number>()
    for (let i = 0; i < 40; i++) stack = push(stack, i, 24)
    expect(stack.past).toHaveLength(24)
    expect(stack.past[0]).toBe(16)
  })

  it('a new edit clears the redo branch', () => {
    let stack = push(emptyUndo<number>(), 1)
    const u = undo(stack, 2)!
    stack = push(u.stack, u.state)
    expect(stack.future).toEqual([])
  })
})
