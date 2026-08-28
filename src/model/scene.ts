// Scene model — everything here is in real metres.
// The 2D drafting surface and the 3D model both read these helpers, so a
// queue that does not fit a room does not fit in either view.

import type { GeoRoom, RoomDef, Transport } from './types'

// ---- units ----
export const FT = 0.3048
export const ft = (m: number) => m / FT
export const m = (feet: number) => feet * FT
/** Metres per pixel at a latitude and web-mercator zoom, 256 px tiles. */
export const mPerPx = (lat: number, zoom: number) =>
  (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)

// ---- real hotels ----
export interface Seed {
  w: number
  d: number
  kerb: number
  street: number
  kerbName?: string
  streetName?: string
  spaces: RoomDef[]
}
/** Bayfront's arrival level, from the hotel's own Floorplans & Capacities sheet. */
export const SEED: Record<string, Seed> = {
  'Hilton San Diego Bayfront': {
    w: 68,
    d: 51.5,
    kerb: 6.6,
    street: 8,
    kerbName: 'Porte Cochère · Park Blvd frontage',
    streetName: 'Park Boulevard',
    spaces: [
      { id: 'indigo', l: 'Indigo Ballroom', sub: '23,598 sq ft · 114 × 207 ft', x: 2.5, y: 2.5, w: 63.1, d: 34.7, tone: 'quiet' },
      { id: 'lobby', l: 'Main Lobby', sub: 'hotel entrance · front desk', x: 2.5, y: 39, w: 27.4, d: 10.5, tone: 'lit' },
      { id: 'lightwall', l: 'Indigo Light Wall', sub: 'registration area', x: 31.5, y: 39, w: 16, d: 10.5, tone: 'lit' },
      { id: 'westfoyer', l: 'Indigo West Foyer', sub: '9,774 sq ft pre-function', x: 49.1, y: 39, w: 10.4, d: 10.5, tone: 'quiet' },
      { id: 'lifts', l: 'Elevators', sub: 'to Aqua and Sapphire', x: 61.1, y: 39, w: 4.5, d: 10.5, tone: 'furn' },
    ],
  },
}

// ---- packing ----
export const PERSON = 0.5
export const SPACING = 0.72

export interface Pack {
  pts: { x: number; y: number; lane?: number }[]
  over: number
  cap: number
  lanes?: number
  per?: number
}

export function packRect(rect: GeoRoom, n: number, spacing = SPACING): Pack {
  const s = spacing
  const cols = Math.max(1, Math.floor((rect.w - 0.4) / s))
  const rows = Math.max(1, Math.floor((rect.d - 0.4) / s))
  const cap = cols * rows
  const out: Pack['pts'] = []
  const show = Math.min(n, cap)
  for (let i = 0; i < show; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    out.push({ x: rect.x + 0.4 + c * s, y: rect.y + 0.4 + r * s })
  }
  return { pts: out, over: Math.max(0, n - cap), cap }
}

/** A queue is a snake of lanes inside its space, so its length is physical. */
export function packQueue(rect: GeoRoom, n: number, spacing = SPACING): Required<Pack> {
  const s = spacing
  const per = Math.max(1, Math.floor((rect.w - 0.6) / s))
  const lanes = Math.max(1, Math.floor((rect.d - 0.6) / (s * 1.6)))
  const cap = per * lanes
  const out: Pack['pts'] = []
  for (let i = 0; i < Math.min(n, cap); i++) {
    const lane = Math.floor(i / per)
    const k = i % per
    const left = lane % 2 === 0
    out.push({ x: rect.x + 0.5 + (left ? k : per - 1 - k) * s, y: rect.y + 0.5 + lane * s * 1.6, lane })
  }
  return { pts: out, over: Math.max(0, n - cap), cap, lanes, per }
}

/** Line the front edge of a rect — greeters at a door, pick-ups along a kerb. */
export function packEdge(rect: GeoRoom, n: number, edge: 'top' | 'bottom' | 'left' | 'right', spacing = 1.1): Pack {
  const s = spacing
  const out: Pack['pts'] = []
  const alongLen = edge === 'left' || edge === 'right' ? rect.d : rect.w
  const fit = Math.max(1, Math.floor((alongLen - 0.6) / s))
  for (let i = 0; i < Math.min(n, fit); i++) {
    const t = 0.5 + (i % fit) * s
    out.push(
      edge === 'top'
        ? { x: rect.x + t, y: rect.y + 0.6 }
        : edge === 'bottom'
          ? { x: rect.x + t, y: rect.y + rect.d - 0.6 }
          : edge === 'left'
            ? { x: rect.x + 0.6, y: rect.y + t }
            : { x: rect.x + rect.w - 0.6, y: rect.y + t },
    )
  }
  return { pts: out, over: Math.max(0, n - fit), cap: fit }
}

// ---- vehicles ----
export const VEHICLE = {
  coach: { l: 13.7, w: 2.6 },
  shuttle: { l: 8.0, w: 2.4 },
  van: { l: 5.9, w: 2.1 },
  car: { l: 4.8, w: 1.9 },
} as const

export function vehicleBox(t: Pick<Transport, 'seats'> | null | undefined) {
  const seats = t?.seats || 0
  if (seats >= 40) return VEHICLE.coach
  if (seats >= 15) return VEHICLE.shuttle
  if (seats >= 6) return VEHICLE.van
  return VEHICLE.car
}

// ---- routes ----
export const WALK_SPEED = 1.25 // metres per second, crowd pace
export function pathLength(pts: { x: number; y: number }[]) {
  let d = 0
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return d
}
export const walkSeconds = (pts: { x: number; y: number }[]) => pathLength(pts) / WALK_SPEED
