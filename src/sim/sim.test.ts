import { describe, expect, it } from 'vitest'
import { build, hash, slot } from './sim'
import type { SimPlan } from '@/model/types'

function plan(over: Partial<SimPlan['moves'][number]> = {}): SimPlan {
  return {
    geo: {
      rooms: { lobby: { x: 2, y: 30, w: 24, d: 10, headM: 1.6 } },
      buildW: 64,
      buildD: 42,
      kerbY: 43,
      kerbDepth: 7,
      streetY: 50.6,
      streetDepth: 9,
      bays: [11.5, 31.7, 51.8],
    },
    moves: [
      {
        key: 'k1',
        name: 'Field Service',
        hex: '#5d7342',
        s: 480,
        e: 660,
        dir: 'both',
        sizes: [96],
        rides: true,
        cap: 48,
        vcount: 2,
        vlen: 13.7,
        vwid: 2.6,
        vhex: '#c67139',
        vname: 'Coach',
        queueRoom: 'lobby',
        walkQueue: true,
        ...over,
      },
    ],
  }
}

describe('simulation', () => {
  it('is deterministic: the same T gives the same world', () => {
    const a = build(plan()).at(470)
    const b = build(plan()).at(470)
    expect(a).toEqual(b)
  })

  it('hash is stable and in [0, 1)', () => {
    expect(hash('k', 3)).toBe(hash('k', 3))
    for (let i = 0; i < 200; i++) {
      const h = hash('x', i)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    }
  })

  it('a coach movement splits into ceil(total / cap) coaches', () => {
    const sim = build(plan({ sizes: [100], cap: 48 }))
    expect(sim.moves[0]!.co).toHaveLength(3)
    expect(sim.moves[0]!.co.map((c) => c.size)).toEqual([48, 48, 4])
  })

  it('a coach departs at the time the planner set', () => {
    const sim = build(plan())
    expect(sim.moves[0]!.co[0]!.depart).toBe(480)
    // the second coach cannot leave before the first
    expect(sim.moves[0]!.co[1]!.depart).toBeGreaterThan(480)
  })

  it('nobody is on the plan long before or after the movement', () => {
    const sim = build(plan())
    expect(sim.at(300).people).toHaveLength(0)
    expect(sim.at(300).vehicles).toHaveLength(0)
    expect(sim.at(900).people).toHaveLength(0)
  })

  it('delegates queue before release and every queuer names the room', () => {
    const sim = build(plan())
    const w = sim.at(455)
    expect(w.counts.queuing).toBeGreaterThan(0)
    w.people.filter((p) => p.st === 'queuing').forEach((p) => expect(p.room).toBe('lobby'))
  })

  it('a coach is at the kerb while loading and counted', () => {
    const sim = build(plan())
    const w = sim.at(478)
    const loading = w.vehicles.filter((v) => v.state === 'loading' || v.state === 'at kerb')
    expect(loading.length).toBeGreaterThan(0)
    expect(w.counts.busesAtKerb).toBe(loading.length)
  })

  it('egress only: no coach returns at e', () => {
    const sim = build(plan({ dir: 'out' }))
    const w = sim.at(661)
    expect(w.vehicles.filter((v) => v.state === 'unloading' || v.state === 'returning')).toHaveLength(0)
  })

  it('out and back: coaches unload at e', () => {
    const sim = build(plan({ dir: 'both' }))
    const w = sim.at(661)
    expect(w.vehicles.some((v) => v.state === 'unloading')).toBe(true)
  })

  it('a walking party on foot never produces a vehicle', () => {
    const sim = build(plan({ rides: false, cap: 0, vcount: 0, vlen: 0, vwid: 0, sizes: [40, 40] }))
    for (let T = 400; T < 700; T += 7) expect(sim.at(T).vehicles).toHaveLength(0)
  })

  it('queue slots snake across lanes at 0.72 m', () => {
    const r = { x: 0, y: 0, w: 4.2, d: 10 }
    const a = slot(r, 0)
    const b = slot(r, 1)
    expect(b.x - a.x).toBeCloseTo(0.72)
    // lane 1 runs the other way
    const per = Math.floor((r.w - 0.6) / 0.72)
    const c = slot(r, per)
    expect(c.y).toBeGreaterThan(a.y)
    expect(c.x).toBeGreaterThan(a.x)
  })

  it('an empty movement contributes nothing', () => {
    const sim = build(plan({ sizes: [0] }))
    expect(sim.at(470).people).toHaveLength(0)
  })
})
