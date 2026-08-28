// Flow planner — the site, as ONE flow:
//   blank → footprint (upload / pull the map / draw) → walls → places → Go live.
// Draft is the 2D drafting surface; Go live stands the same site up in 3D.
// The chrome reserves its own space (never sticky); the model wrapper is the
// height authority and the surface fills it exactly — zero internal scroll.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { SUITES, clockOf } from '@/model/library'
import { PLANS } from '@/data/plans'
import { buildScene2 } from './buildScene2'
import type { SceneV2 } from '@/model/types'
import { wallLength } from '@/model/site2'
import { Glyph, IconBtn, Pill, Stepper, VSep, inputClass } from '@/ui'
import { dayLabel, dim } from '@/lib/format'
import { DraftCanvas, type DraftCanvasHandle } from './draft/DraftCanvas'
import { LiveCanvas } from './live/LiveCanvas'
import { readPlanFile } from './readPlan'
import s from './planner.module.css'

export function FlowPlanner() {
  const m = useModel()
  const ui = m.ui
  const isDraft = ui.pmode === 'plan'
  const draftRef = useRef<DraftCanvasHandle>(null)
  const [pulling, setPulling] = useState(false)

  // the surfaces poll the scene; this ref always points at the latest one
  const scene = useMemo(() => buildScene2(m), [m])
  const sceneRef = useRef<SceneV2>(scene)
  sceneRef.current = scene
  const getScene = useCallback(() => sceneRef.current, [])

  const site = m.site2()
  const frame = m.frame2()
  const units = ui.units
  const drawer = ui.drawer
  const suite = SUITES.find((x) => x.id === ui.psuite) || SUITES[0]!
  const hotel = m.hotel()
  const hits = PLANS[hotel?.name || ''] || []
  const dates = m.dateList()
  const dateIdx = dates.indexOf(m.iso())
  const sel = ui.sel
  const selItem = sel?.kind === 'item' ? site.items.find((x) => x.id === sel.id) : null
  const selSpace = sel?.kind === 'space' ? site.spaces.find((x) => x.id === sel.id) : null
  const selWall = sel?.kind === 'wall' ? site.walls.find((x) => x.id === sel.id) : null
  const [planOpen, setPlanOpen] = useState(true)

  const hint = (() => {
    if (!site.established && isDraft) return 'Pick where the geometry comes from — everything after that is drawn in place'
    if (ui.ptool) return `Click to drop ${ui.ptool.l} — hold Alt to keep placing · Esc to stop`
    if (isDraft && ui.dtool === 'wall') return 'Trace along the plan · Enter finishes a run · walls rise when you Go live'
    if (isDraft && ui.dtool === 'space') return 'Drag where a queue will stand — the simulation fills it'
    if (isDraft && ui.dtool === 'cal') return 'Two clicks on a known distance set the scale for everything'
    if (!isDraft) return 'Drag to orbit · click a piece to select it · drag it to move it'
    return 'Click anything to select it · right-click for tools'
  })()

  const onUpload = async (f: File | undefined) => {
    if (!f) return
    await readPlanFile(m, f)
  }
  const pullMap = async () => {
    const g = scene.hotelGeo
    if (!g || pulling) return
    setPulling(true)
    const ok = await draftRef.current?.pullMap(g.lat, g.lon)
    setPulling(false)
    if (!ok) A.establish2(m) // tiles unreachable — start from a blank frame instead
  }

  return (
    <div className={s.pane}>
      <div className={s.chrome}>
        <div className={s.chromeRow}>
          {(
            [
              ['plan', 'Draft'],
              ['live', 'Go live'],
            ] as const
          ).map(([id, l]) => (
            <Pill key={id} tone="quiet" on={ui.pmode === id} onClick={() => A.setPmode(id)}>
              {l}
            </Pill>
          ))}
          {isDraft && site.established && (
            <>
              <VSep />
              <DraftTools draftRef={draftRef} />
            </>
          )}
          <VSep />
          {(
            [
              ['place', 'Place', '＋', 'Furniture, signs, people, vehicles'],
              ['layers', 'Layers', '◍', 'What the model draws'],
              ['plans', 'Site', '⌗', 'Underlay, ground, floors, units'],
            ] as const
          ).map(([id, l, g, title]) => (
            <Pill key={id} tone="quiet" on={drawer === id} onClick={() => A.setDrawer(drawer === id ? null : id)} title={title}>
              <span style={{ fontSize: 13, lineHeight: 1, opacity: drawer === id ? 1 : 0.7 }}>{g}</span>
              {l}
            </Pill>
          ))}
          <VSep />
          <IconBtn onClick={() => dateIdx > 0 && A.setDate(dates[dateIdx - 1]!)} title="Previous day" style={{ borderRadius: 12, border: 0, background: 'var(--color-neutral-200)', fontSize: 15 }}>
            ‹
          </IconBtn>
          <IconBtn onClick={() => dateIdx < dates.length - 1 && A.setDate(dates[dateIdx + 1]!)} title="Next day" style={{ borderRadius: 12, border: 0, background: 'var(--color-neutral-200)', fontSize: 15 }}>
            ›
          </IconBtn>
          <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{dayLabel(m.iso())}</span>
          <span style={{ flex: 1 }} />
          <span className={s.originNote}>{hint}</span>
          <Pill small onClick={() => setPlanOpen((v) => !v)} style={{ fontWeight: 700 }}>
            {planOpen ? 'Hide ▴' : 'Show ▾'}
          </Pill>
        </div>

        {/* the selection, editable right here — never a modal */}
        {(selItem || selSpace || selWall) && (
          <div className={s.chromeRow} style={{ gap: 9 }}>
            {selItem && (
              <>
                <span className={s.itemTile}>{SUITES.find((x) => x.kind === selItem.kind)?.items.find((y) => y.t === selItem.t)?.g || '◻'}</span>
                <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{selItem.l}</span>
                <Stepper value={`${selItem.rot || 0}°`} size="sm" onMinus={() => A.rotateItem2(m, selItem.id, -15)} onPlus={() => A.rotateItem2(m, selItem.id, 15)} numStyle={{ minWidth: 42, fontSize: 12.5 }} title="Rotate" />
                <Pill small onClick={() => A.duplicateItem2(m, selItem.id)} style={{ fontWeight: 700 }}>
                  Duplicate
                </Pill>
                <Pill tone="soft" small onClick={() => A.deleteItem2(m, selItem.id)} title="Delete or Backspace">
                  Remove ⌫
                </Pill>
              </>
            )}
            {selSpace && (
              <>
                <input className={inputClass} style={{ minWidth: 150, fontWeight: 700, background: 'var(--color-bg)' }} value={selSpace.l} placeholder="Space name" onChange={(e) => A.renameSpace2(m, selSpace.id, e.target.value)} aria-label="Space name" />
                <Stepper label="Width" value={dim(selSpace.w, units)} size="sm" onMinus={() => A.patchSpace2(m, selSpace.id, { w: Math.max(2, selSpace.w - 1) })} onPlus={() => A.patchSpace2(m, selSpace.id, { w: selSpace.w + 1 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                <Stepper label="Depth" value={dim(selSpace.d, units)} size="sm" onMinus={() => A.patchSpace2(m, selSpace.id, { d: Math.max(2, selSpace.d - 1) })} onPlus={() => A.patchSpace2(m, selSpace.id, { d: selSpace.d + 1 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                <Stepper label="Floor" value={String(selSpace.lvl || 0)} size="sm" onMinus={() => A.patchSpace2(m, selSpace.id, { lvl: Math.max(0, (selSpace.lvl || 0) - 1) })} onPlus={() => A.patchSpace2(m, selSpace.id, { lvl: (selSpace.lvl || 0) + 1 })} numStyle={{ minWidth: 32, fontSize: 12.5 }} />
                <Pill tone="soft" small onClick={() => A.deleteSpace2(m, selSpace.id)} title="Delete or Backspace">
                  Remove ⌫
                </Pill>
              </>
            )}
            {selWall && (
              <>
                <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                  Wall · {dim(wallLength(selWall), units)} · {selWall.pts.length} points
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>Drag it to move · drag a corner to reshape</span>
                <Pill tone="soft" small onClick={() => A.deleteWall(m, selWall.id)} title="Delete or Backspace">
                  Remove ⌫
                </Pill>
              </>
            )}
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
            <label className={s.uploadPlan} data-has={site.underlay ? 'true' : undefined} title="Upload a floor plan (PDF or image)">
              {site.underlay ? 'Replace the plan' : 'Upload plan'}
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
            </label>
            {site.underlay && (
              <Pill small onClick={() => A.setUnderlay2(m, null)}>
                Remove underlay
              </Pill>
            )}
            <Pill small onClick={() => void pullMap()} disabled={!scene.hotelGeo || pulling}>
              {pulling ? 'Pulling tiles…' : site.map ? 'Refresh the map' : 'Pull the real map'}
            </Pill>
            <VSep />
            <Stepper label="Wall height" value={dim(site.wallH, units)} size="sm" onMinus={() => A.setWallH(m, site.wallH - 0.25)} onPlus={() => A.setWallH(m, site.wallH + 0.25)} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Stepper label="Front drive" value={dim(frame.kerb, units)} size="sm" onMinus={() => A.setFrame(m, { kerb: Math.max(3, frame.kerb - 1) })} onPlus={() => A.setFrame(m, { kerb: Math.min(40, frame.kerb + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Stepper label="Road" value={dim(frame.street, units)} size="sm" onMinus={() => A.setFrame(m, { street: Math.max(4, frame.street - 1) })} onPlus={() => A.setFrame(m, { street: Math.min(30, frame.street + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
            <Pill small onClick={() => A.setUnits(units === 'ft' ? 'm' : 'ft')} title="Switch units">
              {units === 'ft' ? 'Feet' : 'Metres'}
            </Pill>
            {hits.length > 0 && (
              <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', flex: '1 1 200px', lineHeight: 1.4 }}>
                On file: {hits[0]!.title} —{' '}
                <a href={hits[0]!.src} target="_blank" rel="noreferrer">
                  open it
                </a>{' '}
                and upload the page you want to trace.
              </span>
            )}
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
              <Pill small onClick={() => A.setPendingUpload(null)}>
                Dismiss
              </Pill>
            </div>
          </div>
        )}
      </div>

      {planOpen && (
        <>
          <div className={s.modelWrap} style={{ position: 'relative' }}>
            {isDraft ? <DraftCanvas ref={draftRef} getScene={getScene} /> : <LiveCanvas getScene={getScene} />}
            {/* nothing is drawn until the site is real */}
            {!site.established && isDraft && (
              <div className={s.establish}>
                <div className={s.estCard}>
                  <h3 className={s.estTitle}>{hotel?.short || 'This hotel'} has no plan yet</h3>
                  <p className={s.estNote}>Pick where the geometry comes from — add the others afterwards.</p>
                  <div className={s.routes}>
                    <label className={s.route}>
                      <em>⌗</em>
                      <span>
                        <b>Upload a floor plan</b>
                        <i>{hits.length ? hits[0]!.title + ' — Praxis has this on file' : 'The hotel’s event-space PDF, or any plan image'}</i>
                      </span>
                      <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
                    </label>
                    <button className={s.route} onClick={() => void pullMap()} disabled={!scene.hotelGeo || pulling}>
                      <em>◉</em>
                      <span>
                        <b>{pulling ? 'Pulling the map…' : 'Pull the real map'}</b>
                        <i>{scene.hotelGeo ? 'OpenStreetMap around the hotel — traced to scale' : 'No coordinates for this hotel yet'}</i>
                      </span>
                    </button>
                    <button className={s.route} onClick={() => A.establish2(m)}>
                      <em>▦</em>
                      <span>
                        <b>Draw from scratch</b>
                        <i>Start with a blank ground and trace the walls yourself</i>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!site.established && !isDraft && (
              <div className={s.establish} style={{ pointerEvents: 'none' }}>
                <div className={s.estCard} style={{ pointerEvents: 'auto' }}>
                  <h3 className={s.estTitle}>Nothing standing yet</h3>
                  <p className={s.estNote}>This hotel has no footprint. Switch to Draft to upload a plan and trace its walls — then Go live stands them up.</p>
                  <Pill tone="primary" onClick={() => A.setPmode('plan')}>
                    Go to Draft
                  </Pill>
                </div>
              </div>
            )}
          </div>
          {!isDraft && (
            <div className={s.clockBar}>
              <Pill on={ui.playing} onClick={A.togglePlay} style={{ flex: 'none', fontWeight: 700 }} title="Play the day">
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

/** The drafting tools: drawn icons, colour-coded per class. */
function DraftTools({ draftRef }: { draftRef: React.RefObject<DraftCanvasHandle | null> }) {
  const m = useModel()
  const cur = m.ui.dtool
  const set = (id: 'select' | 'wall' | 'space' | 'cal') => {
    A.setDraftTool(m.ui.dtool === id && id !== 'select' ? 'select' : id)
    draftRef.current?.clearTool()
  }
  return (
    <>
      <T icon="arrow" hex="#2f4bd8" title="Select and move" on={cur === 'select'} onClick={() => set('select')} />
      <T icon="grid" hex="#33373d" title="Wall tool — trace the walls" on={cur === 'wall'} onClick={() => set('wall')} />
      <T icon="table" hex="#0f8f86" title="Queue space — drag where people will stand" on={cur === 'space'} onClick={() => set('space')} />
      <T icon="split" hex="#c67139" title="Set the scale from a known distance" on={cur === 'cal'} onClick={() => set('cal')} />
      <T icon="clipboard" hex="#7a8a5e" title="Import the builder’s desks and signs as editable objects" on={false} onClick={() => A.importDerived2(m)} />
      <T icon="sun" hex="#6b6a67" title="Underlay opacity" on={false} onClick={() => draftRef.current?.cycleOpacity()} />
      <button className={s.tool} style={{ background: '#6b6a671f', color: '#6b6a67', fontSize: 16, fontWeight: 700 }} title="Zoom in" onClick={() => draftRef.current?.zoomBy(1.4)}>
        ＋
      </button>
      <button className={s.tool} style={{ background: '#6b6a671f', color: '#6b6a67', fontSize: 16, fontWeight: 700 }} title="Zoom out" onClick={() => draftRef.current?.zoomBy(1 / 1.4)}>
        −
      </button>
      <button className={s.tool} style={{ background: '#6b6a671f', color: '#6b6a67', width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, borderRadius: 999 }} title="Fit the site" onClick={() => draftRef.current?.fitNow()}>
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
