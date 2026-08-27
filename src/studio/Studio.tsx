// Setup studio — global libraries shared by all nine hotels, in four chips:
// Activities, Roles, Transport, Signage. Rename, recolour, re-icon, add,
// remove. Changes cascade everywhere. A breadcrumb returns you to where you were.

import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { ROLES, SWATCH } from '@/model/library'
import type { StudioTab } from '@/state/types'
import { Glyph, Pill, Step, Chip, inputClass, swatchClass, swatchRowClass, iconPickClass, iconRowClass, uploadIconClass, readFileAsDataUrl } from '@/ui'
import { dayLabel } from '@/lib/format'
import s from './Studio.module.css'

interface RowSpec {
  id: string
  name: string
  hex: string
  icon?: string
  g?: string
  mine: boolean
  use: string
  on: boolean
  seats?: number
  patch: (p: Record<string, unknown>) => void
  remove: () => void
}

const TABS: [StudioTab, string][] = [
  ['act', 'Activities'],
  ['role', 'Roles'],
  ['tport', 'Transport'],
  ['sign', 'Signage'],
]
const HEADING: Record<StudioTab, string> = { act: 'Global activities', role: 'Global roles', tport: 'Global transport', sign: 'Global signage' }
const ADD: Record<StudioTab, string> = { act: '＋ Add an activity', role: '＋ Add a role', tport: '＋ Add a transport type', sign: '＋ Add a sign' }
const NOTE: Record<StudioTab, string> = {
  act: 'Activities are shared by all nine hotels. Rename one, give it an icon and a colour, and every movement of that type picks it up — schedule, plan and day mix. Add your own and it joins the picker beside ＋ Custom.',
  role: 'Roles appear in all three shifts at every hotel, each with its own captain. The three fixed ones can be restyled but not removed.',
  tport: 'Transport types are what a movement can ride. Seats each drives the seat coverage on every movement that picks it.',
  sign: 'Signage types follow the queues. A group sign is counted once per group, a space sign once per queuing space; either can be overridden on the movement.',
}

export function Studio() {
  const m = useModel()
  const tab = m.ui.studioTab
  const hh = m.hotel()
  const crumb = '◂ Back to ' + (hh ? `${hh.short} · ${dayLabel(m.iso())}` : 'the map')

  let rows: RowSpec[] = []
  if (tab === 'role') {
    rows = m.allRoles().map((r) => {
      const locked = ROLES.some((z) => z.id === r.id)
      return {
        id: r.id,
        name: r.l,
        hex: r.hex,
        icon: r.icon,
        g: r.g,
        mine: !locked,
        use: locked ? 'fixed role' : 'added',
        on: locked,
        patch: (p) => A.patchRole(r, p, locked),
        remove: () => A.removeRole(r.id),
      }
    })
  } else if (tab === 'tport') {
    rows = m.tports().map((t) => ({
      id: t.id,
      name: t.l,
      hex: t.hex,
      icon: t.icon,
      g: t.g,
      mine: !!t.custom,
      use: t.seats ? `${t.seats} seats` : 'carries none',
      on: !!t.seats,
      seats: t.seats || 0,
      patch: (p) => A.patchTport(m, t.id, p),
      remove: () => A.removeTport(m, t.id),
    }))
  } else if (tab === 'sign') {
    rows = m.signTypes().map((t) => ({
      id: t.id,
      name: t.l,
      hex: t.hex,
      icon: t.icon,
      mine: !!t.custom,
      use: t.per === 'group' ? 'one per group' : t.per === 'space' ? 'one per space' : 'on request',
      on: t.per !== 'none',
      patch: (p) => A.patchSign(m, t.id, p),
      remove: () => A.removeSign(m, t.id),
    }))
  } else {
    rows = m.libList().map((t) => {
      const used = m.hotels().reduce((k, h) => k + (m.day(h.name, m.iso()).acts || []).filter((a) => a.c === t.c).length, 0)
      return {
        id: t.c,
        name: t.l,
        hex: t.hex,
        icon: t.icon,
        mine: !!t.mine,
        use: used ? `${used} today` : 'none today',
        on: !!used,
        patch: (p) => A.patchActType(t, p),
        remove: () => A.removeActType(t.c),
      }
    })
  }

  const add = () => {
    if (tab === 'act') A.addActType()
    else if (tab === 'role') A.addRole()
    else if (tab === 'tport') A.addTport(m)
    else A.addSign(m)
  }

  return (
    <div className={s.wrap} role="region" aria-label="Setup studio">
      <div className={s.top}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <button className={s.crumb} onClick={A.closeStudio}>
            {crumb}
          </button>
          <h2 className={s.h2}>{HEADING[tab]}</h2>
        </div>
        <Pill tone="dashed" onClick={add}>
          {ADD[tab]}
        </Pill>
        <Pill tone="primary" onClick={A.closeStudio}>
          Done
        </Pill>
      </div>
      <div className={s.tabs}>
        {TABS.map(([id, l]) => (
          <Pill key={id} on={tab === id} onClick={() => A.setStudioTab(id)}>
            {l}
          </Pill>
        ))}
      </div>
      <p className={s.note}>{NOTE[tab]}</p>
      <div className={s.rows}>
        {rows.map((r) => (
          <StudioRow key={r.id} r={r} icons={m.iconList()} seats={tab === 'tport'} />
        ))}
      </div>
    </div>
  )
}

