// Praxis 3D — the hotel as an architectural scale model.
// Pulls the live plan from getScene() every frame; owns nothing but the view.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { GeoRoom, Layers, PlacedItem, Scene, SimGeo, World } from '@/model/types'
import { build, type Sim } from '@/sim/sim'

const tok = (n: string, f: string): string => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim()
  return v || f
}
const C = () => ({
  ground: tok('--color-neutral-300', '#d8cdbb'),
  paving: tok('--color-neutral-200', '#e6dccb'),
  slab: tok('--color-bg', '#f5ead8'),
  wall: tok('--color-neutral-100', '#f1e7d6'),
  wallTop: tok('--color-neutral-400', '#bfb3a0'),
  carpet: tok('--color-accent-2-100', '#e8ecdf'),
  asphalt: '#4b4741',
  line: '#efe6d4',
  ink: tok('--color-text', '#201e1d'),
  accent: tok('--color-accent', '#c67139'),
  accent2: tok('--color-accent-2', '#7a8a5e'),
  tower: tok('--color-neutral-200', '#e6dccb'),
  glass: '#8fa3ad',
})

const M = (col: string, rough?: number, metal?: number) =>
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(col),
    roughness: rough == null ? 0.86 : rough,
    metalness: metal == null ? 0 : metal,
  })

// ---- a soft radial shadow, for contact where the shadow map is too coarse ----
function blobTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  if (g) {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62)
    r.addColorStop(0, 'rgba(28,24,18,.42)')
    r.addColorStop(0.55, 'rgba(28,24,18,.16)')
    r.addColorStop(1, 'rgba(28,24,18,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const esc = (t: unknown): string =>
  String(t).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c as '<' | '>' | '&'])

// ---- local types ----
export type LiveView = 'site' | 'interior' | 'kerb'
type LiveMode = 'plan' | 'live'

/** A room on the current floor, with the label anchor build() computes for it. */
interface LiveRoom extends GeoRoom {
  id: string
  _c?: THREE.Vector3
}

interface StaticMats {
  ground: THREE.MeshStandardMaterial
  paving: THREE.MeshStandardMaterial
  slab: THREE.MeshStandardMaterial
  wall: THREE.MeshStandardMaterial
  wallTop: THREE.MeshStandardMaterial
  carpet: THREE.MeshStandardMaterial
  asphalt: THREE.MeshStandardMaterial
  line: THREE.MeshStandardMaterial
  tower: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
  trunk: THREE.MeshStandardMaterial
  leaf: THREE.MeshStandardMaterial
  steel: THREE.MeshStandardMaterial
}
interface FurnMats {
  wood: THREE.MeshStandardMaterial
  top: THREE.MeshStandardMaterial
  cloth: THREE.MeshStandardMaterial
  seat: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  panel: THREE.MeshStandardMaterial
  white: THREE.MeshStandardMaterial
  screen: THREE.MeshStandardMaterial
}
type StdMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
type BasicMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>

/** What a pooled vehicle group carries in userData. */
interface VehicleParts {
  body: StdMesh
  glass: StdMesh
  ws: StdMesh[]
  sh: BasicMesh
  bm: THREE.MeshStandardMaterial
}
/** What a pooled stanchion lane carries in userData. */
interface LaneParts {
  posts: StdMesh[]
  rope: StdMesh
}

type Drag =
  | { item: string; g0: THREE.Vector3; i0: PlacedItem; room: string | null }
  | { id: string; corner: boolean; g0: THREE.Vector3; r0: { x: number; y: number; w: number; d: number } }

interface Fly {
  p0: THREE.Vector3
  t0: THREE.Vector3
  p1: THREE.Vector3
  t1: THREE.Vector3
  s: number
}

interface VolPt {
  x: number
  z: number
  hex: string
  role: string
}

type FootClass = 'furn' | 'sign' | 'veh' | 'ppl'

const CSS = `
        .px-live{display:block;position:relative;width:100%;height:100%;min-height:0;
          border-radius:var(--radius-lg,16px);overflow:hidden;background:#cfd6d9;
          font-family:var(--font-body,system-ui)}
        .px-live canvas{display:block;position:absolute;inset:0;width:100%;height:100%}
        .px-live .lay{position:absolute;inset:0;pointer-events:none}
        .px-live .lab{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;
          padding:5px 9px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:-.01em;
          background:rgba(255,253,248,.94);color:var(--color-text,#201e1d);
          box-shadow:0 4px 14px rgba(28,24,18,.22);will-change:transform}
        .px-live .lab i{font-style:normal;display:block;font-size:10px;font-weight:600;opacity:.62;
          letter-spacing:.02em}
        .px-live .lab.in{transform-origin:0 0;background:rgba(255,253,248,.86);box-shadow:none;
          padding:4px 7px;border-radius:6px}
        .px-live .lab.acc{background:rgba(198,113,57,.95);color:#fff}
        .px-live .lab.sg{background:rgba(122,138,94,.95);color:#fff}
        .px-live .pan{position:absolute;box-sizing:border-box;pointer-events:auto;background:rgba(28,25,21,.86);
          backdrop-filter:blur(9px);color:#f6efe2;border-radius:14px;padding:13px 15px;
          box-shadow:0 10px 34px rgba(20,17,12,.34)}
        .px-live .pan h4{margin:0 0 9px;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
          opacity:.6;font-weight:700}
        .px-live .st{left:14px;top:14px;min-width:168px;max-height:calc(100% - 28px);overflow:auto}
        .px-live .st .r{display:flex;align-items:center;gap:9px;padding:4px 0}
        .px-live .st .r b{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;
          margin-left:auto;letter-spacing:-.02em}
        .px-live .st .r span{font-size:11px;opacity:.8}
        .px-live .st .d{width:9px;height:9px;border-radius:3px;flex:none}
        .px-live .zi{right:14px;top:14px;width:214px}
        .px-live .zi .t{font-size:15px;font-weight:700;letter-spacing:-.02em;margin-bottom:2px}
        .px-live .zi .s{font-size:10.5px;opacity:.65;margin-bottom:11px}
        .px-live .zi .r{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:11.5px}
        .px-live .zi .r b{font-variant-numeric:tabular-nums;font-weight:700}
        .px-live .zi hr{border:0;border-top:1px solid rgba(246,239,226,.16);margin:9px 0}
        .px-live .zi button{margin-top:11px;width:100%;height:40px;border:0;border-radius:999px;
          background:var(--color-accent,#c67139);color:#fff;font:inherit;font-size:12px;
          font-weight:700;cursor:pointer}
        .px-live .zi button:hover{background:var(--color-accent-600,#a95d2c)}
        .px-live .vw{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;
          pointer-events:auto;align-items:flex-end;max-height:calc(100% - 28px);flex-wrap:wrap}
        .px-live .vw button{height:40px;padding:0 15px;border:0;border-radius:999px;cursor:pointer;
          font:inherit;font-size:12px;font-weight:700;background:rgba(28,25,21,.86);color:#f6efe2;
          box-shadow:0 6px 18px rgba(20,17,12,.28);backdrop-filter:blur(9px);white-space:nowrap}
        .px-live .vw button[aria-pressed=true]{background:var(--color-accent,#c67139);color:#fff}
        .px-live .lg{position:absolute;left:14px;bottom:14px;display:flex;gap:5px;flex-wrap:wrap;
          max-width:52%;pointer-events:auto}
        .px-live .lg button{height:40px;padding:0 12px 0 10px;display:inline-flex;align-items:center;gap:7px;
          border:0;border-radius:999px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:700;
          background:rgba(28,25,21,.78);color:#f6efe2;backdrop-filter:blur(9px);white-space:nowrap}
        .px-live .lg button[aria-pressed=false]{background:rgba(28,25,21,.42);color:rgba(246,239,226,.5)}
        .px-live .lg i{width:11px;height:11px;border-radius:4px;flex:none;font-style:normal}
        .px-live .hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);font-size:11px;
          white-space:nowrap;max-width:calc(100% - 28px);overflow:hidden;text-overflow:ellipsis;
          font-weight:600;color:#f6efe2;background:rgba(28,25,21,.6);padding:5px 11px;
          border-radius:999px;backdrop-filter:blur(6px)}
`

