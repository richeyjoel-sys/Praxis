// One shift: its roles with captains, then its movements.

import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { hhmm, shiftOf, type Shift } from '@/model/library'
import { Chip, Glyph, IconBtn, Micro, Pill, Step, inputClass } from '@/ui'
import { n } from '@/lib/format'
import { MovementRow } from './MovementRow'
import s from './builder.module.css'

export function ShiftCard({ sh }: { sh: Shift }) {
  const m = useModel()
  const a = m.actsIn(sh)
  const cov = m.cover(sh)
  const b = m.base(sh)
  const cur = shiftOf(m.ui.mins)
  const open = sh.id === cur.id
  const coach = a.reduce((t, x) => t + m.coaches(x), 0)
  const allOpen = a.length > 0 && a.every((x) => m.ui.openMoves[m.key(x)])

  return (
    <section className={s.card} data-open={open ? 'true' : undefined} aria-label={sh.l}>
      <button className={s.cardHead} onClick={() => A.goShift(sh, a.length ? a[0]!.s : null)}>
        <span className={s.cardTile} data-open={open ? 'true' : undefined}>
          {sh.g}
        </span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span className={s.cardTitle}>{sh.l}</span>
          <span className={s.cardRange}>
            {hhmm(sh.from)}–{hhmm(sh.to)} · {a.length} group{a.length === 1 ? '' : 's'} · {n(b.all)} delegates
          </span>
        </span>
        <Chip color={coach ? 'var(--color-accent-900)' : 'var(--color-neutral-700)'} bg={coach ? 'var(--color-accent-200)' : 'var(--color-neutral-200)'}>
          {coach ? `${coach} coach${coach === 1 ? '' : 'es'}` : 'no coaches'}
        </Chip>
      </button>

      <div className={s.roles}>
        {m.allRoles().map((r) => {
          const cK = m.capKey(sh, r.id)
          const rc = m.doc.caps[cK] || ''
          return (
            <div key={r.id} className={s.roleBlock} data-cap={rc ? 'true' : undefined}>
              <div className={s.roleRow}>
                <button
                  className={s.roleDot}
                  style={{ background: r.hex }}
                  title={`${r.l} — proposed ${b[r.id] || 0}. Click to edit the role.`}
                  onClick={() => A.openStudio('role')}
                >
                  <Glyph icon={r.icon} g={r.g} size={14} />
                </button>
                <span className={s.roleName} title={r.l}>
                  {r.l}
                </span>
                <span className={s.roleNum}>{cov[r.id] || 0}</span>
                <Step size="w30" onClick={() => A.bumpRole(m, sh, r.id, -1)} aria-label={`Fewer ${r.l}`}>
                  −
                </Step>
                <Step size="w30" onClick={() => A.bumpRole(m, sh, r.id, 1)} aria-label={`More ${r.l}`}>
                  +
                </Step>
              </div>
              <div className={s.capRow}>
                <span className={s.capTile} style={{ background: r.hex }}>
                  <Glyph icon="captain" size={11} />
                </span>
                <input
                  className={inputClass}
                  style={{ flex: 1, fontSize: 12, borderRadius: 8, padding: '0 9px', borderColor: rc ? undefined : 'var(--color-accent-300)' }}
                  value={rc}
                  placeholder="Captain name"
                  onChange={(e) => A.setCaptain(m, sh, r.id, e.target.value)}
                  aria-label={`${r.l} captain for ${sh.l}`}
                />
                <Chip color={rc ? 'var(--color-accent-2-900)' : 'var(--color-accent-800)'} bg={rc ? 'var(--color-accent-2-100)' : 'var(--color-accent-200)'} style={{ fontSize: 10.5 }}>
                  {rc ? '✓ captain' : '⚑ no captain'}
                </Chip>
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Pill tone="dashed" small onClick={() => { A.addRole(); A.openStudio('role') }} style={{ fontSize: 11.5 }}>
            ＋ Add a role
          </Pill>
          <IconBtn onClick={() => A.openStudio('role')} title="Set up global roles">
            ⚙
          </IconBtn>
        </div>
      </div>

      <div className={s.moves}>
        <div className={s.movesHead}>
          <Micro>Movements</Micro>
          <span style={{ flex: 1 }} />
          <Pill small onClick={() => A.setMovesOpen(a.map((x) => m.key(x)), !allOpen)} style={{ fontSize: 11, fontWeight: 700 }}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Pill>
        </div>
        {a.map((x, i) => (
          <MovementRow key={m.key(x)} x={x} sh={sh} zebra={i % 2 === 1} />
        ))}
        {a.length === 0 && <div className={s.emptyNote}>Nothing runs in this shift today.</div>}
        <div className={s.addRow}>
          <Micro>Add</Micro>
          {m.libList().map((t) => (
            <button
              key={t.c}
              className={s.addType}
              style={{ background: t.tint || 'var(--color-neutral-100)', color: t.hex, borderColor: t.tint || 'var(--color-neutral-300)' }}
              title={`${t.l} — add to ${sh.l}`}
              onClick={() => A.addAct(m, sh, t.c)}
            >
              <Glyph icon={t.icon} g="◆" size={15} />
            </button>
          ))}
          <Pill tone="dashed" small onClick={() => A.addAct(m, sh)} style={{ fontSize: 11 }}>
            ＋ Custom
          </Pill>
          <IconBtn onClick={() => A.openStudio('act')} title="Set up global activities">
            ⚙
          </IconBtn>
        </div>
      </div>
    </section>
  )
}
