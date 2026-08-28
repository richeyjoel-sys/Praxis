// The drafting surface — site model v2.
// One flow: underlay → walls → spaces → objects, all directly manipulable.
// Architectural linework in SVG at true scale: survey grid, hatched paving,
// poché walls drawn exactly where the planner traced them, drafted dimension
// labels, real object symbols. Reads the SceneV2 getter; writes back only
// through its callbacks.

import type { ItemV2, ManySnap, Road, SceneV2, SpaceV2, Wall } from '@/model/types'
import { distToWall } from '@/model/site2'

const tok = (n: string, f: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f
const C = () => ({
  ink: tok('--color-text', '#16181c'),
  paper: tok('--color-bg', '#ffffff'),
  n100: tok('--color-neutral-100', '#ffffff'),
  n200: tok('--color-neutral-200', '#f0f1f4'),
  n300: tok('--color-neutral-300', '#dcdee3'),
  n400: tok('--color-neutral-400', '#c3c6cd'),
  n600: tok('--color-neutral-600', '#6f747d'),
  accent: tok('--color-accent', '#2f4bd8'),
  a100: tok('--color-accent-100', '#eceffd'),
  a300: tok('--color-accent-300', '#b3c0f6'),
  accent2: tok('--color-accent-2', '#0f8f86'),
  b100: tok('--color-accent-2-100', '#e6f4f2'),
})
type Palette = ReturnType<typeof C>

// every class of thing on the plan carries its own colour, matching the builder
const CLASS = () => {
  const c = C()
  return {
    furn: { hex: '#a8763f', l: 'Furniture' },
    sign: { hex: '#c67139', l: 'Signs' },
    people: { hex: c.accent2, l: 'People' },
    veh: { hex: '#4a5a6a', l: 'Vehicles' },
  }
}
type ClassMap = ReturnType<typeof CLASS>

// footprint in metres, and how the symbol is drawn
const FP: Record<string, { w: number; d: number; sym: string }> = {
  desk: { w: 2.4, d: 0.75, sym: 'counter' },
  kiosk: { w: 0.7, d: 0.7, sym: 'box' },
  trestle: { w: 1.83, d: 0.76, sym: 'table6' },
  round: { w: 1.52, d: 1.52, sym: 'round8' },
  chairs: { w: 1.2, d: 1.3, sym: 'chairs' },
  stanchion: { w: 4.5, d: 0.12, sym: 'rope' },
  banner: { w: 2.4, d: 0.15, sym: 'banner' },
  aframe: { w: 0.72, d: 0.5, sym: 'aframe' },
  lollipop: { w: 0.32, d: 0.32, sym: 'disc' },
  arrowsign: { w: 0.68, d: 0.12, sym: 'arrow' },
  bay: { w: 0.5, d: 0.12, sym: 'plate' },
  coach: { w: 13.7, d: 2.55, sym: 'bus' },
  shuttle: { w: 8.2, d: 2.4, sym: 'bus' },
  van: { w: 5.4, d: 2.1, sym: 'car' },
  car: { w: 4.6, d: 1.9, sym: 'car' },
  greeter: { w: 0.5, d: 0.5, sym: 'person' },
  pickup: { w: 0.5, d: 0.5, sym: 'person' },
}
const fpOf = (it: ItemV2) => FP[it.t] || { w: 0.8, d: 0.8, sym: 'box' }
const esc = (t: unknown): string =>
  String(t == null ? '' : t).replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]!)

interface Cam {
  x: number
  z: number
  ppm: number
}
interface Pt {
  x: number
  z: number
  sx: number
  sy: number
}
type Down =
  | { mode: 'pan'; p: Pt; cx: number; cz: number }
  | { mode: 'item'; id: string; p: Pt; x0: number; z0: number; moved?: boolean }
  | { mode: 'wall'; id: string; p: Pt; pts0: [number, number][]; moved?: boolean }
  | { mode: 'road'; id: string; p: Pt; pts0: [number, number][]; moved?: boolean }
  | { mode: 'vertex'; id: string; vi: number; pts0: [number, number][] }
  | { mode: 'rvertex'; id: string; vi: number; pts0: [number, number][] }
  | { mode: 'space'; id: string; p: Pt; x0: number; y0: number; moved?: boolean }
  | { mode: 'size'; id: string; p: Pt; w0: number; d0: number }
  | { mode: 'rubber'; p: Pt }
  | { mode: 'marquee'; p: Pt }
  | { mode: 'many'; p: Pt; snap: ManySnap }
interface Pop {
  kind: 'item' | 'space' | 'wall' | 'road' | 'auto'
  id: string
  sx: number
  sy: number
}

const STYLE = `
.px-draft{display:block;position:absolute;inset:0;overflow:hidden;
  background:var(--color-neutral-200,#f0f1f4);font-family:var(--font-body,system-ui);touch-action:none}
.px-draft>svg{position:absolute;inset:0;width:100%;height:100%;display:block;
  user-select:none;-webkit-user-select:none}
.px-draft .ui2{position:absolute;pointer-events:none;inset:0}
.px-draft .ui2>*{pointer-events:auto}
.px-draft .scale{position:absolute;left:13px;bottom:13px;pointer-events:none;display:flex;
  align-items:flex-end;gap:11px;padding:9px 13px;border-radius:14px;
  background:var(--color-bg,#fff);box-shadow:0 4px 14px rgba(20,24,32,.16)}
.px-draft .scale b{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.px-draft .scale i{font-style:normal;font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;
  color:var(--color-neutral-600,#6f747d);font-weight:700}
.px-draft .bar{height:7px;border-left:2px solid currentColor;border-right:2px solid currentColor;
  border-bottom:2px solid currentColor}
.px-draft .attr{position:absolute;right:13px;top:56px;pointer-events:none;font-size:9.5px;
  padding:4px 8px;z-index:2;border-radius:8px;background:rgba(255,255,255,.86);color:#4e535b}
.px-draft .commit{position:absolute;display:flex;align-items:center;gap:8px;padding:7px 8px 7px 13px;
  border-radius:12px;background:rgba(29,32,37,.94);color:#fff;box-shadow:0 8px 28px rgba(20,24,32,.3);
  font-size:12px;font-weight:700;white-space:nowrap;z-index:5}
.px-draft .commit button{height:34px;border:0;border-radius:9px;padding:0 13px;cursor:pointer;
  font:inherit;font-weight:800;font-size:12px}
.px-draft .commit button.ok{background:var(--color-accent,#2f4bd8);color:#fff}
.px-draft .commit button.no{background:#33373d;color:#c3c6cd}
.px-draft .hint{position:absolute;left:50%;bottom:11px;transform:translateX(-50%);pointer-events:none;
  max-width:calc(100% - 26px);overflow:hidden;text-overflow:ellipsis;font-size:11.5px;
  font-weight:700;padding:7px 13px;border-radius:999px;white-space:nowrap;
  background:var(--color-text,#16181c);color:#fff}
.px-draft .pop{position:absolute;box-sizing:border-box;padding:5px;border-radius:14px;
  background:var(--color-text,#16181c);box-shadow:0 12px 30px rgba(15,17,22,.4);
  display:flex;flex-direction:column;gap:1px;z-index:5}
.px-draft .pop .hd{display:flex;align-items:center;gap:7px;padding:7px 9px 6px;font-size:12px;
  font-weight:700;color:#f2f3f7}
.px-draft .pop .hd i{font-style:normal;width:10px;height:10px;border-radius:3px;flex:none}
.px-draft .pop button{height:40px;padding:0 10px;border:0;border-radius:9px;cursor:pointer;
  font:inherit;font-size:12.5px;font-weight:700;color:#f2f3f7;background:transparent;
  text-align:left;display:flex;align-items:center;gap:9px}
.px-draft .pop button:hover{background:rgba(242,243,247,.15)}
.px-draft .pop button.rm:hover{background:#b8563f}
.px-draft .pop button em{font-style:normal;width:18px;text-align:center;opacity:.75}
.px-draft .pop input{height:40px;margin:2px 0;padding:0 10px;border-radius:9px;font:inherit;
  font-size:12.5px;font-weight:700;border:1.5px solid rgba(242,243,247,.28);
  background:rgba(242,243,247,.08);color:#f2f3f7}
.px-draft .ask{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:6;
  display:flex;align-items:center;gap:9px;padding:13px 15px;border-radius:16px;
  background:var(--color-bg,#fff);box-shadow:0 14px 40px rgba(20,24,32,.3)}
.px-draft .ask b{font-size:13px;font-weight:700;white-space:nowrap}
.px-draft .ask input{height:44px;width:104px;padding:0 12px;border-radius:12px;font:inherit;
  font-size:15px;font-weight:700;border:1.5px solid var(--color-neutral-300,#dcdee3);
  background:var(--color-neutral-100,#fff);color:var(--color-text,#16181c)}
.px-draft .ask button{height:44px;padding:0 16px;border:0;border-radius:999px;cursor:pointer;
  font:inherit;font-size:13px;font-weight:700;background:var(--color-accent,#2f4bd8);color:#fff}
.px-draft .ask button.g{background:transparent;color:var(--color-neutral-700,#4e535b);
  border:1.5px solid var(--color-neutral-300,#dcdee3)}
`