function StudioRow({ r, icons, seats }: { r: RowSpec; icons: { id: string; l: string }[]; seats: boolean }) {
  const hex = r.hex || 'var(--color-neutral-600)'
  return (
    <div className={s.row}>
      <span className={s.tile} style={{ background: hex }}>
        <Glyph icon={r.icon} g={r.g || '◆'} size={18} />
      </span>
      <input className={inputClass} style={{ flex: '1 1 160px', minWidth: 130, fontSize: 13.5, fontWeight: 700 }} value={r.name} onChange={(e) => r.patch({ l: e.target.value })} />
      <span className={swatchRowClass}>
        {SWATCH.map((c) => (
          <button key={c} className={swatchClass} data-on={r.hex === c ? 'true' : undefined} style={{ background: c }} title={c} onClick={() => r.patch({ hex: c })} aria-label={`Colour ${c}`} />
        ))}
      </span>
      <span className={iconRowClass} style={{ flex: '1 1 200px', minWidth: 130 }}>
        <label className={uploadIconClass} title="Upload an icon or picture">
          ↑
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              const id = A.addUploadedIcon(f.name, await readFileAsDataUrl(f))
              r.patch({ icon: id })
            }}
          />
        </label>
        {icons.map((ic) => {
          const on = ic.id === r.icon
          return (
            <button
              key={ic.id}
              className={iconPickClass}
              title={ic.l}
              onClick={() => r.patch({ icon: ic.id })}
              style={on ? { background: hex, color: '#fff', borderColor: hex } : undefined}
            >
              <Glyph icon={ic.id} size={15} />
            </button>
          )
        })}
      </span>
      {seats && (
        <span className={s.seats}>
          <Step onClick={() => r.patch({ seats: Math.max(0, (r.seats || 0) - 1) })} aria-label="Fewer seats">
            −
          </Step>
          <span className={s.seatNum}>{r.seats || 0}</span>
          <Step onClick={() => r.patch({ seats: (r.seats || 0) + 1 })} aria-label="More seats">
            +
          </Step>
          <span style={{ fontSize: 11, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>seats</span>
        </span>
      )}
      <Chip color={r.on ? 'var(--color-accent-900)' : 'var(--color-neutral-700)'} bg={r.on ? 'var(--color-accent-200)' : 'var(--color-neutral-200)'} style={{ flex: 'none' }}>
        {r.use}
      </Chip>
      {r.mine && (
        <Pill small onClick={r.remove} style={{ fontSize: 11.5, fontWeight: 700 }}>
          Remove
        </Pill>
      )}
    </div>
  )
}
