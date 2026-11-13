import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { SPECIES_BY_ID } from './data';
import type { Family } from './data';
import { buildPlant } from './plants3d';
import { artStyle, finish, mat } from './styles';
import type { Harvest } from './sim';

interface Item { h: Harvest; root: THREE.Group; home: THREE.Vector3; sold: boolean }
interface Client {
  seat: number;
  wish: Family | null;
  patience: number;
  max: number;
  /** 'in' il arrive, 'wait' il attend, 'happy' il repart servi, 'angry' il repart déçu. */
  state: 'in' | 'wait' | 'happy' | 'angry';
  root: THREE.Group;
  x: number;
  shake: number;
  hop: number;
  dir: number;
}

const HALF_FOV = 0.42;
const SEATS = [-0.85, 0, 0.85];
const TOP = 0.92;
const CLIENT_Z = -1.3;
const COATS = [0xe2574c, 0x4f8ad6, 0xf2b441, 0x8a6fd0, 0x3f9d6b, 0xe58ab0, 0x5a6a7a];
const SKIN = [0xf3c9a5, 0xd9a47a, 0xa8714a, 0xf7dcc0];
const HAIR = [0x3a2a26, 0x8a5f3c, 0xd9b25a, 0x9a9a9a, 0xb5452e];

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
const box = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, shadow = true) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, shadow);

/**
 * L'étal du fleuriste : on est derrière le comptoir, les plantes de la réserve sont posées devant soi
 * et les clients défilent avec une envie et une patience. On sert en faisant glisser une plante jusqu'au client.
 * Comme l'expédition, la scène ne touche pas à la partie : l'interface encaisse chaque vente par `onSale`.
 */
export class Stall {
  active = false;
  earned = 0;
  served = 0;
  missed = 0;
  combo = 0;
  /** Clients encore à venir. */
  queue = 0;
  /** Plante tenue du doigt (-1 : aucune) et client visé. */
  held = -1;
  target = -1;
  onChange: () => void = () => {};
  /** Encaisse une vente et rend son montant. */
  onSale: (h: Harvest, match: boolean, patience: number, combo: number) => number = () => 0;
  onEvent: (kind: 'sale' | 'great' | 'refuse' | 'leave' | 'arrive', gain?: number) => void = () => {};
  onEnd: () => void = () => {};
  wishOf: (left: Harvest[]) => Family | null = () => null;

