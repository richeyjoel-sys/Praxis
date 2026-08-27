import { beforeEach, describe, expect, it } from 'vitest'
import { load, save, STORAGE_KEY } from './persist'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips', () => {
    expect(save({ a: 1 })).toBe(true)
    expect(load<{ a: number }>()).toEqual({ a: 1 })
  })

  it('ignores a corrupt entry instead of throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(load()).toBeNull()
  })

  it('ignores a different schema version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, data: { a: 1 } }))
    expect(load()).toBeNull()
  })
})
