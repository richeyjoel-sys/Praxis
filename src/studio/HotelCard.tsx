// Hotel card — right-click a hotel in the rail. Details are yours to keep;
// the delegate figures come from the matrix. A popover, not a modal.

import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { Micro, Pill, inputClass, textareaClass, readFileAsDataUrl } from '@/ui'
import type { HotelMeta } from '@/model/types'
import s from './HotelCard.module.css'

const FIELDS: [keyof HotelMeta, string, string][] = [
  ['short', 'Hotel name', 'As the volunteers know it'],
  ['address', 'Address', 'Street, city'],
  ['contact', 'Contact', 'Who we ask for on the day'],
  ['phone', 'Phone', 'Direct line'],
  ['rooms', 'Rooms held', 'e.g. 240'],
  ['distance', 'Distance to venue', 'e.g. 3.2 mi · 12 min'],
  ['kerb', 'Kerb / bay notes', 'How many coaches fit, where they wait'],
  ['parking', 'Parking notes', 'Private vehicles, drop-off, overflow'],
]

export function HotelCard() {
  const m = useModel()
  const c = m.ui.hotelCard
  const x = c ? m.hotels().find((h) => h.name === c.name) : null
  if (!c || !x) return null
  const meta = m.meta(x.name)
  const top = Math.max(14, Math.min(c.top - 40, 120))

  return (
    <div className={s.wrap} style={{ top, maxHeight: `calc(100vh - ${top + 14}px)` }} role="dialog" aria-label={`${x.short} details`}>
      <div className={s.top}>
        <span className={s.badge}>{x.code}</span>
        <span className={s.title}>{x.short}</span>
        <Pill tone="primary" small onClick={A.closeHotelCard}>
          Done
        </Pill>
      </div>
      <label className={s.photo} style={meta.photo ? { background: `url("${meta.photo}") center/cover no-repeat` } : undefined}>
        {!meta.photo && <span>Drop a photo of the hotel</span>}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) A.setHotelMeta(x.name, { photo: await readFileAsDataUrl(f) })
          }}
        />
      </label>
      <div className={s.fields}>
        {FIELDS.map(([k, l, ph]) => (
          <label key={k} className={s.field}>
            <Micro>{l}</Micro>
            <input
              className={inputClass}
              style={{ width: '100%' }}
              value={k === 'short' ? x.short : String(meta[k] || '')}
              placeholder={ph}
              onChange={(e) => A.setHotelMeta(x.name, { [k]: e.target.value })}
            />
          </label>
        ))}
        <label className={s.field}>
          <Micro>Notes</Micro>
          <textarea className={textareaClass} value={meta.notes || ''} placeholder="Anything the captains should know" onChange={(e) => A.setHotelMeta(x.name, { notes: e.target.value })} />
        </label>
      </div>
      <div className={s.foot}>
        <span className={s.note}>
          {x.custom ? 'A hotel you added. It has no matrix groups until the data carries it.' : 'Details are yours to keep; the delegate figures come from the matrix.'}
        </span>
        {x.custom && (
          <Pill small onClick={() => A.removeHotel(x.name)}>
            Remove
          </Pill>
        )}
      </div>
    </div>
  )
}
