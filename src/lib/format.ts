import { ft } from '@/model/scene'

export const n = (v: number) => v.toLocaleString('en-US')

/** A length in the user's unit. */
export const dim = (m: number, units: 'ft' | 'm') => (units === 'm' ? m.toFixed(1) + ' m' : Math.round(ft(m)) + ' ft')

export function dayLabel(iso: string, style: 'short' | 'long' | 'pill' = 'short'): string {
  const dt = new Date(iso + 'T12:00:00')
  if (style === 'pill') return dt.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + dt.getDate()
  if (style === 'long') return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
