// Event setup: name, logo with colour extraction, the date list, palettes.
// A strip under the header — not a modal.

import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { PALETTES } from '@/model/library'
import { Micro, Pill, inputClass, readFileAsDataUrl } from '@/ui'
import { applyTheme, logoColours } from '@/lib/theme'
import { dayLabel } from '@/lib/format'
import s from './EventSetup.module.css'

export function EventSetup() {
  const m = useModel()
  const ev = m.doc.ev
  const cols = m.ui.logoCols
  const dropped = (ev.dropDates || []).length
  const added = (ev.addDates || []).length

  const upload = async (f: File | undefined) => {
    if (!f) return
    const src = await readFileAsDataUrl(f)
    A.setEv({ logo: src, logoName: f.name })
    A.setLogoCols(await logoColours(src))
  }
  const useTheme = (a: string, b: string) => {
    A.setEv({ theme: { a, b } })
    applyTheme(a, b)
  }

  return (
    <div className={s.wrap}>
      <div className={s.top}>
        <span className={s.title}>Event setup</span>
        <Pill tone="primary" small onClick={A.closeSetup}>
          Done
        </Pill>
      </div>
      <div className={s.row}>
        <label className={s.field} style={{ flex: '1 1 280px', minWidth: 240 }}>
          <Micro>Event name</Micro>
          <input
            className={inputClass}
            style={{ height: 44, borderRadius: 12, fontSize: 15, fontWeight: 700, background: 'var(--color-bg)' }}
            value={ev.name || ''}
            onChange={(e) => A.setEv({ name: e.target.value })}
            placeholder="e.g. Eternal Happiness International Convention"
          />
        </label>
        <div className={s.field}>
          <Micro>Logo</Micro>
          <div className={s.logoRow}>
            <span
              className={s.logoBox}
              title={ev.logoName || 'No logo yet'}
              style={ev.logo ? { background: `var(--color-bg) url("${ev.logo}") center/contain no-repeat` } : undefined}
            />
            <label className={s.upload}>
              Upload logo
              <input type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      </div>
      {ev.logo && (
        <div className={s.extract}>
          <span className={s.extractNote}>
            {cols.length
              ? `Read ${cols.length} colours from ${ev.logoName || 'the logo'}. The first two become the accent pair; every tint and pressed state follows.`
              : 'Reading the logo…'}
          </span>
          {cols.map((h) => (
            <span key={h} className={s.colour} style={{ background: h }} title={h} />
          ))}
          <Pill tone="primary" small onClick={() => cols[0] && useTheme(cols[0], cols[1] || cols[0])} disabled={!cols.length}>
            Use these colours
          </Pill>
        </div>
      )}
      <div className={s.field}>
        <Micro>Event dates</Micro>
        <div className={s.datesRow}>
          {m.dateList().map((d) => (
            <Pill key={d} tone="quiet" small onClick={() => A.shiftDate(m, d, true)} title="Remove this day">
              {dayLabel(d)} ✕
            </Pill>
          ))}
          <input
            type="date"
            className={s.addDate}
            title="Add a day to the schedule"
            onChange={(e) => {
              const v = e.target.value
              e.target.value = ''
              if (v) A.shiftDate(m, v, false)
            }}
          />
        </div>
        <span className={s.note}>
          {m.dateList().length} days in the schedule{added ? `, ${added} added` : ''}
          {dropped ? `, ${dropped} dropped` : ''}. A dropped day keeps its matrix data — removing it only takes it off the
          schedule.
        </span>
      </div>
      <div className={s.field}>
        <Micro>Or pick a palette</Micro>
        <div className={s.palettes}>
          {PALETTES.map((p) => {
            const on = ev.theme?.a === p.a && ev.theme?.b === p.b
            return (
              <button key={p.id} className={s.palette} data-on={on ? 'true' : undefined} onClick={() => useTheme(p.a, p.b)}>
                <span className={s.sw}>
                  {[p.a, p.b, '#f5ead8'].map((h) => (
                    <span key={h} style={{ background: h }} />
                  ))}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{p.l}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
