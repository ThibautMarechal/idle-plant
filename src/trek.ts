import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { BIOMES, CUT_ZONE, SPECIES_BY_ID, TREK_TIME } from './data';
import { buildPlant } from './plants3d';
import { artStyle, finish, mat } from './styles';

interface Find {
  id: string;
  tier: number;
  pos: THREE.Vector3;
  root: THREE.Group;
  /** Fourré qui cache la plante : on le frotte pour l'écarter avant de pouvoir cueillir. */
  cover: THREE.Group | null;
  rub: number;
  taken: boolean;
  fly: number;
}

const EYE = 1.5;
const HALF_FOV = 0.5;
/** Distance à laquelle on peut cueillir, et rayon du camp. */
const REACH = 2.7;
export const CAMP = 4;
const SPEED = 4.2;

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/**
 * L'expédition : on part du camp à pied, à la première personne. Le pouce sert de manette
 * (vers le haut on avance, sur les côtés on tourne). Plus on s'éloigne, plus les plantes sont rares,
 * mais il faut être revenu au camp avant la nuit, sinon on perd la moitié du panier.
 * Chaque plante se coupe d'un geste d'adresse : toucher quand le curseur passe dans le vert.
 * Comme l'établi, la scène ne touche jamais à la partie : l'interface lit le panier au retour.
 */
export class Trek {
  active = false;
  basket: string[] = [];
  /** Une graine en plus par coupe parfaite. */
  bonus: string[] = [];
  cap = 4;
  left = 0;
  /** Plante à portée de main (-1 : aucune). */
  near = -1;
  biome = 0;
  /** Jauge de coupe en cours : position du curseur 0..1, zone verte centrée sur `mid`. */
  cut: { pos: number; dir: number; mid: number; zone: number; speed: number } | null = null;
  /** Manette sous le pouce, en pixels : origine et écart. */
  stick: { x: number; y: number; dx: number; dy: number } | null = null;
  /** Ramassé en chemin : argile et pièces. */
  loot = { clay: 0, coins: 0 };
  private total = TREK_TIME;
  private speed = 1;
  private pickups: { x: number; z: number; kind: 'clay' | 'coins'; n: number; obj: THREE.Object3D; got: boolean }[] = [];
  private glints: THREE.Mesh[] = [];
  /** Vrai si la nuit est tombée loin du camp. */
  lost = false;
  slowed = false;
  onChange: () => void = () => {};
  onEvent: (kind: 'pick' | 'perfect' | 'miss' | 'reveal' | 'slow' | 'dusk' | 'clay' | 'coins', id?: string) => void = () => {};
  onEnd: () => void = () => {};

