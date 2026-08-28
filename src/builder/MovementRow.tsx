// One movement. Collapsed: time, name, transport, delegates, seats. Open: the
// six-step cascade — delegates → timing → transport → split → queue → signage —
// because each answer constrains the next. Each step is individually collapsible.

import { useModel } from '@/model/useModel'
import type { Model, Move } from '@/model/select'
import * as A from '@/state/actions'
import { BUS_D, ICON_BY, WALK_D, hhmm, type Shift } from '@/model/library'
import { Chevron, Glyph, IconBtn, IconSvg, Micro, Pill, Stepper, inputClass, iconPickClass, iconRowClass, uploadIconClass, readFileAsDataUrl } from '@/ui'
import { n } from '@/lib/format'
import s from './builder.module.css'

export function MovementRow({ x, sh, zebra }: { x: Move; sh: Shift; zebra: boolean }) {
  const m = useModel()
  const t = m.ui.mins
  const mk = m.key(x)
  const open = !!m.ui.openMoves[mk]
  const act = m.actOf(x)
  const seats = m.seatsOf(x)
  const tp = m.modeT(x)
  const live = t >= x.s - 45 && t < x.e + 30
  const iconD = (x.icon && ICON_BY[x.icon]?.d) || act.d || ''
  const modeD = tp ? ICON_BY[tp.icon]?.d || BUS_D : WALK_D

  return (
    <div className={s.move} style={{ borderLeftColor: act.hex, background: open ? act.tint : zebra ? 'var(--color-neutral-200)' : 'transparent' }}>
      <div className={s.moveHead}>
        <button
          className={s.chev}
          style={open ? { background: act.hex, color: '#fff', borderColor: act.hex } : undefined}
          onClick={() => A.toggleMove(mk)}
          aria-expanded={open}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <Chevron open={open} size={17} weight={2.8} />
        </button>
        <span className={s.actIcon} style={{ background: act.tint, color: act.hex }} title={act.l}>
          {x.icon && !ICON_BY[x.icon] ? <Glyph icon={x.icon} size={16} /> : <IconSvg d={iconD} size={16} weight={2.1} />}
        </span>
        <button className={s.timeBtn} style={{ color: live ? 'var(--color-accent-800)' : 'var(--color-text)' }} onClick={() => A.setMins(Math.max(360, x.s - 30))} title="Show this moment on the plan">
          {hhmm(x.s)}
        </button>
        <span className={s.moveName}>{x.n}</span>
      </div>
      <div className={s.moveSub}>
        <IconSvg d={modeD} size={15} weight={2.1} style={{ color: 'var(--color-neutral-600)', flex: 'none' }} />
        <span className={s.moveD}>{n(x.d)}</span>
        <span style={{ flex: 1 }} />
        {!open && (
          <button className={s.seatBtn} data-ok={seats >= x.d ? 'true' : undefined} onClick={() => A.toggleMove(mk)} title="Open the transport for this movement">
            {seats ? `${seats} seats` : tp ? 'no seats yet' : 'on foot'}
          </button>
        )}
        <IconBtn onClick={() => A.dropAct(m, x)} title={x.id ? 'Delete this movement' : 'Take this group off the day — Undo brings it back'} style={{ borderWidth: 1, color: 'var(--color-neutral-600)', fontSize: 11 }}>
          ✕
        </IconBtn>
      </div>
      {open && <Cascade x={x} sh={sh} m={m} />}
    </div>
  )
}