const MAXP = 1600

export class LiveModel {
  private readonly host: HTMLElement
  private readonly getScene: () => Scene | null
  private readonly cv: HTMLCanvasElement
  private readonly labs: HTMLElement
  private readonly stEl: HTMLElement
  private readonly ziEl: HTMLElement
  private readonly vwEl: HTMLElement
  private readonly hintEl: HTMLElement
  private readonly styleEl: HTMLStyleElement

  private view: LiveView = 'site'
  private layers: Layers = {
    delegates: true, volunteers: true, vehicles: true, queues: true, zones: true, labels: true,
  }
  private pick: string | null = null
  private _labPool: HTMLDivElement[] = []

  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly cam: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly sun: THREE.DirectionalLight
  private readonly statics: THREE.Group
  private readonly dyn: THREE.Group
  private readonly blob: THREE.CanvasTexture
  private readonly ray: THREE.Raycaster
  private readonly gplane: THREE.Plane
  private readonly ro: ResizeObserver
  private raf = 0

  // pointer state
  private _dn: [number, number] | null = null
  private drag: Drag | null = null
  private _mode: LiveMode | null = null

  // the plan the model is currently built from
  private geo: SimGeo | null = null
  private rooms: LiveRoom[] = []
  private roomMeshes: THREE.Mesh[] = []
  private walls: THREE.Mesh[] = []
  private tower: THREE.Group | null = null
  private mat: StaticMats | null = null
  private bayLabel: THREE.Vector3[] = []
  private _sig: string | null = null
  private _msig: string | null = null
  private _fsig: string | null = null
  private _under: string | null = null
  private _rise: number | null = null
  private _fly: Fly | null = null
  private _elsewhere = 0
  private sim: Sim | null = null
  private volPts: VolPt[] = []

  // pools
  private people: THREE.InstancedMesh | null = null
  private heads: THREE.InstancedMesh | null = null
  private vehPool: THREE.Group[] = []
  private lanePool: THREE.Group[] = []
  private furn: THREE.Group | null = null
  private foot: THREE.Group | null = null

  // listeners, kept so destroy() can remove them
  private readonly onDown: (e: PointerEvent) => void
  private readonly onMove: (e: PointerEvent) => void
  private readonly onUp: (e: PointerEvent) => void
  private readonly endDrag: () => void

