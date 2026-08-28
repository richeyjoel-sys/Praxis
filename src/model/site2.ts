// Site model v2 — one flow: blank → underlay (+scale) → walls → place → live.
// Pure helpers: defaults, migration from the v1 rectangle model and the
// Bayfront seed, frame resolution, wall geometry.

import type { Site, SiteV2, SiteFrame, Wall, SpaceV2, ItemV2, PlacedItem } from './types'
import { SEED } from './scene'
import { BAYS } from './library'

export const DEFAULT_WALL_H = 3.15
export const WALL_T = 0.24

export function blankSite(): SiteV2 {
  return {
    v: 2,
    established: false,
    underlay: null,
    map: null,
    walls: [],
    wallH: DEFAULT_WALL_H,
    spaces: [],
    items: [],
    frame: { w: 64, d: 42, kerb: 7, street: 9 },
  }
}

/** The outline of a rectangle as wall runs, with a door gap on the front (+z) face. */
export function rectWalls(idBase: string, x: number, y: number, w: number, d: number): Wall[] {
  const gap = Math.min(2.2, w * 0.28)
  const dx0 = x + (w - gap) / 2
  const dx1 = dx0 + gap
  return [
    // back + both sides, one run: bottom-left → top-left → top-right → bottom-right
    { id: idBase + 'a', pts: [[x, y + d], [x, y], [x + w, y], [x + w, y + d]] },
    // front wall in two pieces around the door
    { id: idBase + 'b', pts: [[x, y + d], [dx0, y + d]] },
    { id: idBase + 'c', pts: [[dx1, y + d], [x + w, y + d]] },
  ]
}

/** Migrate a v1 site (rect rooms) or the Bayfront seed into v2. */
export function migrateSite(hotelName: string, v1: Site | undefined): SiteV2 {
  const seed = SEED[hotelName]
  // a v1 site the user actually established
  if (v1?.established && v1.rooms && Object.keys(v1.rooms).length) {
    const walls: Wall[] = []
    const spaces: SpaceV2[] = []
    Object.entries(v1.rooms).forEach(([id, r], i) => {
      if (r.x == null || r.y == null || !r.w || !r.d) return
      walls.push(...rectWalls('mw' + i, r.x, r.y, r.w, r.d))
      spaces.push({ id, l: id, x: r.x, y: r.y, w: r.w, d: r.d, lvl: r.lvl || 0 })
    })
    return {
      ...blankSite(),
      established: true,
      underlay: v1.plan || null,
      walls,
      spaces,
      frame: { w: v1.w, d: v1.d, kerb: v1.kerb, street: v1.street },
    }
  }
  if (seed) {
    const walls: Wall[] = []
    const spaces: SpaceV2[] = []
    seed.spaces.forEach((r, i) => {
      if (r.x == null || r.y == null || !r.w || !r.d) return
      walls.push(...rectWalls('sw' + i, r.x, r.y, r.w, r.d))
      spaces.push({ id: r.id, l: r.l, x: r.x, y: r.y, w: r.w, d: r.d, lvl: 0 })
    })
    return {
      ...blankSite(),
      established: true,
      walls,
      spaces,
      frame: { w: seed.w, d: seed.d, kerb: seed.kerb, street: seed.street },
    }
  }
  return blankSite()
}

/** The frame grown to hold everything drawn, so nothing ever falls off the ground. */
export function resolveFrame(site: SiteV2): SiteFrame {
  let { w, d } = site.frame
  const pad = 2
  site.walls.forEach((wl) =>
    wl.pts.forEach(([x, z]) => {
      w = Math.max(w, x + pad)
      d = Math.max(d, z + pad)
    }),
  )
  site.spaces.forEach((s) => {
    w = Math.max(w, s.x + s.w + pad)
    d = Math.max(d, s.y + s.d + pad)
  })
  return { ...site.frame, w, d }
}

/** Coach bay centre positions across the frame width. */
export function bayXs(frame: SiteFrame): number[] {
  return BAYS.map((b) => (b.x / 100) * frame.w)
}

/** Convert a legacy per-day placed item (room-relative) to a world item. */
export function migrateItem(it: PlacedItem, spaces: SpaceV2[]): ItemV2 | null {
  if (it.room) {
    const r = spaces.find((s) => s.id === it.room)
    if (!r) return null
    return {
      id: it.id,
      kind: it.kind,
      t: it.t,
      l: it.l,
      x: r.x + ((it.x ?? 50) / 100) * r.w,
      z: r.y + ((it.y ?? 50) / 100) * r.d,
      rot: it.rot || 0,
      hex: it.hex,
    }
  }
  if (it.x == null || it.y == null) return null
  return { id: it.id, kind: it.kind, t: it.t, l: it.l, x: it.x, z: it.y, rot: it.rot || 0, hex: it.hex }
}

export function wallLength(w: Wall): number {
  let t = 0
  for (let i = 1; i < w.pts.length; i++) {
    const a = w.pts[i - 1]!
    const b = w.pts[i]!
    t += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return t
}

/** Distance from a point to a wall's nearest segment, for hit-testing. */
export function distToWall(w: Wall, x: number, z: number): number {
  let best = Infinity
  for (let i = 1; i < w.pts.length; i++) {
    const [ax, az] = w.pts[i - 1]!
    const [bx, bz] = w.pts[i]!
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz || 1e-9
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2))
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)))
  }
  return best
}