function Cascade({ x, m }: { x: Move; sh: Shift; m: Model }) {
  const k = m.key(x)
  const shut = m.ui.stepShut
  const isOpen = (i: number) => !shut[k + '|' + i]
  const allShut = [1, 2, 3, 4, 5, 6].every((i) => shut[k + '|' + i])
  const act = m.actOf(x)
  const tp = m.modeT(x)
  const dir = m.dirOf(x)
  const cur = m.modeId(x)
  const nV = m.vcount(x)
  const seats = m.seatsOf(x)
  const sizes = m.sizes(x)
  const total = sizes.reduce((a, b) => a + b, 0)
  const wq = m.walkQueue(x)
  const hotel = m.hotel()

  const Head = ({ i, children }: { i: number; children: string }) => (
    <StepHead open={isOpen(i)} onToggle={() => A.toggleStep(k, i, isOpen(i))}>
      {children}
    </StepHead>
  )

  return (
    <div className={s.cascade}>
      <div className={s.row}>
        <input className={inputClass} style={{ flex: '1 1 100%', fontSize: 12.5, fontWeight: 700, borderRadius: 9 }} value={x.n} placeholder="Name this movement" onChange={(e) => A.patchMove(m, x, { nm: e.target.value })} aria-label="Movement name" />
        <span className={iconRowClass} style={{ flex: '1 1 100%' }}>
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
                A.patchMove(m, x, { icon: A.addUploadedIcon(f.name, await readFileAsDataUrl(f)) })
              }}
            />
          </label>
          {m.iconList().map((ic) => {
            const on = ic.id === x.icon
            return (
              <button key={ic.id} className={iconPickClass} title={ic.l} onClick={() => A.patchMove(m, x, { icon: ic.id })} style={on ? { background: act.hex, color: '#fff', borderColor: act.hex } : undefined}>
                <Glyph icon={ic.id} size={14} />
              </button>
            )
          })}
        </span>
        <Pill small onClick={() => A.setAllSteps(k, !allShut)} style={{ fontSize: 10.5, fontWeight: 700 }}>
          {allShut ? 'Open all steps' : 'Collapse steps'}
        </Pill>
      </div>

      <Head i={1}>1 · How many delegates</Head>
      {isOpen(1) && (
        <div className={s.stepBody}>
          <div className={s.row}>
            <Stepper label="Delegates" value={n(total)} onMinus={() => A.setTotal(m, x, -5)} onPlus={() => A.setTotal(m, x, 5)} numStyle={{ minWidth: 44, fontSize: 14 }} />
          </div>
        </div>
      )}

      <Head i={2}>2 · When they go and come back</Head>
      {isOpen(2) && (
        <div className={s.stepBody}>
          <div className={s.row} style={{ paddingBottom: 2 }}>
            {(
              [
                ['out', 'Egress only'],
                ['both', 'Out and back'],
                ['in', 'Ingress only'],
              ] as const
            ).map(([id, l]) => (
              <Pill key={id} hex={null} on={dir === id} onClick={() => A.setDir(m, x, id)}>
                {l}
              </Pill>
            ))}
          </div>
          <div className={s.row}>
            {dir !== 'in' && <Stepper label="Out" value={hhmm(x.s)} onMinus={() => A.shiftTime(m, x, 's', -5)} onPlus={() => A.shiftTime(m, x, 's', 5)} />}
            {dir !== 'out' && <Stepper label={dir === 'in' ? 'Arrives' : 'Back'} value={hhmm(x.e)} onMinus={() => A.shiftTime(m, x, 'e', -5)} onPlus={() => A.shiftTime(m, x, 'e', 5)} />}
            <span className={s.lead}>
              {dir === 'in'
                ? `Arrives ${hhmm(x.e)} — nothing leaves the hotel`
                : `Volunteers on post ${hhmm(x.s - 45)}, loading ${hhmm(x.s - 20)}` + (dir === 'both' ? ` · back ${hhmm(x.e)}` : '')}
            </span>
          </div>
        </div>
      )}

      <Head i={3}>3 · What moves them</Head>
      {isOpen(3) && (
        <div className={s.stepBody}>
          <div className={s.row}>
            <Pill hex={null} on={cur === 'walk'} onClick={() => A.setMode(m, x, 'walk')}>
              <Glyph icon="walk" size={13} /> On foot
            </Pill>
            {m.tports().map((tt) => (
              <Pill key={tt.id} hex={tt.hex} on={cur === tt.id} onClick={() => A.setMode(m, x, tt.id)}>
                <Glyph icon={tt.icon} g={tt.g} size={13} /> {tt.l}
              </Pill>
            ))}
            <IconBtn onClick={() => A.openStudio('tport')} title="Set up global transport">
              ⚙
            </IconBtn>
            {!tp && (
              <span className={s.row} style={{ flex: '1 1 100%', padding: 0, gap: 5 }}>
                <Micro>Queue on foot?</Micro>
                <Pill hex={null} on={wq} onClick={() => A.patchMove(m, x, { wq: 1 })}>
                  Yes
                </Pill>
                <Pill hex={null} on={!wq} onClick={() => A.patchMove(m, x, { wq: 0, q: '' })}>
                  No
                </Pill>
                <span className={s.lead}>
                  {wq ? 'They form up before they leave, so the groups and signs below apply.' : 'They walk straight out — no queue to build, no signs needed.'}
                </span>
              </span>
            )}
          </div>
          {tp && (
            <div className={s.row} style={{ borderTop: '1px dashed var(--color-neutral-300)', marginTop: 3 }}>
              <span className={s.vehName}>
                {tp.l}
                <span className={s.vehSub} data-short={seats < x.d ? 'true' : undefined}>
                  {tp.seats || 0} seats each · {n(seats)} for {n(x.d)} delegates
                </span>
              </span>
              <Stepper value={String(nV)} onMinus={() => A.bumpVehicles(m, x, -1)} onPlus={() => A.bumpVehicles(m, x, 1)} numStyle={{ minWidth: 21 }} />
            </div>
          )}
        </div>
      )}

      <Head i={4}>4 · How they split</Head>
      {isOpen(4) && (
        <div className={s.stepBody}>
          <div className={s.row}>
            <Stepper label="Per group" value={String(m.gsize(x))} onMinus={() => A.setGsize(m, x, -5)} onPlus={() => A.setGsize(m, x, 5)} />
            <Stepper label="Groups" value={String(sizes.length)} onMinus={() => A.setGroupCount(m, x, -1)} onPlus={() => A.setGroupCount(m, x, 1)} />
          </div>
          {sizes.map((v, i) => (
            <div key={i} className={s.groupRow}>
              <span className={s.groupLabel}>
                {x.n} · {hotel?.code || ''}
                {sizes.length > 1 ? ' ' + (i + 1) : ''}
              </span>
              <Stepper value={String(v)} onMinus={() => A.setGroupSize(m, x, i, -5)} onPlus={() => A.setGroupSize(m, x, i, 5)} />
            </div>
          ))}
        </div>
      )}

      <Head i={5}>5 · Where they queue</Head>
      {isOpen(5) && (
        <div className={s.stepBody}>
          <div className={s.row} style={{ paddingBottom: 2 }}>
            {[{ id: '', l: 'No queue' }, ...m.spaces2().map((r) => ({ id: r.id, l: r.l })), { id: 'kerb', l: 'Front drive · kerbside' }].map((o) => (
              <Pill key={o.id} hex={null} on={(x.q || '') === o.id} onClick={() => A.patchMove(m, x, { q: o.id })}>
                {o.l}
              </Pill>
            ))}
            <Pill tone="dashed" hex={null} on={false} onClick={() => A.addSpace2(m, undefined, x)}>
              ＋ Space
            </Pill>
            <IconBtn onClick={() => A.openStudio('act')} title="Setup studio">
              ⚙
            </IconBtn>
          </div>
        </div>
      )}

      <Head i={6}>6 · What signs it needs</Head>
      {isOpen(6) && (
        <div className={s.stepBody}>
          <div className={s.row}>
            {m.signTypes().map((st) => (
              <span key={st.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} title={st.l}>
                <span className={s.signG} style={{ background: st.hex }}>
                  <Glyph icon={st.icon} size={12} />
                </span>
                <Stepper label={st.l} value={String(m.signCount(x, st))} onMinus={() => A.bumpSign(m, x, st, -1)} onPlus={() => A.bumpSign(m, x, st, 1)} />
              </span>
            ))}
            <IconBtn onClick={() => A.openStudio('sign')} title="Set up global signage">
              ⚙
            </IconBtn>
            <span className={s.lead}>{x.q ? 'One per group where it makes sense, one per space otherwise — adjust any of them.' : 'Pick a queuing space and the signs follow it.'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StepHead({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: string }) {
  return (
    <button className={s.stepHead} data-open={open ? 'true' : undefined} onClick={onToggle} aria-expanded={open}>
      <Chevron open={open} size={13} weight={3} />
      {children}
    </button>
  )
}
