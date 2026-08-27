// Flow planner — the site. Two modes: Plan (2D drafting) and Go live (3D).
// The chrome reserves its own space (never sticky); the model wrapper is the
// height authority and the surface fills it exactly — zero internal scroll.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useModel } from '@/model/useModel'
import { useStore } from '@/state/store'
import * as A from '@/state/actions'
import { SUITES, clockOf } from '@/model/library'
import { planSearches } from '@/data/plans'
import { buildScene } from './buildScene'
import type { Scene } from '@/model/types'
import { Glyph, IconBtn, Micro, Pill, Stepper, VSep, inputClass } from '@/ui'
import { dayLabel, dim } from '@/lib/format'
import { PlanCanvas, type PlanCanvasHandle } from './plan/PlanCanvas'
import { LiveCanvas } from './live/LiveCanvas'
import { readPlanFile } from './readPlan'
import s from './planner.module.css'

export function FlowPlanner() {
  const m = useModel()
  const ui = m.ui
  const isPlan = ui.pmode === 'plan'
  const planRef = useRef<PlanCanvasHandle>(null)

  // the surfaces poll the scene; this ref always points at the latest one
  const scene = useMemo(() => buildScene(m), [m])
  const sceneRef = useRef<Scene>(scene)
  sceneRef.current = scene
  const getScene = useCallback(() => sceneRef.current, [])

  const site = m.site()
  const units = ui.units
  const drawer = ui.drawer
  const suite = SUITES.find((x) => x.id === ui.psuite) || SUITES[0]!
  const hotel = m.hotel()
  const hits = scene.planHits
  const meta = scene.hotelMeta
  const dates = m.dateList()
  const dateIdx = dates.indexOf(m.iso())
  const pickRoom = ui.sitePick ? m.rooms().find((r) => r.id === ui.sitePick) : null
  const pickBox = pickRoom ? m.roomBox(pickRoom, m.innerRooms().indexOf(pickRoom)) : null
  const pickItem = ui.ipick ? m.itemsOf().find((x) => x.id === ui.ipick) : null
  const itemGlyph = pickItem ? SUITES.find((x) => x.kind === pickItem.kind)?.items.find((y) => y.t === pickItem.t)?.g || '◻' : ''

  const drawerHint = (() => {
    if (drawer === 'place') return ui.ptool ? `Click to drop ${ui.ptool.l} — stays armed · Esc to stop` : 'Pick a suite, then an object. Drag to move · ⌫ to delete'
    if (drawer === 'space') return ui.sitePick || ui.ipick ? 'Editing the selection' : 'Click a space or object on the plan'
    if (drawer === 'layers') return 'Toggle what the model draws'
    if (drawer === 'plans') return 'Trace a real plan under the model'
    return 'Drag spaces · Go live to stand it up'
  })()

  const [planOpen, setPlanOpen] = useState(true)

  const onUpload = async (f: File | undefined) => {
    if (!f) return
    await readPlanFile(m, f)
  }
  const findPlans = () => {
    if (ui.finder) return A.setFinder(null)
    A.setFinder('looking')
    setTimeout(() => {
      if (useStore.getState().ui.finder === 'looking') A.setFinder('done')
    }, 700)
  }

  return (
    <div className={s.pane}>
      <div className={s.chrome}>
        <div className={s.chromeRow}>
          {(
            [
              ['plan', 'Plan'],
              ['live', 'Go live'],
            ] as const
          ).map(([id, l]) => (
            <Pill key={id} tone="quiet" on={ui.pmode === id} onClick={() => A.setPmode(id)}>
              {l}
            </Pill>
          ))}
          <VSep />
          {(
            [
              ['place', 'Place', '＋', 'Furniture, signs, people, vehicles'],
              ['space', 'Space', '⤢', 'Rename, resize, floors, road and site'],
              ['layers', 'Layers', '◍', 'What the model draws'],
              ['plans', 'Plans', '⌗', 'Find or upload a floor plan'],
            ] as const
          ).map(([id, l, g, title]) => (
            <Pill key={id} tone="quiet" on={drawer === id} onClick={() => A.setDrawer(drawer === id ? null : id)} title={title}>
              <span style={{ fontSize: 13, lineHeight: 1, opacity: drawer === id ? 1 : 0.7 }}>{g}</span>
              {l}
            </Pill>
          ))}
          {isPlan && (
            <>
              <VSep />
              <PlanTools planRef={planRef} />
              <VSep />
              <IconBtn onClick={() => dateIdx > 0 && A.setDate(dates[dateIdx - 1]!)} title="Previous day" style={{ borderRadius: 12, border: 0, background: 'var(--color-neutral-200)', fontSize: 15 }}>
                ‹
              </IconBtn>
              <IconBtn onClick={() => dateIdx < dates.length - 1 && A.setDate(dates[dateIdx + 1]!)} title="Next day" style={{ borderRadius: 12, border: 0, background: 'var(--color-neutral-200)', fontSize: 15 }}>
                ›
              </IconBtn>
              <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{dayLabel(m.iso())}</span>
            </>
          )}
          <span style={{ flex: 1 }} />
          <span className={s.originNote}>{drawerHint}</span>
          <Pill small onClick={() => setPlanOpen((v) => !v)} style={{ fontWeight: 700 }}>
            {planOpen ? 'Hide ▴' : 'Show ▾'}
          </Pill>
        </div>

        {ui.finder && (
          <div className={s.finder}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16, flex: 1 }}>
                {ui.finder === 'looking' ? 'Looking for published plans…' : hits.length ? 'Found a floor plan' : 'No published plan on file'}
              </span>
              <Pill tone="primary" small onClick={() => A.setFinder(null)}>
                Done
              </Pill>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', lineHeight: 1.45 }}>
              {ui.finder === 'looking'
                ? `Checking this project, then the hotel's own event-space collateral for ${hotel?.name}.`
                : hits.length
                  ? `Matched on ${hotel?.name}${meta.addr ? ' · ' + meta.addr : ''}. Using it names the spaces in the model and keeps their real proportions.`
                  : `Nothing on file for ${hotel?.name}${meta.addr ? ' · ' + meta.addr : ''}. Run one of these searches and upload what you find, or keep the measured spaces already in the model.`}
            </span>
            {ui.finder === 'done' &&
              hits.map((p) => (
                <div key={p.title} className={s.hit}>
                  <span className={s.hitBadge}>{p.kind}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, letterSpacing: '-.01em' }}>{p.title}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 2 }}>{[p.where, p.year, p.note].filter(Boolean).join(' · ')}</span>
                  </span>
                  <a href={p.src} target="_blank" rel="noreferrer" className={s.openLink}>
                    Open
                  </a>
                  <Pill
                    tone="primary"
                    small
                    onClick={() => {
                      const rs = m.rooms()
                      ;(p.rooms || []).forEach((nm, i) => {
                        if (rs[i]) A.renameRoom(rs[i]!.id, nm)
                      })
                      A.setFinder(null)
                    }}
                  >
                    Use this plan
                  </Pill>
                </div>
              ))}
            {ui.finder === 'done' &&
              !hits.length &&
              planSearches(hotel?.name || '', meta.addr).map((x) => (
                <a key={x.l} href={x.url} target="_blank" rel="noreferrer" className={s.searchLink}>
                  {x.l} ↗
                </a>
              ))}
          </div>
        )}

        {drawer === 'layers' && (
          <div className={s.chromeRow} style={{ gap: 6 }}>
            {(
              [
                ['delegates', 'Delegates'],
                ['volunteers', 'Volunteers'],
                ['vehicles', 'Vehicles'],
                ['queues', 'Queue lanes'],
                ['zones', 'Spaces'],
                ['labels', 'Labels'],
              ] as const
            ).map(([id, l]) => {
              const on = scene.layers[id]
              return (
                <button key={id} className={s.layer} data-on={on ? 'true' : undefined} onClick={() => A.toggleLayer(id)} aria-pressed={on}>
                  <span className={s.layerBox} data-on={on ? 'true' : undefined} />
                  {l}
                </button>
              )
            })}
          </div>
        )}

        {drawer === 'place' && (
          <div className={s.chromeRow}>
            {SUITES.map((su) => {
              const on = suite.id === su.id
              return (
                <button key={su.id} className={s.suite} style={on ? { background: su.hex, color: '#fff' } : undefined} onClick={() => A.setSuite(su.id)}>
                  <span className={s.suiteG} style={{ background: on ? 'rgba(255,255,255,.24)' : su.hex }}>
                    {su.items[0]!.g}
                  </span>
                  {su.l}
                </button>
              )
            })}
            <VSep />
            {suite.items.map((it) => {
              const on = ui.ptool?.t === it.t && ui.ptool?.kind === suite.kind
              const hx = suite.hex
              return (
                <button
                  key={it.t}
                  className={s.item}
                  style={{ background: on ? hx + '1f' : 'var(--color-bg)', color: on ? 'var(--color-text)' : 'var(--color-neutral-700)', borderColor: on ? hx : 'var(--color-neutral-300)' }}
                  onClick={() => A.armTool(on ? null : { ...it, kind: suite.kind })}
                  aria-pressed={on}
                >
                  <span className={s.itemG} style={{ background: on ? hx : hx + '26', color: on ? '#fff' : hx }}>
                    {it.g}
                  </span>
                  {it.l}
                  <span className={s.itemSub}>{it.sub}</span>
                </button>
              )
            })}
          </div>
        )}

        {drawer === 'plans' && (
          <div className={s.chromeRow} style={{ gap: 7 }}>
            <Pill tone="primary" onClick={findPlans}>
              Find floor plans
            </Pill>
            <label className={s.uploadPlan} data-has={site.plan ? 'true' : undefined} title="Upload a floor plan">
              Upload plan
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
            </label>
            <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', flex: '1 1 220px', lineHeight: 1.4 }}>
              A traced plan sets real proportions. Praxis checks its own library first, then the hotel’s own collateral.
            </span>
          </div>
        )}

        {drawer === 'space' && (
          <div className={s.chromeRow} style={{ gap: 9 }}>
            {pickRoom && pickBox && (
              <>
                <input className={inputClass} style={{ minWidth: 150, fontWeight: 700, background: 'var(--color-bg)' }} value={pickRoom.l} placeholder="Space name" onChange={(e) => A.renameRoom(pickRoom.id, e.target.value)} aria-label="Space name" />
                <Stepper label="Width" value={dim(pickBox.w, units)} size="sm" onMinus={() => A.patchRoom(m, pickRoom.id, { w: Math.max(2, pickBox.w - 1) })} onPlus={() => A.patchRoom(m, pickRoom.id, { w: pickBox.w + 1 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                <Stepper label="Depth" value={dim(pickBox.d, units)} size="sm" onMinus={() => A.patchRoom(m, pickRoom.id, { d: Math.max(2, pickBox.d - 1) })} onPlus={() => A.patchRoom(m, pickRoom.id, { d: pickBox.d + 1 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                <VSep />
              </>
            )}
            {pickItem && (
              <>
                <span className={s.itemTile}>{itemGlyph}</span>
                <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{pickItem.l}</span>
                <Stepper value={`${pickItem.rot || 0}°`} size="sm" onMinus={() => A.rotateItem(m, pickItem.id, -15)} onPlus={() => A.rotateItem(m, pickItem.id, 15)} numStyle={{ minWidth: 42, fontSize: 12.5 }} title="Rotate" />
                <Pill small onClick={() => A.duplicateItem(m, pickItem.id)} style={{ fontWeight: 700 }}>
                  Duplicate
                </Pill>
                <Pill tone="soft" small onClick={() => A.removeItem(m, pickItem.id)} title="Delete or Backspace">
                  Remove ⌫
                </Pill>
                <VSep />
              </>
            )}
            <Micro>Floor</Micro>
            {Array.from({ length: m.maxLvl() + 1 }, (_, i) => i).map((i) => (
              <Pill key={i} tone="quiet" on={m.lvl() === i} onClick={() => A.setLevel(i)} style={m.lvl() === i ? { background: 'var(--color-accent-2)', borderColor: 'var(--color-accent-2)' } : undefined}>
                {i === 0 ? 'Ground' : 'Level ' + i}
              </Pill>
            ))}
            <Pill tone="dashed" onClick={() => A.addFloor(m)}>
              ＋ Floor
            </Pill>
            {pickRoom && (
              <Stepper label="Move to" value={String(m.lvlOf(pickRoom.id))} size="sm" onMinus={() => A.patchRoom(m, pickRoom.id, { lvl: Math.max(0, m.lvlOf(pickRoom.id) - 1) })} onPlus={() => A.patchRoom(m, pickRoom.id, { lvl: m.lvlOf(pickRoom.id) + 1 })} numStyle={{ minWidth: 42, fontSize: 12.5 }} />
            )}
            <VSep />
            <Stepper label="Road" value={dim(site.street, units)} size="sm" onMinus={() => A.patchSite(m, { street: Math.max(4, site.street - 1) })} onPlus={() => A.patchSite(m, { street: Math.min(30, site.street + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Stepper label="Front drive" value={dim(site.kerb, units)} size="sm" onMinus={() => A.patchSite(m, { kerb: Math.max(3, site.kerb - 1) })} onPlus={() => A.patchSite(m, { kerb: Math.min(40, site.kerb + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Stepper label="Site width" value={dim(site.w, units)} size="sm" onMinus={() => A.patchSite(m, { w: Math.max(20, site.w - 2) })} onPlus={() => A.patchSite(m, { w: site.w + 2 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Stepper label="Site depth" value={dim(site.d, units)} size="sm" onMinus={() => A.patchSite(m, { d: Math.max(14, site.d - 2) })} onPlus={() => A.patchSite(m, { d: site.d + 2 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Pill small onClick={() => A.setUnits(units === 'ft' ? 'm' : 'ft')} title="Switch units">
              {units === 'ft' ? 'Feet' : 'Metres'}
            </Pill>
          </div>
        )}

        {ui.pendingUp && (
          <div className={s.finder}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
              <span className={s.hitBadge}>READ</span>
              <span style={{ flex: 1, minWidth: 180 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5, letterSpacing: '-.01em' }}>{ui.pendingUp.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 2 }}>{ui.pendingUp.note}</span>
              </span>
              {ui.pendingUp.src && (
                <Pill
                  tone="primary"
                  small
                  onClick={() => {
                    const u = ui.pendingUp!
                    A.patchSite(m, { plan: { src: u.src!, w: site.w, h: site.d } })
                    A.setPendingUpload(null)
                    A.setPmode('plan')
                  }}
                >
                  Incorporate
                </Pill>
              )}
              <Pill small onClick={() => A.setPendingUpload(null)}>
                Discard
              </Pill>
            </div>
          </div>
        )}
      </div>

      {planOpen && (
        <>
          <div className={s.modelWrap}>{isPlan ? <PlanCanvas ref={planRef} getScene={getScene} /> : <LiveCanvas getScene={getScene} />}</div>
          {!isPlan && (
            <div className={s.clockBar}>
              <Pill on={ui.playing} onClick={A.togglePlay} style={{ flex: 'none', fontWeight: 700 }} title="Play the day · Space">
                {ui.playing ? 'Pause' : 'Play the day'}
              </Pill>
              <span className={s.clock}>{clockOf(ui.mins)}</span>
              <input type="range" min={360} max={1350} step={5} value={ui.mins} onChange={(e) => A.scrub(Number(e.target.value))} style={{ flex: '1 1 auto', minWidth: 180, height: 40 }} aria-label="Time of day" />
              {[10, 60, 300].map((v) => (
                <Pill key={v} small on={ui.speed === v} onClick={() => A.setSpeed(v)} style={{ fontSize: 10.5 }}>
                  ×{v}
                </Pill>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** The drafting tools speak the builder's language: drawn icons, colour-coded per class. */
function PlanTools({ planRef }: { planRef: React.RefObject<PlanCanvasHandle | null> }) {
  const m = useModel()
  const cur = m.ui.ptl
  const setTool = (id: 'select' | 'trace' | 'cal') => {
    A.setPlanTool(id)
    planRef.current?.clearTool()
  }
  return (
    <>
      <T icon="arrow" hex="#2f4bd8" title="Select and move" on={cur === 'select'} onClick={() => setTool('select')} />
      <T icon="grid" hex="#a8763f" title="Trace a space over the uploaded plan" on={cur === 'trace'} onClick={() => setTool('trace')} />
      <T icon="split" hex="#c67139" title="Set the scale from a known distance" on={cur === 'cal'} onClick={() => setTool('cal')} />
      <T icon="clipboard" hex="#7a8a5e" title="Import the builder’s people, desks and signs" on={false} onClick={() => A.importDerived(m)} />
      <T icon="sun" hex="#6b6a67" title="Underlay opacity" on={false} onClick={() => planRef.current?.cycleOpacity()} />
      <button className={s.tool} style={{ background: '#6b6a671f', color: '#6b6a67', fontSize: 16, fontWeight: 700 }} title="Zoom in" onClick={() => planRef.current?.zoomBy(1.4)}>
        ＋
      </button>
      <button className={s.tool} style={{ background: '#6b6a671f', color: '#6b6a67', fontSize: 16, fontWeight: 700 }} title="Zoom out" onClick={() => planRef.current?.zoomBy(1 / 1.4)}>
        −
      </button>
      <button className={s.tool} style={{ background: '#6b6a671f', color: '#6b6a67', width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, borderRadius: 999 }} title="Fit the site" onClick={() => planRef.current?.fitNow()}>
        Fit
      </button>
    </>
  )
}

function T({ icon, hex, title, on, onClick }: { icon: string; hex: string; title: string; on: boolean; onClick: () => void }) {
  return (
    <button className={s.tool} style={{ background: on ? hex : hex + '1f', color: on ? '#fff' : hex }} title={title} onClick={onClick} aria-pressed={on}>
      <Glyph icon={icon} size={17} />
    </button>
  )
}
