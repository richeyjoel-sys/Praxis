// Report studio — the whole apparatus on one dense matrix.
// Rows are the nine hotels; columns are the ten days (or, with a day chosen,
// its three shifts). Every cell: delegates moving, movements, bus trips.
// Filter by activity type; click any cell to land in that hotel and day's
// Schedule builder. Totals along both edges; magnitude as a single-hue tint.

import { useState } from 'react'
import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { ACT, SHIFTS } from '@/model/library'
import type { Act } from '@/model/types'
import { Glyph, Pill } from '@/ui'
import { dayLabel, n } from '@/lib/format'
import s from './report.module.css'

const SHIFT_COLS = [
  ['am', 'Morning'],
  ['mid', 'Mid-day'],
  ['pm', 'Evening'],
] as const
type ShiftId = (typeof SHIFT_COLS)[number][0]

const shiftOf = (a: Act): ShiftId => (a.s < 720 ? 'am' : a.s < 1020 ? 'mid' : 'pm')

interface CellStat {
  d: number // delegates moving
  mv: number // movements
  bus: number // bus trips out
}

export function ReportStudio() {
  const m = useModel()
  const [day, setDay] = useState<string | null>(null) // null = whole event
  const [off, setOff] = useState<Record<string, boolean>>({}) // activity types toggled off
  const dates = m.dateList()
  const hotels = m.hotels()
  const codes = Object.keys(ACT).filter((c) => c !== 'X')

  const stat = (hotel: string, iso: string, shift: ShiftId | null): CellStat => {
    let d = 0
    let mv = 0
    let bus = 0
    for (const a of m.day(hotel, iso).acts) {
      if (off[a.c]) continue
      if (shift && shiftOf(a) !== shift) continue
      d += a.d
      mv += 1
      bus += a.bo || 0
    }
    return { d, mv, bus }
  }

  // columns for the current scope
  const cols: { key: string; label: string; sub?: string; iso: string; shift: ShiftId | null }[] = day
    ? SHIFT_COLS.map(([id, l]) => ({ key: id, label: l, iso: day, shift: id }))
    : dates.map((iso) => ({ key: iso, label: dayLabel(iso, 'pill'), iso, shift: null }))

  // the grid, its totals, and the tint scale — one pass
  const grid = hotels.map((h) => cols.map((c) => stat(h.name, c.iso, c.shift)))
  const rowTot = grid.map((r) => r.reduce((t, c) => ({ d: t.d + c.d, mv: t.mv + c.mv, bus: t.bus + c.bus }), { d: 0, mv: 0, bus: 0 }))
  const colTot = cols.map((_, i) => grid.reduce((t, r) => ({ d: t.d + r[i]!.d, mv: t.mv + r[i]!.mv, bus: t.bus + r[i]!.bus }), { d: 0, mv: 0, bus: 0 }))
  const grand = rowTot.reduce((t, c) => ({ d: t.d + c.d, mv: t.mv + c.mv, bus: t.bus + c.bus }), { d: 0, mv: 0, bus: 0 })
  const max = Math.max(1, ...grid.flat().map((c) => c.d))
  const inHouse = day
    ? hotels.reduce((t, h) => t + (m.day(h.name, day).inHouse || 0), 0)
    : hotels.reduce((t, h) => t + h.delegates, 0)

  const open = (hotel: string, iso: string, shift: ShiftId | null) => {
    A.goHotel(hotel)
    A.setDate(iso)
    if (shift) {
      const sh = SHIFTS.find((x) => x.id === shift)
      if (sh) A.goShift(sh, null)
    }
    A.setView('builder')
  }

  const tint = (v: number) => (v > 0 ? `rgba(47, 75, 216, ${(0.04 + 0.3 * (v / max)).toFixed(3)})` : undefined)

  const Cell = ({ c, hotel, iso, shift }: { c: CellStat; hotel: string; iso: string; shift: ShiftId | null }) => (
    <td
      className={s.cell}
      style={{ background: tint(c.d) }}
      onClick={() => open(hotel, iso, shift)}
      title={`${n(c.d)} delegates · ${c.mv} movement${c.mv === 1 ? '' : 's'}${c.bus ? ` · ${c.bus} bus trips` : ''} — open in the Schedule builder`}
    >
      {c.d > 0 || c.mv > 0 ? (
        <>
          <span className={s.big}>{n(c.d)}</span>
          <span className={s.sub}>
            {c.mv} mv{c.bus ? ` · ${c.bus} bus` : ''}
          </span>
        </>
      ) : (
        <span className={s.zero}>·</span>
      )}
    </td>
  )

  return (
    <div className={s.pane}>
      {/* scope: the whole event, or one day opened into its shifts */}
      <div className={s.bar}>
        <Pill small on={!day} onClick={() => setDay(null)}>
          Whole event
        </Pill>
        {dates.map((d2) => (
          <Pill key={d2} small on={day === d2} onClick={() => setDay(day === d2 ? null : d2)}>
            {dayLabel(d2, 'pill')}
          </Pill>
        ))}
      </div>

      {/* what counts: activity types, glyph + name, never colour alone */}
      <div className={s.bar}>
        {codes.map((c) => {
          const a = ACT[c]!
          const on = !off[c]
          return (
            <button key={c} className={s.type} data-on={on ? 'true' : 'false'} style={on ? { background: a.tint, color: a.hex } : undefined} onClick={() => setOff({ ...off, [c]: on })} aria-pressed={on}>
              <span className={s.typeG} style={{ background: a.hex }}>
                <Glyph icon={a.icon} size={10} />
              </span>
              {a.l}
            </button>
          )
        })}
        {Object.values(off).some(Boolean) && (
          <Pill small onClick={() => setOff({})}>
            All types
          </Pill>
        )}
      </div>

      {/* the scope's headline numbers */}
      <div className={s.kpis}>
        {(
          [
            [n(inHouse), day ? 'in house that day' : 'delegates (peak)'],
            [n(grand.d), 'delegate moves'],
            [String(grand.mv), 'movements'],
            [String(grand.bus), 'bus trips out'],
          ] as const
        ).map(([v, l]) => (
          <div key={l} className={s.kpi}>
            <div className={s.kpiV}>{v}</div>
            <div className={s.kpiL}>{l}</div>
          </div>
        ))}
      </div>

      {/* the matrix */}
      <div className={s.wrap}>
        <table className={s.tbl}>
          <thead>
            <tr>
              <th className={s.hotelCell}>{day ? dayLabel(day) : 'Hotel · whole event'}</th>
              {cols.map((c) => (
                <th key={c.key} className="click" onClick={() => (day ? undefined : setDay(c.iso))} title={day ? undefined : 'Open this day by shift'}>
                  {c.label}
                </th>
              ))}
              <th className={s.totCol}>Total</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((h, hi) => (
              <tr key={h.name}>
                <td className={s.hotelCell}>
                  <span className={s.hCode}>{h.code}</span> <span className={s.hName}>{h.short}</span>
                </td>
                {cols.map((c, ci) => (
                  <Cell key={c.key} c={grid[hi]![ci]!} hotel={h.name} iso={c.iso} shift={c.shift} />
                ))}
                <td className={s.totCol}>
                  <span className={s.big}>{n(rowTot[hi]!.d)}</span>
                  <span className={s.sub}>
                    {rowTot[hi]!.mv} mv{rowTot[hi]!.bus ? ` · ${rowTot[hi]!.bus} bus` : ''}
                  </span>
                </td>
              </tr>
            ))}
            <tr className={s.totRow}>
              <td className={s.hotelCell}>All hotels</td>
              {colTot.map((c, i) => (
                <td key={cols[i]!.key}>
                  <span className={s.big}>{n(c.d)}</span>
                  <span className={s.sub}>
                    {c.mv} mv{c.bus ? ` · ${c.bus} bus` : ''}
                  </span>
                </td>
              ))}
              <td className={s.totCol}>
                <span className={s.big}>{n(grand.d)}</span>
                <span className={s.sub}>
                  {grand.mv} mv{grand.bus ? ` · ${grand.bus} bus` : ''}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
