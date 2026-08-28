// The libraries every hotel shares: shifts, the three fixed roles, the eight
// matrix activity types, default transport and signage, the drawn icon set,
// palettes, and the object suites you can place on a plan.

import type { ActType, Role, SignType, Transport, PlanTool, ItemKind } from './types'

export interface Shift {
  id: 'am' | 'mid' | 'pm'
  l: string
  g: string
  from: number
  to: number
}
export const SHIFTS: Shift[] = [
  { id: 'am', l: 'Morning', g: '☀', from: 360, to: 720 },
  { id: 'mid', l: 'Mid-day', g: '◐', from: 720, to: 1020 },
  { id: 'pm', l: 'Evening', g: '☾', from: 1020, to: 1350 },
]
export const DAY_START = 360
export const DAY_END = 1350

export const ROLES: Role[] = [
  { id: 'greeter', l: 'Greeters', g: '●', icon: 'greeter', hex: '#0f8f86' },
  { id: 'pickup', l: 'Pick-Ups', g: '▲', icon: 'pickup', hex: '#c67139' },
  { id: 'desk', l: 'Welcome / Help Desk', g: '■', icon: 'desk', hex: '#2f4bd8' },
]
export const SEATS = 48

/** One colour and one icon per activity type — the colour is the movement's identity everywhere. */
export const ACT: Record<string, Omit<ActType, 'c'>> = {
  CNV: { l: 'Convention Session', icon: 'mic', d: 'M4 19h16M6 15h12M8 11h8M12 4v3', hex: '#3f5c8a', tint: '#e7ecf5' },
  EG: { l: 'Encouraging Gathering', icon: 'users', d: 'M4 5h16v10H9l-5 4zM9 10h6', hex: '#7a4a6b', tint: '#f2e9ef' },
  FS: { l: 'Field Service', icon: 'book', d: 'M7 3h10v18H7zM14 11.2v1.6', hex: '#5d7342', tint: '#eaefe2' },
  LEO: { l: 'Leoness Temecula Winery', icon: 'wine', d: 'M8 4h8l-1 5a3 3 0 0 1-6 0zM12 14v6M9 20h6', hex: '#8c3a52', tint: '#f6e6ea' },
  FFL: { l: 'Friends for Life', icon: 'heart', d: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z', hex: '#b8553e', tint: '#fbe8e2' },
  MW: { l: 'Metropolitan Witnessing', icon: 'building', d: 'M4 20V9l5-3v14M9 20V11l6-3v12M15 20v-7l5-2v9', hex: '#3f6b78', tint: '#e4eff2' },
  'T&R': { l: 'Taste and Rejoice', icon: 'utensils', d: 'M8 4v6a2 2 0 0 0 4 0V4M10 10v10M16 20V4c2 2 2 6 0 8', hex: '#a8741f', tint: '#f8eeda' },
  HBC: { l: 'Harbor Sunset Cruise', icon: 'boat', d: 'M4 15h16l-3 5H7zM12 15V4l6 8z', hex: '#2f7d7d', tint: '#e2f0ef' },
  X: { l: 'Added movement', icon: 'star', d: 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10', hex: '#6b6a67', tint: '#eeece8' },
}
export const ACT_ORDER = ['CNV', 'EG', 'FS', 'LEO', 'FFL', 'MW', 'T&R', 'HBC']

export const BUS_D = 'M4 6h16v10H4zM4 11h16M7 16v2M17 16v2'
export const WALK_D = 'M12 2.7a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 1 0 0-3.6M12 7v6M12 13l-3 7M12 13l3 6M8.5 9.5L15 8'

export const DEF_TPORTS: Transport[] = [
  { id: 'coach', l: 'Coach', g: '▬', icon: 'bus', hex: '#c67139', seats: 48 },
  { id: 'private', l: 'Private vehicle', g: '▪', icon: 'car', hex: '#0f8f86', seats: 4 },
]
export const DEF_SIGNS: SignType[] = [
  { id: 'lolly', l: 'Lollipop sign', icon: 'sign', hex: '#c67139', per: 'group' },
  { id: 'aframe', l: 'A-frame', icon: 'cone', hex: '#2f4bd8', per: 'space' },
  { id: 'banner', l: 'Welcome banner', icon: 'flag', hex: '#0f8f86', per: 'none' },
]

export interface Icon {
  id: string
  l: string
  d: string
}
export const ICONS: Icon[] = [
  { id: 'greeter', l: 'Greeting wave', d: 'M9.5 9V4.6a1.3 1.3 0 0 1 2.6 0V9m0-.6V3.6a1.3 1.3 0 0 1 2.6 0V9m0-.4V5.1a1.3 1.3 0 0 1 2.6 0V13c0 4-2.5 7-6.2 7-3 0-4.3-1.4-5.6-3.6L3.4 13a1.4 1.4 0 0 1 2.4-1.4l1.1 1.7V7.1a1.3 1.3 0 0 1 2.6 0V9' },
  { id: 'pickup', l: 'Pick-up point', d: 'M4 7h13v9H4zM17 10h3l1.5 3v3H17zM7 19a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M18.5 19a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2' },
  { id: 'desk', l: 'Help desk', d: 'M3 20h18M5 20v-6h14v6M8 14V9.5a4 4 0 0 1 8 0V14M12 3v2' },
  { id: 'captain', l: 'Captain star', d: 'M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.3l5.4-.8z' },
  { id: 'users', l: 'Group', d: 'M15.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20M9.2 11.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.5M16.2 4.4a3.6 3.6 0 0 1 0 7' },
  { id: 'person', l: 'One person', d: 'M12 3.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4M12 8v6M12 14l-3 6.5M12 14l3 6.5M8 10.5L16 9' },
  { id: 'walk', l: 'Walking', d: 'M13 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6M11 20l1.8-5.2-2.3-2.4.9-4.4 3 2 2.6 1M10.4 8l-2.8 1.6-1.2 3.4M12.8 14.8L16 20' },
  { id: 'bus', l: 'Coach', d: 'M4 6h16v10H4zM4 11h16M7 16v2M17 16v2M7.5 8.5h2M14.5 8.5h2' },
  { id: 'van', l: 'Shuttle van', d: 'M2 8h11l3.5 3.5H21v4.5H2zM7 19a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4M17.5 19a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4' },
  { id: 'car', l: 'Private vehicle', d: 'M5 16.5h14M6.5 16.5V19M17.5 16.5V19M4 16.5l1.4-5.2A2 2 0 0 1 7.3 10h9.4a2 2 0 0 1 1.9 1.3L20 16.5M7 13.5h10' },
  { id: 'luggage', l: 'Luggage', d: 'M6 8h12v12H6zM9.5 8V5h5v3M9.5 12v4M14.5 12v4' },
  { id: 'bell', l: 'Front bell', d: 'M3.5 19h17M5.5 19v-1.5a6.5 6.5 0 0 1 13 0V19M12 6v-1.5M10.5 4.5h3' },
  { id: 'info', l: 'Information', d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M12 11v5M12 7.8v.4' },
  { id: 'headset', l: 'Radio / headset', d: 'M4.5 15v-3a7.5 7.5 0 0 1 15 0v3M4.5 14h2.2v5H6a1.5 1.5 0 0 1-1.5-1.5zM19.5 14h-2.2v5H18a1.5 1.5 0 0 0 1.5-1.5z' },
  { id: 'clipboard', l: 'Roster', d: 'M8.5 4.5H7A1.5 1.5 0 0 0 5.5 6v13A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-1.5M9 3h6v3H9zM9 11h6M9 15h4' },
  { id: 'pin', l: 'Map pin', d: 'M12 21s-6.5-5-6.5-10a6.5 6.5 0 1 1 13 0c0 5-6.5 10-6.5 10M12 8.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8' },
  { id: 'flag', l: 'Flag', d: 'M5 21V4M5 5h11l-1.8 3.4L16 12H5' },
  { id: 'star', l: 'Star', d: 'M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.3l5.4-.8z' },
  { id: 'heart', l: 'Care', d: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z' },
  { id: 'building', l: 'Hotel', d: 'M4 20V6l8-3 8 3v14M4 20h16M9 20v-4h6v4M8 9h2M14 9h2M8 12.5h2M14 12.5h2' },
  { id: 'door', l: 'Door', d: 'M5 20h14M7 20V4h10v16M14 12.2v.6' },
  { id: 'stairs', l: 'Stairs', d: 'M4 20h4v-4h4v-4h4V8h4' },
  { id: 'lift', l: 'Lift', d: 'M5 3.5h14v17H5zM12 3.5v17M8.5 9l-1.5 2h3zM15.5 15l1.5-2h-3z' },
  { id: 'arrow', l: 'Arrow', d: 'M4 12h15M13.5 6.5L20 12l-6.5 5.5' },
  { id: 'split', l: 'Split flow', d: 'M3 12h6M9 12l6-5.5M9 12l6 5.5M15 6.5h5M15 17.5h5' },
  { id: 'clock', l: 'Time', d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M12 7.5V12l3 2' },
  { id: 'calendar', l: 'Day', d: 'M5 6h14v14H5zM5 10h14M9 3.5V7M15 3.5V7' },
  { id: 'coffee', l: 'Refreshment', d: 'M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 9.5h1.8a2.4 2.4 0 0 1 0 4.8H17M6 3.5v2M10 3.5v2M14 3.5v2' },
  { id: 'utensils', l: 'Meal', d: 'M6 3v7a2 2 0 0 0 4 0V3M8 10v11M16 21V3c2.2 2 2.6 6.5 0 9' },
  { id: 'wine', l: 'Winery', d: 'M8 4h8l-1 5a3 3 0 0 1-6 0zM12 14v6M9 20h6' },
  { id: 'boat', l: 'Cruise', d: 'M4 15h16l-3 5H7zM12 15V4l6 8z' },
  { id: 'mic', l: 'Programme', d: 'M12 3.5a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0V6A2.5 2.5 0 0 0 12 3.5M6 11a6 6 0 0 0 12 0M12 17v3.5' },
  { id: 'camera', l: 'Photo point', d: 'M4 7.5h3.5L9 5.5h6L16.5 7.5H20v11H4zM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4' },
  { id: 'book', l: 'Literature', d: 'M5 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2H5zM19 4.5h-2a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2H19z' },
  { id: 'ticket', l: 'Badge / pass', d: 'M4 7.5h16v3a1.8 1.8 0 0 0 0 3.6v3H4v-3a1.8 1.8 0 0 0 0-3.6zM10.5 7.5v9' },
  { id: 'shield', l: 'Safety', d: 'M12 3.5l7 2.5v6c0 4.2-3 7-7 8.5-4-1.5-7-4.3-7-8.5V6zM9.2 12l2 2 3.6-3.8' },
  { id: 'access', l: 'Accessibility', d: 'M12 3.4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4M9 8.5h6M12 8.5v5h4.5l2 6.5M12 13.5a4 4 0 1 0 3.4 6' },
  { id: 'umbrella', l: 'Weather', d: 'M12 3.5c-4.7 0-8.5 3.6-8.5 8h17c0-4.4-3.8-8-8.5-8M12 11.5V19a2 2 0 0 1-4 0' },
  { id: 'sun', l: 'Morning', d: 'M12 7.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6' },
  { id: 'moon', l: 'Evening', d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5' },
  { id: 'check', l: 'Confirmed', d: 'M4.5 12.5l5 5 10-11' },
  { id: 'alert', l: 'Watch out', d: 'M12 4l8.5 15h-17zM12 10v4M12 16.6v.4' },
  { id: 'phone', l: 'Phone', d: 'M6 3.5h3l1.5 4-2 1.4a11 11 0 0 0 5.6 5.6l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.7 2 2 0 0 1 6 3.5' },
  { id: 'key', l: 'Room key', d: 'M14.5 3.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12M10.3 13.7L3.5 20.5M6.5 17.5l2 2M8.5 15.5l2 2' },
  { id: 'table', l: 'Table', d: 'M3 9h18M5 9v10M19 9v10M6 5.5h12L21 9H3z' },
  { id: 'sign', l: 'Signage', d: 'M12 3v3M6 6h12l2 4-2 4H6l-2-4zM12 14v7M9 21h6' },
  { id: 'cone', l: 'Marshalling', d: 'M12 3.5L18.5 20h-13zM9.2 12h5.6M7.8 16h8.4' },
  { id: 'grid', l: 'Zone', d: 'M4 4.5h6.5V11H4zM13.5 4.5H20V11h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z' },
  // literal tool icons — each looks like the thing it does
  { id: 'blueprint', l: 'Floor plan', d: 'M4 4.5h16v15H4zM4 10.5h7.5M15 10.5h5M11.5 10.5v9M11.5 4.5v2.5' },
  { id: 'pencil', l: 'Draft', d: 'M4.5 19.5l.9-3.6L16.7 4.6a2 2 0 0 1 2.8 2.8L8.2 18.7l-3.7.8zM14.8 6.5l2.8 2.8' },
  { id: 'play', l: 'Go live', d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M10 8.5l5.5 3.5-5.5 3.5z' },
  { id: 'wall', l: 'Wall', d: 'M3.5 6.5h17v11h-17zM3.5 12h17M9 6.5V12M15 6.5V12M6.5 12v5.5M12 12v5.5M17.5 12v5.5' },
  { id: 'road', l: 'Road', d: 'M5 20.5L9.5 3.5M19 20.5L14.5 3.5M12 6v2.4M12 10.8v2.4M12 15.6V18' },
  { id: 'queue', l: 'Queue space', d: 'M4 7.5v-3h3M17 4.5h3v3M20 16.5v3h-3M7 19.5H4v-3M7.9 12h.6M11.7 12h.6M15.5 12h.6' },
  { id: 'ruler', l: 'Scale', d: 'M3.5 16.5L16.5 3.5l4 4L7.5 20.5zM8.3 12.7l1.7 1.7M11.3 9.7l1.7 1.7M14.3 6.7l1.7 1.7' },
  { id: 'map', l: 'Map', d: 'M3.5 6l5.7-2 5.6 2 5.7-2v14l-5.7 2-5.6-2-5.7 2zM9.2 4v14M14.8 6v14' },
  { id: 'page', l: 'Plan file', d: 'M6 3.5h8l4 4v13H6zM14 3.5V8h4M12 16.5V12M9.9 14.1L12 12l2.1 2.1' },
  { id: 'sparkle', l: 'Populate', d: 'M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6-5.6-1.9 5.6-1.9zM18.8 16.8l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z' },
  { id: 'eye', l: 'Show / hide', d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5' },
  { id: 'matrix', l: 'Report matrix', d: 'M4 4.5h16v15H4zM4 9.5h16M4 14.5h16M9.5 4.5v15M14.5 4.5v15' },
]
export const ICON_BY: Record<string, Icon> = Object.fromEntries(ICONS.map((i) => [i.id, i]))

/** Each palette is an accent pair; the ramps are derived from them so every tint moves with the choice. */
export const PALETTES = [
  { id: 'organic', l: 'Organic', a: '#c67139', b: '#7a8a5e' },
  { id: 'harbor', l: 'Harbor', a: '#2f6f8f', b: '#c98a3c' },
  { id: 'ink', l: 'Ink & brass', a: '#3b4a63', b: '#b08b4f' },
  { id: 'garden', l: 'Garden', a: '#6b7f4a', b: '#b8563f' },
]

export const SWATCH = ['#2f4bd8', '#0f8f86', '#c67139', '#8c3a52', '#3f5c8a', '#6b6a67']

export interface Suite {
  id: string
  kind: ItemKind
  l: string
  hex: string
  items: PlanTool[]
}
export const SUITES: Suite[] = [
  {
    id: 'furn',
    kind: 'furn',
    l: 'Furniture',
    hex: '#a8763f',
    items: [
      { kind: 'furn', t: 'desk', l: 'Welcome desk', g: '▭', sub: '2.4 m' },
      { kind: 'furn', t: 'trestle', l: 'Trestle table', g: '▬', sub: '1.83 m' },
      { kind: 'furn', t: 'round', l: 'Round table', g: '◯', sub: '1.52 m · 8 seats' },
      { kind: 'furn', t: 'chairs', l: 'Chairs', g: '◻', sub: '4' },
      { kind: 'furn', t: 'stanchion', l: 'Stanchion run', g: '┃', sub: '4 posts · 4.5 m' },
      { kind: 'furn', t: 'kiosk', l: 'Kiosk', g: '▣', sub: '0.7 m' },
    ],
  },
  {
    id: 'sign',
    kind: 'sign',
    l: 'Signs',
    hex: '#c67139',
    items: [
      { kind: 'sign', t: 'banner', l: 'Welcome banner', g: '▮', sub: '2.4 × 1.5 m' },
      { kind: 'sign', t: 'aframe', l: 'A-frame', g: '◭', sub: '0.94 m' },
      { kind: 'sign', t: 'lollipop', l: 'Lollipop sign', g: '◉', sub: '2.2 m' },
      { kind: 'sign', t: 'arrowsign', l: 'Directional arrow', g: '▸', sub: '2.1 m' },
      { kind: 'sign', t: 'bay', l: 'Bay number', g: '▤', sub: '2.1 m' },
    ],
  },
  {
    id: 'people',
    kind: 'people',
    l: 'People',
    hex: '#7a8a5e',
    items: [
      { kind: 'people', t: 'greeter', l: 'Greeter', g: '♦', sub: 'posted' },
      { kind: 'people', t: 'pickup', l: 'Pick-Up', g: '♦', sub: 'posted' },
      { kind: 'people', t: 'desk', l: 'Welcome desk staff', g: '♦', sub: 'posted' },
    ],
  },
  {
    id: 'veh',
    kind: 'veh',
    l: 'Vehicles',
    hex: '#4a5a6a',
    items: [
      { kind: 'veh', t: 'coach', l: 'Coach', g: '▰', sub: '13.7 m' },
      { kind: 'veh', t: 'shuttle', l: 'Shuttle', g: '▰', sub: '8.2 m' },
      { kind: 'veh', t: 'van', l: 'Van', g: '▬', sub: '5.4 m' },
      { kind: 'veh', t: 'car', l: 'Private car', g: '▪', sub: '4.6 m' },
    ],
  },
]

/** Coach bays as a percentage across the site width. */
export const BAYS = [
  { l: 'Bay 1', x: 18 },
  { l: 'Bay 2', x: 49.5 },
  { l: 'Bay 3', x: 81 },
]

/** 12-hour clock, e.g. 8:05am. */
export function hhmm(mins: number): string {
  const h24 = Math.floor(mins / 60) % 24
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return h + ':' + String(mins % 60).padStart(2, '0') + (h24 < 12 ? 'am' : 'pm')
}
/** 12-hour clock with a space, e.g. "8:05 am". */
export function clockOf(mins: number): string {
  const h = Math.floor(mins / 60)
  const mm = String(mins % 60).padStart(2, '0')
  const ap = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mm} ${ap}`
}
export function shiftOf(mins: number): Shift {
  return SHIFTS.find((s) => mins >= s.from && mins < s.to) || SHIFTS[2]!
}