  constructor(host: HTMLElement, getScene: () => Scene | null) {
    this.host = host
    this.getScene = getScene
    host.classList.add('px-live')
    this.styleEl = document.createElement('style')
    this.styleEl.textContent = CSS
    host.appendChild(this.styleEl)
    host.insertAdjacentHTML(
      'beforeend',
      `<canvas></canvas><div class="lay"></div>
      <div class="pan st"><h4>Live status</h4></div>
      <div class="pan zi" hidden></div>
      <div class="vw"></div>
      <div class="hint" hidden></div>`,
    )
    const q = <T extends Element>(sel: string): T => {
      const el = host.querySelector<T>(sel)
      if (!el) throw new Error('LiveModel: missing ' + sel)
      return el
    }
    this.cv = q<HTMLCanvasElement>('canvas')
    this.labs = q<HTMLElement>('.lay')
    this.stEl = q<HTMLElement>('.st')
    this.ziEl = q<HTMLElement>('.zi')
    this.vwEl = q<HTMLElement>('.vw')
    this.hintEl = q<HTMLElement>('.hint')

    this.renderer = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.VSMShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.06
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#dfe4e2')
    this.scene.fog = new THREE.Fog('#dfe4e2', 210, 520)

    this.cam = new THREE.PerspectiveCamera(38, 1, 0.4, 900)
    this.controls = new OrbitControls(this.cam, this.cv)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.075
    this.controls.maxPolarAngle = Math.PI * 0.492
    this.controls.minDistance = 8
    this.controls.maxDistance = 340

    const hemi = new THREE.HemisphereLight(0xfff4e2, 0xa89c88, 0.9)
    this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.5)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.radius = 4.5
    this.sun.shadow.blurSamples = 16
    this.sun.shadow.bias = -0.0006
    this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target)
    const fill = new THREE.DirectionalLight(0xdfe8f0, 0.34)
    fill.position.set(-70, 46, -52)
    this.scene.add(fill)

    this.statics = new THREE.Group()
    this.dyn = new THREE.Group()
    this.scene.add(this.statics, this.dyn)
    this.blob = blobTexture()
    this.ray = new THREE.Raycaster()

    this.gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.onDown = (e: PointerEvent) => {
      this._dn = [e.clientX, e.clientY]
      if (this._mode !== 'plan') return
      const s = this.getScene()
      const g = this.ground(e)
      if (!g) return
      if (s && s.tool) return // a placement, handled on pointerup
      const it = this.itemAt(g, s)
      if (it) {
        if (s && s.onItemPick) s.onItemPick(it.id)
        this.drag = { item: it.id, g0: g, i0: it, room: it.room }
        this.controls.enabled = false
        this.cv.setPointerCapture(e.pointerId)
        return
      }
      const r = this.roomAt(g)
      if (!r) return
      const corner =
        Math.abs(g.x - (r.x + r.w)) < Math.max(1.2, r.w * 0.09) &&
        Math.abs(g.z - (r.y + r.d)) < Math.max(1.2, r.d * 0.09)
      this.drag = { id: r.id, corner, g0: g, r0: { x: r.x, y: r.y, w: r.w, d: r.d } }
      this.controls.enabled = false
      this.pick = r.id
      if (s && s.onPick) s.onPick(r.id)
      this.cv.setPointerCapture(e.pointerId)
    }
    this.onMove = (e: PointerEvent) => {
      if (!this.drag && this._mode === 'plan') {
        const s2 = this.getScene()
        const g2 = this.ground(e)
        this.cv.style.cursor = s2 && s2.tool ? 'copy' : g2 && this.itemAt(g2, s2) ? 'grab' : 'default'
      }
      if (!this.drag) return
      const g = this.ground(e)
      if (!g) return
      const dx = g.x - this.drag.g0.x
      const dz = g.z - this.drag.g0.z
      const s = this.getScene()
      if ('item' in this.drag) {
        const i0 = this.drag.i0
        const rm = i0.room && this.geo ? this.geo.rooms[i0.room] : null
        const p2 = rm
          ? {
              x: Math.max(0, Math.min(100, i0.x + (dx / rm.w) * 100)),
              y: Math.max(0, Math.min(100, i0.y + (dz / rm.d) * 100)),
            }
          : { x: i0.x + dx, y: i0.y + dz }
        if (s && s.onItem) s.onItem(this.drag.item, p2)
        return
      }
      const r0 = this.drag.r0
      const p = this.drag.corner
        ? { w: Math.max(2, Math.round((r0.w + dx) * 2) / 2), d: Math.max(2, Math.round((r0.d + dz) * 2) / 2) }
        : { x: Math.round((r0.x + dx) * 2) / 2, y: Math.round((r0.y + dz) * 2) / 2 }
      if (s && s.onRoom) s.onRoom(this.drag.id, p)
    }
    this.endDrag = () => {
      this.drag = null
      this.controls.enabled = true
      this.cv.style.cursor = 'default'
    }
    this.onUp = (e: PointerEvent) => {
      if (!this._dn || Math.hypot(e.clientX - this._dn[0], e.clientY - this._dn[1]) > 5) return
      this.hit(e)
    }
    this.cv.addEventListener('pointerdown', this.onDown)
    this.cv.addEventListener('pointermove', this.onMove)
    this.cv.addEventListener('pointerup', this.endDrag)
    this.cv.addEventListener('pointercancel', this.endDrag)
    this.cv.addEventListener('pointerup', this.onUp)
    this.ro = new ResizeObserver(() => this.size())
    this.ro.observe(host)
    this.size()
    this.chrome()
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.cv.removeEventListener('pointerdown', this.onDown)
    this.cv.removeEventListener('pointermove', this.onMove)
    this.cv.removeEventListener('pointerup', this.endDrag)
    this.cv.removeEventListener('pointercancel', this.endDrag)
    this.cv.removeEventListener('pointerup', this.onUp)
    this.controls.dispose()
    // every geometry, material and texture the model created hangs off the scene graph
    this.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      const mesh = o as THREE.Mesh
      mesh.geometry.dispose()
      const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      ms.forEach((m) => {
        const tx = (m as THREE.MeshBasicMaterial).map
        if (tx && tx !== this.blob) tx.dispose()
        m.dispose()
      })
    })
    if (this.mat) Object.values(this.mat).forEach((m) => m.dispose())
    this.blob.dispose()
    this.scene.clear()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.host.querySelectorAll(':scope > canvas, :scope > .lay, :scope > .pan, :scope > .vw, :scope > .hint')
      .forEach((el) => el.remove())
    this.styleEl.remove()
    this.host.classList.remove('px-live')
  }

  setView(id: LiveView): void {
    this.view = id
    this.frame(true)
    this.chromeState()
  }

  private size(): void {
    const w = this.host.clientWidth || 900
    const h = this.host.clientHeight || 480
    this.renderer.setSize(w, h, false)
    this.cam.aspect = w / h
    this.cam.updateProjectionMatrix()
  }

  // ---------- chrome ----------
  private chrome(): void {
    const vw = this.vwEl
    const views: [LiveView, string][] = [['site', 'Site level'], ['interior', 'Interior'], ['kerb', 'Kerb & loading']]
    views.forEach(([id, l]) => {
      const b = document.createElement('button')
      b.textContent = l
      b.setAttribute('aria-pressed', String(this.view === id))
      b.onclick = () => { this.view = id; this.frame(true); this.chromeState() }
      vw.appendChild(b)
      b.dataset.v = id
    })
  }
  private chromeState(): void {
    this.host.querySelectorAll<HTMLButtonElement>('.vw button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.v === this.view)),
    )
  }

  // ---------- static model ----------
  private build(geo: SimGeo, rooms: LiveRoom[]): void {
    const g = this.statics
    const c = C()
    while (g.children.length) {
      const o = g.children.pop()
      if (o) o.traverse((x) => { if (x instanceof THREE.Mesh) (x as THREE.Mesh).geometry.dispose() })
    }
    this.roomMeshes = []
    const W = geo.buildW
    const D = geo.buildD
    const add = <T extends THREE.Mesh>(mesh: T, cast?: boolean, recv?: boolean): T => {
      mesh.castShadow = !!cast
      mesh.receiveShadow = recv !== false
      g.add(mesh)
      return mesh
    }
    const box = (w: number, h: number, d: number, mat: THREE.MeshStandardMaterial,
                 x: number, y: number, z: number, name?: string): StdMesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y + h / 2, z)
      m.name = name || ''
      return m
    }
    // a wall's geometry sits on its own base, so scale.y raises it out of the plan
    this.walls = []
    const wallBox = (w: number, h: number, d: number, mat: THREE.MeshStandardMaterial,
                     x: number, y: number, z: number): StdMesh => {
      const g2 = new THREE.BoxGeometry(w, h, d)
      g2.translate(0, h / 2, 0)
      const m = new THREE.Mesh(g2, mat)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      this.walls.push(m)
      this.statics.add(m)
      return m
    }
    const mat: StaticMats = {
      ground: M(c.ground, 0.95), paving: M(c.paving, 0.9), slab: M(c.slab, 0.88),
      wall: M(c.wall, 0.82), wallTop: M(c.wallTop, 0.8), carpet: M(c.carpet, 0.96),
      asphalt: M(c.asphalt, 0.94), line: M(c.line, 0.7), tower: M(c.tower, 0.7),
      glass: new THREE.MeshStandardMaterial({ color: new THREE.Color(c.glass), roughness: 0.18, metalness: 0.45 }),
      trunk: M('#6b5a45', 0.9), leaf: M('#7d8f63', 0.95), steel: M('#8d8b86', 0.5, 0.5),
    }
    this.mat = mat

    // ground, road, front drive
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), mat.ground)
    gp.rotation.x = -Math.PI / 2
    gp.position.set(W / 2, -0.02, D / 2)
    gp.receiveShadow = true
    g.add(gp)
    add(box(W + 260, 0.1, geo.streetDepth, mat.asphalt, W / 2, 0, geo.streetY + geo.streetDepth / 2))
    for (let x = -110; x < W + 130; x += 6)
      add(box(3, 0.02, 0.22, mat.line, x, 0.1, geo.streetY + geo.streetDepth / 2), false, false)
    add(box(W + 40, 0.16, geo.kerbDepth, mat.paving, W / 2, 0, geo.kerbY + geo.kerbDepth / 2))
    add(box(W + 40, 0.06, 0.34, mat.wallTop, W / 2, 0.16, geo.kerbY + geo.kerbDepth - 0.17))
    this.bayLabel = []
    ;(geo.bays || []).forEach((bx, i) => {
      add(box(0.16, 0.02, geo.kerbDepth * 0.66, mat.line, bx - 6.9, 0.16, geo.kerbY + geo.kerbDepth * 0.6),
          false, false)
      add(box(0.16, 0.02, geo.kerbDepth * 0.66, mat.line, bx + 6.9, 0.16, geo.kerbY + geo.kerbDepth * 0.6),
          false, false)
      this.bayLabel[i] = new THREE.Vector3(bx, 0.4, geo.kerbY + geo.kerbDepth * 0.32)
    })

    // building slab + tower behind it
    add(box(W + 1.6, 0.2, D + 1.2, mat.slab, W / 2, 0, D / 2 - 0.3))
    if (this._under && this._under.startsWith('data:image/')) {
      const u = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }))
      u.rotation.x = -Math.PI / 2
      u.position.set(W / 2, 0.205, D / 2)
      u.visible = false
      u.name = 'underlay'
      g.add(u)
      new THREE.TextureLoader().load(
        this._under,
        (tx) => {
          tx.colorSpace = THREE.SRGBColorSpace
          u.material.map = tx
          u.material.needsUpdate = true
          u.visible = true
        },
        undefined,
        () => { if (u.parent) u.parent.remove(u); this._under = null },
      )
    }
    const tH = 44
    this.tower = new THREE.Group()
    this.statics.add(this.tower)
    const tower = this.tower
    const tw = (m: THREE.Mesh, cast?: boolean) => { m.castShadow = !!cast; m.receiveShadow = true; tower.add(m) }
    const tg = new THREE.BoxGeometry(W * 0.74, tH, 26)
    tg.translate(0, tH / 2, 0)
    const tm = new THREE.Mesh(tg, mat.tower)
    tm.position.set(W * 0.5, 0.2, -14.5)
    tm.name = 'towerMass'
    tw(tm, true)
    for (let f = 0; f < 13; f++)
      tw(box(W * 0.745, 1.5, 26.2, mat.glass, W * 0.5, 1.8 + f * 3.2, -14.5))
    const cg = new THREE.BoxGeometry(W * 0.44, 8, 26.4)
    cg.translate(0, 4, 0)
    const cm = new THREE.Mesh(cg, mat.tower)
    cm.position.set(W * 0.5, tH + 0.2, -14.5)
    tw(cm, true)

    // rooms: walls with a door gap on the front face
    const H = 3.15
    const T = 0.24
    rooms.forEach((r) => {
      const x0 = r.x, z0 = r.y, w = r.w, d = r.d
      if (w < 1 || d < 1 || r.id === 'kerb' || r.id === 'street') return
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - T, d - T), mat.carpet)
      fl.rotation.x = -Math.PI / 2
      fl.position.set(x0 + w / 2, 0.21, z0 + d / 2)
      fl.receiveShadow = true
      fl.userData.room = r.id
      g.add(fl)
      this.roomMeshes.push(fl)
      wallBox(w, H, T, mat.wall, x0 + w / 2, 0.2, z0 + T / 2)
      wallBox(T, H, d, mat.wall, x0 + T / 2, 0.2, z0 + d / 2)
      wallBox(T, H, d, mat.wall, x0 + w - T / 2, 0.2, z0 + d / 2)
      const gap = Math.min(2.2, w * 0.28)
      const side = (w - gap) / 2
      if (side > 0.1) {
        wallBox(side, H, T, mat.wall, x0 + side / 2, 0.2, z0 + d - T / 2)
        wallBox(side, H, T, mat.wall, x0 + w - side / 2, 0.2, z0 + d - T / 2)
      }
      r._c = new THREE.Vector3(x0 + w / 2, H + 0.5, z0 + d / 2)
    })

    // street trees, for scale and life
    for (let i = 0; i < 14; i++) {
      const x = -22 + i * ((W + 46) / 13)
      const z = geo.streetY - 1.4
      add(box(0.34, 2.3, 0.34, mat.trunk, x, 0.1, z), true)
      const cr = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), mat.leaf)
      cr.position.set(x, 3.5, z)
      cr.castShadow = true
      g.add(cr)
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2),
        new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false }))
      sh.rotation.x = -Math.PI / 2
      sh.position.set(x, 0.12, z)
      g.add(sh)
    }
    this.sizeShadow(W, D, geo)
  }
  private sizeShadow(W: number, D: number, geo: SimGeo): void {
    const s = this.sun
    const r = Math.max(W, geo.streetY + 40) * 0.75
    s.position.set(W * 0.5 + r * 0.7, r * 1.5, -r * 0.5)
    s.target.position.set(W * 0.5, 0, D * 0.6)
    const cam = s.shadow.camera
    cam.left = -r * 1.5
    cam.right = r * 1.5
    cam.top = r * 1.5
    cam.bottom = -r * 1.5
    cam.near = 1
    cam.far = r * 6
    cam.updateProjectionMatrix()
  }

  // ---------- dynamic ----------
  private pools(): void {
    const d = this.dyn
    if (this.people) return
    const body = new THREE.CapsuleGeometry(0.2, 0.62, 6, 12)
    const head = new THREE.SphereGeometry(0.145, 12, 9)
    const pm = new THREE.MeshStandardMaterial({ roughness: 0.72 })
    this.people = new THREE.InstancedMesh(body, pm, MAXP)
    this.heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: 0.66 }), MAXP)
    ;[this.people, this.heads].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.frustumCulled = false
      m.castShadow = true
      m.count = 0
      d.add(m)
    })
    this.vehPool = []
    this.lanePool = []
    this.furn = new THREE.Group()
    d.add(this.furn)
    this.foot = new THREE.Group()
    this.scene.add(this.foot)
  }
  private vehicle(i: number): THREE.Group {
    const have = this.vehPool[i]
    if (have) return have
    const g = new THREE.Group()
    const bm = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.22 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bm)
    body.castShadow = true
    body.name = 'body'
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mat ? this.mat.glass : M('#8fa3ad', 0.18, 0.45))
    glass.name = 'glass'
    const wheel = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14)
    const wm = M('#2b2825', 0.85)
    const ws: StdMesh[] = []
    for (let k = 0; k < 4; k++) {
      const w = new THREE.Mesh(wheel, wm)
      w.rotation.z = Math.PI / 2
      ws.push(w)
      g.add(w)
    }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false }))
    sh.rotation.x = -Math.PI / 2
    sh.name = 'sh'
    g.add(body, glass, sh)
    const parts: VehicleParts = { body, glass, ws, sh, bm }
    g.userData = parts
    this.dyn.add(g)
    this.vehPool[i] = g
    return g
  }
  private lane(i: number): THREE.Group {
    const have = this.lanePool[i]
    if (have) return have
    const g = new THREE.Group()
    const post = new THREE.CylinderGeometry(0.045, 0.055, 0.98, 8)
    const pm = this.mat ? this.mat.steel : M('#8d8b86', 0.5, 0.5)
    const posts: StdMesh[] = []
    for (let k = 0; k < 12; k++) {
      const p = new THREE.Mesh(post, pm)
      p.position.y = 0.7
      p.castShadow = true
      posts.push(p)
      g.add(p)
    }
    const rope = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 0.035), M('#8d8375', 0.9))
    rope.position.y = 0.95
    g.add(rope)
    const parts: LaneParts = { posts, rope }
    g.userData = parts
    this.dyn.add(g)
    this.lanePool[i] = g
    return g
  }

  // ---------- furniture, at real size, from the plan's own inventory ----------
  private chair(x: number, z: number, rot: number, mats: FurnMats): THREE.Group {
    const g = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.44), mats.seat)
    seat.position.y = 0.45
    seat.castShadow = true
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.06), mats.seat)
    back.position.set(0, 0.71, -0.19)
    back.castShadow = true
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), mats.metal)
    ped.position.y = 0.22
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), mats.metal)
    foot.position.y = 0.02
    g.add(seat, back, ped, foot)
    g.position.set(x, 0.21, z)
    g.rotation.y = rot || 0
    return g
  }
  // the plan symbol for an object: its real footprint, drawn flat and legible
  private footprint(it: PlacedItem, fx: number, fz: number, rot: number, sel: boolean): THREE.Group {
    const c = C()
    const FP: Record<string, [number, number, FootClass]> = {
      desk: [2.4, 0.72, 'furn'], kiosk: [0.9, 0.9, 'furn'], trestle: [1.95, 0.86, 'furn'],
      round: [1.52, 1.52, 'furn'], chairs: [1.3, 1.4, 'furn'], stanchion: [4.5, 0.4, 'furn'],
      banner: [2.4, 0.4, 'sign'], aframe: [0.9, 0.6, 'sign'], lollipop: [0.9, 0.9, 'sign'],
      arrowsign: [1.0, 0.4, 'sign'], bay: [0.8, 0.4, 'sign'],
      coach: [13.7, 2.55, 'veh'], shuttle: [8.2, 2.4, 'veh'], van: [5.4, 2.1, 'veh'],
      car: [4.6, 1.9, 'veh'], greeter: [0.8, 0.8, 'ppl'], pickup: [0.8, 0.8, 'ppl'],
    }
    const f: [number, number, FootClass] = FP[it.t] || [1.0, 1.0, it.kind === 'sign' ? 'sign' : 'furn']
    const hue: Record<FootClass, string> = { furn: '#b08b4f', sign: c.accent, veh: '#5b6470', ppl: c.accent2 }
    const round = it.t === 'round' || it.t === 'lollipop' || f[2] === 'ppl'
    const g = new THREE.Group()
    g.position.set(fx, 0, fz)
    g.rotation.y = rot || 0
    const shape = (w: number, d: number, col: string, y: number, op: number): BasicMesh => {
      const geo2 = round ? new THREE.CircleGeometry(w / 2, 28) : new THREE.PlaneGeometry(w, d)
      const m = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({
        color: new THREE.Color(col), transparent: true, opacity: op,
        depthWrite: false, side: THREE.DoubleSide,
      }))
      m.rotation.x = -Math.PI / 2
      m.position.y = y
      return m
    }
    g.add(shape(f[0] + 0.16, f[1] + 0.16, sel ? c.accent : '#2b2723', 0.30, sel ? 0.95 : 0.42))
    g.add(shape(f[0], f[1], hue[f[2]], 0.31, it.auto ? 0.62 : 0.95))
    if (f[2] === 'ppl' || it.t === 'lollipop') // a mark that reads at any zoom
      g.add(shape(f[0] * 0.42, f[1] * 0.42, '#fffdf8', 0.32, 0.9))
    return g
  }
  private furniture(items: PlacedItem[], geo: SimGeo, S: Scene): void {
    const furn = this.furn
    const foot = this.foot
    if (!furn || !foot) return
    const sig = JSON.stringify(items || []) + '|' + this._sig + '|' + (S.itemPick || '')
    if (sig === this._fsig) return
    this._fsig = sig
    const clear = (grp: THREE.Group) => {
      while (grp.children.length) {
        const o = grp.children[0]
        if (!o) break
        o.traverse((x) => {
          if (!(x instanceof THREE.Mesh)) return
          const mesh = x as THREE.Mesh
          mesh.geometry.dispose()
          if (!Array.isArray(mesh.material)) mesh.material.dispose()
        })
        grp.remove(o)
      }
    }
    clear(furn)
    clear(foot)
    const c = C()
    const mats: FurnMats = {
      wood: M('#a8825a', 0.72), top: M('#c9a978', 0.62), cloth: M(c.accent2, 0.92),
      seat: M('#6f6558', 0.78), metal: M('#8d8b86', 0.42, 0.55),
      panel: M(c.accent, 0.66), white: M('#f6f1e6', 0.72), screen: M('#2c3138', 0.3, 0.2),
    }
    const box = (w: number, h: number, d: number, mat: THREE.MeshStandardMaterial,
                 x: number, y: number, z: number): StdMesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y + h / 2, z)
      m.castShadow = true
      return m
    }
    const per: Record<string, number> = {}
    this._elsewhere = 0
    const DIMS: Record<string, [number, number, number]> = {
      coach: [13.7, 3.3, 2.55], shuttle: [8.2, 2.9, 2.4], van: [5.4, 2.1, 2.0], car: [4.6, 1.5, 1.85],
    }
    ;(items || []).forEach((it) => {
      // an item inside a space keeps its percentage of that space; one dropped on open
      // ground carries metres, so the kerb and the road can hold objects too
      const open = !it.room && it.x != null
      const lvOf = (it.room ? (S.roomLevels || {})[it.room] : undefined) || 0
      if (!open && lvOf !== (S.level || 0)) { this._elsewhere++; return } // another floor
      // a space renamed or removed under an object must not lose it — fall back to the first
      const r: GeoRoom | null = open ? null
        : (it.room ? geo.rooms[it.room] : undefined) || geo.rooms.lobby ||
          geo.rooms[Object.keys(geo.rooms)[0] ?? ''] || null
      if (!open && !r) return
      const rid = open ? '_open' : (it.room || 'lobby')
      per[rid] = (per[rid] || 0) + 1
      const k = (per[rid] || 1) - 1
      const fx = open || !r ? it.x
        : it.x != null ? r.x + (it.x / 100) * r.w : r.x + 1.4 + (k % 8) * ((r.w - 2.8) / 8)
      const fz = open || !r ? it.y
        : it.y != null ? r.y + (it.y / 100) * r.d
                       : r.y + (r.headM || 1.6) + 0.9 + Math.floor(k / 8) * 1.9
      const rot = ((it.rot || 0) * Math.PI) / 180
      const g = new THREE.Group()
      g.position.set(fx, 0, fz)
      g.rotation.y = rot
      const T2 = it.t || 'desk'
      if (T2 === 'desk' || T2 === 'kiosk') {
        const w = T2 === 'desk' ? 2.4 : 0.7
        g.add(box(w, 0.98, 0.72, mats.wood, 0, 0.21, 0))
        g.add(box(w + 0.12, 0.06, 0.84, mats.top, 0, 1.19, 0))
        if (T2 === 'kiosk') g.add(box(0.56, 0.4, 0.05, mats.screen, 0, 1.25, 0.3))
        else { g.add(this.chair(-0.5, -0.72, Math.PI, mats)); g.add(this.chair(0.6, -0.72, Math.PI, mats)) }
      } else if (T2 === 'trestle') {
        g.add(box(1.83, 0.74, 0.76, mats.cloth, 0, 0.21, 0))
        g.add(box(1.95, 0.05, 0.86, mats.top, 0, 0.95, 0))
        for (let i = 0; i < 4; i++)
          g.add(this.chair(-0.6 + (i % 2) * 1.2, i < 2 ? 0.78 : -0.78, i < 2 ? 0 : Math.PI, mats))
      } else if (T2 === 'round') {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.06, 28), mats.top)
        top.position.y = 0.95
        top.castShadow = true
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.74, 28), mats.cloth)
        skirt.position.y = 0.58
        skirt.castShadow = true
        g.add(top, skirt)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          g.add(this.chair(Math.cos(a) * 1.16, Math.sin(a) * 1.16, -a + Math.PI / 2, mats))
        }
      } else if (T2 === 'chairs') {
        for (let i = 0; i < 4; i++) g.add(this.chair((i % 2) * 0.6, Math.floor(i / 2) * 0.72, 0, mats))
      } else if (T2 === 'stanchion') {
        for (let i = 0; i < 4; i++) {
          g.add(box(0.09, 0.98, 0.09, mats.metal, i * 1.5, 0.21, 0))
          if (i) g.add(box(1.5, 0.035, 0.035, mats.seat, i * 1.5 - 0.75, 1.14, 0))
        }
      } else if (T2 === 'banner') {
        g.add(box(0.09, 2.5, 0.09, mats.metal, -1.2, 0.21, 0))
        g.add(box(0.09, 2.5, 0.09, mats.metal, 1.2, 0.21, 0))
        g.add(box(2.4, 1.5, 0.05, mats.panel, 0, 1.2, 0))
      } else if (T2 === 'aframe') {
        const a = box(0.72, 0.94, 0.05, mats.white, 0, 0.21, -0.16)
        a.rotation.x = 0.22
        const b = box(0.72, 0.94, 0.05, mats.white, 0, 0.21, 0.16)
        b.rotation.x = -0.22
        g.add(a, b)
      } else if (T2 === 'lollipop' || T2 === 'arrowsign' || T2 === 'bay') {
        g.add(box(0.06, 2.1, 0.06, mats.metal, 0, 0.21, 0))
        if (T2 === 'lollipop') {
          const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 22), mats.panel)
          d.rotation.x = Math.PI / 2
          d.position.set(0, 2.2, 0)
          d.castShadow = true
          g.add(d)
        } else g.add(box(T2 === 'bay' ? 0.5 : 0.68, 0.34, 0.05, mats.panel, 0, 1.92, 0))
      } else if (it.kind === 'people') {
        const hex = (S.roleHex || {})[it.t] || c.accent2
        const pm = M(hex, 0.72)
        const b2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 6, 12), pm)
        b2.position.y = 0.72
        b2.castShadow = true
        const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 9), pm)
        h2.position.y = 1.42
        h2.castShadow = true
        g.add(b2, h2)
      } else if (it.kind === 'veh') {
        const dims = DIMS[it.t] || [4.6, 1.5, 1.85]
        const vm = new THREE.MeshStandardMaterial({ color: new THREE.Color(it.hex || '#5b6470'),
          roughness: 0.42, metalness: 0.22 })
        g.add(box(dims[0], dims[1] * 0.74, dims[2], vm, 0, 0.42, 0))
        g.add(box(dims[0] * 0.96, dims[1] * 0.3, dims[2] * 1.01, mats.screen, 0, 0.42 + dims[1] * 0.78, 0))
        for (let k2 = 0; k2 < 4; k2++) {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14), mats.seat)
          wh.rotation.z = Math.PI / 2
          wh.position.set((k2 < 2 ? -1 : 1) * dims[0] * 0.34, 0.48, (k2 % 2 ? -1 : 1) * (dims[2] / 2 - 0.16))
          g.add(wh)
        }
      } else {
        g.add(box(0.6, 0.6, 0.6, mats.wood, 0, 0.21, 0))
      }
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false }))
      sh.rotation.x = -Math.PI / 2
      sh.position.y = 0.23
      g.add(sh)
      if (it.auto) g.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        const mesh = o as THREE.Mesh
        const m = mesh.material
        if (Array.isArray(m) || m.opacity === undefined) return
        if (!m.transparent) {
          const m2 = m.clone()
          m2.transparent = true
          m2.opacity = 0.82
          mesh.material = m2
        }
      })
      const sel = !!it.id && it.id === S.itemPick
      if (sel) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.28, 36),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(c.accent), transparent: true,
            opacity: 0.9, side: THREE.DoubleSide }))
        ring.rotation.x = -Math.PI / 2
        ring.position.y = 0.26
        g.add(ring)
      }
      furn.add(g)
      foot.add(this.footprint(it, fx, fz, rot, sel))
    })
  }

  // ---------- frame ----------
  private readonly loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    const s = this.getScene()
    if (!s || !s.plan) { this.renderer.render(this.scene, this.cam); return }
    if (s.layers) this.layers = s.layers
    const mode: LiveMode = s.mode === 'plan' ? 'plan' : 'live'
    if (mode !== this._mode) { this._mode = mode; this.frame(true); this.chromeState() }
    const want = mode === 'live' ? 1 : 0
    if (this._rise == null) this._rise = want
    if (Math.abs(this._rise - want) > 0.001) this._rise += (want - this._rise) * 0.11
    else this._rise = want
    const geo = s.plan.geo
    const rooms: LiveRoom[] = Object.entries(geo.rooms).map(([id, r]) => ({ id, ...r }))
    const lv = s.level || 0
    const rl = s.roomLevels || {}
    const onLevel = rooms.filter((r) => (rl[r.id] || 0) === lv)
    const sig = JSON.stringify([s.hotelName, lv, geo.buildW, geo.buildD, geo.kerbY, geo.kerbDepth,
      geo.streetY, geo.streetDepth, geo.bays, onLevel.map((r) => [r.id, r.x, r.y, r.w, r.d])])
    const under = s.underlay ? s.underlay.src : null
    if (under !== this._under) { this._under = under || null; this._sig = null }
    if (sig !== this._sig) {
      this._sig = sig
      this.geo = geo
      this.rooms = onLevel.filter((r) => r.w >= 2 && r.d >= 2)
      this.build(geo, this.rooms)
      this.pools()
      this.frame(true)
    }
    const msig = JSON.stringify(s.plan.moves) + '|' + sig
    if (msig !== this._msig) { this._msig = msig; this.sim = build(s.plan) }
    const T = s.mins
    const w: World = this.sim ? this.sim.at(T)
      : { people: [], vehicles: [],
          counts: { queuing: 0, walking: 0, kerb: 0, boarding: 0, aboard: 0, busesAtKerb: 0, arriving: 0 } }
    this.furniture((s.items || []).concat(s.derived || []), geo, s)
    if (this.furn) this.furn.visible = this.layers.zones
    this.paint(w, s)
    const rz = Math.max(0.012, this._rise)
    ;(this.walls || []).forEach((m) => (m.scale.y = rz))
    if (this.tower) { this.tower.scale.y = rz; this.tower.visible = this._rise > 0.02 }
    if (this.furn) this.furn.scale.y = rz
    // flat symbols in plan, real objects once it stands up
    if (this.foot) this.foot.visible = this._rise < 0.5 && this.layers.zones !== false
    this.dyn.visible = this._rise > 0.35
    this.controls.update()
    if (this._fly) this.fly()
    this.renderer.render(this.scene, this.cam)
    this.overlay(w, s)
  }

  private paint(w: World, s: Scene): void {
    const people = this.people
    const heads = this.heads
    const geo = this.geo
    if (!people || !heads || !geo) return
    const L = this.layers
    const m = new THREE.Matrix4()
    const col = new THREE.Color()
    const pos = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const sc = new THREE.Vector3(1, 1, 1)
    let n = 0
    const put = (x: number, z: number, hex: string, rot: number) => {
      if (n >= MAXP) return
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot || 0)
      pos.set(x, 0.72, z)
      m.compose(pos, q, sc)
      people.setMatrixAt(n, m)
      col.set(hex)
      people.setColorAt(n, col)
      pos.set(x, 1.42, z)
      m.compose(pos, q, sc)
      heads.setMatrixAt(n, m)
      heads.setColorAt(n, col.multiplyScalar(1.0))
      n++
    }
    if (L.delegates) w.people.forEach((p) => put(p.x, p.y, p.hex, 0))
    // volunteers: greeters along the lobby front, desk at its counter, pick-ups at the kerb
    this.volPts = []
    if (L.volunteers && s.cover) {
      const c = C()
      const lobby = geo.rooms[s.queueRoom] || this.rooms[0]
      const rc = s.roleHex || {}
      const gh = rc.greeter || c.accent2
      const dh = rc.desk || '#7c6bb0'
      const ph = rc.pickup || '#3f7f8f'
      const nG = s.cover.greeter || 0
      const nD = s.cover.desk || 0
      const nP = s.cover.pickup || 0
      if (lobby) {
        for (let i = 0; i < nG; i++) {
          const x = lobby.x + 1.4 + (i % 14) * ((lobby.w - 2.8) / 14)
          const z = lobby.y + lobby.d - 1.6 - Math.floor(i / 14) * 0.9
          put(x, z, gh, 0)
          this.volPts.push({ x, z, hex: gh, role: 'Greeter' })
        }
        for (let i = 0; i < nD; i++) {
          const x = lobby.x + 2.2 + i * 0.85
          const z = lobby.y + 2.4
          put(x, z, dh, Math.PI)
          this.volPts.push({ x, z, hex: dh, role: 'Desk' })
        }
      }
      for (let i = 0; i < nP; i++) {
        const bays = geo.bays && geo.bays.length ? geo.bays : [geo.buildW / 2]
        const bx = bays[i % bays.length] ?? geo.buildW / 2
        const x = bx - 4 + (Math.floor(i / bays.length) % 6) * 1.6
        const z = geo.kerbY + geo.kerbDepth * 0.22
        put(x, z, ph, 0)
        this.volPts.push({ x, z, hex: ph, role: 'Pick-up' })
      }
    }
    people.count = heads.count = n
    people.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true
    if (people.instanceColor) people.instanceColor.needsUpdate = true
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true

    // vehicles
    const vs = L.vehicles ? w.vehicles : []
    this.vehPool.forEach((g) => (g.visible = false))
    vs.slice(0, 16).forEach((v, i) => {
      const g = this.vehicle(i)
      const u = g.userData as VehicleParts
      g.visible = true
      const tall = v.l > 9 ? 3.25 : v.l > 5.4 ? 2.35 : 1.48
      u.bm.color.set(v.hex)
      u.body.scale.set(v.l, tall * 0.74, v.w)
      u.body.position.set(0, 0.42 + tall * 0.37, 0)
      u.glass.scale.set(v.l * 0.96, tall * 0.3, v.w * 1.005)
      u.glass.position.set(0, 0.42 + tall * 0.78, 0)
      u.ws.forEach((wh, k) => wh.position.set(
        (k < 2 ? -1 : 1) * v.l * 0.34, 0.48, (k % 2 ? -1 : 1) * (v.w / 2 - 0.16)))
      u.sh.scale.set(v.l * 1.5, v.w * 2.6, 1)
      u.sh.position.set(0, 0.13, 0)
      g.position.set(v.x, 0.1, v.y)
      g.rotation.y = 0
    })

    // stanchion lanes in whichever room the delegates are actually standing in
    const qr: Record<string, boolean> = {}
    w.people.forEach((p) => { if (p.st === 'queuing' && p.room) qr[p.room] = true })
    let li = 0
    this.lanePool.forEach((g) => (g.visible = false))
    if (L.queues) Object.keys(qr).forEach((id) => {
      const r = geo.rooms[id]
      if (!r) return
      const head = r.headM || 1.6
      const lanes = Math.max(1, Math.min(5, Math.floor((r.d - head - 1) / 1.15)))
      for (let l = 0; l < lanes; l++) {
        const g = this.lane(li++)
        if (!g) break
        g.visible = true
        const z = r.y + head + 0.7 + l * 1.15
        g.position.set(r.x + 0.6, 0.21, z)
        const span = r.w - 1.2
        const u = g.userData as LaneParts
        u.posts.forEach((p, k) => {
          p.visible = k * (span / 11) <= span
          p.position.x = k * (span / 11)
        })
        u.rope.scale.x = span
        u.rope.position.x = span / 2
      }
    })
    this.statics.visible = true
    this.roomMeshes.forEach((fl) => (fl.visible = true))
    if (this.tower) this.tower.visible = this.view !== 'interior' && (this._rise ?? 0) > 0.02
  }

  // ---------- camera ----------
  private frame(anim?: boolean): void {
    const geo = this.geo
    if (!geo) return
    const W = geo.buildW
    const D = geo.buildD
    let tgt: THREE.Vector3
    let pos: THREE.Vector3
    if (this._mode === 'plan') {
      const span = Math.max(W, geo.streetY + geo.streetDepth + 6)
      tgt = new THREE.Vector3(W / 2, 0, (geo.streetY + geo.streetDepth) / 2)
      pos = new THREE.Vector3(W / 2, span * 1.42, (geo.streetY + geo.streetDepth) / 2 + 0.01)
    } else if (this.view === 'site') {
      tgt = new THREE.Vector3(W / 2, 0, D * 0.75)
      pos = new THREE.Vector3(W / 2 - W * 0.72, Math.max(66, W * 0.7), geo.streetY + W * 0.9)
    } else if (this.view === 'interior') {
      const r = (this.pick ? geo.rooms[this.pick] : undefined) || geo.rooms[Object.keys(geo.rooms)[0] ?? '']
      if (!r) return
      tgt = new THREE.Vector3(r.x + r.w / 2, 1.1, r.y + r.d / 2)
      const span = Math.max(r.w, r.d)
      pos = new THREE.Vector3(r.x + r.w / 2 - span * 0.42, span * 0.66, r.y + r.d + span * 0.72)
    } else {
      const bx = (geo.bays && geo.bays[1]) || W / 2
      tgt = new THREE.Vector3(bx, 1.4, geo.kerbY + geo.kerbDepth * 0.6)
      pos = new THREE.Vector3(bx - 26, 11, geo.streetY + geo.streetDepth + 24)
    }
    if (anim && this.cam.position.length() > 1) {
      this._fly = { p0: this.cam.position.clone(), t0: this.controls.target.clone(),
                    p1: pos, t1: tgt, s: performance.now() }
    } else {
      this.cam.position.copy(pos)
      this.controls.target.copy(tgt)
      this.controls.update()
    }
  }
  private fly(): void {
    const f = this._fly
    if (!f) return
    const k = Math.min(1, (performance.now() - f.s) / 720)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    this.cam.position.lerpVectors(f.p0, f.p1, e)
    this.controls.target.lerpVectors(f.t0, f.t1, e)
    if (k >= 1) this._fly = null
  }

  private ground(e: PointerEvent): THREE.Vector3 | null {
    const r = this.cv.getBoundingClientRect()
    this.ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1), this.cam)
    const out = new THREE.Vector3()
    return this.ray.ray.intersectPlane(this.gplane, out) ? out : null
  }
  // where a placed object actually stands, so it can be picked up off the plan
  private itemAt(g: THREE.Vector3, s: Scene | null): PlacedItem | null {
    const geo = this.geo
    if (!geo) return null
    let best: PlacedItem | null = null
    let bd = 1.6
    ;((s && s.items) || []).forEach((it) => { // derived objects are not draggable
      const open = !it.room && it.x != null
      const rr = open ? null : ((it.room ? geo.rooms[it.room] : undefined) || geo.rooms.lobby || null)
      if (!open && !rr) return
      const x = open || !rr ? it.x : rr.x + ((it.x == null ? 50 : it.x) / 100) * rr.w
      const z = open || !rr ? it.y : rr.y + ((it.y == null ? 50 : it.y) / 100) * rr.d
      const d = Math.hypot(g.x - x, g.z - z)
      if (d < bd) { bd = d; best = it }
    })
    return best
  }
  private roomAt(g: THREE.Vector3): LiveRoom | null {
    return (this.rooms || []).find((r) => r.id !== 'kerb' && r.id !== 'street' &&
      g.x >= r.x && g.x <= r.x + r.w && g.z >= r.y && g.z <= r.y + r.d) || null
  }
  private hit(e: PointerEvent): void {
    const s = this.getScene()
    if (this._mode === 'plan') {
      const g = this.ground(e)
      if (g && s && s.tool && s.onPlace) {
        const r = this.roomAt(g)
        s.onPlace(s.tool, r ? r.id : null,
          r ? ((g.x - r.x) / r.w) * 100 : g.x, r ? ((g.z - r.y) / r.d) * 100 : g.z)
        return
      }
      const it2 = g && this.itemAt(g, s)
      if (it2) { if (s && s.onItemPick) s.onItemPick(it2.id); return }
      const r2 = g && this.roomAt(g)
      this.pick = r2 ? r2.id : null
      if (s && s.onPick) s.onPick(this.pick)
      if (s && s.onItemPick) s.onItemPick(null)
      return
    }
    const r = this.cv.getBoundingClientRect()
    this.ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1), this.cam)
    const is = this.ray.intersectObjects(this.roomMeshes || [], false)
    const first = is[0]
    const room = first ? (first.object.userData as { room?: string }).room : undefined
    this.pick = room ?? null
    const h = this.getScene()
    if (h && h.onPick) h.onPick(this.pick)
  }

  // ---------- HTML overlay ----------
  private label(i: number, cls: string, x: number, y: number, main: string, sub?: string): HTMLDivElement {
    let el = this._labPool[i]
    if (!el) { el = document.createElement('div'); this._labPool[i] = el; this.labs.appendChild(el) }
    el.className = 'lab' + (cls ? ' ' + cls : '')
    el.hidden = false
    el.style.transform = `translate(-50%,-100%) translate(${x}px,${y}px)`
    el.innerHTML = sub ? `${main}<i>${sub}</i>` : main
    return el
  }
  private project(v: THREE.Vector3): { x: number; y: number; z: number } | null {
    const p = v.clone().project(this.cam)
    if (p.z > 1) return null
    return { x: (p.x * 0.5 + 0.5) * this.host.clientWidth, y: (-p.y * 0.5 + 0.5) * this.host.clientHeight,
             z: p.z }
  }
  private overlay(w: World, s: Scene): void {
    let i = 0
    const placed: { l: number; r: number; t: number; b: number }[] = []
    const free = (x: number, y: number, w2: number, h2: number): boolean => {
      const r = { l: x - w2 / 2, r: x + w2 / 2, t: y - h2, b: y }
      if (placed.some((p) => r.l < p.r && r.r > p.l && r.t < p.b && r.b > p.t)) return false
      placed.push(r)
      return true
    }
    if (this.layers.labels) {
      const names = s.roomNames || {}
      if (this._mode === 'plan') {
        const ft = (n: number) => Math.round(n * 3.28084) + ' ft'
        ;(this.rooms || []).forEach((r) => {
          if (r.id === 'kerb' || r.id === 'street' || r.w < 2 || r.d < 2) return
          const p = this.project(new THREE.Vector3(r.x + 0.5, 0.3, r.y + 0.5))
          if (!p) return
          const el = this.label(i++, 'in' + (r.id === this.pick ? ' acc' : ''), p.x, p.y,
            esc(names[r.id] || r.id), ft(r.w) + ' × ' + ft(r.d))
          el.style.transform = `translate(${p.x}px,${p.y}px)`
        })
        for (let k = i; k < this._labPool.length; k++) { const el = this._labPool[k]; if (el) el.hidden = true }
        this.panels(w, s)
        return
      }
      const busy: Record<string, number> = {}
      w.people.forEach((x) => { if (x.room) busy[x.room] = (busy[x.room] || 0) + 1 })
      ;(this.rooms || []).forEach((r) => {
        if (!r._c || r.id === 'kerb' || r.id === 'street') return
        if (!busy[r.id] && r.id !== this.pick && this.view === 'site') return
        const p = this.project(r._c)
        if (!p) return
        if (!free(p.x, p.y, 116, 46)) return
        this.label(i++, r.id === this.pick ? 'acc' : '', p.x, p.y,
          esc(names[r.id] || r.id), busy[r.id] ? busy[r.id] + ' delegates' : '')
      })
      ;(w.vehicles || []).slice(0, 8).forEach((v) => {
        const p = this.project(new THREE.Vector3(v.x, 3.6, v.y))
        if (!p) return
        if (!free(p.x, p.y, 116, 46)) return
        this.label(i++, 'sg', p.x, p.y, esc(v.label), `${v.occ}/${v.cap} · ${esc(v.state)}`)
      })
    }
    for (let k = i; k < this._labPool.length; k++) { const el = this._labPool[k]; if (el) el.hidden = true }

    this.panels(w, s)
  }
  private panels(w: World, s: Scene): void {
    const c = C()
    const st = this.stEl
    const geo = this.geo
    const rows: [string, number, string][] = this._mode === 'plan'
      ? ([['Spaces on this floor', (this.roomMeshes || []).length, c.accent2],
          ['Objects here', this.furn ? this.furn.children.length : 0, '#b08b4f']] as [string, number, string][])
          .concat(this._elsewhere ? [['On other floors', this._elsewhere, '#8d8375']] : [])
          .concat([['Coach bays', ((geo && geo.bays) || []).length, '#5b6470']])
      : [['Queuing', w.counts.queuing || 0, c.accent],
         ['Walking', w.counts.walking || 0, '#b08b4f'],
         ['At kerb', w.counts.kerb || 0, '#5b6470'],
         ['Aboard', w.counts.aboard || 0, '#7c6bb0'],
         ['Volunteers', (this.volPts || []).length, c.accent2]]
    st.innerHTML = '<h4>' + (this._mode === 'plan' ? 'Plan' : 'Live status') + '</h4>' + rows.map(([l, n, h]) =>
      `<div class="r"><span class="d" style="background:${h}"></span><span>${l}</span><b>${n}</b></div>`).join('')

    const zi = this.ziEl
    const r = this.pick && geo ? geo.rooms[this.pick] : undefined
    if (this.pick && r) {
      const pick = this.pick
      const here = w.people.filter((x) => x.room === pick && x.st === 'queuing')
      const ft = (n: number) => Math.round(n * 3.28084) + ' ft'
      const cap = Math.floor((r.w - 0.6) / 0.72) * Math.max(1,
        Math.floor((r.d - (r.headM || 1.6) - 0.4) / 1.152))
      const mv = [...new Set(here.map((x) => x.mv))]
      zi.hidden = false
      zi.innerHTML = `<h4>Zone info</h4><div class="t">${esc((s.roomNames || {})[pick] || pick)}</div>
        <div class="s">${ft(r.w)} × ${ft(r.d)} · ${Math.round(r.w * r.d * 10.7639)} sq ft</div>
        <div class="r"><span>In queue</span><b>${here.length}</b></div>
        <div class="r"><span>Standing capacity</span><b>${cap}</b></div>
        <div class="r"><span>Utilisation</span><b>${cap ? Math.round(here.length / cap * 100) + '%' : '—'}</b></div>
        <hr><div class="r"><span>Movement</span><b>${mv.length ? esc(mv[0]) : 'none'}</b></div>
        <button>View from inside</button>`
      const btn = zi.querySelector('button')
      if (btn) btn.onclick = () => { this.view = 'interior'; this.frame(true); this.chromeState() }
    } else zi.hidden = true

    const hint = this.hintEl
    hint.hidden = this._mode !== 'plan' && !!this.pick
    hint.textContent = this._mode === 'plan'
      ? (s.tool ? 'Click the plan to place ' + s.tool.l
                : 'Drag a space to move it · drag its corner to resize · Go live to stand it up')
      : 'Drag to orbit · scroll to zoom · click a space for its numbers'
  }
}
