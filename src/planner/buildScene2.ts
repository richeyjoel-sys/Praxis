// Builds the SceneV2 both planner surfaces read every frame: the site as
// drawn, what the builder decided, the selection and armed tool, and the
// callbacks the surfaces write back through. Every callback dispatches a
// named action — the surfaces own nothing but the view.

import type { Model } from '@/model/select'
import type { SceneV2 } from '@/model/types'
import { GEO } from '@/data/geo'
import { SEED } from '@/model/scene'
import * as A from '@/state/actions'

export function buildScene2(m: Model): SceneV2 {
  const ui = m.ui
  const rh: Record<string, string> = {}
  m.allRoles().forEach((r) => (rh[r.id] = r.hex))
  const layersRaw = ui.layers || {}
  const layers = {} as SceneV2['layers']
  ;(['delegates', 'volunteers', 'vehicles', 'queues', 'zones', 'labels'] as const).forEach(
    (k) => (layers[k] = layersRaw[k] !== false),
  )
  const hotel = m.hotel()

  return {
    mode: ui.pmode === 'plan' ? 'draft' : 'live',
    site: m.site2(),
    frame: m.frame2(),
    mins: ui.mins,
    hotelName: hotel?.name || '',
    cover: m.cover(m.shiftNow()),
    roleHex: rh,
    plan: m.simPlan(),
    derived: m.derived2(),
    spaceNames: m.spaceNames(),
    layers,
    units: ui.units || 'ft',
    tool: ui.dtool,
    place: ui.ptool,
    sel: ui.sel,
    level: m.lvl(),
    hotelGeo: GEO[hotel?.name || ''] || null,
    frontage: !!SEED[hotel?.name || ''],

    onSelect: (sel) => A.select(sel),
    onMoveItem: (id, x, z) => A.moveItem2(m, id, x, z),
    onRotateItem: (id, d) => A.rotateItem2(m, id, d),
    onDuplicateItem: (id) => A.duplicateItem2(m, id),
    onPatchWall: (id, pts) => A.patchWall(m, id, pts),
    onAddWall: (pts) => A.addWall(m, pts),
    onAddRoad: (pts) => A.addRoad(m, pts),
    onPatchRoad: (id, p) => A.patchRoad(m, id, p),
    onAddSpace: (r) => A.addSpace2(m, r),
    onPatchSpace: (id, p) => A.patchSpace2(m, id, p),
    onRenameSpace: (id, l) => A.renameSpace2(m, id, l),
    onDeleteSel: () => A.deleteSelection(m),
    onPlace: (tool, x, z) => A.placeItem2(m, tool, x, z),
    onPlaced: () => A.armTool(null),
    onCalibrate: (p) => {
      A.calibrate2(m, p)
      A.setDraftTool('select')
    },
    onOwn: (id) => A.ownDerived2(m, id),
    onMap: (map) => A.setMap2(m, map),
    onTool: (t) => A.setDraftTool(t),
    onRotSite: (d) => A.rotSite(m, d),
  }
}
