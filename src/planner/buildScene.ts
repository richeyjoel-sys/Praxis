// Builds the Scene the two view surfaces read: what the builder decided,
// drawn without being placed by hand, plus the callbacks they write through.
// Pure over the model; every callback dispatches a named action.

import type { Model } from '@/model/select'
import type { PlanUnderlay, Scene } from '@/model/types'
import { GEO } from '@/data/geo'
import { PLANS } from '@/data/plans'
import * as A from '@/state/actions'
import { shiftOf } from '@/model/library'

/** Only a decodable raster can be traced; a stale PDF or an oversized blob is dropped. */
export function goodPlan(p: PlanUnderlay | null | undefined): PlanUnderlay | null {
  return p && typeof p.src === 'string' && /^data:image\//.test(p.src) && p.src.length < 2600000 ? p : null
}

export function buildScene(m: Model): Scene {
  const ui = m.ui
  const rh: Record<string, string> = {}
  m.allRoles().forEach((r) => (rh[r.id] = r.hex))
  const lv = m.live().filter((x) => x.phase !== 'Out')
  const layersRaw = ui.layers || {}
  const layers = {} as Scene['layers']
  ;(['delegates', 'volunteers', 'vehicles', 'queues', 'zones', 'labels'] as const).forEach(
    (k) => (layers[k] = layersRaw[k] !== false),
  )
  const cur = m.cover(shiftOf(ui.mins))
  const hotel = m.hotel()
  const site = m.site()

  return {
    plan: m.simPlan(),
    mins: ui.mins,
    hotelName: hotel?.name || '',
    cover: cur,
    roleHex: rh,
    queueRoom: lv[0]?.a.q || 'lobby',
    items: m.itemsOf(),
    derived: m.derived(),
    roomNames: m.roomNames(),
    layers,
    mode: ui.pmode === 'plan' ? 'plan' : 'live',
    tool: ui.ptool,
    underlay: goodPlan(site.plan),
    level: m.lvl(),
    roomLevels: m.roomLevels(),
    itemPick: ui.ipick,
    sitePick: ui.sitePick,
    units: ui.units || 'ft',
    established: !!site.established,
    hotelGeo: GEO[hotel?.name || ''] || null,
    hotelMeta: m.meta(hotel?.name || ''),
    planHits: PLANS[hotel?.name || ''] || [],
    planTool: ui.ptl || 'select',

    onItemPick: (id) => A.pickItem(id),
    onRoom: (id, p) => A.patchRoom(m, id, p),
    onItem: (id, p) => A.patchItem(m, id, p),
    onPlace: (tool, room, x, y) => A.placeItem(m, tool, room, x, y),
    onPick: (id) => A.pickSite(id),
    onNeedPlan: () => A.setDrawer('plans'),
    onPlaced: () => A.armTool(null),
    // a traced rectangle becomes a real space at those exact metres
    onTrace: (r) => {
      const id = A.addRoom(m)
      A.patchRoom(m, id, { x: r.x, y: r.y, w: r.w, d: r.d, lvl: m.lvl() })
      A.pickSite(id)
    },
    // one known distance sets the scale: the underlay and every space grow together
    onCalibrate: ({ factor, anchorX, anchorZ }) => {
      const pl = site.plan || null
      const f = Math.max(0.05, Math.min(20, factor))
      const scale = (v: number, anchor: number) => +(anchor + (v - anchor) * f).toFixed(2)
      const rooms: NonNullable<typeof site.rooms> = {}
      m.innerRooms().forEach((r, i) => {
        const b = m.roomBox(r, i)
        rooms[r.id] = {
          ...(site.rooms || {})[r.id],
          x: scale(b.x, anchorX),
          y: scale(b.y, anchorZ),
          w: +Math.max(2, b.w * f).toFixed(2),
          d: +Math.max(2, b.d * f).toFixed(2),
        }
      })
      A.patchSite(m, {
        w: +Math.max(20, site.w * f).toFixed(1),
        d: +Math.max(20, site.d * f).toFixed(1),
        rooms,
        plan: pl?.src
          ? {
              ...pl,
              wM: +((pl.wM || site.w) * f).toFixed(2),
              hM: +((pl.hM || site.w * 0.7) * f).toFixed(2),
              ox: scale(pl.ox || 0, anchorX),
              oy: scale(pl.oy || 0, anchorZ),
              calibrated: true,
            }
          : pl,
      })
    },
    onRename: (id, l) => A.renameRoom(id, l),
    onRoomLevel: (id, d) => A.patchRoom(m, id, { lvl: Math.max(0, m.lvlOf(id) + d) }),
    onRemoveRoom: (id) => A.removeRoom(id),
    onImport: () => A.importDerived(m),
    onOwn: (id) => A.ownDerived(m, id),
    onDelete: () => {
      if (ui.ipick) A.removeItem(m, ui.ipick)
    },
    onDuplicate: () => {
      if (ui.ipick) A.duplicateItem(m, ui.ipick)
    },
    onRotate: (d) => {
      if (ui.ipick) A.rotateItem(m, ui.ipick, d)
    },
    // the site becomes real: its frame, its spaces laid into it, its provenance
    onEstablish: (p) => {
      const rs = m.innerRooms()
      const names = (p.rooms || []).slice(0, rs.length)
      const pad = 1.5
      const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(rs.length))))
      const rows = Math.ceil(rs.length / cols)
      const cw = (p.siteW - pad * (cols + 1)) / cols
      const cd = (p.siteD - pad * (rows + 1)) / rows
      const rooms: NonNullable<typeof site.rooms> = {}
      rs.forEach((r, i) => {
        const cx = i % cols
        const cy = Math.floor(i / cols)
        rooms[r.id] = {
          ...(site.rooms || {})[r.id],
          x: +(pad + cx * (cw + pad)).toFixed(2),
          y: +(pad + cy * (cd + pad)).toFixed(2),
          w: +Math.max(4, cw).toFixed(2),
          d: +Math.max(4, cd).toFixed(2),
          lvl: 0,
        }
      })
      names.forEach((nm, i) => {
        if (rs[i]) A.renameRoom(rs[i]!.id, nm)
      })
      A.patchSite(m, {
        established: true,
        rooms,
        w: p.siteW,
        d: p.siteD,
        kerb: p.drive,
        street: p.road,
        bays: p.bays,
        tracedFrom: p.map ? 'map' : p.rooms ? 'plan' : 'measured',
      })
      A.pickSite(null)
      A.setLevel(0)
    },
  }
}
