// Praxis 3D — the hotel as an architectural scale model.
// Pulls the live plan from window.__praxisScene() every frame; owns nothing but the view.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const tok = (n, f) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return v || f;
};
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
  glass: '#8fa3ad'
});

const M = (col, rough, metal) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(col), roughness: rough == null ? 0.86 : rough,
  metalness: metal == null ? 0 : metal
});

// ---- a soft radial shadow, for contact where the shadow map is too coarse ----
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  r.addColorStop(0, 'rgba(28,24,18,.42)');
  r.addColorStop(0.55, 'rgba(28,24,18,.16)');
  r.addColorStop(1, 'rgba(28,24,18,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Praxis3D extends HTMLElement {
  connectedCallback() {
    // React's host detaches and re-attaches this element during early re-renders:
    // on re-connect restart the frame loop instead of bailing, or the view freezes
    if (this._up) {
      cancelAnimationFrame(this.raf);
      this._sig = null;
      this.size();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    this._up = true;
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;position:relative;width:100%;height:100%;min-height:0;
          border-radius:var(--radius-lg,16px);overflow:hidden;background:#cfd6d9;
          font-family:var(--font-body,system-ui)}
        canvas{display:block;position:absolute;inset:0;width:100%;height:100%}
        .lay{position:absolute;inset:0;pointer-events:none}
        .lab{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;
          padding:5px 9px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:-.01em;
          background:rgba(255,253,248,.94);color:var(--color-text,#201e1d);
          box-shadow:0 4px 14px rgba(28,24,18,.22);will-change:transform}
        .lab i{font-style:normal;display:block;font-size:10px;font-weight:600;opacity:.62;
          letter-spacing:.02em}
        .lab.in{transform-origin:0 0;background:rgba(255,253,248,.86);box-shadow:none;
          padding:4px 7px;border-radius:6px}
        .lab.acc{background:rgba(198,113,57,.95);color:#fff}
        .lab.sg{background:rgba(122,138,94,.95);color:#fff}
        .pan{position:absolute;box-sizing:border-box;pointer-events:auto;background:rgba(28,25,21,.86);
          backdrop-filter:blur(9px);color:#f6efe2;border-radius:14px;padding:13px 15px;
          box-shadow:0 10px 34px rgba(20,17,12,.34)}
        .pan h4{margin:0 0 9px;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
          opacity:.6;font-weight:700}
        .st{left:14px;top:14px;min-width:168px;max-height:calc(100% - 28px);overflow:auto}
        .st .r{display:flex;align-items:center;gap:9px;padding:4px 0}
        .st .r b{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;
          margin-left:auto;letter-spacing:-.02em}
        .st .r span{font-size:11px;opacity:.8}
        .st .d{width:9px;height:9px;border-radius:3px;flex:none}
        .zi{right:14px;top:14px;width:214px}
        .zi .t{font-size:15px;font-weight:700;letter-spacing:-.02em;margin-bottom:2px}
        .zi .s{font-size:10.5px;opacity:.65;margin-bottom:11px}
        .zi .r{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-size:11.5px}
        .zi .r b{font-variant-numeric:tabular-nums;font-weight:700}
        .zi hr{border:0;border-top:1px solid rgba(246,239,226,.16);margin:9px 0}
        .zi button{margin-top:11px;width:100%;height:40px;border:0;border-radius:999px;
          background:var(--color-accent,#c67139);color:#fff;font:inherit;font-size:12px;
          font-weight:700;cursor:pointer}
        .zi button:hover{background:var(--color-accent-600,#a95d2c)}
        .vw{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;
          pointer-events:auto;align-items:flex-end;max-height:calc(100% - 28px);flex-wrap:wrap}
        .vw button{height:40px;padding:0 15px;border:0;border-radius:999px;cursor:pointer;
          font:inherit;font-size:12px;font-weight:700;background:rgba(28,25,21,.86);color:#f6efe2;
          box-shadow:0 6px 18px rgba(20,17,12,.28);backdrop-filter:blur(9px);white-space:nowrap}
        .vw button[aria-pressed=true]{background:var(--color-accent,#c67139);color:#fff}
        .lg{position:absolute;left:14px;bottom:14px;display:flex;gap:5px;flex-wrap:wrap;
          max-width:52%;pointer-events:auto}
        .lg button{height:40px;padding:0 12px 0 10px;display:inline-flex;align-items:center;gap:7px;
          border:0;border-radius:999px;cursor:pointer;font:inherit;font-size:11.5px;font-weight:700;
          background:rgba(28,25,21,.78);color:#f6efe2;backdrop-filter:blur(9px);white-space:nowrap}
        .lg button[aria-pressed=false]{background:rgba(28,25,21,.42);color:rgba(246,239,226,.5)}
        .lg i{width:11px;height:11px;border-radius:4px;flex:none;font-style:normal}
        .hint{position:absolute;left:50%;top:12px;transform:translateX(-50%);font-size:11px;
          white-space:nowrap;max-width:calc(100% - 28px);overflow:hidden;text-overflow:ellipsis;
          font-weight:600;color:#f6efe2;background:rgba(28,25,21,.6);padding:5px 11px;
          border-radius:999px;backdrop-filter:blur(6px)}
      </style>
      <canvas></canvas><div class="lay" id="labs"></div>
      <div class="pan st" id="st"><h4>Live status</h4></div>
      <div class="pan zi" id="zi" hidden></div>
      <div class="vw" id="vw"></div>
      <div class="hint" id="hint" hidden></div>`;

    this.cv = this.shadowRoot.querySelector('canvas');
    this.labs = this.shadowRoot.getElementById('labs');
    this.view = 'site';
    this.layers = {delegates: true, volunteers: true, vehicles: true, queues: true, zones: true, labels: true};
    this.pick = null;
    this._labPool = [];

    this.renderer = new THREE.WebGLRenderer({canvas: this.cv, antialias: true,
      preserveDrawingBuffer: true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dfe4e2');
    this.scene.fog = new THREE.Fog('#dfe4e2', 210, 520);

    this.cam = new THREE.PerspectiveCamera(38, 1, 0.4, 900);
    this.controls = new OrbitControls(this.cam, this.cv);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.maxPolarAngle = Math.PI * 0.492;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 340;

    this.hemi = new THREE.HemisphereLight(0xfff4e2, 0xa89c88, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 4.5;
    this.sun.shadow.blurSamples = 16;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight(0xdfe8f0, 0.34);
    this.fill.position.set(-70, 46, -52);
    this.scene.add(this.fill);

    this.statics = new THREE.Group();
    this.dyn = new THREE.Group();
    this.scene.add(this.statics, this.dyn);
    this.blob = blobTexture();
    this.ray = new THREE.Raycaster();

    this.gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.cv.addEventListener('pointerdown', e => {
      this._dn = [e.clientX, e.clientY];
      if (this._mode !== 'plan') return;
      const s = window.__praxisScene && window.__praxisScene();
      const g = this.ground(e); if (!g) return;
      if (s && s.tool) return;                       // a placement, handled on pointerup
      const it = this.itemAt(g, s);
      if (it) {
        if (s && s.onItemPick) s.onItemPick(it.id);
        this.drag = {item: it.id, g0: g, i0: it, room: it.room};
        this.controls.enabled = false;
        this.cv.setPointerCapture(e.pointerId);
        return;
      }
      const r = this.roomAt(g);
      if (!r) return;
      const corner = Math.abs(g.x - (r.x + r.w)) < Math.max(1.2, r.w * 0.09) &&
                     Math.abs(g.z - (r.y + r.d)) < Math.max(1.2, r.d * 0.09);
      this.drag = {id: r.id, corner, g0: g, r0: {x: r.x, y: r.y, w: r.w, d: r.d}};
      this.controls.enabled = false;
      this.pick = r.id;
      if (s && s.onPick) s.onPick(r.id);
      this.cv.setPointerCapture(e.pointerId);
    });
    this.cv.addEventListener('pointermove', e => {
      if (!this.drag && this._mode === 'plan') {
        const s2 = window.__praxisScene && window.__praxisScene();
        const g2 = this.ground(e);
        this.cv.style.cursor = (s2 && s2.tool) ? 'copy'
          : (g2 && this.itemAt(g2, s2)) ? 'grab' : 'default';
      }
      if (!this.drag) return;
      const g = this.ground(e); if (!g) return;
      const dx = g.x - this.drag.g0.x, dz = g.z - this.drag.g0.z, r0 = this.drag.r0;
      const s = window.__praxisScene && window.__praxisScene();
      if (this.drag.item) {
        const i0 = this.drag.i0, rm = i0.room ? this.geo.rooms[i0.room] : null;
        const p2 = rm
          ? {x: Math.max(0, Math.min(100, i0.x + (dx / rm.w) * 100)),
             y: Math.max(0, Math.min(100, i0.y + (dz / rm.d) * 100))}
          : {x: i0.x + dx, y: i0.y + dz};
        if (s && s.onItem) s.onItem(this.drag.item, p2);
        return;
      }
      const p = this.drag.corner
        ? {w: Math.max(2, Math.round((r0.w + dx) * 2) / 2), d: Math.max(2, Math.round((r0.d + dz) * 2) / 2)}
        : {x: Math.round((r0.x + dx) * 2) / 2, y: Math.round((r0.y + dz) * 2) / 2};
      if (s && s.onRoom) s.onRoom(this.drag.id, p);
    });
    const endDrag = () => { this.drag = null; this.controls.enabled = true;
      this.cv.style.cursor = 'default'; };
    this.cv.addEventListener('pointerup', endDrag);
    this.cv.addEventListener('pointercancel', endDrag);
    this.cv.addEventListener('pointerup', e => {
      if (!this._dn || Math.hypot(e.clientX - this._dn[0], e.clientY - this._dn[1]) > 5) return;
      this.hit(e);
    });
    this.ro = new ResizeObserver(() => this.size());
    this.ro.observe(this);
    this.size();
    this.chrome();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect();
    this.renderer && this.renderer.dispose();
  }
  size() {
    const w = this.clientWidth || 900, h = this.clientHeight || 480;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }

  // ---------- chrome ----------
  chrome() {
    const vw = this.shadowRoot.getElementById('vw');
    [['site', 'Site level'], ['interior', 'Interior'], ['kerb', 'Kerb & loading']].forEach(([id, l]) => {
      const b = document.createElement('button');
      b.textContent = l; b.setAttribute('aria-pressed', String(this.view === id));
      b.onclick = () => { this.view = id; this.frame(true); this.chromeState(); };
      vw.appendChild(b); b.dataset.v = id;
    });
  }
  chromeState() {
    this.shadowRoot.querySelectorAll('.vw button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.v === this.view)));
  }

  // ---------- static model ----------
  build(geo, rooms) {
    const g = this.statics, c = C();
    while (g.children.length) { const o = g.children.pop(); o.geometry && o.geometry.dispose(); }
    this.roomMeshes = [];
    const W = geo.buildW, D = geo.buildD;
    const add = (mesh, cast, recv) => {
      mesh.castShadow = !!cast; mesh.receiveShadow = recv !== false; g.add(mesh); return mesh;
    };
    const box = (w, h, d, mat, x, y, z, name) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h / 2, z); m.name = name || '';
      return m;
    };
    // a wall's geometry sits on its own base, so scale.y raises it out of the plan
    this.walls = [];
    const wallBox = (w, h, d, mat, x, y, z) => {
      const g2 = new THREE.BoxGeometry(w, h, d); g2.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g2, mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      this.walls.push(m); this.statics.add(m); return m;
    };
    this._wallBox = wallBox;
    const mat = {
      ground: M(c.ground, 0.95), paving: M(c.paving, 0.9), slab: M(c.slab, 0.88),
      wall: M(c.wall, 0.82), wallTop: M(c.wallTop, 0.8), carpet: M(c.carpet, 0.96),
      asphalt: M(c.asphalt, 0.94), line: M(c.line, 0.7), tower: M(c.tower, 0.7),
      glass: new THREE.MeshStandardMaterial({color: new THREE.Color(c.glass), roughness: 0.18,
        metalness: 0.45}),
      trunk: M('#6b5a45', 0.9), leaf: M('#7d8f63', 0.95), steel: M('#8d8b86', 0.5, 0.5)
    };
    this.mat = mat;

    // ground, road, front drive
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), mat.ground);
    gp.rotation.x = -Math.PI / 2; gp.position.set(W / 2, -0.02, D / 2); gp.receiveShadow = true;
    g.add(gp);
    add(box(W + 260, 0.1, geo.streetDepth, mat.asphalt, W / 2, 0, geo.streetY + geo.streetDepth / 2));
    for (let x = -110; x < W + 130; x += 6)
      add(box(3, 0.02, 0.22, mat.line, x, 0.1, geo.streetY + geo.streetDepth / 2), false, false);
    add(box(W + 40, 0.16, geo.kerbDepth, mat.paving, W / 2, 0, geo.kerbY + geo.kerbDepth / 2));
    add(box(W + 40, 0.06, 0.34, mat.wallTop, W / 2, 0.16, geo.kerbY + geo.kerbDepth - 0.17));
    (geo.bays || []).forEach((bx, i) => {
      add(box(0.16, 0.02, geo.kerbDepth * 0.66, mat.line, bx - 6.9, 0.16,
              geo.kerbY + geo.kerbDepth * 0.6), false, false);
      add(box(0.16, 0.02, geo.kerbDepth * 0.66, mat.line, bx + 6.9, 0.16,
              geo.kerbY + geo.kerbDepth * 0.6), false, false);
      this.bayLabel = this.bayLabel || [];
      this.bayLabel[i] = new THREE.Vector3(bx, 0.4, geo.kerbY + geo.kerbDepth * 0.32);
    });

    // building slab + tower behind it
    add(box(W + 1.6, 0.2, D + 1.2, mat.slab, W / 2, 0, D / 2 - 0.3));
    if (this._under && /^data:image\//.test(this._under)) {
      const u = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
        new THREE.MeshBasicMaterial({transparent: true, opacity: 0.55}));
      u.rotation.x = -Math.PI / 2; u.position.set(W / 2, 0.205, D / 2);
      u.visible = false; u.name = 'underlay'; g.add(u);
      new THREE.TextureLoader().load(this._under,
        tx => { tx.colorSpace = THREE.SRGBColorSpace; u.material.map = tx;
                u.material.needsUpdate = true; u.visible = true; },
        undefined,
        () => { if (u.parent) u.parent.remove(u); this._under = null; });
    }
    const tH = 44;
    this.tower = new THREE.Group(); this.statics.add(this.tower);
    const tw = (m, cast) => { m.castShadow = !!cast; m.receiveShadow = true; this.tower.add(m); };
    const tg = new THREE.BoxGeometry(W * 0.74, tH, 26); tg.translate(0, tH / 2, 0);
    const tm = new THREE.Mesh(tg, mat.tower); tm.position.set(W * 0.5, 0.2, -14.5);
    tm.name = 'towerMass'; tw(tm, true);
    for (let f = 0; f < 13; f++)
      tw(box(W * 0.745, 1.5, 26.2, mat.glass, W * 0.5, 1.8 + f * 3.2, -14.5));
    const cg = new THREE.BoxGeometry(W * 0.44, 8, 26.4); cg.translate(0, 4, 0);
    const cm = new THREE.Mesh(cg, mat.tower); cm.position.set(W * 0.5, tH + 0.2, -14.5);
    tw(cm, true);

    // rooms: walls with a door gap on the front face
    const H = 3.15, T = 0.24;
    rooms.forEach(r => {
      const x0 = r.x, z0 = r.y, w = r.w, d = r.d;
      if (w < 1 || d < 1 || r.id === 'kerb' || r.id === 'street') return;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w - T, d - T), mat.carpet);
      fl.rotation.x = -Math.PI / 2; fl.position.set(x0 + w / 2, 0.21, z0 + d / 2);
      fl.receiveShadow = true; fl.userData.room = r.id; g.add(fl);
      this.roomMeshes.push(fl);
      wallBox(w, H, T, mat.wall, x0 + w / 2, 0.2, z0 + T / 2);
      wallBox(T, H, d, mat.wall, x0 + T / 2, 0.2, z0 + d / 2);
      wallBox(T, H, d, mat.wall, x0 + w - T / 2, 0.2, z0 + d / 2);
      const gap = Math.min(2.2, w * 0.28), side = (w - gap) / 2;
      if (side > 0.1) {
        wallBox(side, H, T, mat.wall, x0 + side / 2, 0.2, z0 + d - T / 2);
        wallBox(side, H, T, mat.wall, x0 + w - side / 2, 0.2, z0 + d - T / 2);
      }
      r._c = new THREE.Vector3(x0 + w / 2, H + 0.5, z0 + d / 2);
    });

    // street trees, for scale and life
    for (let i = 0; i < 14; i++) {
      const x = -22 + i * ((W + 46) / 13);
      const z = geo.streetY - 1.4;
      add(box(0.34, 2.3, 0.34, mat.trunk, x, 0.1, z), true);
      const cr = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), mat.leaf);
      cr.position.set(x, 3.5, z); cr.castShadow = true; g.add(cr);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2),
        new THREE.MeshBasicMaterial({map: this.blob, transparent: true, depthWrite: false}));
      sh.rotation.x = -Math.PI / 2; sh.position.set(x, 0.12, z); g.add(sh);
    }
    this.sizeShadow(W, D, geo);
  }
  sizeShadow(W, D, geo) {
    const s = this.sun, r = Math.max(W, geo.streetY + 40) * 0.75;
    s.position.set(W * 0.5 + r * 0.7, r * 1.5, -r * 0.5);
    s.target.position.set(W * 0.5, 0, D * 0.6);
    const cam = s.shadow.camera;
    cam.left = -r * 1.5; cam.right = r * 1.5; cam.top = r * 1.5; cam.bottom = -r * 1.5;
    cam.near = 1; cam.far = r * 6; cam.updateProjectionMatrix();
  }

  // ---------- dynamic ----------
  pools(geo) {
    const d = this.dyn;
    if (this.people) return;
    const MAXP = 1600;
    const body = new THREE.CapsuleGeometry(0.2, 0.62, 6, 12);
    const head = new THREE.SphereGeometry(0.145, 12, 9);
    const pm = new THREE.MeshStandardMaterial({roughness: 0.72});
    this.people = new THREE.InstancedMesh(body, pm, MAXP);
    this.heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({roughness: 0.66}), MAXP);
    [this.people, this.heads].forEach(m => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; m.castShadow = true; m.count = 0; d.add(m);
    });
    this.vehPool = [];
    this.lanePool = [];
    this.furn = new THREE.Group(); d.add(this.furn);
    this.foot = new THREE.Group(); this.scene.add(this.foot);
  }
  vehicle(i) {
    if (this.vehPool[i]) return this.vehPool[i];
    const g = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({roughness: 0.42, metalness: 0.22});
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bm);
    body.castShadow = true; body.name = 'body';
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mat.glass);
    glass.name = 'glass';
    const wheel = new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14);
    const wm = M('#2b2825', 0.85);
    const ws = [];
    for (let k = 0; k < 4; k++) {
      const w = new THREE.Mesh(wheel, wm); w.rotation.z = Math.PI / 2; ws.push(w); g.add(w);
    }
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({map: this.blob, transparent: true, depthWrite: false}));
    sh.rotation.x = -Math.PI / 2; sh.name = 'sh';
    g.add(body, glass, sh);
    g.userData = {body, glass, ws, sh, bm};
    this.dyn.add(g); this.vehPool[i] = g;
    return g;
  }
  lane(i) {
    if (this.lanePool[i]) return this.lanePool[i];
    const g = new THREE.Group();
    const post = new THREE.CylinderGeometry(0.045, 0.055, 0.98, 8);
    const pm = this.mat.steel;
    const posts = [];
    for (let k = 0; k < 12; k++) {
      const p = new THREE.Mesh(post, pm); p.position.y = 0.7; p.castShadow = true;
      posts.push(p); g.add(p);
    }
    const rope = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 0.035), M('#8d8375', 0.9));
    rope.position.y = 0.95; g.add(rope);
    g.userData = {posts, rope};
    this.dyn.add(g); this.lanePool[i] = g;
    return g;
  }

  // ---------- furniture, at real size, from the plan's own inventory ----------
  chair(x, z, rot, mats) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 0.44), mats.seat);
    seat.position.y = 0.45; seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.06), mats.seat);
    back.position.set(0, 0.71, -0.19); back.castShadow = true;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), mats.metal);
    ped.position.y = 0.22;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), mats.metal);
    foot.position.y = 0.02;
    g.add(seat, back, ped, foot);
    g.position.set(x, 0.21, z); g.rotation.y = rot || 0;
    return g;
  }
  // the plan symbol for an object: its real footprint, drawn flat and legible
  footprint(it, fx, fz, rot, sel) {
    const c = C();
    const FP = {
      desk: [2.4, 0.72, 'furn'], kiosk: [0.9, 0.9, 'furn'], trestle: [1.95, 0.86, 'furn'],
      round: [1.52, 1.52, 'furn'], chairs: [1.3, 1.4, 'furn'], stanchion: [4.5, 0.4, 'furn'],
      banner: [2.4, 0.4, 'sign'], aframe: [0.9, 0.6, 'sign'], lollipop: [0.9, 0.9, 'sign'],
      arrowsign: [1.0, 0.4, 'sign'], bay: [0.8, 0.4, 'sign'],
      coach: [13.7, 2.55, 'veh'], shuttle: [8.2, 2.4, 'veh'], van: [5.4, 2.1, 'veh'],
      car: [4.6, 1.9, 'veh'], greeter: [0.8, 0.8, 'ppl'], pickup: [0.8, 0.8, 'ppl']
    };
    const f = FP[it.t] || [1.0, 1.0, it.kind === 'sign' ? 'sign' : 'furn'];
    const hue = {furn: '#b08b4f', sign: c.accent, veh: '#5b6470', ppl: c.accent2}[f[2]];
    const round = it.t === 'round' || it.t === 'lollipop' || f[2] === 'ppl';
    const g = new THREE.Group();
    g.position.set(fx, 0, fz); g.rotation.y = rot || 0;
    const shape = (w, d, col, y, op) => {
      const geo2 = round ? new THREE.CircleGeometry(w / 2, 28)
                         : new THREE.PlaneGeometry(w, d);
      const m = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({
        color: new THREE.Color(col), transparent: true, opacity: op,
        depthWrite: false, side: THREE.DoubleSide}));
      m.rotation.x = -Math.PI / 2; m.position.y = y;
      return m;
    };
    g.add(shape(f[0] + 0.16, f[1] + 0.16, sel ? c.accent : '#2b2723', 0.30, sel ? 0.95 : 0.42));
    g.add(shape(f[0], f[1], hue, 0.31, it.auto ? 0.62 : 0.95));
    if (f[2] === 'ppl' || it.t === 'lollipop')                     // a mark that reads at any zoom
      g.add(shape(f[0] * 0.42, f[1] * 0.42, '#fffdf8', 0.32, 0.9));
    return g;
  }
  furniture(items, geo, S) {
    const sig = JSON.stringify(items || []) + '|' + this._sig + '|' + (S.itemPick || '');
    if (sig === this._fsig) return;
    this._fsig = sig;
    while (this.furn.children.length) this.furn.remove(this.furn.children[0]);
    while (this.foot.children.length) this.foot.remove(this.foot.children[0]);
    const c = C();
    const mats = {
      wood: M('#a8825a', 0.72), top: M('#c9a978', 0.62), cloth: M(c.accent2, 0.92),
      seat: M('#6f6558', 0.78), metal: M('#8d8b86', 0.42, 0.55),
      panel: M(c.accent, 0.66), white: M('#f6f1e6', 0.72), screen: M('#2c3138', 0.3, 0.2)
    };
    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h / 2, z); m.castShadow = true; return m;
    };
    const per = {};
    this._elsewhere = 0;
    (items || []).forEach(it => {
      // an item inside a space keeps its percentage of that space; one dropped on open
      // ground carries metres, so the kerb and the road can hold objects too
      const open = !it.room && it.x != null;
      const lvOf = (S.roomLevels || {})[it.room] || 0;
      if (!open && lvOf !== (S.level || 0)) { this._elsewhere++; return; }   // another floor
      // a space renamed or removed under an object must not lose it — fall back to the first
      const r = open ? null
        : (geo.rooms[it.room] || geo.rooms.lobby || geo.rooms[Object.keys(geo.rooms)[0]]);
      if (!open && !r) return;
      const rid = open ? '_open' : (it.room || 'lobby');
      per[rid] = (per[rid] || 0) + 1;
      const k = per[rid] - 1;
      const fx = open ? it.x
        : it.x != null ? r.x + (it.x / 100) * r.w : r.x + 1.4 + (k % 8) * ((r.w - 2.8) / 8);
      const fz = open ? it.y
        : it.y != null ? r.y + (it.y / 100) * r.d
                       : r.y + (r.headM || 1.6) + 0.9 + Math.floor(k / 8) * 1.9;
      const rot = ((it.rot || 0) * Math.PI) / 180;
      const g = new THREE.Group(); g.position.set(fx, 0, fz); g.rotation.y = rot;
      const T2 = it.t || 'desk';
      if (T2 === 'desk' || T2 === 'kiosk') {
        const w = T2 === 'desk' ? 2.4 : 0.7;
        g.add(box(w, 0.98, 0.72, mats.wood, 0, 0.21, 0));
        g.add(box(w + 0.12, 0.06, 0.84, mats.top, 0, 1.19, 0));
        if (T2 === 'kiosk') g.add(box(0.56, 0.4, 0.05, mats.screen, 0, 1.25, 0.3));
        else { g.add(this.chair(-0.5, -0.72, Math.PI, mats)); g.add(this.chair(0.6, -0.72, Math.PI, mats)); }
      } else if (T2 === 'trestle') {
        g.add(box(1.83, 0.74, 0.76, mats.cloth, 0, 0.21, 0));
        g.add(box(1.95, 0.05, 0.86, mats.top, 0, 0.95, 0));
        for (let i = 0; i < 4; i++) g.add(this.chair(-0.6 + (i % 2) * 1.2, (i < 2 ? 0.78 : -0.78),
          i < 2 ? 0 : Math.PI, mats));
      } else if (T2 === 'round') {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.06, 28), mats.top);
        top.position.y = 0.95; top.castShadow = true;
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.74, 28), mats.cloth);
        skirt.position.y = 0.58; skirt.castShadow = true;
        g.add(top, skirt);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          g.add(this.chair(Math.cos(a) * 1.16, Math.sin(a) * 1.16, -a + Math.PI / 2, mats));
        }
      } else if (T2 === 'chairs') {
        for (let i = 0; i < 4; i++) g.add(this.chair((i % 2) * 0.6, Math.floor(i / 2) * 0.72, 0, mats));
      } else if (T2 === 'stanchion') {
        for (let i = 0; i < 4; i++) {
          g.add(box(0.09, 0.98, 0.09, mats.metal, i * 1.5, 0.21, 0));
          if (i) g.add(box(1.5, 0.035, 0.035, mats.seat, i * 1.5 - 0.75, 1.14, 0));
        }
      } else if (T2 === 'banner') {
        g.add(box(0.09, 2.5, 0.09, mats.metal, -1.2, 0.21, 0));
        g.add(box(0.09, 2.5, 0.09, mats.metal, 1.2, 0.21, 0));
        g.add(box(2.4, 1.5, 0.05, mats.panel, 0, 1.2, 0));
      } else if (T2 === 'aframe') {
        const a = box(0.72, 0.94, 0.05, mats.white, 0, 0.21, -0.16); a.rotation.x = 0.22;
        const b = box(0.72, 0.94, 0.05, mats.white, 0, 0.21, 0.16); b.rotation.x = -0.22;
        g.add(a, b);
      } else if (T2 === 'lollipop' || T2 === 'arrowsign' || T2 === 'bay') {
        g.add(box(0.06, 2.1, 0.06, mats.metal, 0, 0.21, 0));
        if (T2 === 'lollipop') {
          const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 22), mats.panel);
          d.rotation.x = Math.PI / 2; d.position.set(0, 2.2, 0); d.castShadow = true; g.add(d);
        } else g.add(box(T2 === 'bay' ? 0.5 : 0.68, 0.34, 0.05, mats.panel, 0, 1.92, 0));
      } else if (it.kind === 'people') {
        const hex = (S.roleHex || {})[it.t] || c.accent2;
        const pm = M(hex, 0.72);
        const b2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.62, 6, 12), pm);
        b2.position.y = 0.72; b2.castShadow = true;
        const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 9), pm);
        h2.position.y = 1.42; h2.castShadow = true;
        g.add(b2, h2);
      } else if (it.kind === 'veh') {
        const dims = {coach: [13.7, 3.3, 2.55], shuttle: [8.2, 2.9, 2.4],
                      van: [5.4, 2.1, 2.0], car: [4.6, 1.5, 1.85]}[it.t] || [4.6, 1.5, 1.85];
        const vm = new THREE.MeshStandardMaterial({color: new THREE.Color(it.hex || '#5b6470'),
          roughness: 0.42, metalness: 0.22});
        g.add(box(dims[0], dims[1] * 0.74, dims[2], vm, 0, 0.42, 0));
        g.add(box(dims[0] * 0.96, dims[1] * 0.3, dims[2] * 1.01, mats.screen, 0,
                  0.42 + dims[1] * 0.78, 0));
        for (let k = 0; k < 4; k++) {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14), mats.seat);
          wh.rotation.z = Math.PI / 2;
          wh.position.set((k < 2 ? -1 : 1) * dims[0] * 0.34, 0.48,
                          (k % 2 ? -1 : 1) * (dims[2] / 2 - 0.16));
          g.add(wh);
        }
      } else {
        g.add(box(0.6, 0.6, 0.6, mats.wood, 0, 0.21, 0));
      }
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({map: this.blob, transparent: true, depthWrite: false}));
      sh.rotation.x = -Math.PI / 2; sh.position.y = 0.23; g.add(sh);
      if (it.auto) g.traverse(o => { if (o.material && o.material.opacity === undefined) return;
        if (o.material && !o.material.transparent) {
          o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.82;
        } });
      if (it.id && it.id === S.itemPick) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.28, 36),
          new THREE.MeshBasicMaterial({color: new THREE.Color(c.accent), transparent: true,
            opacity: 0.9, side: THREE.DoubleSide}));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.26; g.add(ring);
      }
      this.furn.add(g);
      this.foot.add(this.footprint(it, fx, fz, rot, it.id && it.id === S.itemPick));
    });
  }

  // ---------- frame ----------
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const hook = window.__praxisScene;
    const s = hook && hook();
    if (!s || !s.plan || !window.PRAXIS_SIM) { this.renderer.render(this.scene, this.cam); return; }
    if (s.layers) this.layers = s.layers;
    const mode = s.mode === 'plan' ? 'plan' : 'live';
    if (mode !== this._mode) { this._mode = mode; this.frame(true); this.chromeState(); }
    const want = mode === 'live' ? 1 : 0;
    if (this._rise == null) this._rise = want;
    if (Math.abs(this._rise - want) > 0.001) this._rise += (want - this._rise) * 0.11;
    else this._rise = want;
    const geo = s.plan.geo;
    const rooms = Object.keys(geo.rooms).map(k => ({id: k, ...geo.rooms[k]}));
    const lv = s.level || 0, rl = s.roomLevels || {};
    const onLevel = rooms.filter(r => (rl[r.id] || 0) === lv);
    const sig = JSON.stringify([s.hotelName, lv, geo.buildW, geo.buildD, geo.kerbY, geo.kerbDepth,
      geo.streetY, geo.streetDepth, geo.bays, onLevel.map(r => [r.id, r.x, r.y, r.w, r.d])]);
    if (s.underlay !== this._under) { this._under = s.underlay || null; this._sig = null; }
    if (sig !== this._sig) {
      this._sig = sig; this.geo = geo; this._lv = lv;
      this.rooms = onLevel.filter(r => r.w >= 2 && r.d >= 2);
      this.build(geo, this.rooms); this.pools(geo); this.frame(true);
    }
    const msig = JSON.stringify(s.plan.moves) + '|' + sig;
    if (msig !== this._msig) { this._msig = msig; this.sim = window.PRAXIS_SIM.build(s.plan); }
    const T = s.mins;
    const w = this.sim ? this.sim.at(T) : {people: [], vehicles: [], counts: {}};
    this.world = w;
    this.furniture((s.items || []).concat(s.derived || []), geo, s);
    this.furn.visible = this.layers.zones;
    this.paint(w, s);
    const rz = Math.max(0.012, this._rise);
    (this.walls || []).forEach(m => (m.scale.y = rz));
    if (this.tower) { this.tower.scale.y = rz; this.tower.visible = this._rise > 0.02; }
    if (this.furn) this.furn.scale.y = rz;
    // flat symbols in plan, real objects once it stands up
    if (this.foot) this.foot.visible = this._rise < 0.5 && this.layers.zones !== false;
    this.dyn.visible = this._rise > 0.35;
    this.controls.update();
    if (this._fly) this.fly();
    this.renderer.render(this.scene, this.cam);
    this.overlay(w, s);
  }

  paint(w, s) {
    const L = this.layers, m = new THREE.Matrix4(), col = new THREE.Color();
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let n = 0;
    const put = (x, z, hex, rot) => {
      if (n >= this.people.count_max) return;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot || 0);
      pos.set(x, 0.72, z); m.compose(pos, q, sc);
      this.people.setMatrixAt(n, m); col.set(hex); this.people.setColorAt(n, col);
      pos.set(x, 1.42, z); m.compose(pos, q, sc);
      this.heads.setMatrixAt(n, m); this.heads.setColorAt(n, col.multiplyScalar(1.0));
      n++;
    };
    this.people.count_max = 1600;
    if (L.delegates) w.people.forEach(p => put(p.x, p.y, p.hex, 0));
    // volunteers: greeters along the lobby front, desk at its counter, pick-ups at the kerb
    this.volPts = [];
    if (L.volunteers && s.cover) {
      const c = C(), lobby = this.geo.rooms[s.queueRoom] || this.rooms[0];
      const rc = (s.roleHex || {});
      const gh = rc.greeter || c.accent2, dh = rc.desk || '#7c6bb0', ph = rc.pickup || '#3f7f8f';
      const nG = s.cover.greeter || 0, nD = s.cover.desk || 0, nP = s.cover.pickup || 0;
      for (let i = 0; i < nG; i++) {
        const x = lobby.x + 1.4 + (i % 14) * ((lobby.w - 2.8) / 14);
        const z = lobby.y + lobby.d - 1.6 - Math.floor(i / 14) * 0.9;
        put(x, z, gh, 0); this.volPts.push({x, z, hex: gh, role: 'Greeter'});
      }
      for (let i = 0; i < nD; i++) {
        const x = lobby.x + 2.2 + i * 0.85, z = lobby.y + 2.4;
        put(x, z, dh, Math.PI); this.volPts.push({x, z, hex: dh, role: 'Desk'});
      }
      for (let i = 0; i < nP; i++) {
        const bays = this.geo.bays || [this.geo.buildW / 2];
        const bx = bays[i % bays.length];
        const x = bx - 4 + (Math.floor(i / bays.length) % 6) * 1.6;
        const z = this.geo.kerbY + this.geo.kerbDepth * 0.22;
        put(x, z, ph, 0); this.volPts.push({x, z, hex: ph, role: 'Pick-up'});
      }
    }
    this.people.count = this.heads.count = n;
    this.people.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
    if (this.people.instanceColor) this.people.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;

    // vehicles
    const vs = L.vehicles ? w.vehicles : [];
    this.vehPool.forEach(g => (g.visible = false));
    vs.slice(0, 16).forEach((v, i) => {
      const g = this.vehicle(i), u = g.userData;
      g.visible = true;
      const tall = v.l > 9 ? 3.25 : v.l > 5.4 ? 2.35 : 1.48;
      u.bm.color.set(v.hex);
      u.body.scale.set(v.l, tall * 0.74, v.w);
      u.body.position.set(0, 0.42 + tall * 0.37, 0);
      u.glass.scale.set(v.l * 0.96, tall * 0.3, v.w * 1.005);
      u.glass.position.set(0, 0.42 + tall * 0.78, 0);
      u.ws.forEach((wh, k) => wh.position.set(
        (k < 2 ? -1 : 1) * v.l * 0.34, 0.48, (k % 2 ? -1 : 1) * (v.w / 2 - 0.16)));
      u.sh.scale.set(v.l * 1.5, v.w * 2.6, 1);
      u.sh.position.set(0, 0.13, 0);
      g.position.set(v.x, 0.1, v.y);
      g.rotation.y = 0;
    });

    // stanchion lanes in whichever room the delegates are actually standing in
    const qr = {};
    w.people.forEach(p => { if (p.st === 'queuing' && p.room) qr[p.room] = true; });
    let li = 0;
    this.lanePool.forEach(g => (g.visible = false));
    if (L.queues) Object.keys(qr).forEach(id => {
      const r = this.geo.rooms[id]; if (!r) return;
      const head = r.headM || 1.6;
      const lanes = Math.max(1, Math.min(5, Math.floor((r.d - head - 1) / 1.15)));
      for (let l = 0; l < lanes; l++) {
        const g = this.lane(li++); if (!g) break;
        g.visible = true;
        const z = r.y + head + 0.7 + l * 1.15;
        g.position.set(r.x + 0.6, 0.21, z);
        const span = r.w - 1.2;
        g.userData.posts.forEach((p, k) => {
          p.visible = k * (span / 11) <= span;
          p.position.x = k * (span / 11);
        });
        g.userData.rope.scale.x = span;
        g.userData.rope.position.x = span / 2;
      }
    });
    this.statics.visible = true;
    this.roomMeshes && this.roomMeshes.forEach(fl => (fl.visible = true));
    if (this.tower) this.tower.visible = this.view !== 'interior' && this._rise > 0.02;
  }

  // ---------- camera ----------
  frame(anim) {
    const geo = this.geo; if (!geo) return;
    const W = geo.buildW, D = geo.buildD;
    let tgt, pos;
    if (this._mode === 'plan') {
      const span = Math.max(W, geo.streetY + geo.streetDepth + 6);
      tgt = new THREE.Vector3(W / 2, 0, (geo.streetY + geo.streetDepth) / 2);
      pos = new THREE.Vector3(W / 2, span * 1.42, (geo.streetY + geo.streetDepth) / 2 + 0.01);
    } else if (this.view === 'site') {
      tgt = new THREE.Vector3(W / 2, 0, D * 0.75);
      pos = new THREE.Vector3(W / 2 - W * 0.72, Math.max(66, W * 0.7), geo.streetY + W * 0.9);
    } else if (this.view === 'interior') {
      const r = (this.pick && geo.rooms[this.pick]) ||
                geo.rooms[Object.keys(geo.rooms)[0]];
      tgt = new THREE.Vector3(r.x + r.w / 2, 1.1, r.y + r.d / 2);
      const span = Math.max(r.w, r.d);
      pos = new THREE.Vector3(r.x + r.w / 2 - span * 0.42, span * 0.66,
                              r.y + r.d + span * 0.72);
    } else {
      const bx = (geo.bays && geo.bays[1]) || W / 2;
      tgt = new THREE.Vector3(bx, 1.4, geo.kerbY + geo.kerbDepth * 0.6);
      pos = new THREE.Vector3(bx - 26, 11, geo.streetY + geo.streetDepth + 24);
    }
    if (anim && this.cam.position.length() > 1) {
      this._fly = {p0: this.cam.position.clone(), t0: this.controls.target.clone(),
                   p1: pos, t1: tgt, s: performance.now()};
    } else {
      this.cam.position.copy(pos); this.controls.target.copy(tgt); this.controls.update();
    }
  }
  fly() {
    const f = this._fly, k = Math.min(1, (performance.now() - f.s) / 720);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    this.cam.position.lerpVectors(f.p0, f.p1, e);
    this.controls.target.lerpVectors(f.t0, f.t1, e);
    if (k >= 1) this._fly = null;
  }

  ground(e) {
    const r = this.cv.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1), this.cam);
    const out = new THREE.Vector3();
    return this.ray.ray.intersectPlane(this.gplane, out) ? out : null;
  }
  // where a placed object actually stands, so it can be picked up off the plan
  itemAt(g, s) {
    let best = null, bd = 1.6;
    ((s && s.items) || []).forEach(it => {   // derived objects are not draggable
      const open = !it.room && it.x != null;
      if (!open && !(this.geo.rooms[it.room] || this.geo.rooms.lobby)) return;
      const rr = open ? null : (this.geo.rooms[it.room] || this.geo.rooms.lobby);
      const x = open ? it.x : rr.x + ((it.x == null ? 50 : it.x) / 100) * rr.w;
      const z = open ? it.y : rr.y + ((it.y == null ? 50 : it.y) / 100) * rr.d;
      const d = Math.hypot(g.x - x, g.z - z);
      if (d < bd) { bd = d; best = it; }
    });
    return best;
  }
  roomAt(g) {
    return (this.rooms || []).find(r => r.id !== 'kerb' && r.id !== 'street' &&
      g.x >= r.x && g.x <= r.x + r.w && g.z >= r.y && g.z <= r.y + r.d) || null;
  }
  hit(e) {
    const s = window.__praxisScene && window.__praxisScene();
    if (this._mode === 'plan') {
      const g = this.ground(e);
      if (g && s && s.tool && s.onPlace) {
        const r = this.roomAt(g);
        s.onPlace(s.tool, r ? r.id : null,
          r ? ((g.x - r.x) / r.w) * 100 : g.x, r ? ((g.z - r.y) / r.d) * 100 : g.z);
        return;
      }
      const it2 = g && this.itemAt(g, s);
      if (it2) { if (s && s.onItemPick) s.onItemPick(it2.id); return; }
      const r2 = g && this.roomAt(g);
      this.pick = r2 ? r2.id : null;
      if (s && s.onPick) s.onPick(this.pick);
      if (s && s.onItemPick) s.onItemPick(null);
      return;
    }
    const r = this.cv.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1), this.cam);
    const is = this.ray.intersectObjects(this.roomMeshes || [], false);
    this.pick = is.length ? is[0].object.userData.room : null;
    const h = window.__praxisScene && window.__praxisScene();
    if (h && h.onPick) h.onPick(this.pick);
  }

  // ---------- HTML overlay ----------
  label(i, cls, x, y, main, sub) {
    let el = this._labPool[i];
    if (!el) { el = document.createElement('div'); this._labPool[i] = el; this.labs.appendChild(el); }
    el.className = 'lab' + (cls ? ' ' + cls : '');
    el.hidden = false;
    el.style.transform = `translate(-50%,-100%) translate(${x}px,${y}px)`;
    el.innerHTML = sub ? `${main}<i>${sub}</i>` : main;
    return el;
  }
  project(v) {
    const p = v.clone().project(this.cam);
    if (p.z > 1) return null;
    return {x: (p.x * 0.5 + 0.5) * this.clientWidth, y: (-p.y * 0.5 + 0.5) * this.clientHeight,
            z: p.z};
  }
  overlay(w, s) {
    let i = 0;
    this._s = s;
    const placed = [];
    const free = (x, y, w2, h2) => {
      const r = {l: x - w2 / 2, r: x + w2 / 2, t: y - h2, b: y};
      if (placed.some(p => r.l < p.r && r.r > p.l && r.t < p.b && r.b > p.t)) return false;
      placed.push(r); return true;
    };
    const esc = t => String(t).replace(/[<>&]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[c]));
    if (this.layers.labels) {
      const names = s.roomNames || {};
      if (this._mode === 'plan') {
        const ft = n => Math.round(n * 3.28084) + ' ft';
        (this.rooms || []).forEach(r => {
          if (r.id === 'kerb' || r.id === 'street' || r.w < 2 || r.d < 2) return;
          const p = this.project(new THREE.Vector3(r.x + 0.5, 0.3, r.y + 0.5));
          if (!p) return;
          const el = this.label(i++, 'in' + (r.id === this.pick ? ' acc' : ''), p.x, p.y,
            esc(names[r.id] || r.id), ft(r.w) + ' × ' + ft(r.d));
          el.style.transform = `translate(${p.x}px,${p.y}px)`;
        });
        for (let k = i; k < this._labPool.length; k++) this._labPool[k].hidden = true;
        this.panels(w, s, i);
        return;
      }
      const busy = {};
      w.people.forEach(x => { if (x.room) busy[x.room] = (busy[x.room] || 0) + 1; });
      (this.rooms || []).forEach(r => {
        if (!r._c || r.id === 'kerb' || r.id === 'street') return;
        if (!busy[r.id] && r.id !== this.pick && this.view === 'site') return;
        const p = this.project(r._c); if (!p) return;
        if (!free(p.x, p.y, 116, 46)) return;
        this.label(i++, r.id === this.pick ? 'acc' : '', p.x, p.y,
          esc(names[r.id] || r.id), busy[r.id] ? busy[r.id] + ' delegates' : '');
      });
      (w.vehicles || []).slice(0, 8).forEach(v => {
        const p = this.project(new THREE.Vector3(v.x, 3.6, v.y)); if (!p) return;
        if (!free(p.x, p.y, 116, 46)) return;
        this.label(i++, 'sg', p.x, p.y, esc(v.label),
          `${v.occ}/${v.cap} · ${esc(v.state)}`);
      });
    }
    for (let k = i; k < this._labPool.length; k++) this._labPool[k].hidden = true;

    this.panels(w, s, i);
  }
  panels(w, s, i) {
    const esc = t => String(t).replace(/[<>&]/g, c2 => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[c2]));
    const c = C(), st = this.shadowRoot.getElementById('st');
    const rows = this._mode === 'plan'
      ? [['Spaces on this floor', (this.roomMeshes || []).length, c.accent2],
         ['Objects here', this.furn ? this.furn.children.length : 0, '#b08b4f']]
        .concat(this._elsewhere ? [['On other floors', this._elsewhere, '#8d8375']] : [])
        .concat([['Coach bays', (this.geo.bays || []).length, '#5b6470']])
      : [['Queuing', w.counts.queuing || 0, c.accent],
                  ['Walking', w.counts.walking || 0, '#b08b4f'],
                  ['At kerb', w.counts.kerb || 0, '#5b6470'],
                  ['Aboard', w.counts.aboard || 0, '#7c6bb0'],
                  ['Volunteers', (this.volPts || []).length, c.accent2]];
    st.innerHTML = '<h4>' + (this._mode === 'plan' ? 'Plan' : 'Live status') + '</h4>' + rows.map(([l, n, h]) =>
      `<div class="r"><span class="d" style="background:${h}"></span><span>${l}</span><b>${n}</b></div>`).join('');

    const zi = this.shadowRoot.getElementById('zi');
    if (this.pick && this.geo.rooms[this.pick]) {
      const r = this.geo.rooms[this.pick];
      const here = w.people.filter(x => x.room === this.pick && x.st === 'queuing');
      const ft = n => Math.round(n * 3.28084) + ' ft';
      const cap = Math.floor((r.w - 0.6) / 0.72) * Math.max(1,
        Math.floor((r.d - (r.headM || 1.6) - 0.4) / 1.152));
      const mv = [...new Set(here.map(x => x.mv))];
      zi.hidden = false;
      zi.innerHTML = `<h4>Zone info</h4><div class="t">${esc((s.roomNames || {})[this.pick] || this.pick)}</div>
        <div class="s">${ft(r.w)} × ${ft(r.d)} · ${Math.round(r.w * r.d * 10.7639)} sq ft</div>
        <div class="r"><span>In queue</span><b>${here.length}</b></div>
        <div class="r"><span>Standing capacity</span><b>${cap}</b></div>
        <div class="r"><span>Utilisation</span><b>${cap ? Math.round(here.length / cap * 100) + '%' : '—'}</b></div>
        <hr><div class="r"><span>Movement</span><b>${mv.length ? esc(mv[0]) : 'none'}</b></div>
        <button>View from inside</button>`;
      zi.querySelector('button').onclick = () => { this.view = 'interior'; this.frame(true); this.chromeState(); };
    } else zi.hidden = true;

    const hint = this.shadowRoot.getElementById('hint');
    hint.hidden = this._mode !== 'plan' && !!this.pick;
    hint.textContent = this._mode === 'plan'
      ? (s.tool ? 'Click the plan to place ' + s.tool.l
                : 'Drag a space to move it · drag its corner to resize · Go live to stand it up')
      : 'Drag to orbit · scroll to zoom · click a space for its numbers';
  }
}
customElements.define('praxis-3d', Praxis3D);
