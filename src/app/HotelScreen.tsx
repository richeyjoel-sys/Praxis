// One hotel, one screen: the header (who, when, the numbers, the view), the
// date row, event setup when open, then the body — the ONE scroller — holding
// the planner and/or the builder.

import { useModel } from '@/model/useModel'
import { useStore } from '@/state/store'
import * as A from '@/state/actions'
import { Chip, Glyph, Micro, Pill } from '@/ui'
import { label } from '@/lib/shortcuts'
import { dayLabel, n } from '@/lib/format'
import { EventSetup } from '@/studio/EventSetup'
import { ScheduleBuilder } from '@/builder/ScheduleBuilder'
import { FlowPlanner } from '@/planner/FlowPlanner'
import s from './HotelScreen.module.css'

export function HotelScreen() {
  const m = useModel()
  const undo = useStore((st) => st.undo)
  const depth = useStore((st) => st.history.past.length)
  const h = m.hotel()!
  const iso = m.iso()
  const ui = m.ui
  const acts = m.acts()
  const inHouse = m.day().inHouse || 0
  const dayCoach = acts.reduce((t, a) => t + m.coaches(a), 0)
  const other = m.tports().filter((t) => t.id !== 'coach')
  const dayPriv = acts.reduce((t, a) => t + other.reduce((k, tp) => k + m.tcount(a, tp), 0), 0)
  const planMode = ui.view === 'planner' && ui.pmode === 'plan'
  const showStats = !planMode
  const showDates = !planMode
  const addr = h.addr || m.meta(h.name).address
  const ev = m.doc.ev
  const dates = m.dateList()
  /** The day before or after an ISO date, midday-anchored so timezones can't slip it. */
  const stepIso = (d: string, dir: 1 | -1) => {
    const t = new Date(d + 'T12:00:00Z')
    t.setUTCDate(t.getUTCDate() + dir)
    return t.toISOString().slice(0, 10)
  }

  return (
    <div className={s.screen}>
      <header className={s.head}>
        <div className={s.row1}>
          <div className={s.titles}>
            <Micro>
              {h.code}
              {addr ? ' · ' + addr : ''} · {dayLabel(iso, 'short').replace(/^(\w+)/, (w) => w)}
            </Micro>
            <h1 className={s.h1}>{h.short}</h1>
          </div>
          <Pill small onClick={undo} disabled={depth === 0} style={{ fontWeight: 700 }} title="Undo the last edit">
            ↺ Undo {label({ key: 'z', meta: true })}
            {depth ? ` (${depth})` : ''}
          </Pill>
          <Chip color="var(--color-accent-2-900)" bg="var(--color-accent-2-100)">
            {ui.restored ? '✓ plan restored' : '✓ saved on this device'}
          </Chip>
          {showStats && (
            <div className={s.stats}>
              {[
                [n(inHouse), 'in house'],
                [String(acts.length), 'groups'],
                [String(dayCoach), 'coaches'],
                [String(dayPriv), 'private'],
              ].map(([v, k]) => (
                <div key={k} className={s.stat}>
                  <div className={s.statV}>{v}</div>
                  <Micro>{k}</Micro>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={s.row2}>
          {ev.logo && (
            <span
              className={s.logo}
              title={ev.name || 'This event'}
              style={{ background: `var(--color-bg) url("${ev.logo}") center/contain no-repeat` }}
            />
          )}
          {ev.name && <span className={s.evName}>{ev.name}</span>}
          {/* the two workspaces — not chips: each is a different world.
              The builder comes first: decide the schedule, then draw it. */}
          {(
            [
              ['builder', 'Schedule builder', '1', 'clipboard'],
              ['planner', 'Flow planner', '2', 'blueprint'],
            ] as const
          ).map(([id, l, key, ic]) => (
            <button
              key={id}
              className={s.ws}
              aria-pressed={ui.view === id}
              onClick={() => A.setView(id)}
              title={`${l} · ${label({ key, meta: true })}`}
            >
              <Glyph icon={ic} size={16} />
              {l}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          {showStats && (
            <span className={s.hint}>
              {ui.view === 'planner'
                ? 'Place furniture, signs, people and vehicles on the floor'
                : 'Build the shifts and movements — the planner draws what you decide'}
            </span>
          )}
        </div>
        {showDates && (
          <div className={s.dates}>
            {dates.length > 0 && (
              <Pill
                small
                onClick={() => A.shiftDate(m, stepIso(dates[0]!, -1), false)}
                title={`Add ${dayLabel(stepIso(dates[0]!, -1), 'pill')} before the first day`}
              >
                ＋
              </Pill>
            )}
            {dates.map((d) => (
              <Pill key={d} small on={d === iso} onClick={() => A.setDate(d)}>
                {dayLabel(d, 'pill')}
              </Pill>
            ))}
            {dates.length > 0 && (
              <Pill
                small
                onClick={() => A.shiftDate(m, stepIso(dates[dates.length - 1]!, 1), false)}
                title={`Add ${dayLabel(stepIso(dates[dates.length - 1]!, 1), 'pill')} after the last day`}
              >
                ＋
              </Pill>
            )}
            <span style={{ flex: 1 }} />
            <Pill tone="dashed" small on={false} onClick={A.toggleSetup} title="Event name, logo, dates and colours">
              ＋ Event &amp; dates
            </Pill>
          </div>
        )}
        {ui.setup && <EventSetup />}
      </header>

      <div className={s.body} data-planner={ui.view === 'planner' ? 'true' : undefined}>
        {ui.view === 'planner' ? <FlowPlanner /> : <ScheduleBuilder />}
      </div>
    </div>
  )
}
