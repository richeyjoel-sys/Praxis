// Praxis plan — the drafting surface. Architectural linework in SVG at true scale:
// poché walls, door swings, dimension strings, hatched paving, real object symbols.
// Reads the scene through `getScene()` and writes back through its callbacks. No 3D here.
//
// Ported from prototype/praxis-plan.js. The prototype was a custom element with a shadow
// root reading window.__praxisScene(); this is a plain class that owns the DOM inside a
// host element, scopes its styles under `.px-plan`, and takes the scene getter directly.
import type { GeoRoom, PlacedItem, PlanTool, PlanToolId, PlanUnderlay, Scene, SimGeo } from '@/model/types'

const tok = (n: string, f: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f

interface Palette {
  ink: string
  paper: string
  n100: string
  n200: string
  n300: string
  n400: string
  n600: string
  accent: string
  a100: string
  a300: string
  accent2: string
  b100: string
}
const C = (): Palette => ({
  ink: tok('--color-text', '#201e1d'),
  paper: tok('--color-bg', '#f5ead8'),
  n100: tok('--color-neutral-100', '#f1e7d6'),
  n200: tok('--color-neutral-200', '#e6dccb'),
  n300: tok('--color-neutral-300', '#d8cdbb'),
  n400: tok('--color-neutral-400', '#bfb3a0'),
  n600: tok('--color-neutral-600', '#7d7466'),
  accent: tok('--color-accent', '#c67139'),
  a100: tok('--color-accent-100', '#f7ece3'),
  a300: tok('--color-accent-300', '#e0b28c'),
  accent2: tok('--color-accent-2', '#7a8a5e'),
  b100: tok('--color-accent-2-100', '#eceee5'),
})
// every class of thing on the plan carries its own colour, matching the builder
interface ClassDef {
  hex: string
  l: string
  g: string
}
type ClassMap = Record<PlacedItem['kind'], ClassDef>
const CLASS = (): ClassMap => {
  const c = C()
  return {
    furn: { hex: '#a8763f', l: 'Furniture', g: '▭' },
    sign: { hex: c.accent, l: 'Signs', g: '◉' },
    people: { hex: c.accent2, l: 'People', g: '♦' },
    veh: { hex: '#4a5a6a', l: 'Vehicles', g: '▰' },
  }
}
// footprint in metres, and how the symbol is drawn
type Sym =
  | 'counter'
  | 'box'
  | 'table6'
  | 'round8'
  | 'chairs'
  | 'rope'
  | 'banner'
  | 'aframe'
  | 'disc'
  | 'arrow'
  | 'plate'
  | 'bus'
  | 'car'
  | 'person'
interface Footprint {
  w: number
  d: number
  sym: Sym
}
const FP: Record<string, Footprint> = {
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
  deskstaff: { w: 0.5, d: 0.5, sym: 'person' },
}
const fpOf = (it: PlacedItem): Footprint => FP[it.t] || { w: 0.8, d: 0.8, sym: 'box' }
const ESC: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }
const esc = (t: unknown): string =>
  String(t == null ? '' : t).replace(/[<>&"]/g, (ch) => ESC[ch] ?? ch)

// ---- local state shapes ----
interface Cam {
  x: number
  z: number
  ppm: number
} // in metres / px-per-metre
interface Pt {
  x: number
  z: number
  sx: number
  sy: number
}
interface Cal {
  a: Pt
  b?: Pt
} // two picked points awaiting a real distance
interface Rubber {
  x: number
  y: number
  w: number
  d: number
} // the rectangle being traced
type PopKind = 'item' | 'room' | 'auto'
interface Pop {
  kind: PopKind
  id: string
  sx: number
  sy: number
} // the right-click menu
type Down =
  | { mode: 'trace'; p: Pt }
  | { mode: 'size'; id: string; p: Pt; w0: number; d0: number }
  | { mode: 'item'; id: string; p: Pt; it0: PlacedItem }
  | { mode: 'room'; id: string; p: Pt; x0: number; y0: number }
  | { mode: 'pan'; p: Pt; cx: number; cz: number }
interface MapPull {
  src: string
  mpp: number
  px: number
  py: number
  w: number
  h: number
}
type Underlay = MapPull | PlanUnderlay
const isMap = (u: Underlay): u is MapPull => 'mpp' in u && !!u.mpp
interface Frame {
  w: number
  d: number
  road: number
  drive: number
  bays: number
}
const FRAME_DEFAULT = (): Frame => ({ w: 64, d: 42, road: 9, drive: 7, bays: 3 })
const isFrameKey = (k: string | null): k is keyof Frame =>
  k === 'w' || k === 'd' || k === 'road' || k === 'drive' || k === 'bays'
type Step = 'start' | 'read' | 'map' | 'frame' | null

const hitOf = (e: Event): Element | null => {
  const t = e.target
  return t instanceof Element ? t.closest('[data-h]') : null
}

const STYLE = `
.px-plan{display:block;position:relative;width:100%;height:100%;min-height:0;
  border-radius:var(--radius-lg,16px);overflow:hidden;
  background:var(--color-neutral-200,#e6dccb);
  font-family:var(--font-body,system-ui);touch-action:none}
.px-plan > svg{position:absolute;inset:0;width:100%;height:100%;display:block;
  user-select:none;-webkit-user-select:none}
.px-plan > .px-plan-ui{position:absolute;pointer-events:none;inset:0}
.px-plan > .px-plan-ui > *{pointer-events:auto}
.px-plan .rail2{position:absolute;left:13px;bottom:13px;display:flex;gap:4px;
  padding:5px;border-radius:16px;background:var(--color-bg,#f5ead8);
  box-shadow:0 6px 20px rgba(28,24,18,.2);
  max-width:calc(100% - 26px);overflow-x:auto;overscroll-behavior:contain}
.px-plan .rail2 button{width:44px;height:44px;border:0;border-radius:12px;cursor:pointer;
  font:inherit;font-size:16px;font-weight:700;display:grid;place-items:center;
  background:transparent;color:var(--color-neutral-700,#5f584c);position:relative}
.px-plan .rail2 button:hover{background:var(--color-neutral-200,#e6dccb)}
.px-plan .rail2 button[aria-pressed=true]{background:var(--color-accent,#c67139);color:#fff}
.px-plan .rail2 hr{border:0;border-left:1px solid var(--color-neutral-300,#d8cdbb);margin:4px 2px;
  width:0;align-self:stretch}
.px-plan .ask{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  display:flex;align-items:center;gap:9px;padding:13px 15px;border-radius:16px;
  background:var(--color-bg,#f5ead8);box-shadow:0 14px 40px rgba(28,24,18,.3)}
.px-plan .ask b{font-size:13px;font-weight:700;white-space:nowrap}
.px-plan .ask input{height:44px;width:104px;padding:0 12px;border-radius:12px;font:inherit;
  font-size:15px;font-weight:700;border:1.5px solid var(--color-neutral-300,#d8cdbb);
  background:#fffdf8;color:var(--color-text,#201e1d)}
.px-plan .ask button{height:44px;padding:0 16px;border:0;border-radius:999px;cursor:pointer;
  font:inherit;font-size:13px;font-weight:700;background:var(--color-accent,#c67139);
  color:#fff}
.px-plan .ask button.g{background:transparent;color:var(--color-neutral-700,#5f584c);
  border:1.5px solid var(--color-neutral-300,#d8cdbb)}
.px-plan .pop{position:absolute;box-sizing:border-box;padding:5px;
  border-radius:14px;background:var(--color-text,#201e1d);
  box-shadow:0 12px 30px rgba(20,17,12,.4);display:flex;flex-direction:column;gap:1px}
.px-plan .pop .hd{display:flex;align-items:center;gap:7px;padding:7px 9px 6px;font-size:12px;
  font-weight:700;color:#f6efe2}
.px-plan .pop .hd i{font-style:normal;width:10px;height:10px;border-radius:3px;flex:none}
.px-plan .pop button{height:40px;padding:0 10px;border:0;border-radius:9px;cursor:pointer;
  font:inherit;font-size:12.5px;font-weight:700;color:#f6efe2;background:transparent;
  text-align:left;display:flex;align-items:center;gap:9px}
.px-plan .pop button:hover{background:rgba(246,239,226,.15)}
.px-plan .pop button.rm:hover{background:#b8563f}
.px-plan .pop button em{font-style:normal;width:18px;text-align:center;opacity:.75}
.px-plan .pop input{height:40px;margin:2px 0;padding:0 10px;border-radius:9px;font:inherit;
  font-size:12.5px;font-weight:700;border:1.5px solid rgba(246,239,226,.28);
  background:rgba(246,239,226,.08);color:#f6efe2}
.px-plan .zoom{position:absolute;right:13px;bottom:13px;display:flex;flex-direction:column;gap:6px}
.px-plan .zoom button{width:44px;height:44px;border:0;border-radius:14px;cursor:pointer;
  font:inherit;font-size:17px;font-weight:700;color:var(--color-text,#201e1d);
  background:var(--color-bg,#f5ead8);box-shadow:0 4px 14px rgba(28,24,18,.22)}
.px-plan .zoom button:hover{background:var(--color-accent-100,#f7ece3)}
.px-plan .zoom .fit{font-size:11.5px;letter-spacing:.02em}
.px-plan .scale{position:absolute;left:13px;top:13px;pointer-events:none;display:flex;align-items:flex-end;gap:11px;
  padding:9px 13px;border-radius:14px;background:var(--color-bg,#f5ead8);
  box-shadow:0 4px 14px rgba(28,24,18,.18)}
.px-plan .scale b{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;
  letter-spacing:.02em}
.px-plan .scale i{font-style:normal;font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;
  color:var(--color-neutral-600,#7d7466);font-weight:700}
.px-plan .bar{height:7px;border-left:2px solid currentColor;border-right:2px solid currentColor;
  border-bottom:2px solid currentColor}
.px-plan .attr{position:absolute;right:13px;top:56px;pointer-events:none;font-size:9.5px;padding:4px 8px;z-index:2;
  border-radius:8px;background:rgba(255,253,248,.86);color:#4a463f}
.px-plan .sel{position:absolute;display:flex;align-items:center;gap:4px;padding:5px;
  border-radius:14px;background:var(--color-text,#201e1d);
  box-shadow:0 8px 22px rgba(20,17,12,.36);transform:translate(-50%,-100%)}
.px-plan .sel button{height:40px;min-width:40px;padding:0 11px;border:0;border-radius:10px;
  cursor:pointer;font:inherit;font-size:12px;font-weight:700;color:#f6efe2;
  background:transparent;white-space:nowrap}
.px-plan .sel button:hover{background:rgba(246,239,226,.16)}
.px-plan .sel button.rm:hover{background:#b8563f}
.px-plan .sel .nm{font-size:12px;font-weight:700;color:#f6efe2;padding:0 8px 0 6px;
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.px-plan .sel .nm span{width:9px;height:9px;border-radius:3px}
.px-plan .hint{position:absolute;left:50%;bottom:11px;transform:translateX(-50%);pointer-events:none;
  max-width:calc(100% - 26px);overflow:hidden;text-overflow:ellipsis;font-size:11.5px;
  font-weight:700;padding:7px 13px;border-radius:999px;white-space:nowrap;
  background:var(--color-text,#201e1d);color:#f6efe2}
.px-plan .set{position:absolute;left:0;right:0;top:0;display:block;padding:11px;
  max-height:100%;overflow-y:auto;overscroll-behavior:contain}
.px-plan .card{background:var(--color-bg,#f5ead8);border-radius:16px;padding:11px 13px;
  box-shadow:0 10px 30px rgba(28,24,18,.2);display:flex;flex-direction:column;gap:9px}
.px-plan .card h3{margin:0;font-size:15px;font-weight:700;letter-spacing:-.02em;line-height:1.2}
.px-plan .card p{margin:0;font-size:11.5px;line-height:1.4;color:var(--color-neutral-600,#7d7466);
  text-wrap:pretty}
.px-plan .card .top{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
.px-plan .card .top > div:first-child{flex:1 1 240px;min-width:180px}
.px-plan .rail{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.px-plan .rail span{font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
  padding:4px 8px;border-radius:999px;background:var(--color-neutral-200,#e6dccb);
  color:var(--color-neutral-600,#7d7466)}
.px-plan .rail span[data-on]{background:var(--color-accent,#c67139);color:#fff}
.px-plan .routes{display:flex;gap:7px;flex-wrap:wrap}
.px-plan .route{display:flex;align-items:center;gap:9px;padding:7px 12px 7px 8px;border-radius:999px;
  border:1.5px solid var(--color-neutral-300,#d8cdbb);background:rgba(255,253,248,.7);
  cursor:pointer;text-align:left;font:inherit;flex:0 1 auto;min-height:44px}
.px-plan .route:hover{border-color:var(--color-accent,#c67139);
  background:var(--color-accent-100,#f7ece3)}
.px-plan .route em{font-style:normal;width:30px;height:30px;flex:none;display:grid;
  place-items:center;border-radius:9px;font-size:15px;
  background:var(--color-accent-100,#f7ece3);color:var(--color-accent,#c67139)}
.px-plan .route b{display:block;font-size:13px;letter-spacing:-.01em;white-space:nowrap}
.px-plan .route i{font-style:normal;display:block;font-size:10.5px;margin-top:1px;
  max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--color-neutral-600,#7d7466);line-height:1.35}
.px-plan .route[data-key] b:after{content:attr(data-key);float:right;font-size:10.5px;
  font-weight:700;opacity:.5;letter-spacing:.06em}
.px-plan .card .scr{display:flex;flex-direction:column;gap:9px;min-height:0}
.px-plan .card footer{display:flex;gap:9px;align-items:center;flex-wrap:wrap;
  position:sticky;bottom:0;padding-top:3px;background:var(--color-bg,#f5ead8)}
.px-plan .card footer{padding-top:0}
.px-plan .card footer button{height:44px;padding:0 17px;border:0;border-radius:999px;cursor:pointer;
  font:inherit;font-size:13px;font-weight:700}
.px-plan .go{background:var(--color-accent,#c67139);color:#fff}
.px-plan .ghost{background:transparent;color:var(--color-neutral-700,#5f584c);
  border:1.5px solid var(--color-neutral-300,#d8cdbb)}
.px-plan .card label{display:flex;flex-direction:column;gap:5px;font-size:9.5px;
  letter-spacing:.11em;text-transform:uppercase;font-weight:700;
  color:var(--color-neutral-600,#7d7466)}
.px-plan .card input[type=text],.px-plan .card input[type=number]{height:44px;padding:0 11px;
  border-radius:12px;font:inherit;font-size:14px;font-weight:700;
  border:1.5px solid var(--color-neutral-300,#d8cdbb);background:#fffdf8;
  color:var(--color-text,#201e1d);text-transform:none;letter-spacing:0}
.px-plan .grid2{display:flex;gap:9px;flex-wrap:wrap}
.px-plan .grid2 label{flex:0 0 auto}
.px-plan .grid2 input{width:96px}
.px-plan .found{display:flex;gap:6px;flex-wrap:wrap;max-height:96px;overflow:auto;padding:2px}
.px-plan .found div{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:700;
  padding:9px 12px;border-radius:12px;background:rgba(255,253,248,.8)}
.px-plan .found div b{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums;
  font-size:12px;color:var(--color-neutral-600,#7d7466)}
.px-plan .load{display:flex;align-items:center;gap:11px;font-size:13px;font-weight:700}
.px-plan .spin{width:22px;height:22px;border-radius:999px;flex:none;
  border:2.5px solid var(--color-neutral-300,#d8cdbb);
  border-top-color:var(--color-accent,#c67139);animation:px-plan-sp 1s linear infinite}
@keyframes px-plan-sp{to{transform:rotate(360deg)}}
`

export class PlanSurface {
  private readonly host: HTMLElement
  private readonly getScene: () => Scene | null
  private readonly style: HTMLStyleElement
  private readonly svg: SVGSVGElement
  private readonly ui: HTMLDivElement
  private readonly ro: ResizeObserver
  private readonly tick: ReturnType<typeof setInterval>
  private cam: Cam | null = null // {x, z, ppm} in metres / px-per-metre
  private _tool: PlanToolId = 'select' // mirrored from the app's toolbar
  private cal: Cal | null = null // two picked points awaiting a real distance
  private rubber: Rubber | null = null // the rectangle being traced
  private pop: Pop | null = null // the right-click menu
  private hover: string | null = null
  private units: 'ft' | 'm' = 'ft'
  private underlayOp = 0.5
  private map: MapPull | null = null
  private _down: Down | null = null
  private _keepTool = false
  private _step: Step = null
  private _msg: string | null = null
  private _frame: Frame | null = null
  // window listeners, kept so destroy() can remove them
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Alt') this._keepTool = true
  }
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Alt') this._keepTool = false
  }

  constructor(host: HTMLElement, getScene: () => Scene | null) {
    this.host = host
    this.getScene = getScene
    host.classList.add('px-plan')
    this.style = document.createElement('style')
    this.style.textContent = STYLE
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    this.ui = document.createElement('div')
    this.ui.className = 'px-plan-ui'
    host.append(this.style, this.svg, this.ui)
    this.wire()
    this.ro = new ResizeObserver(() => this.draw())
    this.ro.observe(host)
    this.tick = setInterval(() => this.draw(), 400) // picks up builder edits
    this.draw()
  }
  destroy(): void {
    this.ro.disconnect()
    clearInterval(this.tick)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.style.remove()
    this.svg.remove()
    this.ui.remove()
    this.host.classList.remove('px-plan')
  }

  private S(): Scene | null {
    return this.getScene()
  }
  get tool(): PlanToolId {
    const s = this.S()
    return (s && s.planTool) || this._tool
  }
  setTool(v: PlanToolId): void {
    this._tool = v
  }
  // the toolbar drives these
  zoomBy(k: number): void {
    if (!this.cam) return
    this.cam.ppm = Math.max(1.6, Math.min(190, this.cam.ppm * k))
    this.draw()
  }
  fitNow(): void {
    this.fit()
    this.draw()
  }
  cycleOpacity(): void {
    this.underlayOp = this.underlayOp > 0.7 ? 0.28 : this.underlayOp > 0.4 ? 0.85 : 0.5
    this.draw()
  }
  clearTool(): void {
    this.cal = null
    this.rubber = null
    this.pop = null
    this.draw()
  }
  private geo(): SimGeo | null {
    const s = this.S()
    return s && s.plan ? s.plan.geo : null
  }

  // ---- transform ----
  private get clientWidth(): number {
    return this.host.clientWidth
  }
  private get clientHeight(): number {
    return this.host.clientHeight
  }
  private cm(): Cam {
    const c = this.cam
    if (!c) throw new TypeError('PlanSurface: no camera yet')
    return c
  }
  private fit(): void {
    const g = this.geo()
    if (!g) return
    const W = this.clientWidth || 900,
      H = this.clientHeight || 480
    const sw = g.buildW + 14,
      sd = g.kerbY + g.kerbDepth + 8
    this.cam = {
      x: g.buildW / 2,
      z: (g.kerbY + g.kerbDepth) / 2,
      ppm: Math.min(W / sw, H / sd) * 0.96,
    }
  }
  private tx(wx: number): number {
    const c = this.cm()
    return (wx - c.x) * c.ppm + (this.clientWidth || 900) / 2
  }
  private ty(wz: number): number {
    const c = this.cm()
    return (wz - c.z) * c.ppm + (this.clientHeight || 480) / 2
  }
  private wx(sx: number): number {
    const c = this.cm()
    return (sx - (this.clientWidth || 900) / 2) / c.ppm + c.x
  }
  private wz(sy: number): number {
    const c = this.cm()
    return (sy - (this.clientHeight || 480) / 2) / c.ppm + c.z
  }
  private at(e: MouseEvent): Pt {
    const r = this.svg.getBoundingClientRect()
    return {
      x: this.wx(e.clientX - r.left),
      z: this.wz(e.clientY - r.top),
      sx: e.clientX - r.left,
      sy: e.clientY - r.top,
    }
  }

  // ---- interaction ----
  private wire(): void {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    this.svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        if (!this.cam) return
        const p = this.at(e)
        const k = Math.exp(-e.deltaY * 0.0016)
        this.cam.ppm = Math.max(1.6, Math.min(190, this.cam.ppm * k))
        const q = this.at(e)
        this.cam.x += p.x - q.x
        this.cam.z += p.z - q.z
        this.draw()
      },
      { passive: false },
    )
    this.svg.addEventListener('pointerdown', (e) => {
      const s = this.S()
      if (!s || !this.cam) return
      const p = this.at(e)
      const hit = hitOf(e)
      const kind = hit && hit.getAttribute('data-h')
      const id = (hit && hit.getAttribute('data-id')) ?? ''
      const grab = (): void => {
        try {
          this.svg.setPointerCapture(e.pointerId)
        } catch {
          /* pointer already gone */
        }
      }
      if (this.tool === 'cal') {
        if (!this.cal || this.cal.b) this.cal = { a: p }
        else this.cal = { ...this.cal, b: p }
        this._down = null
        this.draw()
        return
      }
      if (this.tool === 'trace') {
        this._down = { mode: 'trace', p }
        this.rubber = { x: p.x, y: p.z, w: 0, d: 0 }
        grab()
        this.draw()
        return
      }
      if (s.tool) {
        this.place(p, s)
        this._down = null
        this.draw()
        return
      }
      const g = this.geo()
      if (kind === 'handle') {
        const r = (g ? g.rooms : {})[id]
        if (r) this._down = { mode: 'size', id, p, w0: r.w, d0: r.d }
      } else if (kind === 'item') {
        const it = (s.items || []).find((x) => x.id === id)
        if (it) {
          s.onItemPick(id)
          this._down = { mode: 'item', id, p, it0: { ...it } }
        }
      } else if (kind === 'room') {
        const r = (g ? g.rooms : {})[id]
        s.onPick(id)
        if (r) this._down = { mode: 'room', id, p, x0: r.x, y0: r.y }
      } else {
        s.onPick(null)
        this._down = { mode: 'pan', p, cx: this.cam.x, cz: this.cam.z }
      }
      grab()
      this.draw()
    })
    this.svg.addEventListener('pointermove', (e) => {
      const s = this.S()
      if (!s || !this.cam) return
      const p = this.at(e)
      if (!this._down) {
        const hit = hitOf(e)
        const h = hit ? hit.getAttribute('data-h') + ':' + hit.getAttribute('data-id') : null
        this.svg.style.cursor = s.tool
          ? 'copy'
          : !hit
            ? 'grab'
            : hit.getAttribute('data-h') === 'handle'
              ? 'nwse-resize'
              : 'move'
        if (h !== this.hover) {
          this.hover = h
          this.draw()
        }
        return
      }
      const d = this._down,
        snap = (v: number): number => Math.round(v * 4) / 4
      if (d.mode === 'trace') {
        this.rubber = {
          x: Math.min(d.p.x, p.x),
          y: Math.min(d.p.z, p.z),
          w: Math.abs(p.x - d.p.x),
          d: Math.abs(p.z - d.p.z),
        }
        this.draw()
        return
      }
      if (d.mode === 'pan') {
        this.cam.x = d.cx - (p.x - d.p.x)
        this.cam.z = d.cz - (p.z - d.p.z)
        this.draw()
      } else if (d.mode === 'room') {
        s.onRoom(d.id, { x: snap(d.x0 + (p.x - d.p.x)), y: snap(d.y0 + (p.z - d.p.z)) })
      } else if (d.mode === 'size') {
        s.onRoom(d.id, {
          w: Math.max(2, snap(d.w0 + (p.x - d.p.x))),
          d: Math.max(2, snap(d.d0 + (p.z - d.p.z))),
        })
      } else if (d.mode === 'item') {
        const g = this.geo(),
          it = d.it0
        const r = g && it.room ? g.rooms[it.room] : undefined
        if (it.room && r) {
          const nx = ((p.x - r.x) / r.w) * 100,
            ny = ((p.z - r.y) / r.d) * 100
          s.onItem(d.id, { x: Math.max(1, Math.min(99, nx)), y: Math.max(1, Math.min(99, ny)) })
        } else s.onItem(d.id, { x: snap(p.x), y: snap(p.z) })
      }
    })
    const end = (): void => {
      if (this._down && this._down.mode === 'trace' && this.rubber) {
        const r = this.rubber
        if (r.w > 1.2 && r.d > 1.2) {
          const s2 = this.S()
          if (s2)
            s2.onTrace({
              x: +r.x.toFixed(2),
              y: +r.y.toFixed(2),
              w: +r.w.toFixed(2),
              d: +r.d.toFixed(2),
            })
        }
        this.rubber = null
      }
      this._down = null
      this.svg.style.cursor = 'grab'
      this.draw()
    }
    this.svg.addEventListener('pointerup', end)
    this.svg.addEventListener('pointercancel', end)
    // right-click is the edit menu — no modal, no hunting in a drawer
    this.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const s2 = this.S()
      if (!s2) return
      const hit = hitOf(e)
      const r = this.svg.getBoundingClientRect()
      const sx = e.clientX - r.left,
        sy = e.clientY - r.top
      if (!hit) {
        this.pop = null
        this.draw()
        return
      }
      const k = hit.getAttribute('data-h'),
        id = hit.getAttribute('data-id') ?? ''
      if (k === 'item') {
        s2.onItemPick(id)
        this.pop = { kind: 'item', id, sx, sy }
      } else if (k === 'room') {
        s2.onPick(id)
        this.pop = { kind: 'room', id, sx, sy }
      } else if (k === 'auto') {
        this.pop = { kind: 'auto', id, sx, sy }
      }
      this.draw()
    })
  }
  private place(p: Pt, s: Scene): void {
    const g = this.geo(),
      tool: PlanTool | null = s.tool
    if (!g || !tool) return
    let room: string | null = null,
      rr: GeoRoom | null = null,
      best = 1e9
    for (const k of Object.keys(g.rooms)) {
      const r = g.rooms[k]
      if (!r) continue
      if ((s.roomLevels || {})[k] !== undefined && (s.roomLevels[k] || 0) !== (s.level || 0)) continue
      if (p.x >= r.x && p.x <= r.x + r.w && p.z >= r.y && p.z <= r.y + r.d) {
        const a = r.w * r.d
        if (a < best) {
          best = a
          room = k
          rr = r
        }
      }
    }
    if (room && rr) s.onPlace(tool, room, ((p.x - rr.x) / rr.w) * 100, ((p.z - rr.y) / rr.d) * 100)
    else s.onPlace(tool, null, Math.round(p.x * 4) / 4, Math.round(p.z * 4) / 4)
    if (!this._keepTool) s.onPlaced() // one click, one object
  }

  // ---- the map: OSM tiles, georeferenced, so a traced plan is to scale ----
  private async pullMap(lat: number, lon: number): Promise<MapPull | null> {
    const z = 18,
      n = 2 ** z,
      size = 256,
      span = 3
    const wxT = ((lon + 180) / 360) * n
    const la = (lat * Math.PI) / 180
    const wyT = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n
    const cx = Math.floor(wxT),
      cy = Math.floor(wyT)
    const cv = document.createElement('canvas')
    cv.width = cv.height = size * span
    const cx2 = cv.getContext('2d')
    if (!cx2) return null
    cx2.fillStyle = '#efe9e0'
    cx2.fillRect(0, 0, cv.width, cv.height)
    const half = (span - 1) / 2
    const jobs: Promise<boolean>[] = []
    for (let i = 0; i < span; i++)
      for (let j = 0; j < span; j++) {
        const tx = cx - half + i,
          tyy = cy - half + j
        jobs.push(
          new Promise<boolean>((res) => {
            const im = new Image()
            im.crossOrigin = 'anonymous'
            im.onload = () => {
              cx2.drawImage(im, i * size, j * size)
              res(true)
            }
            im.onerror = () => res(false)
            im.src = `https://tile.openstreetmap.org/${z}/${tx}/${tyy}.png`
          }),
        )
      }
    const ok = (await Promise.all(jobs)).filter(Boolean).length
    if (!ok) return null
    const mpp = (156543.03392 * Math.cos(la)) / n // metres per pixel at this latitude
    // where the hotel sits inside the composite, in pixels
    const px = (wxT - (cx - half)) * size,
      py = (wyT - (cy - half)) * size
    return { src: cv.toDataURL('image/png'), mpp, px, py, w: cv.width, h: cv.height }
  }

  // ---- drawing ----
  draw(): void {
    const s = this.S()
    if (!s || !s.plan) return
    if (s.mode !== 'plan') {
      this.svg.innerHTML = ''
      this.ui.innerHTML = ''
      return
    }
    const g = s.plan.geo
    if (!this.cam) this.fit()
    if (!this.cam) return
    if (this.units !== (s.units || 'ft')) this.units = s.units || 'ft'
    const W = this.clientWidth || 900,
      H = this.clientHeight || 480
    const c = C(),
      CL = CLASS(),
      K = this.cam.ppm
    const X = (w: number): string => this.tx(w).toFixed(1),
      Y = (w: number): string => this.ty(w).toFixed(1)
    const L = (id: keyof Scene['layers']): boolean => (s.layers || {})[id] !== false
    const ft = (m: number): string =>
      this.units === 'm' ? m.toFixed(1) + ' m' : Math.round(m * 3.28084) + '′'
    const out: string[] = []

    if (!s.established) {
      this.setup(s)
      return
    }
    this.ui.hidden = false

    out.push(`<defs>
      <pattern id="hpav" width="7" height="7" patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7"
        stroke="${c.n400}" stroke-width="1" stroke-opacity=".5"/></pattern>
      <pattern id="hcar" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r=".5" fill="${c.n400}" fill-opacity=".55"/></pattern>
      <pattern id="hkerb" width="6" height="6" patternUnits="userSpaceOnUse"
        patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="6"
        stroke="${c.n600}" stroke-width=".8" stroke-opacity=".4"/></pattern>
    </defs>`)
    out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${c.n200}"/>`)

    // survey grid, one line per 5 m, denser when you are in close
    const step = K > 26 ? 1 : K > 9 ? 5 : 20
    const gx0 = Math.floor(this.wx(0) / step) * step,
      gx1 = this.wx(W)
    const gz0 = Math.floor(this.wz(0) / step) * step,
      gz1 = this.wz(H)
    let grid = ''
    for (let x = gx0; x < gx1; x += step) grid += `<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${H}"/>`
    for (let z = gz0; z < gz1; z += step) grid += `<line x1="0" y1="${Y(z)}" x2="${W}" y2="${Y(z)}"/>`
    out.push(`<g stroke="${c.n400}" stroke-width=".6" stroke-opacity=".45">${grid}</g>`)

    // a traced underlay sits under everything, at its own scale
    const un: Underlay | null = this.map || (s.underlay || null)
    if (un && un.src) {
      let ox: number, oy: number, uw: number, uh: number
      if (isMap(un)) {
        // a pulled map knows its own metres
        const mk = un.mpp * K
        uw = un.w * mk
        uh = un.h * mk
        ox = this.tx(g.buildW / 2) - un.px * mk
        oy = this.ty(g.buildD / 2) - un.py * mk
      } else {
        // an uploaded plan: calibrated or fitted
        const wM = un.wM || g.buildW,
          hM = un.hM || wM * (un.ar || 0.7)
        ox = this.tx(un.ox || 0)
        oy = this.ty(un.oy || 0)
        uw = wM * K
        uh = hM * K
      }
      out.push(`<image href="${un.src}" x="${ox.toFixed(1)}" y="${oy.toFixed(1)}"
        width="${uw.toFixed(1)}" height="${uh.toFixed(1)}" opacity="${this.underlayOp}"
        preserveAspectRatio="none"/>`)
    }

    // the public road, then the kerb, then the site
    const rd = { x: -60, y: g.streetY, w: g.buildW + 120, d: g.streetDepth }
    out.push(`<rect x="${X(rd.x)}" y="${Y(rd.y)}" width="${(rd.w * K).toFixed(1)}"
      height="${(rd.d * K).toFixed(1)}" fill="#57534c" fill-opacity=".16"
      stroke="${c.ink}" stroke-width="1" stroke-opacity=".35"/>`)
    const cl = rd.y + rd.d / 2
    out.push(`<line x1="${X(rd.x)}" y1="${Y(cl)}" x2="${X(rd.x + rd.w)}" y2="${Y(cl)}"
      stroke="#c9a227" stroke-width="1.6" stroke-dasharray="${(2.4 * K).toFixed(1)} ${(2 * K).toFixed(1)}"/>`)
    out.push(`<rect x="${X(0)}" y="${Y(g.kerbY)}" width="${(g.buildW * K).toFixed(1)}"
      height="${(g.kerbDepth * K).toFixed(1)}" fill="url(#hpav)" stroke="${c.ink}"
      stroke-width="1.1" stroke-opacity=".5"/>`)
    out.push(`<line x1="${X(0)}" y1="${Y(g.kerbY + g.kerbDepth)}"
      x2="${X(g.buildW)}" y2="${Y(g.kerbY + g.kerbDepth)}" stroke="${c.ink}" stroke-width="2.4"/>`)
    ;(g.bays || []).forEach((bx, i) => {
      out.push(`<g stroke="#fffdf8" stroke-width="2" stroke-opacity=".85">
        <line x1="${X(bx - 6.9)}" y1="${Y(g.kerbY + 0.4)}" x2="${X(bx - 6.9)}" y2="${Y(g.kerbY + g.kerbDepth - 0.4)}"/>
        <line x1="${X(bx + 6.9)}" y1="${Y(g.kerbY + 0.4)}" x2="${X(bx + 6.9)}" y2="${Y(g.kerbY + g.kerbDepth - 0.4)}"/></g>`)
      if (K > 5)
        out.push(`<text x="${X(bx)}" y="${Y(g.kerbY + g.kerbDepth * 0.55)}"
        text-anchor="middle" font-size="${Math.min(15, 1.4 * K)}" font-weight="700"
        fill="${c.ink}" fill-opacity=".5">BAY ${i + 1}</text>`)
    })

    // building envelope, drawn as poché
    const wall = Math.max(1.6, 0.28 * K)
    out.push(`<rect x="${X(-0.6)}" y="${Y(-0.6)}" width="${((g.buildW + 1.2) * K).toFixed(1)}"
      height="${((g.buildD + 1.2) * K).toFixed(1)}" fill="${c.n100}"
      stroke="${c.ink}" stroke-width="${wall.toFixed(1)}" stroke-opacity=".85"/>`)

    // spaces on this floor
    const rooms: (GeoRoom & { id: string })[] = []
    Object.keys(g.rooms)
      .filter((k) => k !== 'kerb' && k !== 'street')
      .filter((k) => ((s.roomLevels || {})[k] || 0) === (s.level || 0))
      .forEach((k) => {
        const r = g.rooms[k]
        if (r) rooms.push({ id: k, ...r })
      })
    rooms.forEach((r) => {
      const sel = s.sitePick === r.id,
        hov = this.hover === 'room:' + r.id
      const px = X(r.x),
        py = Y(r.y),
        pw = r.w * K,
        pd = r.d * K
      out.push(`<g data-h="room" data-id="${r.id}">
        <rect x="${px}" y="${py}" width="${pw.toFixed(1)}" height="${pd.toFixed(1)}"
          fill="${sel ? c.a100 : '#fffdf8'}" fill-opacity="${sel ? 1 : 0.82}"
          stroke="${sel ? c.accent : c.ink}" stroke-width="${wall.toFixed(1)}"
          stroke-opacity="${sel ? 1 : 0.78}"/>
        ${
          hov && !sel
            ? `<rect x="${px}" y="${py}" width="${pw.toFixed(1)}" height="${pd.toFixed(1)}"
          fill="${c.accent}" fill-opacity=".07"/>`
            : ''
        }</g>`)
      // door opening on the front wall, with its swing
      const gap = Math.min(2.2, r.w * 0.3),
        dx = r.x + r.w / 2 - gap / 2,
        dy = r.y + r.d
      out.push(`<line x1="${X(dx)}" y1="${Y(dy)}" x2="${X(dx + gap)}" y2="${Y(dy)}"
        stroke="#fffdf8" stroke-width="${(wall + 1.4).toFixed(1)}"/>`)
      if (K > 6)
        out.push(`<path d="M ${X(dx)} ${Y(dy)} A ${(gap * K).toFixed(1)} ${(gap * K).toFixed(1)} 0 0 0 ${X(dx)} ${Y(dy - gap)}"
        fill="none" stroke="${c.ink}" stroke-width="1" stroke-opacity=".4"/>
        <line x1="${X(dx)}" y1="${Y(dy)}" x2="${X(dx)}" y2="${Y(dy - gap)}"
        stroke="${c.ink}" stroke-width="1.4" stroke-opacity=".55"/>`)
      if (L('labels')) {
        const fs = Math.max(9, Math.min(15, 1.15 * K))
        const fits = (ch: number): boolean => ch * fs * 0.56 < r.w * K - 6
        const nm = esc(s.roomNames ? s.roomNames[r.id] : r.id)
        out.push(`<text x="${X(r.x + 0.5)}" y="${+Y(r.y) + fs + 3}" font-size="${fs}"
          font-weight="700" fill="${c.ink}">${fits(nm.length) ? nm : ''}</text>`)
        if (fs * 2.4 < r.d * K)
          out.push(`<text x="${X(r.x + 0.5)}" y="${+Y(r.y) + fs * 2.1 + 3}"
          font-size="${(fs * 0.82).toFixed(1)}" fill="${c.n600}"
          font-variant-numeric="tabular-nums">${ft(r.w)} × ${ft(r.d)}</text>`)
      }
      if (sel) {
        // dimension strings, drafted: witness lines, ticks, the figure above the line
        const dimY = r.y - 1.4,
          dimX = r.x - 1.4
        out.push(`<g stroke="${c.accent}" stroke-width="1.2" fill="none">
          <line x1="${X(r.x)}" y1="${Y(dimY)}" x2="${X(r.x + r.w)}" y2="${Y(dimY)}"/>
          <line x1="${X(r.x)}" y1="${Y(dimY - 0.5)}" x2="${X(r.x)}" y2="${Y(dimY + 0.5)}"/>
          <line x1="${X(r.x + r.w)}" y1="${Y(dimY - 0.5)}" x2="${X(r.x + r.w)}" y2="${Y(dimY + 0.5)}"/>
          <line x1="${X(dimX)}" y1="${Y(r.y)}" x2="${X(dimX)}" y2="${Y(r.y + r.d)}"/>
          <line x1="${X(dimX - 0.5)}" y1="${Y(r.y)}" x2="${X(dimX + 0.5)}" y2="${Y(r.y)}"/>
          <line x1="${X(dimX - 0.5)}" y1="${Y(r.y + r.d)}" x2="${X(dimX + 0.5)}" y2="${Y(r.y + r.d)}"/></g>
          <text x="${X(r.x + r.w / 2)}" y="${(+Y(dimY) - 6).toFixed(1)}" text-anchor="middle"
            font-size="12" font-weight="700" fill="${c.accent}"
            font-variant-numeric="tabular-nums">${ft(r.w)}</text>
          <text x="${(+X(dimX) - 6).toFixed(1)}" y="${Y(r.y + r.d / 2)}" text-anchor="end"
            font-size="12" font-weight="700" fill="${c.accent}"
            font-variant-numeric="tabular-nums">${ft(r.d)}</text>
          <rect data-h="handle" data-id="${r.id}" x="${(+X(r.x + r.w) - 7).toFixed(1)}"
            y="${(+Y(r.y + r.d) - 7).toFixed(1)}" width="14" height="14" rx="4"
            fill="${c.accent}" stroke="#fffdf8" stroke-width="2"/>`)
        // how far this space sits from the kerb — the reference that matters on the day
        const gapK = g.kerbY - (r.y + r.d)
        if (gapK > 0.6)
          out.push(`<g stroke="${c.accent2}" stroke-width="1" stroke-dasharray="4 3">
          <line x1="${X(r.x + r.w / 2)}" y1="${Y(r.y + r.d)}" x2="${X(r.x + r.w / 2)}" y2="${Y(g.kerbY)}"/></g>
          <text x="${(+X(r.x + r.w / 2) + 5).toFixed(1)}" y="${Y(r.y + r.d + gapK / 2)}"
            font-size="11" font-weight="700" fill="${c.accent2}">${ft(gapK)} to kerb</text>`)
      }
    })

    // objects: real symbols, colour-coded by class
    const objs = (s.items || []).concat(L('zones') ? s.derived || [] : [])
    objs.forEach((it) => {
      const g2 = it.room ? g.rooms[it.room] : null
      if (it.room && (!g2 || ((s.roomLevels || {})[it.room] || 0) !== (s.level || 0))) return
      const ox = g2 ? g2.x + (it.x / 100) * g2.w : it.x
      const oz = g2 ? g2.y + (it.y / 100) * g2.d : it.y
      if (ox == null || oz == null) return
      const cls = CL[it.kind] || CL.furn
      const sel = !!it.id && it.id === s.itemPick
      out.push(this.symbol(it, ox, oz, cls.hex, sel, K, c))
    })

    // people and vehicles from the simulation, so the plan is the day
    // (the prototype checked `s.sim` here; the Scene contract carries no `sim`,
    // and the block was empty — live figures belong to Go live)
    if (L('delegates')) {
      /* live figures belong to Go live */
    }

    if (this.cal && this.cal.a) {
      const a = this.cal.a,
        b = this.cal.b || { x: a.x, z: a.z }
      out.push(`<g stroke="${c.accent}" stroke-width="2">
        <line x1="${X(a.x)}" y1="${Y(a.z)}" x2="${X(b.x)}" y2="${Y(b.z)}"/>
        <circle cx="${X(a.x)}" cy="${Y(a.z)}" r="5" fill="#fffdf8"/>
        <circle cx="${X(b.x)}" cy="${Y(b.z)}" r="5" fill="#fffdf8"/></g>`)
    }
    if (this.rubber) {
      const r = this.rubber
      out.push(`<rect x="${X(r.x)}" y="${Y(r.y)}" width="${(r.w * K).toFixed(1)}"
        height="${(r.d * K).toFixed(1)}" fill="${c.accent}" fill-opacity=".14"
        stroke="${c.accent}" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="${X(r.x + r.w / 2)}" y="${(+Y(r.y + r.d / 2) + 4).toFixed(1)}"
          text-anchor="middle" font-size="12" font-weight="700" fill="${c.accent}">${ft(r.w)} × ${ft(r.d)}</text>`)
    }
    // north arrow
    out.push(`<g transform="translate(${W - 46},${64})">
      <circle r="19" fill="rgba(255,253,248,.86)"/>
      <path d="M0 -13 L5 8 L0 3 L-5 8 Z" fill="${c.ink}"/>
      <text y="17" text-anchor="middle" font-size="9" font-weight="700"
        letter-spacing="1" fill="${c.n600}">N</text></g>`)
    this.svg.innerHTML = out.join('')
    this.chrome(s, K, c, CL)
  }

  // an architectural symbol per object type
  private symbol(
    it: PlacedItem,
    ox: number,
    oz: number,
    hex: string,
    sel: boolean,
    K: number,
    c: Palette,
  ): string {
    const f = fpOf(it),
      rot = it.rot || 0
    const w = f.w * K,
      d = f.d * K
    const sx = this.tx(ox),
      sy = this.ty(oz)
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
      ;[-1, 1].forEach((sgn) =>
        [-0.3, 0.3].forEach((o) => (body += chair(w * o, sgn * d * 0.92, Math.max(3, 0.2 * K)))),
      )
    } else if (f.sym === 'chairs') {
      body = ''
      ;(
        [
          [-0.28, -0.28],
          [0.28, -0.28],
          [-0.28, 0.28],
          [0.28, 0.28],
        ] as const
      ).forEach(([a, b]) => (body += chair(w * a, d * b, Math.max(3, 0.22 * K))))
    } else if (f.sym === 'rope') {
      body = `<line x1="${(-w / 2).toFixed(1)}" y1="0" x2="${(w / 2).toFixed(1)}" y2="0"
        stroke="${hex}" stroke-width="${(sw * 1.2).toFixed(1)}" stroke-dasharray="3 3"/>`
      for (let i = 0; i <= 3; i++) {
        const px = -w / 2 + (i / 3) * w
        body += `<circle cx="${px.toFixed(1)}" cy="0" r="${Math.max(2.4, 0.09 * K).toFixed(1)}"
          fill="#fffdf8" stroke="${hex}" stroke-width="${sw.toFixed(1)}"/>`
      }
    } else if (f.sym === 'bus' || f.sym === 'car') {
      body =
        box(w, d, hex, 0.34) +
        `<rect x="${(-w / 2 + w * 0.06).toFixed(1)}" y="${(-d / 2 + d * 0.16).toFixed(1)}"
          width="${(w * 0.2).toFixed(1)}" height="${(d * 0.68).toFixed(1)}" fill="${hex}"
          fill-opacity=".5"/>`
      ;(
        [
          [-0.34, -0.5],
          [-0.34, 0.5],
          [0.3, -0.5],
          [0.3, 0.5],
        ] as const
      ).forEach(
        ([a, b]) =>
          (body += `<rect x="${(w * a).toFixed(1)}" y="${(d * b - Math.max(1.6, 0.1 * K) / 2).toFixed(1)}"
          width="${Math.max(3, 0.5 * K).toFixed(1)}" height="${Math.max(1.6, 0.1 * K).toFixed(1)}"
          fill="${hex}"/>`),
      )
    } else if (f.sym === 'person') {
      const r = Math.max(2.6, w / 2)
      body = `<circle r="${r.toFixed(1)}" fill="${hex}" stroke="#fffdf8" stroke-width="${sw.toFixed(1)}"/>
        <path d="M ${(-r * 1.5).toFixed(1)} ${(r * 1.1).toFixed(1)} A ${(r * 1.6).toFixed(1)} ${(r * 1.6).toFixed(1)} 0 0 1 ${(r * 1.5).toFixed(1)} ${(r * 1.1).toFixed(1)}"
          fill="none" stroke="${hex}" stroke-width="${sw.toFixed(1)}" stroke-opacity=".7"/>`
    } else if (f.sym === 'disc') {
      const r = Math.max(3.4, ((w * K) / f.w / 2) * 0 + Math.max(3.4, 0.34 * K))
      body = `<circle r="${r.toFixed(1)}" fill="${hex}" stroke="#fffdf8" stroke-width="${sw.toFixed(1)}"/>
        <circle r="${(r * 0.38).toFixed(1)}" fill="#fffdf8"/>`
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
      ? `<circle r="${(Math.max(w, d) / 2 + 7).toFixed(1)}" fill="none"
      stroke="${c.accent}" stroke-width="2.4"/>`
      : ''
    const hov =
      this.hover === 'item:' + it.id && !sel
        ? `<circle r="${(Math.max(w, d) / 2 + 6).toFixed(1)}" fill="${c.accent}" fill-opacity=".12"/>`
        : ''
    return `<g data-h="${it.auto ? 'auto' : 'item'}" data-id="${it.id || ''}"
      transform="translate(${sx.toFixed(1)},${sy.toFixed(1)}) rotate(${rot})"
      opacity="${op}" style="cursor:${it.auto ? 'default' : 'move'}">${hov}${body}${ring}</g>`
  }

  // ---- overlay chrome ----
  private chrome(s: Scene, K: number, c: Palette, CL: ClassMap): void {
    const sel = (s.items || []).find((x) => x.id === s.itemPick)
    const barM = K > 22 ? 5 : K > 9 ? 10 : 25
    const barPx = barM * K
    const ratio = Math.round(1000 / (K * 0.26458))
    const ftLab = this.units === 'm' ? barM + ' m' : Math.round(barM * 3.28084) + ' ft'

    let ui = `
      <div class="scale" style="color:${c.ink}">
        <div><i>Scale</i><div class="bar" style="width:${barPx.toFixed(0)}px"></div></div>
        <b>${ftLab} · 1:${ratio}</b></div>`
    if (this.map) ui += `<div class="attr">© OpenStreetMap contributors</div>`
    ui += `<div class="hint">${
      this.tool === 'cal'
        ? this.cal && this.cal.a
          ? 'Click the far end of a known distance'
          : 'Click one end of something you know the size of'
        : this.tool === 'trace'
          ? 'Drag a rectangle over a room in the plan'
          : s.tool
            ? 'Click to place ' + esc(s.tool.l) + ' · hold Alt to keep placing'
            : sel
              ? 'Drag to move · right-click for tools · ⌫ to delete'
              : 'Drag a space · right-click anything · scroll to zoom'
    }</div>`
    if (sel) {
      const g = this.geo()
      const r = g && sel.room ? g.rooms[sel.room] : null
      const ox = r ? r.x + (sel.x / 100) * r.w : sel.x
      const oz = r ? r.y + (sel.y / 100) * r.d : sel.y
      const cls = CL[sel.kind] || CL.furn
      ui += `<div class="sel" style="left:${this.tx(ox).toFixed(0)}px;top:${(this.ty(oz) - 22).toFixed(0)}px">
        <span class="nm"><span style="background:${cls.hex}"></span>${esc(sel.l)}</span>
        <button data-o="rl" title="Rotate left">↺</button>
        <button data-o="rr" title="Rotate right">↻</button>
        <button data-o="dup">Duplicate</button>
        <button class="rm" data-o="rm" title="Delete or Backspace">Remove</button></div>`
    }
    if (this.cal && this.cal.b) {
      ui += `<div class="ask"><b>How far is that, really?</b>
        <input type="number" id="cald" placeholder="${this.units === 'm' ? 'metres' : 'feet'}" step="0.5">
        <button data-c="ok">Set the scale</button>
        <button class="g" data-c="no">Cancel</button></div>`
    }
    if (this.pop) ui += this.menu(s, CL, this.pop)
    this.ui.innerHTML = ui
    const cd = this.ui.querySelector<HTMLInputElement>('#cald')
    if (cd) {
      cd.focus()
      const apply = (): void => {
        const real = parseFloat(cd.value)
        if (!(real > 0)) return
        const cal = this.cal
        if (!cal || !cal.b) return
        const a = cal.a,
          b = cal.b
        const shown = Math.hypot(b.x - a.x, b.z - a.z)
        if (shown < 0.05) {
          this.cal = null
          this.draw()
          return
        }
        const realM = this.units === 'm' ? real : real * 0.3048
        const st = this.S()
        if (st) st.onCalibrate({ factor: realM / shown, anchorX: a.x, anchorZ: a.z })
        this.cal = null
        this.setTool('select')
        this.draw()
      }
      const ok = this.ui.querySelector<HTMLButtonElement>('[data-c=ok]')
      if (ok) ok.onclick = apply
      cd.onkeydown = (e) => {
        if (e.key === 'Enter') apply()
      }
      const no = this.ui.querySelector<HTMLButtonElement>('[data-c=no]')
      if (no)
        no.onclick = () => {
          this.cal = null
          this.draw()
        }
    }
    this.ui.querySelectorAll<HTMLElement>('[data-m]').forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.getAttribute('data-m'),
            st = this.S(),
            pop = this.pop
          if (st) {
            if (k === 'rm') st.onDelete()
            else if (k === 'dup') st.onDuplicate()
            else if (k === 'rl') st.onRotate(-15)
            else if (k === 'rr') st.onRotate(15)
            else if (k === 'rmroom') {
              if (pop) st.onRemoveRoom(pop.id)
            } else if (k === 'up') {
              if (pop) st.onRoomLevel(pop.id, 1)
            } else if (k === 'down') {
              if (pop) st.onRoomLevel(pop.id, -1)
            } else if (k === 'own') {
              if (pop) st.onOwn(pop.id)
            }
          }
          this.pop = null
          this.draw()
        }),
    )
    const nm2 = this.ui.querySelector<HTMLInputElement>('#popname')
    if (nm2)
      nm2.onchange = () => {
        const st = this.S(),
          pop = this.pop
        if (st && pop) st.onRename(pop.id, nm2.value)
      }
    this.ui.querySelectorAll<HTMLElement>('[data-o]').forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.getAttribute('data-o'),
            st = this.S()
          if (st) {
            if (k === 'rm') st.onDelete()
            else if (k === 'dup') st.onDuplicate()
            else st.onRotate(k === 'rl' ? -15 : 15)
          }
          this.draw()
        }),
    )
  }

  // the right-click menu: everything you can do to whatever you clicked
  // where the menu can actually sit: inside the surface, flipped below near the top
  private popAt(pop: Pop, sy: number): string {
    const W = this.clientWidth || 900,
      H = this.clientHeight || 480
    const pw = 188,
      ph = pop.kind === 'room' ? 226 : pop.kind === 'auto' ? 96 : 208
    const x = Math.max(pw / 2 + 6, Math.min(W - pw / 2 - 6, pop.sx))
    const below = sy < ph + 8
    const y = below ? Math.min(H - ph - 6, sy + 10) : Math.min(H - 6, sy)
    return `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${pw}px;transform:translate(-50%,${below ? '0' : '-100%'})`
  }
  private menu(s: Scene, CL: ClassMap, p: Pop): string {
    const c = C(),
      at = this.popAt(p, p.sy)
    if (p.kind === 'auto')
      return `<div class="pop" style="${at}">
        <div class="hd"><i style="background:${c.accent2}"></i>From the builder</div>
        <button data-m="own"><em>✎</em>Make it editable here</button></div>`
    if (p.kind === 'room') {
      const nm = (s.roomNames || {})[p.id] || p.id
      return `<div class="pop" style="${at}">
        <div class="hd"><i style="background:${c.accent}"></i>Space</div>
        <input id="popname" value="${esc(nm)}" placeholder="Space name">
        <button data-m="up"><em>▲</em>Move up a floor</button>
        <button data-m="down"><em>▼</em>Move down a floor</button>
        <button class="rm" data-m="rmroom"><em>⌫</em>Delete this space</button></div>`
    }
    const it = (s.items || []).find((x) => x.id === p.id)
    const cls: { hex: string } = (it && CL[it.kind]) || { hex: c.accent }
    return `<div class="pop" style="${at}">
      <div class="hd"><i style="background:${cls.hex}"></i>${esc(it ? it.l : 'Object')}</div>
      <button data-m="rl"><em>↺</em>Rotate left</button>
      <button data-m="rr"><em>↻</em>Rotate right</button>
      <button data-m="dup"><em>⧉</em>Duplicate</button>
      <button class="rm" data-m="rm"><em>⌫</em>Delete</button></div>`
  }

  // ---- the establish flow: nothing is drawn until the site is real ----
  private setup(s: Scene): void {
    const step: 'start' | 'read' | 'map' | 'frame' = this._step || 'start'
    const c = C()
    this.svg.innerHTML = `<rect width="100%" height="100%" fill="${c.n200}"/>
      <g stroke="${c.n400}" stroke-width=".7" stroke-opacity=".5">${Array.from(
        { length: 40 },
        (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="2000"/>
          <line x1="0" y1="${i * 40}" x2="2000" y2="${i * 40}"/>`,
      ).join('')}</g>`
    const hotel = s.hotelName || 'this hotel'
    const meta = s.hotelMeta || {}
    const stepIds: string[] = ['start', 'read', 'frame', 'draw']
    const rail = ['Source', 'Read', 'Frame', 'Draw']
      .map((l, i) => `<span ${stepIds[i] === step ? 'data-on' : ''}>${l}</span>`)
      .join('')
    let body = ''
    if (step === 'start') {
      const hits = s.planHits || []
      const hasPdf = hits.length
      const h0 = hits[0]
      const g2 = s.hotelGeo
      body = `<div class="top"><div><h3>${esc(hotel)} has no plan yet</h3>
        <p>Pick where the geometry comes from — add the others afterwards.</p></div></div>
        <div class="routes">
          <button class="route" data-r="pdf" ${hasPdf ? '' : 'data-none'}>
            <em>⌗</em><span><b>Read a floor plan</b><i>${
              h0
                ? esc(h0.title) + ' — Praxis has this on file'
                : 'Nothing on file. Upload the hotel’s event-space PDF or an image'
            }</i></span></button>
          <button class="route" data-r="map">
            <em>◉</em><span><b>Pull the real map</b><i>${
              g2
                ? 'OpenStreetMap around ' + esc(meta.addr || hotel) + ' — traced to scale'
                : 'No coordinates for this hotel yet'
            }</i></span></button>
          <button class="route" data-r="blank">
            <em>▦</em><span><b>Start from measurements</b><i>Type the site and spaces yourself</i></span></button>
        </div>`
    } else if (step === 'map') {
      body = `<div class="top"><div><h3>Pulling the map</h3>
        <p>OpenStreetMap tiles around ${esc(meta.addr || hotel)}, scaled to metres.</p></div>
        <div class="load"><span class="spin"></span>${esc(this._msg || 'Fetching tiles…')}</div></div>`
    } else if (step === 'read') {
      const hits = s.planHits || []
      const h0 = hits[0]
      body = `<div class="top"><div><h3>${hits.length ? 'Read the plan' : 'No plan on file'}</h3>
        <p>${
          h0
            ? 'Read ' + esc(h0.title) + ' — these named spaces become the plan.'
            : 'Upload the hotel’s event-space PDF or a plan image and Praxis will trace it.'
        }</p></div></div>
        <div class="found">${
          ((h0 && h0.rooms) || [])
            .map((r) => `<div><span style="color:${c.accent}">▭</span>${esc(r)}<b>from PDF</b></div>`)
            .join('') || '<div>Nothing extracted yet</div>'
        }</div>`
    } else if (step === 'frame') {
      const d = this._frame || FRAME_DEFAULT()
      body = `<div class="top"><div><h3>The site</h3>
        <p>How much ground it holds, and how vehicles reach it. All editable later.</p></div></div>
        <div class="grid2">
          <label>Site width<input type="number" data-f="w" value="${d.w}" min="12" max="400"></label>
          <label>Site depth<input type="number" data-f="d" value="${d.d}" min="12" max="400"></label>
          <label>Road width<input type="number" data-f="road" value="${d.road}" min="4" max="40"></label>
          <label>Front drive depth<input type="number" data-f="drive" value="${d.drive}" min="3" max="40"></label>
          <label>Coach bays<input type="number" data-f="bays" value="${d.bays}" min="0" max="8"></label>
        </div>`
    }
    const back = step === 'start' ? '' : `<button class="ghost" data-a="back">Back</button>`
    const next =
      step === 'frame' ? 'Draw the plan' : step === 'read' ? 'Set the site' : step === 'map' ? '' : ''
    this.ui.innerHTML = `<div class="set"><div class="card">
      <div class="scr"><div class="rail">${rail}</div>${body}</div>
      <footer>${back}${next ? `<button class="go" data-a="next">${next}</button>` : ''}
        ${
          step === 'start'
            ? ''
            : `<label style="text-transform:none;letter-spacing:0">
          <span style="font-size:11.5px;font-weight:600;color:${c.n600}">Metres are stored; feet are shown</span></label>`
        }
      </footer></div></div>`
    this.ui
      .querySelectorAll<HTMLElement>('[data-r]')
      .forEach((b) => (b.onclick = () => void this.route(b.getAttribute('data-r'), s)))
    this.ui.querySelectorAll<HTMLInputElement>('[data-f]').forEach(
      (i) =>
        (i.oninput = () => {
          const f = this._frame || FRAME_DEFAULT()
          this._frame = f
          const k = i.getAttribute('data-f')
          if (isFrameKey(k)) f[k] = +i.value || 0
        }),
    )
    const nb = this.ui.querySelector<HTMLElement>('[data-a=next]')
    if (nb)
      nb.onclick = () => {
        if (step === 'read') {
          this._step = 'frame'
          this.draw()
        } else if (step === 'frame') this.finish(s)
      }
    const bb = this.ui.querySelector<HTMLElement>('[data-a=back]')
    if (bb)
      bb.onclick = () => {
        this._step = 'start'
        this.draw()
      }
  }
  private async route(r: string | null, s: Scene): Promise<void> {
    if (r === 'pdf') {
      if (!(s.planHits || []).length) {
        s.onNeedPlan()
        return
      }
      this._step = 'read'
      this.draw()
      return
    }
    if (r === 'blank') {
      this._step = 'frame'
      this.draw()
      return
    }
    if (r === 'map') {
      const g2 = s.hotelGeo
      if (!g2) {
        this._step = 'frame'
        this.draw()
        return
      }
      this._step = 'map'
      this._msg = 'Fetching tiles…'
      this.draw()
      const m = await this.pullMap(g2.lat, g2.lon)
      if (!m) {
        this._msg = 'Tiles unavailable — enter the site by hand'
        this.draw()
        setTimeout(() => {
          this._step = 'frame'
          this.draw()
        }, 1200)
        return
      }
      this.map = m
      this._step = 'frame'
      this.draw()
    }
  }
  private finish(s: Scene): void {
    const f = this._frame || FRAME_DEFAULT()
    s.onEstablish({
      siteW: f.w,
      siteD: f.d,
      road: f.road,
      drive: f.drive,
      bays: f.bays,
      rooms: (s.planHits && s.planHits[0] && s.planHits[0].rooms) || null,
      map: this.map ? { mpp: this.map.mpp } : null,
    })
    this._step = null
    this.cam = null
    this.draw()
  }
}
