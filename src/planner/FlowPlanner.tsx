// Flow planner — one progression: BUILD the space → FILL it → RUN the day.
// The canvas is the hero. Tools live on it in a slim left rail (only the
// current stage's tools), properties live in a right inspector that overlays
// and never reflows, and every drawing shows a live chip with a ✓ Done button.
// The chrome is a single row: the three stage tabs and the day.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useModel } from '@/model/useModel'
import * as A from '@/state/actions'
import { SUITES, clockOf } from '@/model/library'
import { PLANS } from '@/data/plans'
import { buildScene2 } from './buildScene2'
import type { SceneV2 } from '@/model/types'
import { wallLength } from '@/model/site2'
import { Glyph, Pill, Stepper, inputClass } from '@/ui'
import { dayLabel, dim } from '@/lib/format'
import { DraftCanvas, type DraftCanvasHandle } from './draft/DraftCanvas'
import { LiveCanvas } from './live/LiveCanvas'
import { readPlanFile } from './readPlan'
import s from './planner.module.css'

type Stage = 'build' | 'fill' | 'run'
type Fly = null | 'plan' | 'suite' | 'custom'

export function FlowPlanner() {
  const m = useModel()
  const ui = m.ui
  const draftRef = useRef<DraftCanvasHandle>(null)
  const [pulling, setPulling] = useState(false)

  // the surfaces poll the scene; this ref always points at the latest one
  const scene = useMemo(() => buildScene2(m), [m])
  const sceneRef = useRef<SceneV2>(scene)
  useEffect(() => { sceneRef.current = scene }, [scene])
  const getScene = useCallback(() => sceneRef.current, [])

  const site = m.site2()
  const frame = m.frame2()
  const units = ui.units
  const hotel = m.hotel()
  const hits = PLANS[hotel?.name || ''] || []
  const dates = m.dateList()
  const dateIdx = dates.indexOf(m.iso())
  const sel = ui.sel
  const selItem = sel?.kind === 'item' ? site.items.find((x) => x.id === sel.id) : null
  const selSpace = sel?.kind === 'space' ? site.spaces.find((x) => x.id === sel.id) : null
  const selWall = sel?.kind === 'wall' ? site.walls.find((x) => x.id === sel.id) : null
  const selRoad = sel?.kind === 'road' ? site.roads.find((x) => x.id === sel.id) : null
  const anySel = !!(selItem || selSpace || selWall || selRoad)

  const stage: Stage = ui.pmode === 'live' ? 'run' : ui.stage === 'fill' ? 'fill' : 'build'
  const isDraft = stage !== 'run'
  const suite = SUITES.find((x) => x.id === ui.psuite) || SUITES[0]!

  const [fly, setFly] = useState<Fly>(null)
  const [customName, setCustomName] = useState('')
  // the answered dead-end: what Populate says when there is nothing to place
  const [callout, setCallout] = useState<string | null>(null)

  const onUpload = async (f: File | undefined) => {
    if (!f) return
    setFly(null)
    await readPlanFile(m, f)
  }
  const pullMap = async () => {
    const g = scene.hotelGeo
    if (!g || pulling) return
    setPulling(true)
    setFly(null)
    const ok = await draftRef.current?.pullMap(g.lat, g.lon)
    setPulling(false)
    if (!ok) A.establish2(m) // tiles unreachable — start from a blank frame instead
  }
  const populate = () => {
    if (m.populateItems().length === 0) {
      setCallout(`The schedule for ${dayLabel(m.iso())} is empty — build it first, then populate.`)
      return
    }
    setCallout(null)
    A.importDerived2(m)
  }
  const setTool = (id: 'wall' | 'road' | 'space' | 'cal') => {
    A.setDraftTool(ui.dtool === id ? 'select' : id)
    A.armTool(null)
    setFly(null)
    draftRef.current?.clearTool()
  }
  const openSuite = (id: string) => {
    if (fly === 'suite' && ui.psuite === id) setFly(null)
    else {
      A.setSuite(id)
      setFly('suite')
    }
  }
  const placeCustom = () => {
    const name = customName.trim() || 'Custom item'
    A.armTool({ kind: 'furn', t: 'custom', l: name, g: '◻' })
    setFly(null)
  }

  const wallsDone = site.walls.length > 0
  const planDone = !!site.underlay || !!site.map
  const scaleDone = !!site.scaled

  return (
    <div className={s.pane}>
      {/* the chrome: ONE row — the three stages, then the day */}
      <div className={s.chrome}>
        <div className={s.chromeRow}>
          {(
            [
              ['build', 'BUILD', 'wall', site.established && wallsDone],
              ['fill', 'FILL', 'sparkle', site.items.length > 0],
              ['run', 'RUN', 'play', false],
            ] as const
          ).map(([id, l, ic, done]) => (
            <button key={id} className={s.stage} aria-pressed={stage === id} onClick={() => A.setStage(id)}>
              <Glyph icon={ic} size={19} />
              <b>
                {l}
                {done && stage !== id ? ' ✓' : ''}
              </b>
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button
            className={s.tool}
            style={{ background: 'var(--color-neutral-200)', color: 'var(--color-text)', fontSize: 15 }}
            title="Previous day"
            onClick={() => dateIdx > 0 && A.setDate(dates[dateIdx - 1]!)}
          >
            ‹
          </button>
          <button
            className={s.tool}
            style={{ background: 'var(--color-neutral-200)', color: 'var(--color-text)', fontSize: 15 }}
            title="Next day"
            onClick={() => dateIdx < dates.length - 1 && A.setDate(dates[dateIdx + 1]!)}
          >
            ›
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{dayLabel(m.iso())}</span>
        </div>
      </div>

      <div className={s.modelWrap} style={{ position: 'relative' }}>
        {isDraft ? <DraftCanvas ref={draftRef} getScene={getScene} /> : <LiveCanvas getScene={getScene} />}

        {/* first question: how does the space begin? */}
        {!site.established && isDraft && (
          <div className={s.establish}>
            <div className={s.estCard}>
              <h3 className={s.estTitle}>Build your space</h3>
              <p className={s.estNote}>
                {hotel?.short || 'This hotel'} is bare ground. Choose how the geometry begins — the walls, roads and
                scale tools appear as you need them, and everything stays editable.
              </p>
              <div className={s.routes}>
                <label className={s.route}>
                  <em>
                    <Glyph icon="page" size={17} />
                  </em>
                  <span>
                    <b>Trace a floor plan</b>
                    <i>{hits.length ? hits[0]!.title + ' — Praxis has this on file' : 'Upload the hotel’s event-space PDF or any plan image, then trace over it'}</i>
                  </span>
                  <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
                </label>
                <button className={s.route} onClick={() => void pullMap()} disabled={!scene.hotelGeo || pulling}>
                  <em>
                    <Glyph icon="map" size={17} />
                  </em>
                  <span>
                    <b>{pulling ? 'Pulling the map…' : 'Pull the real map'}</b>
                    <i>{scene.hotelGeo ? 'Aerial OpenStreetMap around the hotel, already to scale' : 'No coordinates for this hotel yet'}</i>
                  </span>
                </button>
                <button
                  className={s.route}
                  onClick={() => {
                    A.establish2(m)
                    A.setDraftTool('wall')
                  }}
                >
                  <em>
                    <Glyph icon="pencil" size={17} />
                  </em>
                  <span>
                    <b>Draw it by hand</b>
                    <i>Blank ground, wall tool in hand — trace the walls yourself</i>
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
              <p className={s.estNote}>This hotel has no space built. Build is where it begins — trace or pull the geometry, and Run stands it up.</p>
              <Pill tone="primary" onClick={() => A.setStage('build')}>
                Go to Build
              </Pill>
            </div>
          </div>
        )}

        {/* LEFT TOOL RAIL: only this stage's tools, label under icon */}
        {isDraft && site.established && stage === 'build' && (
          <div className={s.rail}>
            <button className={s.tile} aria-pressed={fly === 'plan'} onClick={() => setFly(fly === 'plan' ? null : 'plan')} title="The floor plan under your drawing — upload, replace, or pull the real map">
              <Glyph icon="page" size={18} />
              Plan
            </button>
            <button className={s.tile} aria-pressed={ui.dtool === 'cal'} onClick={() => setTool('cal')} title="Set the scale — two clicks on a known distance">
              <Glyph icon="ruler" size={18} />
              Scale
            </button>
            <button className={s.tile} aria-pressed={ui.dtool === 'wall'} onClick={() => setTool('wall')} title="Trace the walls">
              <Glyph icon="wall" size={18} />
              Walls
            </button>
            <button className={s.tile} aria-pressed={ui.dtool === 'road'} onClick={() => setTool('road')} title="Draw roads — bends and side streets welcome">
              <Glyph icon="road" size={18} />
              Roads
            </button>
            <button className={s.tile} aria-pressed={ui.dtool === 'space'} onClick={() => setTool('space')} title="Drag where a queue will stand">
              <Glyph icon="queue" size={18} />
              Zones
            </button>
          </div>
        )}
        {isDraft && site.established && stage === 'fill' && (
          <div className={s.rail}>
            <button className={s.tile} onClick={populate} title="Place the day's schedule — greeters, desks, pick-ups — automatically">
              <Glyph icon="sparkle" size={18} />
              Populate
            </button>
            {(
              [
                ['furn', 'Furniture', 'table'],
                ['sign', 'Signs', 'sign'],
                ['people', 'People', 'person'],
                ['veh', 'Vehicles', 'bus'],
              ] as const
            ).map(([id, l, ic]) => (
              <button key={id} className={s.tile} aria-pressed={fly === 'suite' && ui.psuite === id} onClick={() => openSuite(id)} title={l}>
                <Glyph icon={ic} size={18} />
                {l}
              </button>
            ))}
            <button className={`${s.tile} ${s.tileTop}`} aria-pressed={fly === 'custom'} onClick={() => setFly(fly === 'custom' ? null : 'custom')} title="Add your own item">
              <span style={{ fontSize: 17, lineHeight: '18px', fontWeight: 700 }}>＋</span>
              Custom
            </button>
          </div>
        )}

        {/* the Plan flyout: the ground under the drawing */}
        {isDraft && site.established && stage === 'build' && fly === 'plan' && (
          <div className={s.flyout}>
            <div className={s.flyTitle}>The plan under your drawing</div>
            <label className={s.flyItem}>
              <span className={s.flyG} style={{ background: 'var(--color-accent)' }}>
                <Glyph icon="page" size={14} />
              </span>
              <span>
                <span className={s.flyL}>{site.underlay ? 'Replace the floor plan' : 'Upload a floor plan'}</span>
                <span className={s.flySub} style={{ display: 'block' }}>PDF or image — trace over it</span>
              </span>
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => void onUpload(e.target.files?.[0])} />
            </label>
            <button className={s.flyItem} onClick={() => void pullMap()} disabled={!scene.hotelGeo || pulling}>
              <span className={s.flyG} style={{ background: 'var(--color-accent-2)' }}>
                <Glyph icon="map" size={14} />
              </span>
              <span>
                <span className={s.flyL}>{pulling ? 'Pulling…' : site.map ? 'Refresh the real map' : 'Pull the real map'}</span>
                <span className={s.flySub} style={{ display: 'block' }}>Aerial OpenStreetMap, to scale</span>
              </span>
            </button>
            {site.underlay && (
              <button className={s.flyItem} onClick={() => A.setUnderlay2(m, null)}>
                <span className={s.flyG} style={{ background: 'var(--color-neutral-500)' }}>✕</span>
                <span className={s.flyL}>Remove the underlay</span>
              </button>
            )}
            {(site.underlay || site.map) && (
              <button
                className={s.flyItem}
                onClick={() => {
                  setFly(null)
                  draftRef.current?.startAlign()
                }}
              >
                <span className={s.flyG} style={{ background: '#c67139' }}>
                  <Glyph icon="ruler" size={14} />
                </span>
                <span>
                  <span className={s.flyL}>Straighten the map</span>
                  <span className={s.flySub} style={{ display: 'block' }}>Two clicks along an edge that should run flat</span>
                </span>
              </button>
            )}
            <div style={{ borderTop: '1px solid var(--color-neutral-200)', margin: '8px 0', paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(site.underlay || site.map) && (
                <Stepper label="Turn map" value={`${(site.rot || 0).toFixed(0)}°`} size="sm" onMinus={() => A.rotSite(m, -1)} onPlus={() => A.rotSite(m, 1)} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
              )}
              <Stepper label="Wall height" value={dim(site.wallH, units)} size="sm" onMinus={() => A.setWallH(m, site.wallH - 0.25)} onPlus={() => A.setWallH(m, site.wallH + 0.25)} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
              <Stepper label="Front drive" value={dim(frame.kerb, units)} size="sm" onMinus={() => A.setFrame(m, { kerb: Math.max(3, frame.kerb - 1) })} onPlus={() => A.setFrame(m, { kerb: Math.min(40, frame.kerb + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
              <Stepper label="Main road" value={dim(frame.street, units)} size="sm" onMinus={() => A.setFrame(m, { street: Math.max(4, frame.street - 1) })} onPlus={() => A.setFrame(m, { street: Math.min(30, frame.street + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
              <Pill small onClick={() => A.setUnits(units === 'ft' ? 'm' : 'ft')} title="Switch units">
                Working in {units === 'ft' ? 'feet' : 'metres'}
              </Pill>
            </div>
            {hits.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', lineHeight: 1.45 }}>
                On file: {hits[0]!.title} —{' '}
                <a href={hits[0]!.src} target="_blank" rel="noreferrer">
                  open it
                </a>{' '}
                and upload the page you want to trace.
              </div>
            )}
          </div>
        )}

        {/* the armed category's suite: human names, real sizes */}
        {isDraft && site.established && stage === 'fill' && fly === 'suite' && (
          <div className={s.flyout}>
            <div className={s.flyTitle}>{suite.l} — click one, then click the floor</div>
            {suite.items.map((it) => {
              const on = ui.ptool?.t === it.t && ui.ptool?.kind === suite.kind
              return (
                <button key={it.t} className={s.flyItem} aria-pressed={on} onClick={() => A.armTool(on ? null : { ...it, kind: suite.kind })}>
                  <span className={s.flyG} style={{ background: on ? suite.hex : suite.hex + '33', color: on ? '#fff' : suite.hex }}>
                    {it.g}
                  </span>
                  <span>
                    <span className={s.flyL} style={on ? { color: 'var(--color-accent)' } : undefined}>{it.l}</span>
                    {it.sub && <span className={s.flySub} style={{ display: 'block' }}>{it.sub}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* your own item: name it, place it */}
        {isDraft && site.established && stage === 'fill' && fly === 'custom' && (
          <div className={s.flyout}>
            <div className={s.flyTitle}>Your own item</div>
            <input
              className={inputClass}
              style={{ width: '100%', marginBottom: 8, background: 'var(--color-bg)' }}
              placeholder="Name it — e.g. Piano"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') placeCustom()
              }}
              aria-label="Custom item name"
            />
            <button className={s.finish} style={{ marginTop: 0 }} onClick={placeCustom}>
              Place it on the floor
            </button>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 8, lineHeight: 1.45 }}>
              It lands as a box you can move, rotate and duplicate like anything else.
            </div>
          </div>
        )}

        {/* RIGHT INSPECTOR: the selection's properties, or the stage's checklist */}
        {isDraft && site.established && anySel && (
          <div className={s.inspector}>
            <div className={s.inspTitle}>Selected</div>
            {selItem && (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{selItem.l}</div>
                <div className={s.checkSub} style={{ marginBottom: 11 }}>drag it on the floor to move it</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-neutral-700)' }}>Rotate</span>
                  <Stepper value={`${selItem.rot || 0}°`} size="sm" onMinus={() => A.rotateItem2(m, selItem.id, -15)} onPlus={() => A.rotateItem2(m, selItem.id, 15)} numStyle={{ minWidth: 42, fontSize: 12.5 }} />
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <Pill small onClick={() => A.duplicateItem2(m, selItem.id)} style={{ flex: 1, justifyContent: 'center', fontWeight: 700 }}>
                    Duplicate
                  </Pill>
                  <Pill tone="soft" small onClick={() => A.deleteItem2(m, selItem.id)} style={{ flex: 1, justifyContent: 'center' }} title="Delete or Backspace">
                    Remove
                  </Pill>
                </div>
              </>
            )}
            {selSpace && (
              <>
                <input className={inputClass} style={{ width: '100%', fontWeight: 700, background: 'var(--color-bg)', marginBottom: 9 }} value={selSpace.l} placeholder="Zone name" onChange={(e) => A.renameSpace2(m, selSpace.id, e.target.value)} aria-label="Zone name" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 9 }}>
                  <Stepper label="Width" value={dim(selSpace.w, units)} size="sm" onMinus={() => A.patchSpace2(m, selSpace.id, { w: Math.max(2, selSpace.w - 1) })} onPlus={() => A.patchSpace2(m, selSpace.id, { w: selSpace.w + 1 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                  <Stepper label="Depth" value={dim(selSpace.d, units)} size="sm" onMinus={() => A.patchSpace2(m, selSpace.id, { d: Math.max(2, selSpace.d - 1) })} onPlus={() => A.patchSpace2(m, selSpace.id, { d: selSpace.d + 1 })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                  <Stepper label="Floor" value={String(selSpace.lvl || 0)} size="sm" onMinus={() => A.patchSpace2(m, selSpace.id, { lvl: Math.max(0, (selSpace.lvl || 0) - 1) })} onPlus={() => A.patchSpace2(m, selSpace.id, { lvl: (selSpace.lvl || 0) + 1 })} numStyle={{ minWidth: 32, fontSize: 12.5 }} />
                </div>
                <Pill tone="soft" small onClick={() => A.deleteSpace2(m, selSpace.id)} style={{ width: '100%', justifyContent: 'center' }} title="Delete or Backspace">
                  Remove
                </Pill>
              </>
            )}
            {selRoad && (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Road · {dim(wallLength(selRoad), units)}</div>
                <div className={s.checkSub} style={{ marginBottom: 11 }}>drag it to move · drag a corner to bend it</div>
                <div style={{ marginBottom: 9 }}>
                  <Stepper label="Width" value={dim(selRoad.w, units)} size="sm" onMinus={() => A.patchRoad(m, selRoad.id, { w: Math.max(3, selRoad.w - 1) })} onPlus={() => A.patchRoad(m, selRoad.id, { w: Math.min(30, selRoad.w + 1) })} numStyle={{ minWidth: 44, fontSize: 12.5 }} />
                </div>
                <Pill tone="soft" small onClick={() => A.deleteRoad(m, selRoad.id)} style={{ width: '100%', justifyContent: 'center' }} title="Delete or Backspace">
                  Remove
                </Pill>
              </>
            )}
            {selWall && (
              <>
                <div style={{ fontWeight: 800, fontSize: 14 }}>Wall · {dim(wallLength(selWall), units)}</div>
                <div className={s.checkSub} style={{ marginBottom: 11 }}>
                  {selWall.pts.length} points · drag a corner to reshape · with the wall tool, click either end to continue it
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 9 }}>
                  <Stepper label="Rotate" value="±1°" size="sm" onMinus={() => A.rotateWall(m, selWall.id, -1)} onPlus={() => A.rotateWall(m, selWall.id, 1)} numStyle={{ minWidth: 40, fontSize: 12.5 }} />
                  {selWall.pts.length === 2 && (
                    <Stepper
                      label="Length"
                      value={dim(wallLength(selWall), units)}
                      size="sm"
                      onMinus={() => A.setWallLen(m, selWall.id, wallLength(selWall) - (units === 'ft' ? 0.3048 : 1))}
                      onPlus={() => A.setWallLen(m, selWall.id, wallLength(selWall) + (units === 'ft' ? 0.3048 : 1))}
                      numStyle={{ minWidth: 48, fontSize: 12.5 }}
                    />
                  )}
                </div>
                <Pill tone="soft" small onClick={() => A.deleteWall(m, selWall.id)} style={{ width: '100%', justifyContent: 'center' }} title="Delete or Backspace">
                  Remove
                </Pill>
              </>
            )}
          </div>
        )}
        {isDraft && site.established && !anySel && stage === 'build' && ui.dtool === 'select' && (
          <div className={s.inspector}>
            <div className={s.inspTitle}>Build your space</div>
            {(
              [
                ['Floor plan', planDone, site.underlay ? 'Traced over your upload' : site.map ? 'The real map, to scale' : 'Optional — the Plan tool uploads one', 1],
                ['Scale', scaleDone, scaleDone ? 'Set from a known distance' : 'Scale tool: two clicks on a known length', 2],
                ['Walls', wallsDone, wallsDone ? `${site.walls.length} traced · height ${dim(site.wallH, units)}` : 'Trace them over the plan', 3],
                ['Roads', site.roads.length > 0, site.roads.length ? `${site.roads.length} drawn — bends and side streets` : 'Optional — for queuing vehicles', 4],
                ['Queue zones', site.spaces.length > 0, site.spaces.length ? `${site.spaces.length} placed` : 'Where lines will stand', 5],
              ] as const
            ).map(([l, done, sub, n]) => (
              <div key={l} className={s.check}>
                <span
                  className={s.checkDot}
                  style={done ? { background: 'var(--color-accent-2)', color: '#fff' } : { border: '2px solid var(--color-neutral-400)', color: 'var(--color-neutral-600)' }}
                >
                  {done ? '✓' : n}
                </span>
                <span>
                  <span className={s.checkL} style={{ display: 'block' }}>{l}</span>
                  <span className={s.checkSub}>{sub}</span>
                </span>
              </div>
            ))}
            <button className={s.finish} onClick={() => A.setStage('fill')}>
              Finish build → Fill
            </button>
          </div>
        )}
        {isDraft && site.established && !anySel && stage === 'fill' && !ui.ptool && (
          <div className={s.inspector}>
            <div className={s.inspTitle}>Fill the space</div>
            <div className={s.checkSub} style={{ lineHeight: 1.5, marginBottom: 10 }}>
              {site.items.length
                ? `${site.items.length} thing${site.items.length === 1 ? '' : 's'} placed. Click any of them to move, rotate or remove it.`
                : 'Populate places the day’s schedule automatically — or pick a category on the left and click the floor.'}
            </div>
            <button className={s.finish} onClick={() => A.setStage('run')}>
              Run the day →
            </button>
          </div>
        )}

        {/* layers, in Run, on the canvas edge */}
        {stage === 'run' && site.established && (
          <div className={s.layersCard}>
            <div className={s.inspTitle} style={{ marginBottom: 4 }}>Layers</div>
            {(
              [
                ['delegates', 'Delegates'],
                ['volunteers', 'Volunteers'],
                ['vehicles', 'Vehicles'],
                ['queues', 'Queue lanes'],
                ['zones', 'Zones'],
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

        {/* dead ends answer back */}
        {callout && isDraft && (
          <div className={s.callout}>
            <span>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 12.5 }}>Nothing to place yet</span>
              <span style={{ display: 'block', fontSize: 11.5, color: '#c3c6cd' }}>{callout}</span>
            </span>
            <button
              className={s.calloutGo}
              onClick={() => {
                setCallout(null)
                A.setView('builder')
              }}
            >
              Open Schedule builder
            </button>
            <button className={s.calloutGo} style={{ background: '#33373d', color: '#c3c6cd' }} onClick={() => setCallout(null)}>
              ✕
            </button>
          </div>
        )}
        {ui.pendingUp && isDraft && (
          <div className={s.callout} style={{ top: callout ? 78 : 16 }}>
            <span>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 12.5 }}>{ui.pendingUp.name}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: '#c3c6cd' }}>{ui.pendingUp.note}</span>
            </span>
            <button className={s.calloutGo} style={{ background: '#33373d', color: '#c3c6cd' }} onClick={() => A.setPendingUpload(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* view cluster, bottom-right on the canvas */}
        {isDraft && site.established && (
          <div className={s.zoom}>
            <button className={s.tool} style={{ background: 'var(--color-neutral-200)', color: 'var(--color-neutral-700)' }} title="Underlay opacity" onClick={() => draftRef.current?.cycleOpacity()}>
              <Glyph icon="sun" size={15} />
            </button>
            <button className={s.tool} style={{ background: 'var(--color-neutral-200)', color: 'var(--color-neutral-700)', fontSize: 16, fontWeight: 700 }} title="Zoom in" onClick={() => draftRef.current?.zoomBy(1.4)}>
              ＋
            </button>
            <button className={s.tool} style={{ background: 'var(--color-neutral-200)', color: 'var(--color-neutral-700)', fontSize: 16, fontWeight: 700 }} title="Zoom out" onClick={() => draftRef.current?.zoomBy(1 / 1.4)}>
              −
            </button>
            <button className={s.tool} style={{ background: 'var(--color-neutral-200)', color: 'var(--color-neutral-700)', width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 700, borderRadius: 999 }} title="Fit the site" onClick={() => draftRef.current?.fitNow()}>
              Fit
            </button>
          </div>
        )}
      </div>

      {/* the transport: Run's timeline */}
      {stage === 'run' && (
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
    </div>
  )
}