  private renderer: THREE.WebGLRenderer | null = null;
  private outline: OutlineEffect | null = null;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 140);
  private finds: Find[] = [];
  private solids: { x: number; z: number; r: number }[] = [];
  private slows: { x: number; z: number; r: number }[] = [];
  private pos = new THREE.Vector3(0, EYE, 2.5);
  private yaw = 0;
  private pitch = -0.05;
  private aimYaw: number | null = null;
  private raf = 0;
  private last = 0;
  private down: { x: number; y: number; sx: number; sy: number; t: number; rub: boolean } | null = null;
  private sway: THREE.Object3D[] = [];
  private sun: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private ended = false;
  private dusk = false;
  private step = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.add(this.world);
    this.camera.rotation.order = 'YXZ';
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => this.onUp(e as PointerEvent));
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
  }

  open(biome: number, finds: { id: string; hidden: boolean; tier: number }[], setup: { time: number; speed: number; cap: number }): void {
    const cap = setup.cap;
    this.total = setup.time;
    this.speed = setup.speed;
    this.loot = { clay: 0, coins: 0 };
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    const st = artStyle();
    this.outline = st.outline ? new OutlineEffect(this.renderer, { defaultThickness: st.outline, defaultColor: [0.03, 0.02, 0.05], defaultAlpha: 1 }) : null;
    this.biome = biome;
    this.cap = cap;
    this.basket = [];
    this.bonus = [];
    this.left = setup.time;
    this.near = -1;
    this.cut = null;
    this.stick = null;
    this.down = null;
    this.ended = false;
    this.lost = false;
    this.dusk = false;
    this.slowed = false;
    this.yaw = 0;
    this.pitch = -0.05;
    this.aimYaw = null;
    this.pos.set(0, EYE, -2.6);
    this.build(finds);
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
    this.finds = [];
    this.sway = [];
    this.solids = [];
    this.slows = [];
    this.pickups = [];
    this.glints = [];
  }

  resize(): void {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = Math.min(100, (2 * Math.atan(Math.tan(HALF_FOV) / this.camera.aspect) * 180) / Math.PI);
    this.camera.updateProjectionMatrix();
  }

  // ---------- décor ----------

  private build(list: { id: string; hidden: boolean; tier: number }[]): void {
    const b = BIOMES[this.biome];
    const w = this.world;
    const rnd = Math.random;
    this.scene.fog = new THREE.Fog(b.fog, 12, 50);
    this.hemi = new THREE.HemisphereLight(0xfff6e0, 0x8fae9a, 1.2);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.002;
    this.sun = sun;
    w.add(this.hemi, sun, sun.target);
    w.add(mesh(new THREE.CylinderGeometry(120, 120, 0.2, 40), b.ground, 0, -0.1, 0, false));

    // Les plantes sauvages d'abord : le décor s'installe autour d'elles.
    const tierR: [number, number][] = [[5.5, 12], [15, 25], [29, 39]];
    const count = [0, 0, 0];
    const total = [0, 1, 2].map((t) => list.filter((f) => f.tier === t).length);
    this.finds = list.map((f) => {
      const k = count[f.tier]++;
      const a = (k / total[f.tier]) * Math.PI * 2 + f.tier * 0.5 + (rnd() - 0.5) * 0.5;
      const r = tierR[f.tier][0] + rnd() * (tierR[f.tier][1] - tierR[f.tier][0]);
      const pos = new THREE.Vector3(Math.sin(a) * r, 0, -Math.cos(a) * r);
      const root = new THREE.Group();
      root.position.copy(pos);
      const plant = buildPlant(SPECIES_BY_ID[f.id], 4, 1, 0);
      plant.scale.setScalar(1.15);
      root.add(plant, mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.08, 10), 0x6b4a34, 0, 0.03, 0, false));
      let cover: THREE.Group | null = null;
      if (f.hidden) {
        cover = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const ca = (i / 5) * Math.PI * 2;
          cover.add(mesh(new THREE.IcosahedronGeometry(0.55 + rnd() * 0.2, 1), i % 2 ? 0x4f9a5c : 0x5fae68, Math.sin(ca) * 0.42, 0.55 + (i % 2) * 0.25, Math.cos(ca) * 0.42));
        }
        cover.add(mesh(new THREE.IcosahedronGeometry(0.6, 1), 0x6fbf78, 0, 1.05, 0));
        root.add(cover);
        plant.visible = false;
      }
      // Une lueur monte des plantes rares : on la voit de loin, à travers la brume.
      if (f.tier > 0) {
        const glint = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.5, 16, 8, 1, true), new THREE.MeshBasicMaterial({ color: f.tier === 2 ? 0xffd84d : 0xbfe9ff, transparent: true, opacity: f.tier === 2 ? 0.34 : 0.2, depthWrite: false, fog: false, side: THREE.DoubleSide }));
        glint.position.y = 8;
        glint.userData.raw = true;
        root.add(glint);
        this.glints.push(glint);
      }
      w.add(root);
      return { id: f.id, tier: f.tier, pos, root, cover, rub: 0, taken: false, fly: 0 };
    });

    // Place libre : ni sur le camp, ni sur une plante.
    const free = (x: number, z: number, r: number) => Math.hypot(x, z) > CAMP + r + 1 && this.finds.every((f) => Math.hypot(f.pos.x - x, f.pos.z - z) > r + 1.6);
    const scatter = (n: number, r0: number, r1: number, size: number, make: (x: number, z: number, k: number) => void) => {
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 6; tries++) {
          const a = rnd() * Math.PI * 2, r = r0 + Math.sqrt(rnd()) * (r1 - r0);
          const x = Math.sin(a) * r, z = -Math.cos(a) * r;
          if (!free(x, z, size)) continue;
          make(x, z, k);
          break;
        }
      }
    };
    const solid = (x: number, z: number, r: number) => this.solids.push({ x, z, r });
    const flat = (m: THREE.Mesh) => { m.userData.flat = true; return m; };
    const tuft = (x: number, z: number, color: number, s = 1) => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blade = mesh(new THREE.ConeGeometry(0.05 * s, 0.45 * s, 4), color, (i - 1) * 0.07 * s, 0.22 * s, 0, false);
        blade.rotation.z = (i - 1) * 0.35;
        g.add(blade);
      }
      g.position.set(x, 0, z);
      this.sway.push(g);
      w.add(g);
    };
    const patch = b.id === 'dunes' ? 0xdcc48c : b.id === 'marais' ? 0x6f9e7a : 0x7fb56c;
    for (let k = 0; k < 60; k++) {
      const a = rnd() * Math.PI * 2, r = 2 + rnd() * 44;
      const p = flat(mesh(new THREE.CylinderGeometry(1 + rnd() * 2.2, 1, 0.02, 9), patch, Math.sin(a) * r, 0.005 + k * 0.0003, -Math.cos(a) * r, false));
      p.scale.z = 0.5 + rnd() * 0.5;
      w.add(p);
    }
    // Ce qui ralentit : ronces en forêt, mares au marais, sable mou dans les dunes.
    const slow = (x: number, z: number, r: number) => this.slows.push({ x, z, r });
    if (b.id === 'foret') {
      scatter(90, 7, 60, 1.2, (x, z, k) => {
        const h = 4.5 + rnd() * 3.5;
        w.add(mesh(new THREE.CylinderGeometry(0.22, 0.34, h * 0.5, 7), 0x8a5f3c, x, h * 0.25, z),
          mesh(new THREE.ConeGeometry(1.5 + rnd() * 0.6, h * 0.75, 7), k % 2 ? 0x4f9a5c : 0x3f8552, x, h * 0.8, z),
          mesh(new THREE.ConeGeometry(1.0, h * 0.5, 7), k % 2 ? 0x5fae68 : 0x4f9a5c, x, h * 1.2, z));
        solid(x, z, 0.6);
      });
      scatter(22, 5, 42, 0.8, (x, z) => { const r = 0.35 + rnd() * 0.4; w.add(mesh(new THREE.IcosahedronGeometry(r, 0), 0x9a9a92, x, r * 0.4, z)); solid(x, z, r + 0.2); });
      scatter(16, 5, 40, 0.5, (x, z) => w.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 7), 0xe9dcc6, x, 0.15, z), mesh(new THREE.SphereGeometry(0.26, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe2604f, x, 0.3, z)));
      scatter(14, 10, 40, 2.2, (x, z) => {
        const g = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const a = rnd() * Math.PI * 2, r = rnd() * 1.8;
          const spike = mesh(new THREE.ConeGeometry(0.28, 0.9, 5), i % 2 ? 0x7a4a5a : 0x5f6a4a, Math.sin(a) * r, 0.35, Math.cos(a) * r);
          spike.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
          g.add(spike);
        }
        g.position.set(x, 0, z);
        w.add(g);
        slow(x, z, 2.1);
      });
      scatter(150, 2, 46, 0.2, (x, z, k) => tuft(x, z, k % 2 ? 0x6fae5a : 0x7fbf6a));
    } else if (b.id === 'marais') {
      scatter(26, 6, 44, 2.6, (x, z) => {
        const r = 1.6 + rnd() * 1.6;
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x6fb7c4, roughness: 0.15, flatShading: true }));
        pond.position.set(x, 0.02, z);
        pond.receiveShadow = true;
        w.add(flat(pond), flat(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 10), 0x5fae68, x + 0.5, 0.05, z + 0.2, false)), flat(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10), 0x6fbf78, x - 0.6, 0.05, z - 0.1, false)));
        slow(x, z, r);
      });
      scatter(60, 8, 60, 1.2, (x, z, k) => {
        const h = 3.5 + rnd() * 2.5;
        w.add(mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 6), 0x7a6a55, x, h / 2, z), mesh(new THREE.IcosahedronGeometry(1.5 + rnd(), 1), k % 2 ? 0x6fa27a : 0x5f946c, x, h + 0.5, z));
        solid(x, z, 0.5);
      });
      scatter(120, 2, 46, 0.2, (x, z, k) => {
        tuft(x, z, k % 2 ? 0x8fb86a : 0x7fa85a, 2.2);
        if (k % 4 === 0) w.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 6), 0x6b4a34, x, 1.05, z, false));
      });
    } else {
      scatter(16, 50, 75, 1, (x, z, k) => {
        const dune = flat(mesh(new THREE.SphereGeometry(7 + rnd() * 5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), k % 2 ? 0xf0dcae : 0xe6cd96, x, -0.3, z, false));
        dune.scale.y = 0.35 + rnd() * 0.2;
        w.add(dune);
      });
      scatter(40, 6, 55, 0.8, (x, z, k) => {
        const h = 1.2 + rnd() * 1.6;
        w.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, h, 8), 0x5f9a6a, x, h / 2, z));
        if (k % 2) w.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 6), 0x5f9a6a, x + 0.4, h * 0.55, z));
        solid(x, z, 0.5);
      });
      scatter(30, 5, 45, 0.8, (x, z) => { const r = 0.3 + rnd() * 0.5; w.add(mesh(new THREE.IcosahedronGeometry(r, 0), 0xc9a27a, x, r * 0.4, z)); solid(x, z, r + 0.2); });
      scatter(16, 9, 42, 2.4, (x, z) => { const r = 1.8 + rnd(); w.add(flat(mesh(new THREE.CylinderGeometry(r, r, 0.03, 12), 0xc9a86a, x, 0.02, z, false))); slow(x, z, r); });
      scatter(70, 2, 46, 0.2, (x, z, k) => tuft(x, z, k % 2 ? 0xb9b86a : 0xa9a85a, 0.9));
    }

    // À ramasser en marchant : des mottes d'argile et des pièces perdues, plus généreuses loin du camp.
    scatter(16, 8, 43, 0.6, (x, z, k) => {
      const kind = k % 2 ? 'clay' : 'coins';
      const far = Math.hypot(x, z);
      const obj = new THREE.Group();
      if (kind === 'clay') obj.add(mesh(new THREE.IcosahedronGeometry(0.26, 0), 0xb9744f, 0, 0.2, 0), mesh(new THREE.IcosahedronGeometry(0.16, 0), 0xc98360, 0.24, 0.12, 0.1));
      else {
        const coin = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12), 0xf2c94c, 0, 0.55, 0);
        coin.rotation.x = Math.PI / 2;
        obj.add(coin);
      }
      obj.position.set(x, 0, z);
      w.add(obj);
      this.pickups.push({ x, z, kind, n: kind === 'clay' ? (far > 26 ? 2 : 1) : Math.round(far / 5) * 5 + 10, obj, got: false });
    });

    // Le camp : une tente, un fanion, le feu. C'est là qu'il faut être quand la nuit tombe.
    const tent = mesh(new THREE.ConeGeometry(1.5, 1.9, 4), 0xe2804f, 0, 0.95, 0);
    tent.rotation.y = Math.PI / 4;
    w.add(tent, mesh(new THREE.BoxGeometry(0.5, 0.9, 0.05), 0x3a2a26, 0, 0.45, 1.08, false),
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6), 0x8a5f3c, 1.6, 2.1, -0.4), mesh(new THREE.BoxGeometry(0.9, 0.5, 0.03), 0xf2c94c, 2.06, 3.9, -0.4, false),
      mesh(new THREE.ConeGeometry(0.22, 0.5, 6), 0xff9a3c, -1.5, 0.3, 1.5, false));
    for (let i = 0; i < 6; i++) w.add(mesh(new THREE.IcosahedronGeometry(0.14, 0), 0x9a9a92, -1.5 + Math.sin(i) * 0.36, 0.08, 1.5 + Math.cos(i) * 0.36, false));
    w.add(flat(mesh(new THREE.CylinderGeometry(CAMP, CAMP, 0.03, 24), b.id === 'dunes' ? 0xf6e7c8 : 0xcfe0a8, 0, 0.012, 0, false)));
    solid(0, 0, 1.3);

    finish(w);
    // Ce qui est à plat sur le sol ne prend pas de contour encré : il ferait une bande noire.
    w.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.userData.flat) return;
      m.material = (m.material as THREE.Material).clone();
      m.material.userData.outlineParameters = { visible: false };
    });
  }

  // ---------- lecture pour l'interface ----------

  private screen(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const c = p.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const q = p.clone().project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (1 - (q.y * 0.5 + 0.5)) * this.canvas.clientHeight, ok: c.z < -0.3 };
  }

  /** Position écran de la plante à portée, pour y accrocher son étiquette. */
  nearRect(): { x: number; y: number } | null {
    const f = this.finds[this.near];
    if (!f) return null;
    const s = this.screen(f.pos.clone().setY(1.5));
    return s.ok ? s : null;
  }
  get nearHidden(): boolean {
    return !!this.finds[this.near]?.cover;
  }
  get nearId(): string {
    return this.finds[this.near]?.id ?? '';
  }
  get full(): boolean {
    return this.basket.length >= this.cap;
  }
  /** Distance au camp, en mètres. */
  get campDist(): number {
    return Math.hypot(this.pos.x, this.pos.z);
  }
  get atCamp(): boolean {
    return this.campDist < CAMP;
  }
  /** Angle du camp par rapport au regard : 0 droit devant, positif à droite. */
  get campAngle(): number {
    const a = Math.atan2(-this.pos.x, this.pos.z) - this.yaw;
    return Math.atan2(Math.sin(a), Math.cos(a));
  }
  /** 0 en plein jour, 1 à la nuit tombée. */
  get night(): number {
    return Math.max(0, Math.min(1, 1 - this.left / (TREK_TIME * 0.45)));
  }
  /** Part du jour qui reste, 0..1. */
  get day(): number {
    return this.left / this.total;
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
    // Jauge en cours : toucher, c'est couper.
    if (this.cut) { this.slice(); return; }
    const n = this.nearRect();
    const onPlant = !!n && Math.hypot(p.x - n.x, p.y - (n.y + 70)) < 120;
    this.down = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), rub: onPlant && this.nearHidden };
    if (!onPlant) this.stick = { x: p.x, y: p.y, dx: 0, dy: 0 };
    this.onChange();
  }

  private onMove(e: PointerEvent): void {
    const d = this.down;
    if (!d || !this.active) return;
    const p = this.at(e);
    if (d.rub) {
      // On frotte le fourré pour écarter ses branches.
      const f = this.finds[this.near];
      if (f?.cover) {
        f.rub += Math.hypot(p.x - d.x, p.y - d.y);
        f.cover.rotation.z = Math.sin(f.rub * 0.08) * 0.12;
        f.cover.scale.setScalar(1 - Math.min(0.35, f.rub / 900));
        if (f.rub > 320) {
          f.root.remove(f.cover);
          f.cover = null;
          f.root.children[0].visible = true;
          f.fly = -1;
          this.down = null;
          this.onEvent('reveal', f.id);
          this.onChange();
        }
      }
    } else if (this.stick) {
      this.stick.dx = Math.max(-70, Math.min(70, p.x - this.stick.x));
      this.stick.dy = Math.max(-70, Math.min(70, p.y - this.stick.y));
      this.onChange();
    }
    d.x = p.x; d.y = p.y;
  }

  private onUp(e: PointerEvent): void {
    const d = this.down;
    this.down = null;
    const hadStick = !!this.stick;
    this.stick = null;
    if (hadStick) this.onChange();
    if (!d || !this.active || this.ended || d.rub) return;
    const p = this.at(e);
    // Une touche brève sur la plante à portée : on sort le sécateur.
    if (Math.hypot(p.x - d.sx, p.y - d.sy) > 12 || performance.now() - d.t > 400) return;
    const f = this.finds[this.near];
    const n = this.nearRect();
    if (!f || f.cover || !n || Math.hypot(p.x - n.x, p.y - (n.y + 70)) > 130) return;
    if (this.full) { this.onChange(); return; }
    const zone = CUT_ZONE[SPECIES_BY_ID[f.id].rarity];
    this.cut = { pos: 0, dir: 1, mid: 0.3 + Math.random() * 0.4, zone, speed: 0.9 + (0.3 - zone) * 4 };
    const dir = f.pos.clone().sub(this.pos).setY(0).normalize();
    const a = Math.atan2(dir.x, -dir.z);
    this.aimYaw = this.yaw + Math.atan2(Math.sin(a - this.yaw), Math.cos(a - this.yaw));
    this.onChange();
  }

  /** Le coup de sécateur : dans le vert, coupe parfaite ; juste à côté, coupe correcte ; ailleurs, la plante est abîmée. */
  private slice(): void {
    const c = this.cut, f = this.finds[this.near];
    this.cut = null;
    if (!c || !f || f.taken) return;
    const off = Math.abs(c.pos - c.mid);
    f.taken = true;
    this.near = -1;
    this.aimYaw = null;
    if (off > c.zone / 2 + 0.13) {
      f.fly = 0.5;
      this.onEvent('miss', f.id);
    } else {
      f.fly = 1;
      this.basket.push(f.id);
      if (off <= c.zone / 2) { this.bonus.push(f.id); this.onEvent('perfect', f.id); }
      else this.onEvent('pick', f.id);
    }
    this.onChange();
  }

  /** Rentrer : sans risque au camp ; ailleurs, seulement quand la nuit vous y force. */
  goHome(): boolean {
    if (!this.active || this.ended || !this.atCamp) return false;
    this.finish();
    return true;
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.cut = null;
    this.stick = null;
    setTimeout(() => this.onEnd(), this.lost ? 1400 : 300);
  }

  // ---------- image ----------

  private frame = (now: number): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    const cam = this.camera;

    if (!this.ended) {
      const before = Math.ceil(this.left);
      this.left = Math.max(0, this.left - dt);
      if (Math.ceil(this.left) !== before) this.onChange();
      if (!this.dusk && this.left < 35) { this.dusk = true; this.onEvent('dusk'); }
      if (this.left <= 0) {
        if (!this.atCamp) {
          // Surpris par la nuit : on rentre à tâtons en semant la moitié du panier.
          this.lost = true;
          this.basket = this.basket.slice(0, Math.floor(this.basket.length / 2));
          this.onChange();
        }
        this.finish();
      }
    }

    // Marche : le pouce vers le haut avance, vers le bas recule, sur les côtés tourne.
    if (this.stick && !this.cut && !this.ended) {
      const s = this.stick;
      const turn = Math.abs(s.dx) < 8 ? 0 : s.dx / 70;
      const fwd = Math.abs(s.dy) < 8 ? 0 : -s.dy / 70;
      this.yaw += turn * 1.9 * dt;
      const slowed = this.slows.some((z) => Math.hypot(z.x - this.pos.x, z.z - this.pos.z) < z.r);
      if (slowed && !this.slowed) this.onEvent('slow');
      this.slowed = slowed;
      const v = fwd * (fwd > 0 ? SPEED : SPEED * 0.5) * this.speed * (slowed ? 0.35 : 1) * dt;
      this.pos.x += Math.sin(this.yaw) * v;
      this.pos.z += -Math.cos(this.yaw) * v;
      this.step += Math.abs(v);
      // On contourne les troncs, les rochers et la tente.
      for (const o of this.solids) {
        const dx = this.pos.x - o.x, dz = this.pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + 0.45;
        if (d < min && d > 0.001) { this.pos.x = o.x + (dx / d) * min; this.pos.z = o.z + (dz / d) * min; }
      }
      const far = Math.hypot(this.pos.x, this.pos.z);
      if (far > 46) { this.pos.x *= 46 / far; this.pos.z *= 46 / far; }
    }
    if (this.aimYaw !== null) {
      this.yaw += (this.aimYaw - this.yaw) * Math.min(1, dt * 5);
      if (Math.abs(this.aimYaw - this.yaw) < 0.005) this.aimYaw = null;
    }
    this.pitch += ((this.cut ? -0.32 : -0.05) - this.pitch) * Math.min(1, dt * 5);
    cam.position.set(this.pos.x, EYE + Math.sin(this.step * 2.4) * 0.04, this.pos.z);
    cam.rotation.set(this.pitch, -this.yaw, 0);
    cam.updateMatrixWorld(true);

    // On ramasse ce sur quoi on marche.
    for (const p of this.pickups) {
      if (p.got) { if (p.obj.visible) { p.obj.position.y += dt * 4; p.obj.scale.multiplyScalar(1 - Math.min(1, dt * 5)); if (p.obj.position.y > 1.6) p.obj.visible = false; } continue; }
      if (p.kind === 'coins') p.obj.rotation.y = t * 2.5;
      if (this.ended || Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 1.3) continue;
      p.got = true;
      this.loot[p.kind] += p.n;
      this.onEvent(p.kind, String(p.n));
    }
    this.glints.forEach((g, i) => { g.rotation.y = t * 0.6 + i; g.visible = !!g.parent?.visible && g.parent.scale.x > 0.5; });

    // La plante à portée de main : la plus proche, devant soi.
    if (!this.cut) {
      let best = -1, bestD = REACH;
      this.finds.forEach((f, i) => {
        if (f.taken) return;
        const d = Math.hypot(f.pos.x - this.pos.x, f.pos.z - this.pos.z);
        if (d >= bestD) return;
        // À portée seulement si on l'a devant les yeux.
        const s = this.screen(f.pos.clone().setY(0.8));
        if (s.ok && s.x > 30 && s.x < this.canvas.clientWidth - 30) { bestD = d; best = i; }
      });
      if (best !== this.near) { this.near = best; this.onChange(); }
    }

    // Jauge de coupe : le curseur va et vient.
    if (this.cut) {
      const c = this.cut;
      c.pos += c.dir * c.speed * dt;
      if (c.pos > 1) { c.pos = 1; c.dir = -1; }
      if (c.pos < 0) { c.pos = 0; c.dir = 1; }
    }

    // Le soir tombe : la lumière baisse et rougit, la brume se referme.
    const n = this.night;
    if (this.sun && this.hemi) {
      this.sun.intensity = 1.9 - n * 1.5;
      this.sun.color.setHSL(0.11 - n * 0.07, 0.9, 0.82 - n * 0.2);
      this.hemi.intensity = 1.2 - n * 0.75;
      this.sun.position.set(this.pos.x + 8 + n * 14, 14 - n * 9, this.pos.z + 6);
      this.sun.target.position.set(this.pos.x, 0, this.pos.z);
      this.sun.target.updateMatrixWorld();
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set(BIOMES[this.biome].fog).lerp(new THREE.Color(0x2a2a4a), n * 0.85);
    fog.far = 50 - n * 22;

    this.sway.forEach((g, i) => { g.rotation.z = Math.sin(t * 1.4 + i) * 0.12; });
    for (const f of this.finds) {
      if (f.fly > 0) {
        // Cueillie : la plante s'envole vers le panier.
        f.fly = Math.max(0, f.fly - dt * 2.2);
        f.root.position.y = (1 - f.fly) * 1.6;
        f.root.scale.setScalar(Math.max(0.001, f.fly));
        if (f.fly === 0) f.root.visible = false;
      } else if (f.fly < 0) {
        // Découverte : elle se déplie.
        f.fly = Math.min(0, f.fly + dt * 2.5);
        f.root.scale.setScalar(1 + Math.sin(-f.fly * Math.PI) * 0.25);
      } else if (!f.taken) f.root.rotation.z = Math.sin(t * 1.2 + f.pos.x) * 0.03;
    }
    if (this.outline) this.outline.render(this.scene, cam);
    else this.renderer!.render(this.scene, cam);
    // L'étiquette de la plante proche, la jauge et la boussole suivent chaque image.
    this.onChange();
  };
}