export class DraftSurface {
  private readonly host: HTMLElement
  private readonly getScene: () => SceneV2 | null
  private readonly style: HTMLStyleElement
  private readonly svg: SVGSVGElement
  private readonly ui: HTMLDivElement
  private readonly ro: ResizeObserver
  private readonly tick: ReturnType<typeof setInterval>
  private cam: Cam | null = null
  private hover: string | null = null
  private _down: Down | null = null
  private pop: Pop | null = null
  private draft: [number, number][] | null = null // the wall or road being drawn
  private draftKind: 'wall' | 'road' = 'wall'
  private _uiHtml = ''
  /** Straighten-the-map: two clicks along an edge that should run flat. */
  private alignOn = false
  private alignA: { x: number; z: number } | null = null
  /** Drawing began on an existing wall's end — the run continues that wall. */
  private contWall: { id: string; end: 'a' | 'b' } | null = null
  private cursor: { x: number; z: number } | null = null
  private cal: { a?: { x: number; z: number }; b?: { x: number; z: number } } | null = null
  private underlayOp = 0.5
  private _keepTool = false
  private _shift = false

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Alt') this._keepTool = e.type === 'keydown'
    if (e.key === 'Shift') {
      this._shift = e.type === 'keydown'
      if (this.draft) this.draw() // the preview follows the snap the moment Shift moves
    }
    if (e.type !== 'keydown') return
    if (this.draft) {
      if (e.key === 'Enter') {
        this.finishWall()
        e.preventDefault()
      }
      if (e.key === 'Escape') {
        this.draft = null
        this.contWall = null
        this.draw()
        e.preventDefault()
      }
    } else if (e.key === 'Escape') {
      if (this.pop || this.cal || this.alignOn) {
        this.pop = null
        this.cal = null
        this.alignOn = false
        this.alignA = null
        this.draw()
      } else {
        // nothing drawing, nothing open: Esc drops the grab, then the tool
        const s = this.S()
        if (s?.msel?.length) {
          s.onSelectMany([])
          this.draw()
        } else if (s && s.tool !== 'select') {
          s.onTool('select')
          this.draw()
        }
      }
    }
  }
  /** Arm the two-click straighten interaction (from the Plan flyout). */
  startAlign(): void {
    this.alignOn = true
    this.alignA = null
    this.draw()
  }

  constructor(host: HTMLElement, getScene: () => SceneV2 | null) {
    this.host = host
    this.getScene = getScene
    host.classList.add('px-draft')
    this.style = document.createElement('style')
    this.style.textContent = STYLE
    host.appendChild(this.style)
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    host.appendChild(this.svg)
    this.ui = document.createElement('div')
    this.ui.className = 'ui2'
    host.appendChild(this.ui)
    this.wire()
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKey)
    this.ro = new ResizeObserver(() => this.draw())
    this.ro.observe(host)
    this.tick = setInterval(() => this.draw(), 400) // picks up builder edits
    this.draw()
  }
  destroy(): void {
    this.ro.disconnect()
    clearInterval(this.tick)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKey)
    this.svg.remove()
    this.ui.remove()
    this.style.remove()
    this.host.classList.remove('px-draft')
  }

  private S(): SceneV2 | null {
    return this.getScene()
  }
  private get W(): number {
    return this.host.clientWidth || 900
  }
  private get H(): number {
    return this.host.clientHeight || 480
  }

  // ---- transform ----
  fitNow(): void {
    const s = this.S()
    if (!s) return
    const f = s.frame
    const sw = f.w + 14
    const sd = f.d + f.kerb + f.street + 10
    this.cam = {
      x: f.w / 2,
      z: (f.d + f.kerb + f.street) / 2,
      ppm: Math.min(this.W / sw, this.H / sd) * 0.94,
    }
    this.draw()
  }
  zoomBy(k: number): void {
    if (!this.cam) return
    this.cam.ppm = Math.max(1.2, Math.min(220, this.cam.ppm * k))
    this.draw()
  }
  cycleOpacity(): void {
    this.underlayOp = this.underlayOp > 0.7 ? 0.28 : this.underlayOp > 0.4 ? 0.85 : 0.5
    this.draw()
  }
  /** The map is a traceable figure: hide it when the tracing's done, bring it
   *  back when it's needed. Returns whether it is now shown. */
  toggleUnderlay(): boolean {
    if (this.underlayOp > 0) {
      this._opWas = this.underlayOp
      this.underlayOp = 0
    } else this.underlayOp = this._opWas || 0.5
    this.draw()
    return this.underlayOp > 0
  }
  private _opWas = 0.5
  clearTool(): void {
    this.draft = null
    this.cal = null
    this.pop = null
    this.draw()
  }
  private cm(): Cam {
    if (!this.cam) this.fitNow()
    return this.cam || { x: 32, z: 30, ppm: 8 }
  }
  private tx(wx: number): number {
    const c = this.cm()
    return (wx - c.x) * c.ppm + this.W / 2
  }
  private ty(wz: number): number {
    const c = this.cm()
    return (wz - c.z) * c.ppm + this.H / 2
  }
  private wx(sx: number): number {
    const c = this.cm()
    return (sx - this.W / 2) / c.ppm + c.x
  }
  private wz(sy: number): number {
    const c = this.cm()
    return (sy - this.H / 2) / c.ppm + c.z
  }
  private at(e: MouseEvent): Pt {
    const r = this.svg.getBoundingClientRect()
    const sx = e.clientX - r.left
    const sy = e.clientY - r.top
    return { x: this.wx(sx), z: this.wz(sy), sx, sy }
  }
  private snap(v: number): number {
    return Math.round(v * 4) / 4
  }

  // ---- hit testing (by position: the SVG is rebuilt every draw) ----
  private itemAt(x: number, z: number, s: SceneV2): ItemV2 | null {
    let best: ItemV2 | null = null
    let bd = 1.3
    const test = (it: ItemV2) => {
      const f = fpOf(it)
      const d = Math.hypot(x - it.x, z - it.z) - Math.max(f.w, f.d) * 0.35
      if (d < bd) {
        bd = d
        best = it
      }
    }
    s.site.items.forEach(test)
    return best
  }
  private derivedAt(x: number, z: number, s: SceneV2): ItemV2 | null {
    let best: ItemV2 | null = null
    let bd = 1.0
    s.derived.forEach((it) => {
      const d = Math.hypot(x - it.x, z - it.z)
      if (d < bd) {
        bd = d
        best = it
      }
    })
    return best
  }
  private wallAt(x: number, z: number, s: SceneV2): Wall | null {
    const tol = Math.max(0.35, 6 / this.cm().ppm)
    let best: Wall | null = null
    let bd = tol
    s.site.walls.forEach((w) => {
      const d = distToWall(w, x, z)
      if (d < bd) {
        bd = d
        best = w
      }
    })
    return best
  }
  private vertexAt(x: number, z: number, w: Wall): number {
    const tol = Math.max(0.4, 8 / this.cm().ppm)
    for (let i = 0; i < w.pts.length; i++) {
      const [px, pz] = w.pts[i]!
      if (Math.hypot(x - px, z - pz) < tol) return i
    }
    return -1
  }
  private roadAt(x: number, z: number, s: SceneV2): Road | null {
    let best: Road | null = null
    let bd = Infinity
    s.site.roads.forEach((r) => {
      const d = distToWall(r, x, z) - r.w / 2
      if (d < 0.3 && d < bd) {
        bd = d
        best = r
      }
    })
    return best
  }
  private spaceAt(x: number, z: number, s: SceneV2): SpaceV2 | null {
    let best: SpaceV2 | null = null
    let ba = Infinity
    s.site.spaces.forEach((sp) => {
      if ((sp.lvl || 0) !== s.level) return
      if (x >= sp.x && x <= sp.x + sp.w && z >= sp.y && z <= sp.y + sp.d) {
        const a = sp.w * sp.d
        if (a < ba) {
          ba = a
          best = sp
        }
      }
    })
    return best
  }

  // ---- interaction ----
  private wire(): void {
    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const c = this.cm()
        const p = this.at(e)
        const k = Math.exp(-e.deltaY * 0.0016)
        c.ppm = Math.max(1.2, Math.min(220, c.ppm * k))
        const q = this.at(e)
        c.x += p.x - q.x
        c.z += p.z - q.z
        this.draw()
      },
      { passive: false },
    )
    this.svg.addEventListener('pointerdown', (e) => {
      const s = this.S()
      if (!s) return
      if (e.button === 2) return // right-click is the menu, handled on contextmenu
      const p = this.at(e)
      this.pop = null
      // straightening the map: two clicks along an edge that should run flat
      if (this.alignOn) {
        if (!this.alignA) this.alignA = { x: p.x, z: p.z }
        else {
          const dx = p.x - this.alignA.x
          const dz = p.z - this.alignA.z
          if (Math.hypot(dx, dz) > 0.5) {
            const ang = (Math.atan2(dz, dx) * 180) / Math.PI
            const target = Math.round(ang / 90) * 90
            s.onRotSite(+(target - ang).toFixed(2))
          }
          this.alignOn = false
          this.alignA = null
        }
        this.draw()
        return
      }
      const grab = () => {
        try {
          this.svg.setPointerCapture(e.pointerId)
        } catch {
          /* gone */
        }
      }
      // an armed object: one click places one object
      if (s.place) {
        s.onPlace(s.place, this.snap(p.x), this.snap(p.z))
        if (!this._keepTool) s.onPlaced()
        this.draw()
        return
      }
      if (s.tool === 'wall' || s.tool === 'road') {
        const pt = this.wallPoint(p, e.shiftKey)
        if (!this.draft) {
          // starting on an existing wall's end CONTINUES that wall
          if (s.tool === 'wall') {
            const tol = Math.max(0.35, 11 / this.cm().ppm)
            for (const w of s.site.walls) {
              const a0 = w.pts[0]!
              const b0 = w.pts[w.pts.length - 1]!
              const hitB = Math.hypot(p.x - b0[0], p.z - b0[1]) < tol
              const hitA = !hitB && Math.hypot(p.x - a0[0], p.z - a0[1]) < tol
              if (hitB || hitA) {
                this.contWall = { id: w.id, end: hitB ? 'b' : 'a' }
                this.draft = [hitB ? b0 : a0]
                this.draftKind = 'wall'
                this.draw()
                return
              }
            }
          }
          this.draft = [pt]
          this.draftKind = s.tool
        } else {
          // clicking the first vertex closes the loop
          const [fx, fz] = this.draft[0]!
          if (this.draft.length > 2 && Math.hypot(pt[0] - fx, pt[1] - fz) < Math.max(0.4, 8 / this.cm().ppm)) {
            this.draft.push([fx, fz])
            this.finishWall()
            return
          }
          this.draft.push(pt)
        }
        this.draw()
        return
      }
      if (s.tool === 'space') {
        this._down = { mode: 'rubber', p }
        grab()
        return
      }
      if (s.tool === 'cal') {
        if (!this.cal || this.cal.b) this.cal = { a: { x: p.x, z: p.z } }
        else this.cal = { ...this.cal, b: { x: p.x, z: p.z } }
        this.draw()
        return
      }
      // select tool
      // Shift-drag grabs several things at once
      if (e.shiftKey) {
        this._down = { mode: 'marquee', p }
        grab()
        return
      }
      // a grabbed set moves as one: pointerdown on any member drags them all
      if (s.msel?.length) {
        const ms = new Set(s.msel.map((q) => q.kind + ':' + q.id))
        const hitIt = this.itemAt(p.x, p.z, s)
        const hitWl = this.wallAt(p.x, p.z, s)
        const hitRd = this.roadAt(p.x, p.z, s)
        const hitSp = this.spaceAt(p.x, p.z, s)
        if (
          (hitIt && ms.has('item:' + hitIt.id)) ||
          (hitWl && ms.has('wall:' + hitWl.id)) ||
          (hitRd && ms.has('road:' + hitRd.id)) ||
          (hitSp && ms.has('space:' + hitSp.id))
        ) {
          const snap: ManySnap = {
            items: s.site.items.filter((q) => ms.has('item:' + q.id)).map((q) => ({ id: q.id, x: q.x, z: q.z })),
            walls: s.site.walls.filter((q) => ms.has('wall:' + q.id)).map((q) => ({ id: q.id, pts: q.pts.map((pt2) => [...pt2] as [number, number]) })),
            roads: s.site.roads.filter((q) => ms.has('road:' + q.id)).map((q) => ({ id: q.id, pts: q.pts.map((pt2) => [...pt2] as [number, number]) })),
            spaces: s.site.spaces.filter((q) => ms.has('space:' + q.id)).map((q) => ({ id: q.id, x: q.x, y: q.y })),
          }
          this._down = { mode: 'many', p, snap }
          grab()
          return
        }
      }
      const it = this.itemAt(p.x, p.z, s)
      if (it) {
        s.onSelect({ kind: 'item', id: it.id })
        this._down = { mode: 'item', id: it.id, p, x0: it.x, z0: it.z }
        grab()
        this.draw()
        return
      }
      const selWall = s.sel?.kind === 'wall' ? s.site.walls.find((w) => w.id === s.sel!.id) : null
      if (selWall) {
        const vi = this.vertexAt(p.x, p.z, selWall)
        if (vi >= 0) {
          this._down = { mode: 'vertex', id: selWall.id, vi, pts0: selWall.pts.map((q) => [...q]) }
          grab()
          return
        }
      }
      const w = this.wallAt(p.x, p.z, s)
      if (w) {
        s.onSelect({ kind: 'wall', id: w.id })
        this._down = { mode: 'wall', id: w.id, p, pts0: w.pts.map((q) => [...q]) }
        grab()
        this.draw()
        return
      }
      const selRoad = s.sel?.kind === 'road' ? s.site.roads.find((r) => r.id === s.sel!.id) : null
      if (selRoad) {
        const vi = this.vertexAt(p.x, p.z, selRoad)
        if (vi >= 0) {
          this._down = { mode: 'rvertex', id: selRoad.id, vi, pts0: selRoad.pts.map((q) => [...q]) }
          grab()
          return
        }
      }
      const rd = this.roadAt(p.x, p.z, s)
      if (rd) {
        s.onSelect({ kind: 'road', id: rd.id })
        this._down = { mode: 'road', id: rd.id, p, pts0: rd.pts.map((q) => [...q]) }
        grab()
        this.draw()
        return
      }
      const selSpace = s.sel?.kind === 'space' ? s.site.spaces.find((z2) => z2.id === s.sel!.id) : null
      if (selSpace) {
        const hx = selSpace.x + selSpace.w
        const hz = selSpace.y + selSpace.d
        if (Math.hypot(p.x - hx, p.z - hz) < Math.max(0.5, 9 / this.cm().ppm)) {
          this._down = { mode: 'size', id: selSpace.id, p, w0: selSpace.w, d0: selSpace.d }
          grab()
          return
        }
      }
      const sp = this.spaceAt(p.x, p.z, s)
      if (sp) {
        s.onSelect({ kind: 'space', id: sp.id })
        this._down = { mode: 'space', id: sp.id, p, x0: sp.x, y0: sp.y }
        grab()
        this.draw()
        return
      }
      const der = this.derivedAt(p.x, p.z, s)
      if (der) {
        this.pop = { kind: 'auto', id: der.id, sx: p.sx, sy: p.sy }
        this.draw()
        return
      }
      s.onSelect(null)
      const c = this.cm()
      this._down = { mode: 'pan', p, cx: c.x, cz: c.z }
      grab()
      this.draw()
    })
    this.svg.addEventListener('pointermove', (e) => {
      const s = this.S()
      if (!s) return
      const p = this.at(e)
      this.cursor = { x: p.x, z: p.z }
      if (this.draft || (s.tool === 'cal' && this.cal?.a && !this.cal.b)) this.draw()
      if (!this._down) {
        const h = this.hoverKey(p, s)
        this.svg.style.cursor = s.place
          ? 'copy'
          : s.tool === 'wall' || s.tool === 'road' || s.tool === 'space'
            ? 'crosshair'
            : s.tool === 'cal'
              ? 'crosshair'
              : h
                ? 'move'
                : 'grab'
        if (h !== this.hover) {
          this.hover = h
          this.draw()
        }
        return
      }
      const d = this._down
      // smooth by default — holding Shift snaps to the quarter-metre grid
      const sn = (v: number) => (e.shiftKey ? this.snap(v) : +v.toFixed(2))
      if (d.mode === 'pan') {
        const c = this.cm()
        c.x = d.cx - (p.x - d.p.x)
        c.z = d.cz - (p.z - d.p.z)
        this.draw()
      } else if (d.mode === 'rubber' || d.mode === 'marquee') {
        this.draw()
      } else if (d.mode === 'many') {
        s.onMoveMany(d.snap, sn(p.x - d.p.x), sn(p.z - d.p.z))
      } else if (d.mode === 'item') {
        d.moved = true
        s.onMoveItem(d.id, sn(d.x0 + (p.x - d.p.x)), sn(d.z0 + (p.z - d.p.z)))
      } else if (d.mode === 'wall') {
        d.moved = true
        const dx = sn(p.x - d.p.x)
        const dz = sn(p.z - d.p.z)
        s.onPatchWall(d.id, d.pts0.map(([x, z]) => [x + dx, z + dz] as [number, number]))
      } else if (d.mode === 'vertex') {
        const pts = d.pts0.map((q) => [...q] as [number, number])
        pts[d.vi] = [sn(p.x), sn(p.z)]
        s.onPatchWall(d.id, pts)
      } else if (d.mode === 'road') {
        d.moved = true
        const dx = sn(p.x - d.p.x)
        const dz = sn(p.z - d.p.z)
        s.onPatchRoad(d.id, { pts: d.pts0.map(([x, z]) => [x + dx, z + dz] as [number, number]) })
      } else if (d.mode === 'rvertex') {
        const pts = d.pts0.map((q) => [...q] as [number, number])
        pts[d.vi] = [sn(p.x), sn(p.z)]
        s.onPatchRoad(d.id, { pts })
      } else if (d.mode === 'space') {
        d.moved = true
        s.onPatchSpace(d.id, { x: sn(d.x0 + (p.x - d.p.x)), y: sn(d.y0 + (p.z - d.p.z)) })
      } else if (d.mode === 'size') {
        s.onPatchSpace(d.id, {
          w: Math.max(2, sn(d.w0 + (p.x - d.p.x))),
          d: Math.max(2, sn(d.d0 + (p.z - d.p.z))),
        })
      }
    })
    const end = (e: PointerEvent) => {
      const s = this.S()
      const d = this._down
      this._down = null
      if (d && d.mode === 'rubber' && s) {
        const p = this.at(e)
        const x = Math.min(d.p.x, p.x)
        const y = Math.min(d.p.z, p.z)
        const w = Math.abs(p.x - d.p.x)
        const dd = Math.abs(p.z - d.p.z)
        if (w > 1.2 && dd > 1.2)
          s.onAddSpace({ x: +x.toFixed(2), y: +y.toFixed(2), w: +w.toFixed(2), d: +dd.toFixed(2) })
      }
      if (d && d.mode === 'marquee' && s) {
        const p = this.at(e)
        const x0 = Math.min(d.p.x, p.x)
        const x1 = Math.max(d.p.x, p.x)
        const z0 = Math.min(d.p.z, p.z)
        const z1 = Math.max(d.p.z, p.z)
        const inside = (x: number, z: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1
        const haul: { kind: 'item' | 'wall' | 'road' | 'space'; id: string }[] = []
        s.site.items.forEach((it2) => {
          if ((it2.lvl || 0) === s.level && inside(it2.x, it2.z)) haul.push({ kind: 'item', id: it2.id })
        })
        s.site.walls.forEach((w2) => {
          if (w2.pts.some(([x, z]) => inside(x, z))) haul.push({ kind: 'wall', id: w2.id })
        })
        s.site.roads.forEach((r2) => {
          if (r2.pts.some(([x, z]) => inside(x, z))) haul.push({ kind: 'road', id: r2.id })
        })
        s.site.spaces.forEach((sp2) => {
          if ((sp2.lvl || 0) === s.level && inside(sp2.x + sp2.w / 2, sp2.y + sp2.d / 2)) haul.push({ kind: 'space', id: sp2.id })
        })
        s.onSelectMany(haul)
      }
      this.svg.style.cursor = 'grab'
      this.draw()
    }
    this.svg.addEventListener('pointerup', end)
    this.svg.addEventListener('pointercancel', end)
    this.svg.addEventListener('dblclick', (e) => {
      e.preventDefault()
      if (this.draft) this.finishWall()
    })
    // right-click is the edit menu — no modal, no hunting in a drawer
    this.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const s = this.S()
      if (!s) return
      const p = this.at(e)
      const it = this.itemAt(p.x, p.z, s)
      if (it) {
        s.onSelect({ kind: 'item', id: it.id })
        this.pop = { kind: 'item', id: it.id, sx: p.sx, sy: p.sy }
        this.draw()
        return
      }
      const w = this.wallAt(p.x, p.z, s)
      if (w) {
        s.onSelect({ kind: 'wall', id: w.id })
        this.pop = { kind: 'wall', id: w.id, sx: p.sx, sy: p.sy }
        this.draw()
        return
      }
      const rd = this.roadAt(p.x, p.z, s)
      if (rd) {
        s.onSelect({ kind: 'road', id: rd.id })
        this.pop = { kind: 'road', id: rd.id, sx: p.sx, sy: p.sy }
        this.draw()
        return
      }
      const sp = this.spaceAt(p.x, p.z, s)
      if (sp) {
        s.onSelect({ kind: 'space', id: sp.id })
        this.pop = { kind: 'space', id: sp.id, sx: p.sx, sy: p.sy }
        this.draw()
        return
      }
      const der = this.derivedAt(p.x, p.z, s)
      if (der) {
        this.pop = { kind: 'auto', id: der.id, sx: p.sx, sy: p.sy }
        this.draw()
        return
      }
      this.pop = null
      this.draw()
    })
  }
  private hoverKey(p: Pt, s: SceneV2): string | null {
    const it = this.itemAt(p.x, p.z, s)
    if (it) return 'item:' + it.id
    const w = this.wallAt(p.x, p.z, s)
    if (w) return 'wall:' + w.id
    const rd = this.roadAt(p.x, p.z, s)
    if (rd) return 'road:' + rd.id
    const sp = this.spaceAt(p.x, p.z, s)
    if (sp) return 'space:' + sp.id
    return null
  }
  /** The next wall vertex. Free and smooth by default; holding Shift snaps
   *  it to the grid and the run's angle to 15° stops. */
  private wallPoint(p: Pt, wantSnap: boolean): [number, number] {
    if (!wantSnap) return [+p.x.toFixed(2), +p.z.toFixed(2)]
    let x = this.snap(p.x)
    let z = this.snap(p.z)
    if (this.draft && this.draft.length) {
      const [ax, az] = this.draft[this.draft.length - 1]!
      const dx = x - ax
      const dz = z - az
      const ang = Math.atan2(dz, dx)
      const snap = (Math.round(ang / (Math.PI / 12)) * Math.PI) / 12
      const len = Math.hypot(dx, dz)
      x = this.snap(ax + Math.cos(snap) * len)
      z = this.snap(az + Math.sin(snap) * len)
    }
    return [x, z]
  }
  private finishWall(): void {
    const s = this.S()
    const pts = this.draft
    const cont = this.contWall
    this.draft = null
    this.contWall = null
    if (s && pts && pts.length >= 2) {
      if (cont && this.draftKind === 'wall') {
        const w = s.site.walls.find((x) => x.id === cont.id)
        if (w) {
          const add = pts.slice(1)
          const merged = (cont.end === 'b' ? [...w.pts, ...add] : [...[...add].reverse(), ...w.pts]) as [number, number][]
          s.onPatchWall(cont.id, merged)
        }
      } else if (this.draftKind === 'road') s.onAddRoad(pts)
      else s.onAddWall(pts)
    }
    this.draw()
  }

  // ---- drawing ----
  draw(): void {
    const s = this.S()
    if (!s) return
    if (s.mode !== 'draft') {
      this.svg.innerHTML = ''
      this.ui.innerHTML = ''
      return
    }
    const c = C()
    const CL = CLASS()
    const K = this.cm().ppm
    const W = this.W
    const H = this.H
    const X = (w: number) => this.tx(w).toFixed(1)
    const Y = (w: number) => this.ty(w).toFixed(1)
    const L = (id: keyof SceneV2['layers']) => s.layers[id]
    const ft = (mm: number) => (s.units === 'm' ? mm.toFixed(1) + ' m' : Math.round(mm * 3.28084) + '′')
    const f = s.frame
    const out: string[] = []

    out.push(`<defs>
      <pattern id="dpav" width="7" height="7" patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7"
        stroke="${c.n400}" stroke-width="1" stroke-opacity=".5"/></pattern>
    </defs>`)
    out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${c.n200}"/>`)

    // survey grid, denser when you are in close
    const step = K > 26 ? 1 : K > 9 ? 5 : 20
    const gx0 = Math.floor(this.wx(0) / step) * step
    const gz0 = Math.floor(this.wz(0) / step) * step
    let grid = ''
    for (let x = gx0; x < this.wx(W); x += step) grid += `<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}"/>`
    for (let z = gz0; z < this.wz(H); z += step) grid += `<line x1="0" y1="${Y(z)}" x2="${W}" y2="${Y(z)}"/>`
    out.push(`<g stroke="${c.n400}" stroke-width=".6" stroke-opacity=".45">${grid}</g>`)

    // the underlay sits under everything, at its own scale
    const un = s.site.map || s.site.underlay
    if (un && 'src' in un && un.src) {
      let ox: number, oy: number, uw: number, uh: number
      if ('mpp' in un && un.mpp) {
        const mk = un.mpp * K
        uw = un.w * mk
        uh = un.h * mk
        ox = this.tx(f.w / 2) - un.px * mk
        oy = this.ty(f.d / 2) - un.py * mk
      } else {
        const u2 = s.site.underlay!
        const wM = u2.wM || f.w
        const hM = u2.hM || wM * (u2.ar || 0.7)
        ox = this.tx(u2.ox || 0)
        oy = this.ty(u2.oy || 0)
        uw = wM * K
        uh = hM * K
      }
      const rot = s.site.rot || 0
      const rcx = ox + uw / 2
      const rcy = oy + uh / 2
      out.push(`<image href="${un.src}" x="${ox.toFixed(1)}" y="${oy.toFixed(1)}"
        width="${uw.toFixed(1)}" height="${uh.toFixed(1)}" opacity="${this.underlayOp}"
        preserveAspectRatio="none"${rot ? ` transform="rotate(${rot.toFixed(2)} ${rcx.toFixed(1)} ${rcy.toFixed(1)})"` : ''}/>`)
    }

    // no invented frontage anywhere: kerbs, bays and streets exist only when
    // the planner draws them as roads and zones

    // several things grabbed at once — the marquee's haul highlights everywhere
    const MS = new Set((s.msel || []).map((q) => q.kind + ':' + q.id))
    // drawn roads: asphalt ribbons with a dashed centreline — bends and side
    // streets, so vehicles can stage and queue away from the kerb
    s.site.roads.forEach((r) => {
      const on = (s.sel?.kind === 'road' && s.sel.id === r.id) || MS.has('road:' + r.id)
      const hov = this.hover === 'road:' + r.id
      const d = r.pts.map(([x, z], i) => `${i ? 'L' : 'M'} ${X(x)} ${Y(z)}`).join(' ')
      out.push(`<g data-h="road" data-id="${r.id}">
        <path d="${d}" fill="none" stroke="#57534c" stroke-opacity="${on ? 0.42 : hov ? 0.34 : 0.26}"
          stroke-width="${(r.w * K).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#c9a227" stroke-width="1.4"
          stroke-dasharray="${(2.2 * K).toFixed(1)} ${(1.8 * K).toFixed(1)}" stroke-opacity=".8"/>
        ${on ? `<path d="${d}" fill="none" stroke="${c.accent}" stroke-width="2" stroke-dasharray="6 4"/>` : ''}
      </g>`)
      if (on)
        r.pts.forEach(([x, z], i) =>
          out.push(`<rect data-h="rvertex" data-id="${r.id}" data-vi="${i}"
            x="${(+X(x) - 5).toFixed(1)}" y="${(+Y(z) - 5).toFixed(1)}" width="10" height="10" rx="3"
            fill="#fff" stroke="${c.accent}" stroke-width="2"/>`),
        )
    })

    // spaces: light regions with dashed borders — the simulation's ground truth
    if (L('zones'))
      s.site.spaces.forEach((sp) => {
        if ((sp.lvl || 0) !== s.level) return
        const on = (s.sel?.kind === 'space' && s.sel.id === sp.id) || MS.has('space:' + sp.id)
        const hov = this.hover === 'space:' + sp.id
        out.push(`<g data-h="space" data-id="${sp.id}">
          <rect x="${X(sp.x)}" y="${Y(sp.y)}" width="${(sp.w * K).toFixed(1)}" height="${(sp.d * K).toFixed(1)}"
            rx="2" fill="${on ? c.a100 : c.b100}" fill-opacity="${on ? 0.85 : 0.45}"
            stroke="${on ? c.accent : c.accent2}" stroke-width="${on ? 2 : 1.3}"
            stroke-dasharray="${on ? 'none' : '6 4'}"/>
          ${hov && !on ? `<rect x="${X(sp.x)}" y="${Y(sp.y)}" width="${(sp.w * K).toFixed(1)}" height="${(sp.d * K).toFixed(1)}" fill="${c.accent}" fill-opacity=".06"/>` : ''}
        </g>`)
        if (L('labels') && K > 3) {
          const fs = Math.max(9, Math.min(14, 1.1 * K))
          out.push(`<text x="${X(sp.x + 0.5)}" y="${(+Y(sp.y) + fs + 3).toFixed(1)}" font-size="${fs}"
            font-weight="700" fill="${c.accent2}" fill-opacity=".9">${esc(sp.l)}</text>
            <text x="${X(sp.x + 0.5)}" y="${(+Y(sp.y) + fs * 2.1 + 3).toFixed(1)}" font-size="${(fs * 0.8).toFixed(1)}"
            fill="${c.n600}" font-variant-numeric="tabular-nums">${ft(sp.w)} × ${ft(sp.d)}</text>`)
        }
        if (on) {
          // drafted dimension strings + the resize handle
          out.push(`<g stroke="${c.accent}" stroke-width="1.2" fill="none">
            <line x1="${X(sp.x)}" y1="${Y(sp.y - 1.2)}" x2="${X(sp.x + sp.w)}" y2="${Y(sp.y - 1.2)}"/>
            <line x1="${X(sp.x)}" y1="${Y(sp.y - 1.7)}" x2="${X(sp.x)}" y2="${Y(sp.y - 0.7)}"/>
            <line x1="${X(sp.x + sp.w)}" y1="${Y(sp.y - 1.7)}" x2="${X(sp.x + sp.w)}" y2="${Y(sp.y - 0.7)}"/></g>
            <text x="${X(sp.x + sp.w / 2)}" y="${(+Y(sp.y - 1.2) - 5).toFixed(1)}" text-anchor="middle"
              font-size="12" font-weight="700" fill="${c.accent}" font-variant-numeric="tabular-nums">${ft(sp.w)}</text>
            <rect x="${(+X(sp.x + sp.w) - 7).toFixed(1)}" y="${(+Y(sp.y + sp.d) - 7).toFixed(1)}"
              width="14" height="14" rx="4" fill="${c.accent}" stroke="#fff" stroke-width="2"/>`)
        }
      })

    // walls: poché exactly where they were traced
    const wallPx = Math.max(2, 0.24 * K)
    s.site.walls.forEach((w) => {
      const on = (s.sel?.kind === 'wall' && s.sel.id === w.id) || MS.has('wall:' + w.id)
      const hov = this.hover === 'wall:' + w.id
      const d = w.pts.map(([x, z], i) => `${i ? 'L' : 'M'} ${X(x)} ${Y(z)}`).join(' ')
      out.push(`<g data-h="wall" data-id="${w.id}">
        <path d="${d}" fill="none" stroke="${on ? c.accent : hov ? '#3a3f49' : c.ink}"
          stroke-width="${wallPx.toFixed(1)}" stroke-opacity="${on ? 1 : 0.85}"
          stroke-linecap="square" stroke-linejoin="miter"/>
      </g>`)
      if (on)
        w.pts.forEach(([x, z], i) =>
          out.push(`<rect data-h="vertex" data-id="${w.id}" data-vi="${i}"
            x="${(+X(x) - 5).toFixed(1)}" y="${(+Y(z) - 5).toFixed(1)}" width="10" height="10" rx="3"
            fill="#fff" stroke="${c.accent}" stroke-width="2"/>`),
        )
    })

    // objects: real symbols, colour-coded by class
    const items: ItemV2[] = (s.site.items as ItemV2[]).concat(L('zones') ? s.derived : [])
    items.forEach((it) => {
      if ((it.lvl || 0) !== s.level && !it.auto) return
      const cls = CL[it.kind] || CL.furn
      const on = !it.auto && ((s.sel?.kind === 'item' && s.sel.id === it.id) || MS.has('item:' + it.id))
      out.push(this.symbol(it, it.hex || cls.hex, on, K, c))
    })

    // the wall or road being drawn
    if (this.draft && this.draft.length) {
      const road = this.draftKind === 'road'
      const previewW = road ? 8 * K : wallPx
      const d = this.draft.map(([x, z], i) => `${i ? 'L' : 'M'} ${X(x)} ${Y(z)}`).join(' ')
      if (road)
        out.push(`<path d="${d}" fill="none" stroke="#57534c" stroke-opacity=".22"
          stroke-width="${previewW.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`)
      out.push(`<path d="${d}" fill="none" stroke="${c.accent}" stroke-width="${(road ? 2 : wallPx).toFixed(1)}"
        stroke-linecap="square" stroke-opacity=".9"/>`)
      if (this.cursor) {
        const [lx, lz] = this.draft[this.draft.length - 1]!
        const nxt = this.wallPoint({ ...this.cursor, sx: 0, sy: 0 }, this._shift)
        const len = Math.hypot(nxt[0] - lx, nxt[1] - lz)
        out.push(`<line x1="${X(lx)}" y1="${Y(lz)}" x2="${X(nxt[0])}" y2="${Y(nxt[1])}"
          stroke="${c.accent}" stroke-width="${Math.max(1.4, wallPx * 0.5).toFixed(1)}" stroke-dasharray="7 5"/>
          <text x="${X((lx + nxt[0]) / 2)}" y="${(+Y((lz + nxt[1]) / 2) - 8).toFixed(1)}" text-anchor="middle"
            font-size="12" font-weight="700" fill="${c.accent}" font-variant-numeric="tabular-nums">${ft(len)}</text>`)
      }
      this.draft.forEach(([x, z]) =>
        out.push(`<circle cx="${X(x)}" cy="${Y(z)}" r="4.5" fill="#fff" stroke="${c.accent}" stroke-width="2"/>`),
      )
    }
    // the space being rubber-banded
    if (this._down?.mode === 'rubber' && this.cursor) {
      const d0 = this._down.p
      const x = Math.min(d0.x, this.cursor.x)
      const y = Math.min(d0.z, this.cursor.z)
      const w2 = Math.abs(this.cursor.x - d0.x)
      const d2 = Math.abs(this.cursor.z - d0.z)
      out.push(`<rect x="${X(x)}" y="${Y(y)}" width="${(w2 * K).toFixed(1)}" height="${(d2 * K).toFixed(1)}"
        fill="${c.accent2}" fill-opacity=".14" stroke="${c.accent2}" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="${X(x + w2 / 2)}" y="${(+Y(y + d2 / 2) + 4).toFixed(1)}" text-anchor="middle"
          font-size="12" font-weight="700" fill="${c.accent2}">${ft(w2)} × ${ft(d2)}</text>`)
    }
    // the marquee: grab several things at once
    if (this._down?.mode === 'marquee' && this.cursor) {
      const d0 = this._down.p
      const x = Math.min(d0.x, this.cursor.x)
      const y = Math.min(d0.z, this.cursor.z)
      const w2 = Math.abs(this.cursor.x - d0.x)
      const d2 = Math.abs(this.cursor.z - d0.z)
      out.push(`<rect x="${X(x)}" y="${Y(y)}" width="${(w2 * K).toFixed(1)}" height="${(d2 * K).toFixed(1)}"
        fill="${c.accent}" fill-opacity=".08" stroke="${c.accent}" stroke-width="1.6" stroke-dasharray="5 4"/>`)
    }
    // the straighten line
    if (this.alignOn && this.alignA) {
      const a = this.alignA
      const b = this.cursor || a
      out.push(`<g stroke="${c.accent2}" stroke-width="2.4">
        <line x1="${X(a.x)}" y1="${Y(a.z)}" x2="${X(b.x)}" y2="${Y(b.z)}" stroke-dasharray="8 5"/>
        <circle cx="${X(a.x)}" cy="${Y(a.z)}" r="5" fill="#fff"/></g>`)
    }
    // the calibration line
    if (this.cal?.a) {
      const a = this.cal.a
      const b = this.cal.b || this.cursor || a
      out.push(`<g stroke="${c.accent}" stroke-width="2">
        <line x1="${X(a.x)}" y1="${Y(a.z)}" x2="${X(b.x)}" y2="${Y(b.z)}"/>
        <circle cx="${X(a.x)}" cy="${Y(a.z)}" r="5" fill="#fff"/>
        <circle cx="${X(b.x)}" cy="${Y(b.z)}" r="5" fill="#fff"/></g>`)
    }
    // north arrow
    out.push(`<g transform="translate(${W - 46},64)">
      <circle r="19" fill="rgba(255,255,255,.86)"/>
      <path d="M0 -13 L5 8 L0 3 L-5 8 Z" fill="${c.ink}"/>
      <text y="17" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="1" fill="${c.n600}">N</text></g>`)

    this.svg.innerHTML = out.join('')
    this.chrome(s, K, c, CL)
  }

  // an architectural symbol per object type (ported from the v1 surface)
  private symbol(it: ItemV2, hex: string, sel: boolean, K: number, c: Palette): string {
    const f = fpOf(it)
    const rot = it.rot || 0
    const w = f.w * K
    const d = f.d * K
    const sx = this.tx(it.x)
    const sy = this.ty(it.z)
    const sw = Math.max(1, Math.min(2, K / 14))
    const op = it.auto ? 0.55 : 1
    let body = ''
    const box = (bw: number, bd: number, fill: string, o?: number): string =>
      `<rect x="${(-bw / 2).toFixed(1)}" y="${(-bd / 2).toFixed(1)}"
      width="${bw.toFixed(1)}" height="${bd.toFixed(1)}" rx="${Math.min(3, bw / 8).toFixed(1)}"
      fill="${fill}" fill-opacity="${o == null ? 0.3 : o}" stroke="${hex}"
      stroke-width="${sw.toFixed(1)}"/>`
    const chair = (cx: number, cy: number, r: number): string =>
      `<rect x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}"
      width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" rx="${(r / 2).toFixed(1)}"
      fill="none" stroke="${hex}" stroke-width="${(sw * 0.8).toFixed(1)}" stroke-opacity=".7"/>`
    if (f.sym === 'counter') {
      body =
        box(w, d, hex) +
        `<line x1="${(-w / 2).toFixed(1)}" y1="${(-d / 6).toFixed(1)}" x2="${(w / 2).toFixed(1)}"
          y2="${(-d / 6).toFixed(1)}" stroke="${hex}" stroke-width="${sw.toFixed(1)}" stroke-opacity=".6"/>` +
        chair(-w / 4, d * 0.95, Math.max(3, 0.22 * K)) +
        chair(w / 4, d * 0.95, Math.max(3, 0.22 * K))
    } else if (f.sym === 'round8') {
      const r = w / 2
      body = `<circle r="${r.toFixed(1)}" fill="${hex}" fill-opacity=".26" stroke="${hex}" stroke-width="${sw.toFixed(1)}"/>`
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        body += chair(Math.cos(a) * r * 1.42, Math.sin(a) * r * 1.42, Math.max(3, 0.2 * K))
      }
    } else if (f.sym === 'table6') {
      body = box(w, d, hex)
      ;[-1, 1].forEach((sgn) => [-0.3, 0.3].forEach((o) => (body += chair(w * o, sgn * d * 0.92, Math.max(3, 0.2 * K)))))
    } else if (f.sym === 'chairs') {
      body = ''
      ;([
        [-0.28, -0.28],
        [0.28, -0.28],
        [-0.28, 0.28],
        [0.28, 0.28],
      ] as const).forEach(([a, b]) => (body += chair(w * a, d * b, Math.max(3, 0.22 * K))))
    } else if (f.sym === 'rope') {
      body = `<line x1="${(-w / 2).toFixed(1)}" y1="0" x2="${(w / 2).toFixed(1)}" y2="0"
        stroke="${hex}" stroke-width="${(sw * 1.2).toFixed(1)}" stroke-dasharray="3 3"/>`
      for (let i = 0; i <= 3; i++) {
        const px = -w / 2 + (i / 3) * w
        body += `<circle cx="${px.toFixed(1)}" cy="0" r="${Math.max(2.4, 0.09 * K).toFixed(1)}"
          fill="#fff" stroke="${hex}" stroke-width="${sw.toFixed(1)}"/>`
      }
    } else if (f.sym === 'bus' || f.sym === 'car') {
      body =
        box(w, d, hex, 0.34) +
        `<rect x="${(-w / 2 + w * 0.06).toFixed(1)}" y="${(-d / 2 + d * 0.16).toFixed(1)}"
          width="${(w * 0.2).toFixed(1)}" height="${(d * 0.68).toFixed(1)}" fill="${hex}"
          fill-opacity=".5"/>`
      ;([
        [-0.34, -0.5],
        [-0.34, 0.5],
        [0.3, -0.5],
        [0.3, 0.5],
      ] as const).forEach(
        ([a, b]) =>
          (body += `<rect x="${(w * a).toFixed(1)}" y="${(d * b - Math.max(1.6, 0.1 * K) / 2).toFixed(1)}"
          width="${Math.max(3, 0.5 * K).toFixed(1)}" height="${Math.max(1.6, 0.1 * K).toFixed(1)}"
          fill="${hex}"/>`),
      )
    } else if (f.sym === 'person') {
      const r = Math.max(2.6, w / 2)
      body = `<circle r="${r.toFixed(1)}" fill="${hex}" stroke="#fff" stroke-width="${sw.toFixed(1)}"/>
        <path d="M ${(-r * 1.5).toFixed(1)} ${(r * 1.1).toFixed(1)} A ${(r * 1.6).toFixed(1)} ${(r * 1.6).toFixed(1)} 0 0 1 ${(r * 1.5).toFixed(1)} ${(r * 1.1).toFixed(1)}"
          fill="none" stroke="${hex}" stroke-width="${sw.toFixed(1)}" stroke-opacity=".7"/>`
    } else if (f.sym === 'disc') {
      const r = Math.max(3.4, 0.34 * K)
      body = `<circle r="${r.toFixed(1)}" fill="${hex}" stroke="#fff" stroke-width="${sw.toFixed(1)}"/>
        <circle r="${(r * 0.38).toFixed(1)}" fill="#fff"/>`
    } else if (f.sym === 'aframe') {
      const r = Math.max(4, 0.42 * K)
      body = `<path d="M 0 ${(-r).toFixed(1)} L ${r.toFixed(1)} ${r.toFixed(1)} L ${(-r).toFixed(1)} ${r.toFixed(1)} Z"
        fill="${hex}" fill-opacity=".5" stroke="${hex}" stroke-width="${sw.toFixed(1)}"/>`
    } else if (f.sym === 'arrow') {
      const r = Math.max(4, 0.42 * K)
      body = `<path d="M ${(-r).toFixed(1)} 0 L ${(r * 0.3).toFixed(1)} 0 M ${(r * 0.3).toFixed(1)} ${(-r * 0.5).toFixed(1)} L ${r.toFixed(1)} 0 L ${(r * 0.3).toFixed(1)} ${(r * 0.5).toFixed(1)}"
        fill="none" stroke="${hex}" stroke-width="${(sw * 1.6).toFixed(1)}" stroke-linecap="round"/>`
    } else if (f.sym === 'banner' || f.sym === 'plate') {
      body = box(Math.max(6, w), Math.max(3, d), hex, 0.6)
    } else {
      body = box(Math.max(5, w), Math.max(5, d), hex, 0.35)
    }
    const ring = sel
      ? `<circle r="${(Math.max(w, d) / 2 + 7).toFixed(1)}" fill="none" stroke="${c.accent}" stroke-width="2.4"/>`
      : ''
    const hov =
      this.hover === 'item:' + it.id && !sel
        ? `<circle r="${(Math.max(w, d) / 2 + 6).toFixed(1)}" fill="${c.accent}" fill-opacity=".12"/>`
        : ''
    return `<g data-h="${it.auto ? 'auto' : 'item'}" data-id="${it.id}"
      transform="translate(${sx.toFixed(1)},${sy.toFixed(1)}) rotate(${rot})"
      opacity="${op}" style="cursor:${it.auto ? 'default' : 'move'}">${hov}${body}${ring}</g>`
  }

  // ---- overlay chrome ----
  /** True while the planner is typing into one of the overlay's inputs. */
  private typing(): boolean {
    const a = document.activeElement
    return !!a && this.ui.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')
  }
  private chrome(s: SceneV2, K: number, c: Palette, CL: ClassMap): void {
    if (this.typing()) return
    const barM = K > 22 ? 5 : K > 9 ? 10 : 25
    const barPx = barM * K
    const ratio = Math.round(1000 / (K * 0.26458))
    const ftLab = s.units === 'm' ? barM + ' m' : Math.round(barM * 3.28084) + ' ft'
    let ui = `
      <div class="scale" style="color:${c.ink}">
        <div><i>Scale</i><div class="bar" style="width:${barPx.toFixed(0)}px"></div></div>
        <b>${ftLab} · 1:${ratio}</b></div>`
    if (s.site.map) ui += `<div class="attr">© OpenStreetMap contributors</div>`
    // the drawing contract: a live chip with a Done button — never a silent Enter
    if (this.draft && this.draft.length) {
      const road = this.draftKind === 'road'
      let len = 0
      for (let i = 1; i < this.draft.length; i++) {
        const a = this.draft[i - 1]!
        const b = this.draft[i]!
        len += Math.hypot(b[0] - a[0], b[1] - a[1])
      }
      const lab = s.units === 'm' ? Math.round(len) + ' m' : Math.round(len * 3.28084) + ' ft'
      const [lx, lz] = this.draft[this.draft.length - 1]!
      const px = Math.max(10, Math.min((this.W || 600) - 330, this.tx(lx) + 18))
      const py = Math.max(10, Math.min((this.H || 400) - 64, this.ty(lz) - 56))
      const can = this.draft.length >= 2
      ui += `<div class="commit" style="left:${px.toFixed(0)}px;top:${py.toFixed(0)}px">
        <span>${road ? 'Road' : 'Wall'} · ${lab} · ${this.draft.length} point${this.draft.length === 1 ? '' : 's'}</span>
        ${can ? '<button class="ok" data-dc="ok">✓ Done</button>' : '<span style="font-weight:600;color:#c3c6cd">click the next point</span>'}
        <button class="no" data-dc="no">Esc</button></div>`
    }
    const hint = this.alignOn
      ? this.alignA
        ? 'Click the far end — the map turns so this edge runs flat'
        : 'Straighten: click one end of an edge that should run flat (a wall face, a street)'
      : s.place
      ? `Click to place ${esc(s.place.l)} · hold Alt to keep placing`
      : s.tool === 'wall' || s.tool === 'road'
        ? this.draft
          ? `Click along the ${this.draftKind === 'road' ? 'road — bends welcome' : 'walls'} · hold Shift to snap to 15° angles · ✓ Done commits it`
          : s.tool === 'road'
            ? 'Click to start a road — click again for each bend, start on a road for a side street'
            : 'Click to start a wall — or click an existing wall’s end to continue it'
        : s.tool === 'space'
          ? 'Drag a rectangle where a queue will stand'
          : s.tool === 'cal'
            ? this.cal?.a && !this.cal.b
              ? 'Click the far end of a known distance'
              : 'Click one end of something you know the size of'
            : s.msel?.length
              ? `${s.msel.length} grabbed · ⌫ deletes them all · Esc lets go`
              : s.sel
                ? 'Drag to move · right-click for tools · ⌫ to delete'
                : 'Click anything to select it · Shift-drag grabs several · right-click for tools'
    ui += `<div class="hint">${hint}</div>`
    if (this.cal?.b) {
      ui += `<div class="ask"><b>How far is that, really?</b>
        <input type="number" id="cald" placeholder="${s.units === 'm' ? 'metres' : 'feet'}" step="0.5">
        <button data-c="ok">Set the scale</button>
        <button class="g" data-c="no">Cancel</button></div>`
    }
    if (this.pop) ui += this.menu(s, CL, this.pop)
    // rebuild the overlay only when it actually changed — buttons stay stable
    // under the 400ms tick, so a click can never land on a replaced node
    if (ui === this._uiHtml) return
    this._uiHtml = ui
    this.ui.innerHTML = ui

    const dOk = this.ui.querySelector<HTMLButtonElement>('[data-dc=ok]')
    if (dOk) dOk.onclick = () => this.finishWall()
    const dNo = this.ui.querySelector<HTMLButtonElement>('[data-dc=no]')
    if (dNo)
      dNo.onclick = () => {
        this.draft = null
        this.contWall = null
        this.draw()
      }

    const cd = this.ui.querySelector<HTMLInputElement>('#cald')
    if (cd) {
      cd.focus()
      const apply = () => {
        const real = parseFloat(cd.value)
        if (!(real > 0) || !this.cal?.a || !this.cal.b) return
        const a = this.cal.a
        const b = this.cal.b
        const shown = Math.hypot(b.x - a.x, b.z - a.z)
        this.cal = null
        if (shown < 0.05) {
          this.draw()
          return
        }
        const realM = s.units === 'm' ? real : real * 0.3048
        s.onCalibrate({ factor: realM / shown, anchorX: a.x, anchorZ: a.z })
        this.draw()
      }
      this.ui.querySelector<HTMLButtonElement>('[data-c=ok]')!.onclick = apply
      cd.onkeydown = (e) => {
        if (e.key === 'Enter') apply()
      }
      this.ui.querySelector<HTMLButtonElement>('[data-c=no]')!.onclick = () => {
        this.cal = null
        this.draw()
      }
    }
    this.ui.querySelectorAll<HTMLButtonElement>('[data-m]').forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.getAttribute('data-m')
          const pop = this.pop
          this.pop = null
          if (!pop) return
          if (k === 'rm') s.onDeleteSel()
          else if (k === 'dup') s.onDuplicateItem(pop.id)
          else if (k === 'rl') s.onRotateItem(pop.id, -15)
          else if (k === 'rr') s.onRotateItem(pop.id, 15)
          else if (k === 'own') s.onOwn(pop.id)
          this.draw()
        }),
    )
    const nm = this.ui.querySelector<HTMLInputElement>('#popname')
    if (nm)
      nm.onchange = () => {
        if (this.pop) s.onRenameSpace(this.pop.id, nm.value)
      }
  }
  /** Where the menu can actually sit: inside the surface, flipped below near the top. */
  private popAt(p: Pop, ph: number): string {
    const pw = 188
    const x = Math.max(pw / 2 + 6, Math.min(this.W - pw / 2 - 6, p.sx))
    const below = p.sy < ph + 8
    const y = below ? Math.min(this.H - ph - 6, p.sy + 10) : Math.min(this.H - 6, p.sy)
    return `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${pw}px;transform:translate(-50%,${below ? '0' : '-100%'})`
  }
  private menu(s: SceneV2, CL: ClassMap, p: Pop): string {
    const c = C()
    if (p.kind === 'auto')
      return `<div class="pop" style="${this.popAt(p, 96)}">
        <div class="hd"><i style="background:${c.accent2}"></i>From the builder</div>
        <button data-m="own"><em>✎</em>Make it editable here</button></div>`
    if (p.kind === 'space') {
      const sp = s.site.spaces.find((z) => z.id === p.id)
      return `<div class="pop" style="${this.popAt(p, 186)}">
        <div class="hd"><i style="background:${c.accent2}"></i>Queue space</div>
        <input id="popname" value="${esc(sp?.l || '')}" placeholder="Space name">
        <button class="rm" data-m="rm"><em>⌫</em>Delete this space</button></div>`
    }
    if (p.kind === 'wall')
      return `<div class="pop" style="${this.popAt(p, 136)}">
        <div class="hd"><i style="background:#33373d"></i>Wall</div>
        <button class="rm" data-m="rm"><em>⌫</em>Delete this wall</button></div>`
    if (p.kind === 'road')
      return `<div class="pop" style="${this.popAt(p, 136)}">
        <div class="hd"><i style="background:#57534c"></i>Road</div>
        <button class="rm" data-m="rm"><em>⌫</em>Delete this road</button></div>`
    const it = s.site.items.find((x) => x.id === p.id)
    const cls = CL[it?.kind || 'furn']
    return `<div class="pop" style="${this.popAt(p, 208)}">
      <div class="hd"><i style="background:${cls.hex}"></i>${esc(it?.l || 'Object')}</div>
      <button data-m="rl"><em>↺</em>Rotate left</button>
      <button data-m="rr"><em>↻</em>Rotate right</button>
      <button data-m="dup"><em>⧉</em>Duplicate</button>
      <button class="rm" data-m="rm"><em>⌫</em>Delete</button></div>`
  }

  // ---- the map: OSM tiles, georeferenced, so a traced plan is to scale ----
  async pullMap(lat: number, lon: number): Promise<boolean> {
    const z = 18
    const n = 2 ** z
    const size = 256
    const span = 3
    const wxT = ((lon + 180) / 360) * n
    const la = (lat * Math.PI) / 180
    const wyT = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n
    const cx = Math.floor(wxT)
    const cy = Math.floor(wyT)
    const cv = document.createElement('canvas')
    cv.width = cv.height = size * span
    const cx2 = cv.getContext('2d')!
    cx2.fillStyle = '#efe9e0'
    cx2.fillRect(0, 0, cv.width, cv.height)
    const half = (span - 1) / 2
    const jobs: Promise<boolean>[] = []
    for (let i = 0; i < span; i++)
      for (let j = 0; j < span; j++) {
        const txx = cx - half + i
        const tyy = cy - half + j
        jobs.push(
          new Promise((res) => {
            const im = new Image()
            im.crossOrigin = 'anonymous'
            im.onload = () => {
              cx2.drawImage(im, i * size, j * size)
              res(true)
            }
            im.onerror = () => res(false)
            im.src = `https://tile.openstreetmap.org/${z}/${txx}/${tyy}.png`
          }),
        )
      }
    const ok = (await Promise.all(jobs)).filter(Boolean).length
    if (!ok) return false
    const mpp = (156543.03392 * Math.cos(la)) / n
    const px = (wxT - (cx - half)) * size
    const py = (wyT - (cy - half)) * size
    const s = this.S()
    s?.onMap({ src: cv.toDataURL('image/png'), mpp, px, py, w: cv.width, h: cv.height })
    this.fitNow()
    return true
  }
}
