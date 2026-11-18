import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { MUSH_BY_ID } from './data';
import type { Mushroom } from './data';
import { artStyle, finish, mat } from './styles';
import * as sim from './sim';
import type { MushBedState, State } from './sim';

/** Emplacements des bacs : trois caisses au sol devant soi, trois de plus sur l'étagère du fond. */
const SPOTS: [number, number, number][] = [[-1.05, 0, 0.35], [0, 0, 0.35], [1.05, 0, 0.35], [-1.05, 1.05, -0.75], [0, 1.05, -0.75], [1.05, 1.05, -0.75]];
const HALF_FOV = 0.56;

interface Bed { root: THREE.Group; key: string; shrooms: THREE.Object3D[]; soil: THREE.Mesh[]; fly: number; flyGroup: THREE.Group | null }

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, shadow = true) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, shadow);

/** Petit générateur pseudo-aléatoire : chaque bac garde la même disposition d'une image à l'autre. */
function rng(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

/** Un champignon, debout, à sa taille adulte : on le fait grandir par l'échelle. */
function shroom(m: Mushroom, r: () => number): THREE.Group {
  const g = new THREE.Group();
  const cap = m.glow ? new THREE.MeshBasicMaterial({ color: m.cap }) : mat(m.cap);
  const part = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const p = new THREE.Mesh(geo, material);
    p.position.set(x, y, z);
    p.castShadow = !m.glow;
    if (m.glow) p.userData.raw = true;
    g.add(p);
    return p;
  };
  const h = 0.8 + r() * 0.5;
  if (m.shape === 'dome') {
    part(new THREE.CylinderGeometry(0.025, 0.035, 0.12 * h, 7), mat(m.stem), 0, 0.06 * h, 0);
    const c = part(new THREE.SphereGeometry(0.075 * h, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, 0.11 * h, 0);
    c.scale.y = 0.75;
  } else if (m.shape === 'shelf') {
    // Pleurotes : des éventails gris qui sortent les uns au-dessus des autres.
    for (let k = 0; k < 3; k++) {
      const f = part(new THREE.CylinderGeometry(0.09 - k * 0.015, 0.09 - k * 0.015, 0.025, 10, 1, false, 0, Math.PI), cap, 0, 0.05 + k * 0.06, 0.02);
      f.rotation.set(0.25, Math.PI / 2, 0);
    }
  } else if (m.shape === 'pompom') {
    part(new THREE.IcosahedronGeometry(0.11 * h, 1), cap, 0, 0.1, 0);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const sp = part(new THREE.ConeGeometry(0.018, 0.08, 5), cap, Math.cos(a) * 0.07, 0.03, Math.sin(a) * 0.07);
      sp.rotation.x = Math.PI;
    }
  } else if (m.shape === 'bell') {
    part(new THREE.CylinderGeometry(0.008, 0.01, 0.14 * h, 5), m.glow ? new THREE.MeshBasicMaterial({ color: m.stem }) : mat(m.stem), 0, 0.07 * h, 0);
    part(new THREE.ConeGeometry(0.04, 0.05, 8), cap, 0, 0.15 * h, 0);
  } else {
    // Morille : un chapeau alvéolé, en cône bosselé, sur un pied clair.
    part(new THREE.CylinderGeometry(0.035, 0.045, 0.09 * h, 7), mat(m.stem), 0, 0.045 * h, 0);
    const c = part(new THREE.IcosahedronGeometry(0.07, 0), cap, 0, 0.15 * h, 0);
    c.scale.set(0.9, 1.6, 0.9);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      part(new THREE.SphereGeometry(0.018, 5, 4), mat(0x5a3f22), Math.cos(a) * 0.055, 0.13 * h + (k % 2) * 0.05, Math.sin(a) * 0.055);
    }
  }
  return g;
}

/**
 * La cave : on descend sous la serre, devant des bacs de fumier, des bottes de paille et des bûches.
 * Elle pousse surtout la nuit. On y brumise en gardant le doigt sur un bac, on cueille en le balayant.
 * L'état vit dans la partie (`s.cave`) : la scène ne fait que le montrer et rapporter les gestes.
 */
export class Cellar {
  active = false;
  /** Bac sous le doigt (-1 : aucun), et ce qu'on y fait. */
  held = -1;
  mode: '' | 'mist' | 'cut' = '';
  onAsk: (i: number) => void = () => {};
  onPick: (i: number) => void = () => {};
  onClear: (i: number) => void = () => {};
  onHint: (i: number, text: string) => void = () => {};
  onChange: () => void = () => {};
  state: () => State = () => ({}) as State;