  private renderer: THREE.WebGLRenderer | null = null;
  private outline: OutlineEffect | null = null;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 80);
  private items: Item[] = [];
  private clients: Client[] = [];
  private raf = 0;
  private last = 0;
  private nextIn = 1;
  private ended = 0;
  private count = 0;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TOP + 0.5));

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.add(this.world);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => this.onUp());
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
  }

  open(stock: Harvest[]): void {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    const st = artStyle();
    this.outline = st.outline ? new OutlineEffect(this.renderer, { defaultThickness: st.outline, defaultColor: [0.03, 0.02, 0.05], defaultAlpha: 1 }) : null;
    this.earned = this.served = this.missed = this.combo = 0;
    this.held = this.target = -1;
    this.ended = 0;
    this.count = 0;
    this.nextIn = 0.8;
    this.queue = stock.length + 2;
    this.build(stock);
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
    this.items = [];
    this.clients = [];
  }

  /** Ferme l'étal : les clients présents repartent, la recette est comptée. */
  shut(): void {
    if (this.active && !this.ended) this.ended = 0.01;
  }

  resize(): void {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = Math.min(96, (2 * Math.atan(Math.tan(HALF_FOV) / this.camera.aspect) * 180) / Math.PI);
    this.camera.position.set(0, 2.55, 2.15);
    this.camera.lookAt(0, 1.55, -1.0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  // ---------- décor ----------

  private build(stock: Harvest[]): void {
    const w = this.world;
    this.scene.fog = new THREE.Fog(0xcfe6ee, 14, 40);
    w.add(new THREE.HemisphereLight(0xffffff, 0xd8c7a8, 1.25));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.5);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    w.add(sun);
    const flat = (m: THREE.Mesh) => { m.material = (m.material as THREE.Material).clone(); (m.material as THREE.Material).userData.outlineParameters = { visible: false }; m.castShadow = false; return m; };
    // La place : pavés, trottoir d'en face, façades.
    w.add(flat(box(60, 0.1, 40, 0xd9cdb8, 0, -0.05, -8)), flat(box(60, 0.12, 3, 0xbfb3a0, 0, 0.01, -9.5)));
    const fronts = [0xf2d9a8, 0xe9a48a, 0xa8cfe0, 0xf4efe4, 0xcfe0a8, 0xe5b8d0];
    for (let k = 0; k < 7; k++) {
      const x = -13.5 + k * 4.5, h = 5 + ((k * 7) % 3) * 0.9, c = fronts[k % fronts.length];
      w.add(box(4.3, h, 2, c, x, h / 2, -12), box(4.5, 0.35, 2.2, 0xb5654a, x, h + 0.17, -12), box(1.0, 1.9, 0.1, 0x6a4a3a, x - 0.9, 0.95, -10.95, false));
      for (const wx of [-1.1, 0.4, 1.4]) w.add(box(0.7, 0.9, 0.08, 0x8fc7e0, x + wx, h - 1.5, -10.96, false));
      if (h > 5.5) for (const wx of [0.4, 1.4]) w.add(box(0.7, 0.9, 0.08, 0x8fc7e0, x + wx, h - 3.0, -10.96, false));
    }
    for (const x of [-6.5, 6.5]) {
      w.add(mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.2, 8), 0x8a5f3c, x, 1.1, -8.2), mesh(new THREE.IcosahedronGeometry(1.3, 0), 0x5fae5a, x, 3.0, -8.2));
    }
    // Le comptoir et son auvent rayé.
    w.add(box(4.2, TOP, 1.25, 0xa9794f, 0, TOP / 2, 0), box(4.4, 0.08, 1.4, 0xd9b27a, 0, TOP + 0.04, 0), box(4.2, 0.1, 0.05, 0xf2c94c, 0, TOP - 0.2, -0.64, false));
    for (const x of [-2.15, 2.15]) w.add(box(0.1, 3.5, 0.1, 0x8a5f3c, x, 1.75, -0.85));
    for (let k = 0; k < 9; k++) {
      w.add(box(0.5, 0.34, 0.05, k % 2 ? 0xfdfaf2 : 0xe2574c, -2 + k * 0.5, 3.3, -0.88, false));
    }
    // Les plantes de la réserve, emballées de papier kraft.
    const n = stock.length, perRow = n > 5 ? Math.ceil(n / 2) : n;
    this.items = stock.map((h, i) => {
      const row = i < perRow ? 0 : 1, cnt = row ? n - perRow : perRow, col = row ? i - perRow : i;
      const root = new THREE.Group();
      root.add(mesh(new THREE.CylinderGeometry(0.17, 0.08, 0.26, 9, 1, true), 0xcaa472, 0, 0.13, 0), mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 9), 0x5a3f2c, 0, 0.2, 0, false));
      const plant = buildPlant(SPECIES_BY_ID[h.sp], 4, 1, h.vr);
      plant.scale.setScalar(0.55);
      root.scale.setScalar(0.85);
      plant.position.y = 0.2;
      root.add(plant);
      const home = new THREE.Vector3((col - (cnt - 1) / 2) * 0.4 + (row && cnt < perRow ? 0 : row ? 0.2 : 0), TOP + 0.08, row ? 0.02 : 0.42);
      root.position.copy(home);
      w.add(root);
      return { h, root, home, sold: false };
    });
    finish(w);
  }

  private spawn(): void {
    const seats = SEATS.map((_, k) => k).filter((k) => !this.clients.some((c) => c.seat === k));
    if (!seats.length) return;
    const seat = seats[Math.floor(Math.random() * seats.length)];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const root = new THREE.Group();
    const coat = pick(COATS), hair = pick(HAIR);
    const head = mesh(new THREE.SphereGeometry(0.21, 12, 9), pick(SKIN), 0, 1.42, 0);
    root.add(mesh(new THREE.CylinderGeometry(0.2, 0.34, 1.2, 10), coat, 0, 0.6, 0), head,
      mesh(new THREE.SphereGeometry(0.225, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 1.45, -0.03),
      mesh(new THREE.SphereGeometry(0.025, 6, 5), 0x1b1420, -0.075, 1.44, 0.195, false), mesh(new THREE.SphereGeometry(0.025, 6, 5), 0x1b1420, 0.075, 1.44, 0.195, false));
    if (Math.random() < 0.4) root.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 12), coat, 0, 1.6, 0), mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.16, 12), coat, 0, 1.68, 0));
    const dir = Math.random() < 0.5 ? -1 : 1;
    root.scale.setScalar(1.18);
    root.position.set(dir * 5.5, 0, CLIENT_Z - 0.5);
    finish(root);
    this.world.add(root);
    const left = this.items.filter((i) => !i.sold).map((i) => i.h);
    const max = Math.max(9, 17 - this.count * 0.8);
    this.clients.push({ seat, wish: this.wishOf(left), patience: max, max, state: 'in', root, x: SEATS[seat], shake: 0, hop: 0, dir });
    this.count++;
    this.queue--;
  }

  // ---------- lecture pour l'interface ----------

  private screen(p: THREE.Vector3): { x: number; y: number } {
    const q = p.clone().project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (1 - (q.y * 0.5 + 0.5)) * this.canvas.clientHeight };
  }

  /** Une bulle par client qui attend : où l'afficher, son envie, sa patience. */
  bubbles(): { seat: number; x: number; y: number; wish: Family | null; left: number; aim: boolean; fit: boolean }[] {
    const held = this.items[this.held];
    return this.clients.filter((c) => c.state === 'wait').map((c) => {
      const s = this.screen(new THREE.Vector3(c.root.position.x, 2.12, c.root.position.z));
      return { seat: c.seat, ...s, wish: c.wish, left: c.patience / c.max, aim: c.seat === this.target, fit: !!held && this.fits(c, held) };
    });
  }
  /** Espèce de la plante tenue du doigt. */
  get heldId(): string {
    return this.items[this.held]?.h.sp ?? '';
  }
  get left(): number {
    return this.items.filter((i) => !i.sold).length;
  }
  get closing(): boolean {
    return this.ended > 0;
  }

  private fits(c: Client, it: Item): boolean {
    return !c.wish || SPECIES_BY_ID[it.h.sp].family === c.wish;
  }

  // ---------- gestes ----------

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || this.ended) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.at(e);
    let best = -1, bestD = 64;
    this.items.forEach((it, i) => {
      if (it.sold) return;
      const s = this.screen(it.home.clone().setY(it.home.y + 0.28));
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    this.held = best;
    if (best >= 0) this.onMove(e);
    this.onChange();
  }

  private onMove(e: PointerEvent): void {
    const it = this.items[this.held];
    if (!it || !this.active) return;
    const p = this.at(e);
    this.ray.setFromCamera(new THREE.Vector2((p.x / this.canvas.clientWidth) * 2 - 1, -(p.y / this.canvas.clientHeight) * 2 + 1), this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return;
    it.root.position.set(THREE.MathUtils.clamp(hit.x, -2, 2), TOP + 0.3, THREE.MathUtils.clamp(hit.z, CLIENT_Z + 0.45, 0.7));
    // Passé le bord du comptoir, la plante vise le client le plus proche du doigt.
    let t = -1;
    if (p.y < this.screen(new THREE.Vector3(0, TOP, -0.45)).y) {
      let bd = 90;
      for (const c of this.clients) {
        const d = Math.abs(this.screen(c.root.position.clone().setY(1.5)).x - p.x);
        if (c.state === 'wait' && d < bd) { bd = d; t = c.seat; }
      }
    }
    if (t !== this.target) { this.target = t; this.onChange(); }
  }

  private onUp(): void {
    const it = this.items[this.held], c = this.clients.find((k) => k.seat === this.target && k.state === 'wait');
    this.held = this.target = -1;
    if (it && c && !this.ended) {
      if (this.fits(c, it)) {
        const gain = this.onSale(it.h, !!c.wish, c.patience / c.max, this.combo);
        it.sold = true;
        this.earned += gain;
        this.served++;
        this.combo++;
        c.state = 'happy';
        c.hop = 1;
        // Le client repart avec sa plante dans les bras.
        c.root.add(it.root);
        it.root.position.set(0, 0.8, 0.28);
        it.root.scale.setScalar(0.75);
        this.onEvent(c.wish && c.patience / c.max > 0.5 ? 'great' : 'sale', gain);
      } else {
        c.shake = 1;
        c.patience -= c.max * 0.2;
        this.onEvent('refuse');
      }
    }
    this.onChange();
  }

  // ---------- boucle ----------

  private frame = (now: number): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;

    if (!this.ended) {
      this.nextIn -= dt;
      if (this.nextIn <= 0 && this.queue > 0 && this.left > 0 && this.clients.filter((c) => c.state === 'in' || c.state === 'wait').length < 3) {
        this.spawn();
        this.nextIn = 1.6 + Math.random() * 2.2;
        this.onEvent('arrive');
      }
      const busy = this.clients.some((c) => c.state === 'in' || c.state === 'wait');
      if (!busy && (this.left === 0 || this.queue === 0)) this.ended = 0.01;
    } else {
      // Fermeture : on laisse partir tout le monde, puis on compte la recette.
      for (const c of this.clients) if (c.state === 'in' || c.state === 'wait') c.state = 'angry';
      this.ended += dt;
      if (this.ended > 1.3) { this.onEnd(); return; }
    }

    for (const c of this.clients) {
      const r = c.root;
      if (c.state === 'in') {
        r.position.x += Math.sign(c.x - r.position.x) * Math.min(Math.abs(c.x - r.position.x), dt * 3.2);
        r.position.z += (CLIENT_Z - r.position.z) * Math.min(1, dt * 3);
        r.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
        r.rotation.y = Math.abs(c.x - r.position.x) > 0.1 ? -c.dir * 1.2 : 0;
        if (Math.abs(c.x - r.position.x) < 0.02) { c.state = 'wait'; r.rotation.y = 0; this.onChange(); }
      } else if (c.state === 'wait') {
        c.patience -= dt;
        c.shake = Math.max(0, c.shake - dt * 2.5);
        r.position.x = c.x + Math.sin(c.shake * 22) * 0.07 * c.shake;
        r.position.y = Math.sin(t * 2 + c.seat) * 0.015;
        // À bout de patience, il trépigne.
        if (c.patience / c.max < 0.3) r.rotation.z = Math.sin(t * 14) * 0.04;
        if (c.patience <= 0) { c.state = 'angry'; this.combo = 0; this.missed++; r.rotation.z = 0; this.onEvent('leave'); this.onChange(); }
      } else {
        c.hop = Math.max(0, c.hop - dt * 1.6);
        if (c.hop > 0) r.position.y = Math.abs(Math.sin(c.hop * Math.PI * 2)) * 0.22;
        else {
          r.rotation.y = c.dir * 1.2;
          r.position.x += c.dir * dt * (c.state === 'happy' ? 2.6 : 3.4);
          r.position.z -= dt * 0.4;
          r.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
        }
      }
    }
    const gone = this.clients.filter((c) => Math.abs(c.root.position.x) > 6 && c.state !== 'in');
    for (const c of gone) this.world.remove(c.root);
    if (gone.length) this.clients = this.clients.filter((c) => !gone.includes(c));

    this.items.forEach((it, i) => {
      if (it.sold) return;
      if (i !== this.held) it.root.position.lerp(it.home, Math.min(1, dt * 12));
      it.root.rotation.z = i === this.held ? Math.sin(t * 8) * 0.06 : 0;
    });
    if (this.outline) this.outline.render(this.scene, this.camera);
    else this.renderer!.render(this.scene, this.camera);
    this.onChange();
  };
}
