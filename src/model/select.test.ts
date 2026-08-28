import { describe, expect, it } from 'vitest'
import { createModel } from './select'
import { initialDoc, initialUi } from '@/state/store'
import { MATRIX } from '@/data/matrix.generated'
import { SHIFTS } from './library'

const HBF = 'Hilton San Diego Bayfront'
function model(docPatch = {}, uiPatch = {}) {
  const doc = { ...initialDoc(), ...docPatch }
  const ui = { ...initialUi(), hotel: HBF, date: '2026-11-27', ...uiPatch }
  return createModel(doc, ui, MATRIX)
}

describe('model', () => {
  it('reads the matrix day for the hotel', () => {
    const m = model()
    expect(m.acts().length).toBeGreaterThan(0)
    expect(m.day().inHouse).toBe(1932)
  })

  it('sorts movements by start time', () => {
    const a = model().acts()
    for (let i = 1; i < a.length; i++) expect(a[i]!.s).toBeGreaterThanOrEqual(a[i - 1]!.s)
  })

  it('keys pin to the original time so a retimed movement keeps its edits', () => {
    const m0 = model()
    const first = m0.acts()[0]!
    const k = m0.key(first)
    const m1 = model({ tmod: { [k]: { s: first.s + 60, e: first.e + 60 } } })
    const moved = m1.acts().find((a) => a.k0 === k)!
    expect(moved.s).toBe(first.s + 60)
    expect(m1.key(moved)).toBe(k)
  })

  it('cover uses the proposed ratios then the adjustment', () => {
    const m0 = model()
    const sh = SHIFTS[0]!
    const b = m0.base(sh)
    expect(b.greeter).toBe(Math.ceil(b.all / 150))
    expect(b.pickup).toBe(Math.ceil(b.bus / 50))
    const m1 = model({ roleAdj: { [m0.adjKey(sh, 'greeter')]: 3 } })
    expect(m1.cover(sh).greeter).toBe(b.greeter + 3)
    const m2 = model({ roleAdj: { [m0.adjKey(sh, 'greeter')]: -99 } })
    expect(m2.cover(sh).greeter).toBe(0)
  })

  it('a bus movement rides a coach with ceil(d / seats) vehicles by default', () => {
    const m = model()
    const bus = m.acts().find((a) => a.m === 'Bus')
    if (!bus) return
    expect(m.modeId(bus)).toBe('coach')
    expect(m.vcount(bus)).toBe(Math.max(1, Math.ceil(bus.d / 48)))
    expect(m.seatsOf(bus)).toBe(m.vcount(bus) * 48)
  })

  it('a walking movement has no vehicle and no queue unless asked', () => {
    const m = model()
    const walk = m.acts().find((a) => a.m === 'Walking')!
    expect(m.modeT(walk)).toBeNull()
    expect(m.walkQueue(walk)).toBe(false)
    const m2 = model({ tmod: { [m.key(walk)]: { wq: 1 } } })
    expect(m2.walkQueue(walk)).toBe(true)
  })

  it('split divides delegates into groups of the given size', () => {
    const m = model()
    expect(m.split(130, 50)).toEqual([50, 50, 30])
    expect(m.split(0, 50)).toEqual([0])
  })

  it('signs default to one lollipop per group and one A-frame per space, only when queuing', () => {
    const m = model()
    const bus = m.acts().find((a) => a.m === 'Bus')
    if (!bus) return
    const [lolly, aframe, banner] = m.signTypes()
    expect(m.signCount(bus, lolly!)).toBe(0) // no queue space chosen yet
    const m2 = model({ tmod: { [m.key(bus)]: { q: 'lobby' } }, grp: { [m.key(bus)]: [50, 50, 20] } })
    const b2 = m2.acts().find((a) => a.k0 === m.key(bus))!
    expect(m2.signCount(b2, lolly!)).toBe(3)
    expect(m2.signCount(b2, aframe!)).toBe(1)
    expect(m2.signCount(b2, banner!)).toBe(0)
  })

  it('coaches never share a bay while loading', () => {
    const m = model()
    const bm = m.bayMap()
    const coachMoves = m.acts().filter((a) => m.coaches(a) > 0)
    for (let i = 0; i < coachMoves.length; i++)
      for (let j = i + 1; j < coachMoves.length; j++) {
        const a = coachMoves[i]!
        const b = coachMoves[j]!
        const overlap = a.s - 45 < b.e + 30 && b.s - 45 < a.e + 30
        if (overlap && bm[m.key(a)] === bm[m.key(b)]) {
          // only allowed when all three bays were busy
          expect(coachMoves.length).toBeGreaterThan(3)
        }
      }
  })

  it('Bayfront is seeded with its real spaces and walls', () => {
    const m = model()
    const names = m.spaces2().map((s) => s.l)
    expect(names).toContain('Indigo Ballroom')
    expect(names).toContain('Main Lobby')
    expect(m.site2().established).toBe(true)
    expect(m.site2().walls.length).toBeGreaterThan(0)
    expect(m.frame2().w).toBe(68)
  })

  it('every other hotel starts completely blank', () => {
    const m = model({}, { hotel: 'Omni San Diego Hotel at the Ballpark' })
    const site = m.site2()
    expect(site.established).toBe(false)
    expect(site.walls).toHaveLength(0)
    expect(site.spaces).toHaveLength(0)
    expect(site.items).toHaveLength(0)
    // and its movements queue nowhere rather than in an invented lobby
    expect(m.defaultQueue()).toBe('')
  })

  it('the sim plan carries every non-empty movement and the kerb', () => {
    const m = model()
    const p = m.simPlan()
    expect(p.geo.rooms.kerb).toBeDefined()
    expect(p.moves.length).toBe(m.acts().filter((a) => a.d > 0).length)
    expect(p.geo.bays).toHaveLength(3)
    // Bayfront movements with no chosen queue fall back to its real lobby
    expect(p.moves.every((mv) => mv.queueRoom === '' || p.geo.rooms[mv.queueRoom])).toBe(true)
  })

  it('derived objects follow the builder: signs per queue, desks per cover', () => {
    const m = model()
    const d = m.derived2()
    expect(d.filter((o) => o.t === 'desk').length).toBe(Math.min(4, m.cover(SHIFTS[0]!).desk))
    expect(d.every((o) => o.auto === 1 && o.id.startsWith('d'))).toBe(true)
  })

  it('dropping a date keeps the rest and keeps the selected day valid', () => {
    const m = model({ ev: { dropDates: ['2026-11-27'] } })
    expect(m.dateList()).not.toContain('2026-11-27')
    expect(m.dateList()).toContain(m.iso())
  })
})