  private renderer: THREE.WebGLRenderer | null = null;
  private outline: OutlineEffect | null = null;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 60);
  private beds: Bed[] = [];
  private mist: { m: THREE.Mesh; life: number; v: THREE.Vector3 }[] = [];
  private raf = 0;
  private last = 0;
  private down: { x: number; y: number; t: number; bed: number; cut: Set<number> } | null = null;
  private sky: THREE.MeshBasicMaterial | null = null;
  private bulb: THREE.PointLight | null = null;
  private moon: THREE.PointLight | null = null;
  private glows: THREE.PointLight[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.add(this.world);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => this.onUp(e as PointerEvent));
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
  }

  open(): void {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    const st = artStyle();
    this.outline = st.outline ? new OutlineEffect(this.renderer, { defaultThickness: st.outline, defaultColor: [0.03, 0.02, 0.05], defaultAlpha: 1 }) : null;
    this.build();
    this.active = true;
    this.resize();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  close(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.scene.remove(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.beds = [];
    this.mist = [];
    this.glows = [];
    this.held = -1;
    this.mode = '';
    this.down = null;
  }

  resize(): void {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = Math.min(100, (2 * Math.atan(Math.tan(HALF_FOV) / this.camera.aspect) * 180) / Math.PI);
    this.camera.position.set(0, 1.85, 3.2);
    this.camera.lookAt(0, 0.55, -0.3);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Le haut d'un bac à l'écran, pour y poser son étiquette. */
  bedScreen(i: number): { x: number; y: number; unit: number } {
    const [x, y, z] = SPOTS[i];
    const a = this.screen(new THREE.Vector3(x, y + 0.62, z)), b = this.screen(new THREE.Vector3(x + 0.45, y + 0.62, z));
    return { x: a.x, y: a.y, unit: Math.abs(b.x - a.x) };
  }

  // ---------- décor ----------

  private build(): void {
    const w = this.world;
    this.scene.fog = new THREE.Fog(0x1a1410, 6, 14);
    w.add(new THREE.HemisphereLight(0xd8c8b0, 0x2a2018, 0.55));
    // Une ampoule au bout de son fil, qui éclaire les bacs d'une lumière chaude.
    const bulb = new THREE.PointLight(0xffc878, 9, 9, 1.4);
    bulb.position.set(0, 2.9, 0.1);
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(512, 512);
    this.bulb = bulb;
    w.add(bulb);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
    glass.position.set(0, 2.9, 0.1);
    glass.userData.raw = true;
    w.add(glass, box(0.015, 0.9, 0.015, 0x2b2118, 0, 3.4, 0.1, false), box(0.09, 0.08, 0.09, 0x3b2a20, 0, 3.0, 0.1, false));
    // Voûte de pierre et sol de terre battue.
    w.add(box(12, 0.1, 10, 0x4a3a2c, 0, -0.05, 0, false));
    w.add(box(7, 4.5, 0.3, 0x7a6a58, 0, 2.2, -1.6));
    for (const x of [-3.2, 3.2]) w.add(box(0.3, 4.5, 6, 0x6e5f4f, x, 2.2, 0.6));
    for (let r = 0; r < 9; r++) for (let c = 0; c < 8; c++) {
      const sx = -3 + c * 0.82 + (r % 2) * 0.41, sy = 0.2 + r * 0.42;
      w.add(box(0.74, 0.36, 0.05, [0x8a7a66, 0x7f6f5c, 0x958470][(r + c) % 3], sx, sy, -1.43, false));
    }
    // Le soupirail : un carré de ciel, bleu le jour, nuit noire le soir.
    this.sky = new THREE.MeshBasicMaterial({ color: 0x9fd6ee });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), this.sky);
    sky.position.set(1.7, 3.45, -1.38);
    sky.userData.raw = true;
    w.add(sky, box(1.05, 0.08, 0.1, 0x3b2a20, 1.7, 3.71, -1.36, false), box(1.05, 0.08, 0.1, 0x3b2a20, 1.7, 3.19, -1.36, false));
    for (const x of [1.25, 1.7, 2.15]) w.add(box(0.05, 0.5, 0.1, 0x3b2a20, x, 3.45, -1.36, false));
    this.moon = new THREE.PointLight(0x9fb8ff, 0, 6, 1.5);
    this.moon.position.set(1.7, 3.2, -1.0);
    w.add(this.moon);
    // L'étagère du fond, pour les bacs en plus.
    w.add(box(3.4, 0.08, 0.8, 0x7a5236, 0, 1.0, -0.75), box(3.4, 0.08, 0.8, 0x7a5236, 0, 2.3, -0.95));
    for (const x of [-1.65, 1.65]) w.add(box(0.08, 2.4, 0.08, 0x5a3c28, x, 1.2, -0.4), box(0.08, 2.4, 0.08, 0x5a3c28, x, 1.2, -1.2));
    // Bocaux et outils sur l'étagère du haut, un arrosoir brumisateur au sol.
    for (let k = 0; k < 5; k++) w.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8), [0xc9b48a, 0x9fb8a0, 0xb5654a][k % 3], -1.3 + k * 0.6, 2.45, -0.95));
    w.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 10), 0x5f9a8a, 2.3, 0.15, 0.9), mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), 0x3b2a20, 2.3, 0.45, 0.9));
    finish(w);
    this.beds = SPOTS.map(() => ({ root: new THREE.Group(), key: '', shrooms: [], soil: [], fly: 0, flyGroup: null }));
    for (const b of this.beds) w.add(b.root);
  }

  /** Reconstruit un bac quand ce qu'il contient change. */
  private dress(i: number, b: MushBedState | null | undefined, open: boolean): void {
    const bed = this.beds[i];
    const key = !open ? 'x' : !b ? 'e' : `${b.m}:${b.flush}:${sim.mushRotten(b) ? 'r' : ''}`;
    if (key === bed.key) return;
    bed.key = key;
    const keep = bed.flyGroup;
    bed.root.clear();
    if (keep) bed.root.add(keep);
    bed.shrooms = [];
    bed.soil = [];
    const [x, y, z] = SPOTS[i];
    bed.root.position.set(x, y + (y ? 0.04 : 0), z);
    const g = new THREE.Group();
    if (!open) {
      // Place libre : une caisse vide retournée, pas encore achetée.
      g.add(box(0.8, 0.22, 0.5, 0x5a4636, 0, 0.11, 0));
    } else if (!b) {
      g.add(box(0.86, 0.06, 0.56, 0x8a5f3c, 0, 0.03, 0));
      for (const [dx, dz, w, d] of [[0, -0.27, 0.86, 0.04], [0, 0.27, 0.86, 0.04], [-0.42, 0, 0.04, 0.56], [0.42, 0, 0.04, 0.56]] as const) g.add(box(w, 0.26, d, 0xa9794f, dx, 0.13, dz));
    } else {
      const m = MUSH_BY_ID[b.m], rot = sim.mushRotten(b);
      const r = rng(i * 31 + b.flush * 7 + 3);
      let tops: [number, number, number, number][] = [];
      if (m.bed === 'fumier' || m.bed === 'terre') {
        for (const [dx, dz, w, d] of [[0, -0.27, 0.86, 0.04], [0, 0.27, 0.86, 0.04], [-0.42, 0, 0.04, 0.56], [0.42, 0, 0.04, 0.56]] as const) g.add(box(w, 0.26, d, 0xa9794f, dx, 0.13, dz));
        const soil = box(0.8, 0.2, 0.5, m.bed === 'terre' ? 0x4a3826 : 0x3a2818, 0, 0.12, 0, false);
        bed.soil.push(soil);
        g.add(soil);
        if (m.bed === 'terre') for (let k = 0; k < 5; k++) g.add(box(0.1, 0.03, 0.08, 0x5f8a3a, -0.3 + k * 0.15, 0.235, (r() - 0.5) * 0.3, false));
        const n = m.id === 'morille' ? 4 : 7;
        tops = Array.from({ length: n }, (_, k) => [(k / (n - 1) - 0.5) * 0.62 + (r() - 0.5) * 0.06, 0.22, (r() - 0.5) * 0.3, 0]);
      } else if (m.bed === 'paille') {
        const bale = box(0.8, 0.42, 0.46, 0xe2c26a, 0, 0.21, 0);
        bed.soil.push(bale);
        g.add(bale, box(0.81, 0.43, 0.04, 0x8a6a3a, -0.2, 0.21, 0, false), box(0.81, 0.43, 0.04, 0x8a6a3a, 0.2, 0.21, 0, false));
        g.children[g.children.length - 1].rotation.y = Math.PI / 2;
        g.children[g.children.length - 2].rotation.y = Math.PI / 2;
        tops = [[-0.25, 0.12, 0.23, 0], [0.05, 0.2, 0.23, 0], [0.28, 0.1, 0.23, 0], [-0.1, 0.42, 0.05, 0], [0.22, 0.42, -0.08, 0]];
      } else {
        // Deux bûches couchées, les champignons sortent de l'écorce.
        for (const dz of [-0.13, 0.13]) {
          const log = mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.82, 10), 0x6b4a34, 0, 0.14, dz);
          log.rotation.z = Math.PI / 2;
          bed.soil.push(log);
          const end = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 10), 0xd9b27a, 0.41, 0.14, dz, false);
          end.rotation.z = Math.PI / 2;
          g.add(log, end);
        }
        const n = m.id === 'hericium' ? 3 : m.id === 'mycene' ? 9 : 6;
        tops = Array.from({ length: n }, (_, k) => {
          const zz = k % 2 ? 0.13 : -0.13, a = (r() - 0.5) * 1.2;
          return [(k / Math.max(1, n - 1) - 0.5) * 0.66, 0.14 + Math.cos(a) * 0.13, zz + Math.sin(a) * 0.13 + (zz > 0 ? 0.02 : 0), a];
        });
      }
      for (const [sx, sy, sz, tilt] of tops) {
        const s = shroom(m, r);
        s.position.set(sx, sy, sz);
        s.rotation.set(tilt, r() * Math.PI * 2, 0);
        if (m.id === 'hericium') { s.position.y -= 0.05; s.position.z += sz > 0 ? 0.12 : -0.12; }
        if (rot) s.traverse((o) => { if (o instanceof THREE.Mesh) { o.material = mat(0x5a4a3a); o.userData.raw = false; } });
        bed.shrooms.push(s);
        g.add(s);
      }
      if (m.glow && !rot) {
        const l = new THREE.PointLight(0x9cff7a, 0, 1.8, 1.6);
        l.position.set(0, 0.4, 0.2);
        l.userData.glow = true;
        g.add(l);
      }
    }
    finish(g);
    // Chaque support a sa propre matière : elle fonce quand on le brumise.
    for (const m of bed.soil) m.material = (m.material as THREE.Material).clone();
    bed.root.add(g);
    this.glows = [];
    for (const bb of this.beds) bb.root.traverse((o) => { if (o instanceof THREE.PointLight && o.userData.glow) this.glows.push(o); });
  }

  // ---------- gestes ----------

  private screen(q: THREE.Vector3): { x: number; y: number } {
    const s = q.clone().project(this.camera);
    return { x: (s.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (1 - (s.y * 0.5 + 0.5)) * this.canvas.clientHeight };
  }
  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private bedAt(p: { x: number; y: number }): number {
    const n = this.state().cave?.beds.length ?? 0;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < SPOTS.length; i++) {
      const [x, y, z] = SPOTS[i];
      const c = this.screen(new THREE.Vector3(x, y + 0.3, z)), e = this.screen(new THREE.Vector3(x + 0.5, y + 0.3, z));
      const r = Math.abs(e.x - c.x);
      const d = Math.hypot((p.x - c.x) / r, (p.y - c.y) / (r * 0.8));
      if (d < 1.2 && d < bestD) { bestD = d; best = i; }
    }
    return best < n ? best : best >= 0 ? -2 - best : -1;
  }

  private onDown(e: PointerEvent): void {
    if (!this.active) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.at(e);
    this.down = { ...p, t: performance.now(), bed: this.bedAt(p), cut: new Set() };
    this.held = this.down.bed;
    this.mode = '';
  }

  private onMove(e: PointerEvent): void {
    const d = this.down;
    if (!d || !this.active) return;
    const p = this.at(e);
    const s = this.state(), beds = s.cave?.beds ?? [];
    const far = Math.hypot(p.x - d.x, p.y - d.y);
    if (far > 14 && this.mode === '') this.mode = 'cut';
    // Un geste qui balaie un bac mûr, c'est la cueillette ; on peut enchaîner plusieurs bacs d'un seul geste.
    if (this.mode === 'mist' || far < 24) return;
    const ripe = (i: number) => i >= 0 && !d.cut.has(i) && !!beds[i] && beds[i]!.prog >= 1 && !sim.mushRotten(beds[i]!);
    for (const i of [d.bed, this.bedAt(p)]) if (ripe(i)) { d.cut.add(i); this.harvest(i); }
  }

  private onUp(_e: PointerEvent): void {
    const d = this.down;
    this.down = null;
    const wasMist = this.mode === 'mist';
    this.held = -1;
    this.mode = '';
    if (!d || !this.active || wasMist) { this.onChange(); return; }
    const quick = performance.now() - d.t < 350;
    if (!quick) { this.onChange(); return; }
    const s = this.state(), c = s.cave;
    if (d.bed <= -2) { this.onHint(-2 - d.bed, 'buy'); return; }
    if (d.bed < 0 || !c) return;
    const b = c.beds[d.bed];
    if (!b) this.onAsk(d.bed);
    else if (sim.mushRotten(b)) this.onClear(d.bed);
    else if (b.prog >= 1) this.onHint(d.bed, 'cut');
    else this.onHint(d.bed, 'mist');
    this.onChange();
  }

  private harvest(i: number): void {
    const bed = this.beds[i];
    // Les champignons cueillis s'envolent vers le panier.
    const fly = new THREE.Group();
    for (const s of bed.shrooms) {
      const c = s.clone();
      c.position.copy(s.position);
      c.rotation.copy(s.rotation);
      c.scale.copy(s.scale);
      fly.add(c);
    }
    if (bed.flyGroup) bed.root.remove(bed.flyGroup);
    bed.flyGroup = fly;
    bed.fly = 1;
    bed.root.add(fly);
    this.onPick(i);
  }

  // ---------- boucle ----------

  private frame = (now: number): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    const s = this.state(), c = s.cave;
    if (!c) return;
    const light = sim.daylight(s);
    // Garder le doigt posé sur un bac le brumise.
    const d = this.down;
    if (d && d.bed >= 0 && c.beds[d.bed] && c.beds[d.bed]!.prog < 1 && this.mode === '' && now - d.t > 220) this.mode = 'mist';
    if (this.mode === 'mist' && d && d.bed >= 0 && c.beds[d.bed]) {
      sim.mistBed(s, d.bed, dt * 0.45);
      if (Math.random() < dt * 40) this.puff(d.bed);
    }
    SPOTS.forEach((_, i) => this.dress(i, c.beds[i], i < c.beds.length));
    this.beds.forEach((bed, i) => {
      const b = c.beds[i];
      if (b) {
        const ripe = b.prog >= 1, rot = sim.mushRotten(b);
        const k = 0.12 + 0.88 * Math.min(1, b.prog);
        bed.shrooms.forEach((sh, n) => {
          const bob = ripe && !rot ? 1 + Math.sin(t * 3 + n) * 0.03 : 1;
          sh.scale.setScalar(1.4 * k * bob * (rot ? 0.85 : 1));
          if (rot) sh.scale.y *= 0.55;
        });
        // Le support fonce quand il est humide.
        for (const m of bed.soil) {
          const base = (m.userData.base as THREE.Color | undefined) ?? (m.userData.base = (m.material as THREE.MeshStandardMaterial).color.clone());
          (m.material as THREE.MeshStandardMaterial).color.copy(base).multiplyScalar(1 - b.wet * 0.35);
        }
      }
      if (bed.fly > 0 && bed.flyGroup) {
        bed.fly = Math.max(0, bed.fly - dt * 1.8);
        bed.flyGroup.position.set(0, (1 - bed.fly) * 1.4, (1 - bed.fly) * 0.6);
        bed.flyGroup.scale.setScalar(Math.max(0.001, bed.fly));
        if (bed.fly === 0) { bed.root.remove(bed.flyGroup); bed.flyGroup = null; }
      }
    });
    for (const g of this.glows) g.intensity = (1 - light) * 2.2 + 0.4;
    if (this.sky) this.sky.color.setHSL(0.56, 0.55 * light + 0.2, 0.12 + 0.6 * light);
    if (this.bulb) this.bulb.intensity = 7 + Math.sin(t * 13) * 0.15;
    if (this.moon) this.moon.intensity = (1 - light) * 1.2;
    this.mist = this.mist.filter((p) => {
      p.life -= dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.scale.setScalar(1 + (1 - p.life) * 2);
      (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life) * 0.5;
      if (p.life <= 0) { this.world.remove(p.m); return false; }
      return true;
    });
    if (this.outline) this.outline.render(this.scene, this.camera);
    else this.renderer!.render(this.scene, this.camera);
    this.onChange();
  };

  private puff(i: number): void {
    const [x, y, z] = SPOTS[i];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.5, depthWrite: false }));
    m.userData.raw = true;
    (m.material as THREE.Material).userData.outlineParameters = { visible: false };
    m.position.set(x + (Math.random() - 0.5) * 0.7, y + 0.55, z + (Math.random() - 0.5) * 0.3);
    this.world.add(m);
    this.mist.push({ m, life: 1, v: new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.25, 0.05) });
  }
}
