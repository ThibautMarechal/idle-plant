import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { CUT_ZONE, SPECIES_BY_ID, TREK_TIME } from './data';
import { buildPlant } from './plants3d';
import { artStyle, finish, mat } from './styles';

interface Find {
  id: string;
  tier: number;
  /** Point au sol et verticale du lieu. */
  pos: THREE.Vector3;
  up: THREE.Vector3;
  root: THREE.Group;
  /** Fourré qui cache la plante : on le frotte pour l'écarter avant de pouvoir cueillir. */
  cover: THREE.Group | null;
  rub: number;
  taken: boolean;
  fly: number;
}
interface Spot { p: THREE.Vector3; r: number }

/** Rayon de la planète, et limites des régions en mètres de marche depuis la serre. */
const R = 14;
export const RINGS = [13.5, 27, 40.5];
/** Distance à laquelle on peut cueillir, et rayon du parvis de la serre. */
const REACH = 2.4;
export const CAMP = 4.6;
const SPEED = 4.2;
const GROUND = [0x8fc27a, 0x6fa98a, 0xe9d3a0];
const UP = new THREE.Vector3(0, 1, 0);

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
/** Point de la planète à `r` mètres de marche de la serre, dans la direction `a`. */
function sph(r: number, a: number, h = 0): THREE.Vector3 {
  const f = r / R;
  return new THREE.Vector3(Math.sin(f) * Math.sin(a), Math.cos(f), -Math.sin(f) * Math.cos(a)).multiplyScalar(R + h);
}

/**
 * L'expédition : une petite planète ronde dont la serre occupe le pôle. On y promène un personnage vu de dessus,
 * le pouce servant de manette. La forêt entoure la serre, le marais vient ensuite, les dunes sont à l'autre bout :
 * plus on s'éloigne, plus les plantes sont rares, mais il faut être rentré à la serre avant la nuit,
 * sinon on perd la moitié du panier. Chaque plante se coupe d'un geste d'adresse sur une jauge.
 * La scène ne touche jamais à la partie : l'interface lit le panier au retour.
 */
export class Planet {
  active = false;
  basket: string[] = [];
  /** Une graine en plus par coupe parfaite. */
  bonus: string[] = [];
  cap = 4;
  left = 0;
  /** Plante à portée de main (-1 : aucune). */
  near = -1;
  /** Région où l'on se trouve : 0 forêt, 1 marais, 2 dunes. */
  biome = 0;
  /** Jauge de coupe en cours : position du curseur 0..1, zone verte centrée sur `mid`. */
  cut: { pos: number; dir: number; mid: number; zone: number; speed: number } | null = null;
  /** Manette sous le pouce, en pixels : origine et écart. */
  stick: { x: number; y: number; dx: number; dy: number } | null = null;
  /** Ramassé en chemin : argile et pièces. */
  loot = { clay: 0, coins: 0 };
  /** Vrai si la nuit est tombée loin de la serre. */
  lost = false;
  slowed = false;
  onChange: () => void = () => {};
  onEvent: (kind: 'pick' | 'perfect' | 'miss' | 'reveal' | 'slow' | 'dusk' | 'clay' | 'coins' | 'wall' | 'region', id?: string) => void = () => {};
  onEnd: () => void = () => {};

  private total = TREK_TIME;
  private speed = 1;
  /** Nombre de régions ouvertes : au-delà, une mer de nuages barre le passage. */
  private reach = 1;
  private renderer: THREE.WebGLRenderer | null = null;
  private outline: OutlineEffect | null = null;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200);
  private finds: Find[] = [];
  private solids: Spot[] = [];
  private slows: Spot[] = [];
  private pickups: { p: THREE.Vector3; kind: 'clay' | 'coins'; n: number; obj: THREE.Object3D; got: boolean; lift: number }[] = [];
  private glints: THREE.Mesh[] = [];
  private sway: THREE.Object3D[] = [];
  private clouds = new THREE.Group();
  private hero = new THREE.Group();
  /** Position (vecteur unité) et « haut de l'écran » (tangente) du personnage. */
  private p = new THREE.Vector3(0, 1, 0);
  private u = new THREE.Vector3(0, 0, -1);
  private face = new THREE.Vector3(0, 0, -1);
  private zoom = 66;
  /** Secondes de vue d'ensemble avant que la caméra ne plonge. */
  private intro = 0;
  private raf = 0;
  private last = 0;
  private down: { x: number; y: number; sx: number; sy: number; t: number; rub: boolean } | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private amb: THREE.AmbientLight | null = null;
  private ended = false;
  private dusk = false;
  private step = 0;
  private wallAt = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.add(this.world);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => this.onUp(e as PointerEvent));
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
  }

  open(finds: { id: string; hidden: boolean; tier: number; ring: number }[], setup: { time: number; speed: number; cap: number; reach: number }): void {
    this.total = setup.time;
    this.speed = setup.speed;
    this.reach = Math.max(1, setup.reach);
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
    this.cap = setup.cap;
    this.basket = [];
    this.bonus = [];
    this.left = setup.time;
    this.near = -1;
    this.biome = 0;
    this.cut = null;
    this.stick = null;
    this.down = null;
    this.ended = false;
    this.lost = false;
    this.dusk = false;
    this.slowed = false;
    // On sort de la serre, dos à elle : on la voit en bas de l'écran.
    this.p.copy(sph(3.3, 0)).normalize();
    this.u.copy(sph(4.4, 0)).sub(sph(3.3, 0)).normalize();
    this.face.copy(this.u);
    this.zoom = 66;
    this.intro = 1.3;
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
    this.clouds = new THREE.Group();
    this.hero = new THREE.Group();
  }

  resize(): void {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- décor ----------

  /** Pose un objet debout sur la planète, tourné de `spin` autour de sa verticale. */
  private put(obj: THREE.Object3D, r: number, a: number, spin = 0, h = 0): THREE.Vector3 {
    const pos = sph(r, a, h);
    obj.position.copy(pos);
    obj.quaternion.setFromUnitVectors(UP, pos.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
    this.world.add(obj);
    return pos;
  }

  private build(list: { id: string; hidden: boolean; tier: number; ring: number }[]): void {
    const w = this.world;
    const rnd = Math.random;
    const group = (...parts: THREE.Object3D[]) => { const g = new THREE.Group(); g.add(...parts); return g; };
    this.amb = new THREE.AmbientLight(0xffffff, 1.35);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.002;
    this.sun = sun;
    w.add(this.amb, sun, sun.target);

    // Le sol : une boule peinte par régions, aux frontières ondulées.
    const geo = new THREE.SphereGeometry(R, 72, 48);
    const pos = geo.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const cs = GROUND.map((c) => new THREE.Color(c));
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / R, az = Math.atan2(pos.getX(i), -pos.getZ(i));
      const d = Math.acos(Math.max(-1, Math.min(1, y))) * R + Math.sin(az * 5) * 0.9 + Math.sin(az * 11 + 1) * 0.4;
      const k = d < RINGS[0] ? 0 : d < RINGS[1] ? 1 : 2;
      c.copy(cs[k]);
      // Taches plus claires ou plus sombres, pour que le sol ne soit pas un aplat.
      c.offsetHSL(0, 0, (Math.sin(pos.getX(i) * 1.7) * Math.sin(pos.getZ(i) * 1.3 + pos.getY(i)) > 0.35 ? 0.035 : 0) - (d < CAMP ? -0.08 : 0));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const gm = mat(0xffffff).clone() as THREE.MeshToonMaterial;
    gm.vertexColors = true;
    gm.userData.outlineParameters = { thickness: 0.004 };
    const ground = new THREE.Mesh(geo, gm);
    ground.receiveShadow = true;
    ground.userData.raw = true;
    w.add(ground);

    // Les plantes sauvages d'abord : le décor s'installe autour d'elles.
    const tierPart: [number, number][] = [[0.38, 0.62], [0.55, 0.85], [0.82, 0.97]];
    const count: Record<string, number> = {};
    this.finds = list.map((f) => {
      const key = `${f.ring}-${f.tier}`;
      const k = count[key] = (count[key] ?? -1) + 1;
      const n = list.filter((o) => o.ring === f.ring && o.tier === f.tier).length;
      const a = (k / n) * Math.PI * 2 + f.tier * 0.9 + f.ring * 0.4 + (rnd() - 0.5) * 0.5;
      const r0 = f.ring ? RINGS[f.ring - 1] : 0, span = RINGS[f.ring] - r0;
      // Près de la serre, les plantes communes sont à deux pas ; les paliers rares touchent le bord de la région.
      const r = r0 + span * (tierPart[f.tier][0] + rnd() * (tierPart[f.tier][1] - tierPart[f.tier][0])) - (f.ring === 0 && f.tier === 0 ? 1.5 : 0);
      const root = new THREE.Group();
      const plant = buildPlant(SPECIES_BY_ID[f.id], 4, 1, 0);
      plant.scale.setScalar(1.25);
      root.add(plant, mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.08, 10), 0x6b4a34, 0, 0.03, 0, false));
      let cover: THREE.Group | null = null;
      if (f.hidden) {
        cover = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const ca = (i / 5) * Math.PI * 2;
          cover.add(mesh(new THREE.IcosahedronGeometry(0.5 + rnd() * 0.2, 1), i % 2 ? 0x4f9a5c : 0x5fae68, Math.sin(ca) * 0.4, 0.5 + (i % 2) * 0.2, Math.cos(ca) * 0.4));
        }
        cover.add(mesh(new THREE.IcosahedronGeometry(0.55, 1), 0x6fbf78, 0, 0.95, 0));
        root.add(cover);
        plant.visible = false;
      }
      // Une lueur monte des plantes rares : on la voit dépasser de l'horizon.
      if (f.tier > 0) {
        const glint = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.4, 9, 8, 1, true), new THREE.MeshBasicMaterial({ color: f.tier === 2 ? 0xffd84d : 0xbfe9ff, transparent: true, opacity: f.tier === 2 ? 0.4 : 0.26, depthWrite: false, side: THREE.DoubleSide }));
        glint.position.y = 4.5;
        glint.userData.raw = true;
        root.add(glint);
        this.glints.push(glint);
      }
      const at = this.put(root, r, a, rnd() * 6);
      return { id: f.id, tier: f.tier, pos: at, up: at.clone().normalize(), root, cover, rub: 0, taken: false, fly: 0 };
    });

    // Place libre : ni sur le parvis de la serre, ni sur une plante.
    const free = (q: THREE.Vector3, r: number) => this.finds.every((f) => f.pos.distanceTo(q) > r + 1.5) && this.solids.every((s) => s.p.distanceTo(q) > r + s.r);
    const scatter = (n: number, r0: number, r1: number, size: number, make: (r: number, a: number, k: number) => void) => {
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 6; tries++) {
          const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0);
          if (r < CAMP + size + 0.6 || !free(sph(r, a), size)) continue;
          make(r, a, k);
          break;
        }
      }
    };
    const solid = (r: number, a: number, size: number) => this.solids.push({ p: sph(r, a), r: size });
    const slow = (r: number, a: number, size: number) => this.slows.push({ p: sph(r, a), r: size });
    const flat = (m: THREE.Mesh) => { m.userData.flat = true; return m; };
    const tuft = (r: number, a: number, color: number, s = 1) => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blade = mesh(new THREE.ConeGeometry(0.05 * s, 0.45 * s, 4), color, (i - 1) * 0.07 * s, 0.22 * s, 0, false);
        blade.rotation.z = (i - 1) * 0.35;
        g.add(blade);
      }
      this.put(group(g), r, a, rnd() * 6);
      this.sway.push(g);
    };
    const rock = (r: number, a: number, color: number) => {
      const s = 0.3 + rnd() * 0.45;
      this.put(group(mesh(new THREE.IcosahedronGeometry(s, 0), color, 0, s * 0.4, 0)), r, a, rnd() * 6);
      solid(r, a, s + 0.15);
    };
    const [F, M, D] = RINGS;

    // Forêt : sapins, rochers, champignons, et des ronces qui ralentissent.
    scatter(46, 4, F - 0.8, 0.9, (r, a, k) => {
      const h = 1.7 + rnd() * 1.1;
      this.put(group(mesh(new THREE.CylinderGeometry(0.16, 0.24, h * 0.5, 7), 0x8a5f3c, 0, h * 0.25, 0),
        mesh(new THREE.ConeGeometry(0.8 + rnd() * 0.25, h * 0.75, 7), k % 2 ? 0x4f9a5c : 0x3f8552, 0, h * 0.8, 0),
        mesh(new THREE.ConeGeometry(0.55, h * 0.5, 7), k % 2 ? 0x5fae68 : 0x4f9a5c, 0, h * 1.2, 0)), r, a, rnd() * 6);
      solid(r, a, 0.45);
    });
    scatter(12, 4, F, 0.7, (r, a) => rock(r, a, 0x9a9a92));
    scatter(12, 4, F, 0.4, (r, a) => this.put(group(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 7), 0xe9dcc6, 0, 0.13, 0), mesh(new THREE.SphereGeometry(0.24, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe2604f, 0, 0.26, 0)), r, a));
    scatter(7, 6, F - 1.5, 1.7, (r, a) => {
      const g = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const sa = rnd() * Math.PI * 2, sr = rnd() * 1.3;
        const spike = mesh(new THREE.ConeGeometry(0.24, 0.8, 5), i % 2 ? 0x7a4a5a : 0x5f6a4a, Math.sin(sa) * sr, 0.3, Math.cos(sa) * sr);
        spike.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
        g.add(spike);
      }
      this.put(g, r, a);
      slow(r, a, 1.6);
    });
    scatter(70, 2, F, 0.2, (r, a, k) => tuft(r, a, k % 2 ? 0x6fae5a : 0x7fbf6a));

    // Marais : des mares où l'on patauge, des arbres à grosse tête, des roseaux.
    scatter(12, F + 1.8, M - 1.8, 2.0, (r, a) => {
      const s = 1.3 + rnd() * 0.7;
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(s, s, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x6fc0d0, roughness: 0.15, flatShading: true }));
      pond.position.y = 0.06;
      pond.receiveShadow = true;
      this.put(group(flat(pond), flat(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 10), 0x5fae68, 0.45, 0.1, 0.2, false)), flat(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10), 0x6fbf78, -0.5, 0.1, -0.1, false))), r, a, rnd() * 6);
      slow(r, a, s);
    });
    scatter(30, F + 0.8, M - 0.8, 0.9, (r, a, k) => {
      const h = 1.5 + rnd() * 0.9;
      this.put(group(mesh(new THREE.CylinderGeometry(0.12, 0.24, h, 6), 0x7a6a55, 0, h / 2, 0), mesh(new THREE.IcosahedronGeometry(0.8 + rnd() * 0.35, 1), k % 2 ? 0x6fa27a : 0x5f946c, 0, h + 0.4, 0)), r, a);
      solid(r, a, 0.4);
    });
    scatter(60, F, M, 0.2, (r, a, k) => tuft(r, a, k % 2 ? 0x8fb86a : 0x7fa85a, 2));

    // Dunes : cactus, pierres chaudes, bosses de sable et plaques de sable mou.
    scatter(9, M + 1.5, D - 1, 1.6, (r, a) => { const s = 1.3 + rnd() * 0.6; this.put(group(flat(mesh(new THREE.CylinderGeometry(s, s, 0.04, 12), 0xc9a86a, 0, 0.07, 0, false))), r, a); slow(r, a, s); });
    scatter(8, M + 1, D + 2, 1.6, (r, a, k) => {
      const dune = flat(mesh(new THREE.SphereGeometry(1.8 + rnd(), 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), k % 2 ? 0xf0dcae : 0xe6cd96, 0, -0.1, 0, false));
      dune.scale.y = 0.35;
      this.put(group(dune), r, a);
    });
    scatter(22, M + 0.8, D + 2.5, 0.8, (r, a, k) => {
      const h = 1.0 + rnd() * 1.2;
      const g = group(mesh(new THREE.CylinderGeometry(0.2, 0.22, h, 8), 0x5f9a6a, 0, h / 2, 0));
      if (k % 2) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), 0x5f9a6a, 0.36, h * 0.55, 0));
      this.put(g, r, a, rnd() * 6);
      solid(r, a, 0.4);
    });
    scatter(14, M + 0.5, D + 2.5, 0.7, (r, a) => rock(r, a, 0xc9a27a));
    scatter(36, M, D + 2.5, 0.2, (r, a, k) => tuft(r, a, k % 2 ? 0xb9b86a : 0xa9a85a, 0.9));

    // À ramasser en marchant : des mottes d'argile et des pièces perdues, plus généreuses loin de la serre.
    const edge = RINGS[this.reach - 1];
    scatter(6 + this.reach * 4, 6, edge - 1, 0.6, (r, a, k) => {
      const kind = k % 2 ? 'clay' : 'coins';
      const obj = new THREE.Group();
      if (kind === 'clay') obj.add(mesh(new THREE.IcosahedronGeometry(0.26, 0), 0xb9744f, 0, 0.2, 0), mesh(new THREE.IcosahedronGeometry(0.16, 0), 0xc98360, 0.24, 0.12, 0.1));
      else {
        const coin = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), 0xf2c94c, 0, 0.55, 0);
        coin.rotation.x = Math.PI / 2;
        obj.add(coin);
      }
      const p = this.put(obj, r, a);
      this.pickups.push({ p, kind, n: kind === 'clay' ? (r > RINGS[1] ? 2 : 1) : Math.round(r / 5) * 5 + 10, obj, got: false, lift: 0 });
    });

    // Au bord de la dernière région ouverte, une mer de nuages cache la suite.
    if (this.reach < RINGS.length) {
      const n = Math.round((Math.sin(edge / R) * R * Math.PI * 2) / 1.5);
      for (let k = 0; k < n; k++) {
        const s = 0.9 + rnd() * 0.5;
        this.put(group(mesh(new THREE.IcosahedronGeometry(s, 1), 0xfdfdfd, 0, s * 0.5, 0, false), mesh(new THREE.IcosahedronGeometry(s * 0.7, 1), 0xeef4f8, 0.5, s * 0.9, 0.9, false)), edge + 0.9 + rnd() * 0.5, (k / n) * Math.PI * 2, rnd() * 6);
      }
    }

    // La serre, au pôle : un pavillon de verre. C'est là qu'il faut être quand la nuit tombe.
    const house = group(mesh(new THREE.CylinderGeometry(1.75, 1.85, 0.35, 8), 0xf4efe4, 0, 0.17, 0), mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.5, 8), 0xbfe9f2, 0, 1.1, 0),
      mesh(new THREE.ConeGeometry(2.0, 1.3, 8), 0x7fd0c0, 0, 2.5, 0), mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.12, 8), 0xfdfaf2, 0, 1.87, 0),
      mesh(new THREE.SphereGeometry(0.2, 8, 6), 0xf2c94c, 0, 3.25, 0), mesh(new THREE.BoxGeometry(0.75, 1.25, 0.1), 0x3f8a6a, 0, 0.95, -1.5, false));
    for (let i = 0; i < 8; i++) {
      const pa = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const rib = mesh(new THREE.BoxGeometry(0.1, 0.1, 2.25), 0xfdfaf2, Math.sin(pa) * 0.95, 2.52, Math.cos(pa) * 0.95, false);
      rib.rotation.set(0.56, pa, 0, 'YXZ');
      house.add(mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), 0xfdfaf2, Math.sin(pa) * 1.62, 1.1, Math.cos(pa) * 1.62), rib);
    }
    house.scale.setScalar(1.25);
    this.put(house, 0, 0);
    this.solids.push({ p: sph(0, 0), r: 2.3 });
    for (let i = 0; i < 5; i++) this.put(group(flat(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 8), 0xd9cdb8, 0, 0.04, 0, false))), 3.0 + i * 0.7, (i % 2) * 0.12 - 0.06);

    // Le personnage : chapeau de paille, sac à dos.
    this.hero = group(mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.75, 9), 0x4f8ad6, 0, 0.42, 0), mesh(new THREE.SphereGeometry(0.24, 10, 8), 0xf3c9a5, 0, 1.0, 0),
      mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 12), 0xf2d27a, 0, 1.17, 0), mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 10), 0xf2d27a, 0, 1.27, 0),
      mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), 0xb5654a, 0, 0.5, 0.26));
    w.add(this.hero);

    // Des nuages tournent lentement autour de la planète.
    this.clouds = new THREE.Group();
    for (let k = 0; k < 14; k++) {
      const s = 1.2 + rnd() * 1.2;
      const puff = group(mesh(new THREE.IcosahedronGeometry(s, 1), 0xffffff, 0, 0, 0, false), mesh(new THREE.IcosahedronGeometry(s * 0.7, 1), 0xffffff, s * 0.9, -s * 0.15, 0, false), mesh(new THREE.IcosahedronGeometry(s * 0.6, 1), 0xf2f8fb, -s * 0.85, -s * 0.2, 0.2, false));
      const d = new THREE.Vector3().setFromSphericalCoords(R + 7 + rnd() * 3, 0.5 + rnd() * 2.1, rnd() * Math.PI * 2);
      puff.position.copy(d);
      puff.quaternion.setFromUnitVectors(UP, d.clone().normalize());
      this.clouds.add(puff);
    }
    w.add(this.clouds);

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

  private screen(q: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const c = q.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const s = q.clone().project(this.camera);
    return { x: (s.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (1 - (s.y * 0.5 + 0.5)) * this.canvas.clientHeight, ok: c.z < -0.3 };
  }

  /** Position écran de la plante à portée, pour y accrocher son étiquette. */
  nearRect(): { x: number; y: number } | null {
    const f = this.finds[this.near];
    if (!f) return null;
    const s = this.screen(f.pos.clone().addScaledVector(f.up, 1.7));
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
  /** Distance à la serre, en mètres de marche. */
  get campDist(): number {
    return Math.acos(Math.max(-1, Math.min(1, this.p.y))) * R;
  }
  get atCamp(): boolean {
    return this.campDist < CAMP;
  }
  /** Angle de la serre à l'écran : 0 vers le haut, positif à droite. */
  get campAngle(): number {
    const to = UP.clone().addScaledVector(this.p, -this.p.y);
    return Math.atan2(to.dot(new THREE.Vector3().crossVectors(this.u, this.p)), to.dot(this.u));
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
  private onPlant(p: { x: number; y: number }): boolean {
    const f = this.finds[this.near];
    if (!f) return false;
    const s = this.screen(f.pos.clone().addScaledVector(f.up, 0.6));
    return s.ok && Math.hypot(p.x - s.x, p.y - s.y) < 78;
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || this.ended) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.at(e);
    // Jauge en cours : toucher, c'est couper.
    if (this.cut) { this.slice(); return; }
    const onPlant = this.onPlant(p);
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
      const dx = p.x - this.stick.x, dy = p.y - this.stick.y, len = Math.hypot(dx, dy), k = len > 70 ? 70 / len : 1;
      this.stick.dx = dx * k;
      this.stick.dy = dy * k;
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
    if (!f || f.cover || !this.onPlant(p)) return;
    if (this.full) { this.onChange(); return; }
    const zone = CUT_ZONE[SPECIES_BY_ID[f.id].rarity];
    this.cut = { pos: 0, dir: 1, mid: 0.3 + Math.random() * 0.4, zone, speed: 0.9 + (0.3 - zone) * 4 };
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

  /** Rentrer : sans risque à la serre ; ailleurs, seulement quand la nuit vous y force. */
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
    const p = this.p, u = this.u;

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

    // Marche : le personnage va là où pousse le pouce.
    const right = new THREE.Vector3().crossVectors(u, p);
    let moving = false;
    if (this.stick && !this.cut && !this.ended) {
      const sx = this.stick.dx / 70, sy = -this.stick.dy / 70, len = Math.hypot(sx, sy);
      if (len > 0.12) {
        moving = true;
        const here = p.clone().multiplyScalar(R);
        const slowed = this.slows.some((z) => z.p.distanceTo(here) < z.r);
        if (slowed && !this.slowed) this.onEvent('slow');
        this.slowed = slowed;
        const dir = right.clone().multiplyScalar(sx / len).addScaledVector(u, sy / len);
        const v = Math.min(1, len) * SPEED * this.speed * (slowed ? 0.35 : 1) * dt;
        this.face.copy(dir);
        this.step += v;
        const q = here.addScaledVector(dir, v);
        // On contourne les troncs, les rochers et la serre.
        for (const o of this.solids) {
          const d = q.distanceTo(o.p), min = o.r + 0.4;
          if (d < min && d > 0.001) q.addScaledVector(q.clone().sub(o.p).normalize(), min - d);
        }
        q.normalize();
        // Le bout du monde connu : la mer de nuages, ou l'autre pôle.
        const lim = (RINGS[this.reach - 1] - 0.6) / R, f = Math.acos(Math.max(-1, Math.min(1, q.y)));
        if (f > lim) {
          const flat = new THREE.Vector3(q.x, 0, q.z).normalize();
          q.set(flat.x * Math.sin(lim), Math.cos(lim), flat.z * Math.sin(lim));
          if (this.reach < RINGS.length && now - this.wallAt > 6000) { this.wallAt = now; this.onEvent('wall'); }
        }
        p.copy(q);
        u.addScaledVector(p, -u.dot(p)).normalize();
        this.face.addScaledVector(p, -this.face.dot(p)).normalize();
        const ring = this.campDist < RINGS[0] ? 0 : this.campDist < RINGS[1] ? 1 : 2;
        if (ring !== this.biome) { this.biome = ring; this.onEvent('region', String(ring)); }
      }
    }
    // Le personnage, debout sur la planète, tourné vers là où il va.
    const f = this.finds[this.near];
    if (this.cut && f) this.face.copy(f.pos).sub(p.clone().multiplyScalar(R)).addScaledVector(p, -this.face.dot(p)).normalize();
    const hz = this.face.clone().negate(), hx = new THREE.Vector3().crossVectors(p, hz).normalize();
    this.hero.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(hx, p, hz));
    this.hero.position.copy(p).multiplyScalar(R + (moving ? Math.abs(Math.sin(this.step * 2.6)) * 0.12 : 0));

    // La caméra : de très haut au départ (on voit toute la planète), puis elle plonge derrière le personnage.
    this.intro = Math.max(0, this.intro - dt);
    const goal = this.intro > 0 ? 66 : this.cut ? 8.5 : this.ended ? 30 : 13;
    this.zoom += (goal - this.zoom) * Math.min(1, dt * (this.zoom > 16 && !this.ended ? 1.6 : 3));
    const z = this.zoom, far = Math.max(0, Math.min(1, (z - 16) / 34));
    // De loin, on regarde la planète entière ; de près, le personnage, un peu en avant de lui.
    cam.position.copy(p).multiplyScalar(R + z).addScaledVector(u, -z * 0.5 * (1 - far));
    cam.up.copy(far > 0.5 ? u : p);
    cam.lookAt(p.clone().multiplyScalar((R + 0.6) * (1 - far)).addScaledVector(u, 1.6 * (1 - far)));
    cam.updateMatrixWorld(true);

    // On ramasse ce sur quoi on marche.
    const here = p.clone().multiplyScalar(R);
    for (const k of this.pickups) {
      if (k.got) { if (k.obj.visible) { k.lift += dt * 4; k.obj.position.copy(k.p).addScaledVector(k.p.clone().normalize(), k.lift); k.obj.scale.multiplyScalar(1 - Math.min(1, dt * 5)); if (k.lift > 1.6) k.obj.visible = false; } continue; }
      if (k.kind === 'coins') k.obj.rotateY(dt * 2.5);
      if (this.ended || k.p.distanceTo(here) > 1.2) continue;
      k.got = true;
      this.loot[k.kind] += k.n;
      this.onEvent(k.kind, String(k.n));
    }
    this.glints.forEach((g, i) => { g.rotation.y = t * 0.6 + i; g.visible = this.zoom < 20 && !!g.parent?.visible && g.parent.scale.x > 0.5; });
    this.clouds.rotation.y = t * 0.02;

    // La plante à portée de main : la plus proche.
    if (!this.cut) {
      let best = -1, bestD = REACH;
      this.finds.forEach((fd, i) => {
        if (fd.taken) return;
        const d = fd.pos.distanceTo(here);
        if (d < bestD) { bestD = d; best = i; }
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

    // Le soir tombe : la lumière baisse et rougit.
    const n = this.night;
    if (this.sun && this.amb) {
      this.sun.intensity = 1.7 - n * 1.3;
      this.sun.color.setHSL(0.11 - n * 0.07, 0.9, 0.82 - n * 0.2);
      this.amb.intensity = 1.35 - n * 0.8;
      this.sun.position.copy(here).addScaledVector(p, 16 - n * 9).addScaledVector(right, 9 + n * 10).addScaledVector(u, -6);
      this.sun.target.position.copy(here);
      this.sun.target.updateMatrixWorld();
    }

    this.sway.forEach((g, i) => { g.rotation.z = Math.sin(t * 1.4 + i) * 0.12; });
    for (const fd of this.finds) {
      if (fd.fly > 0) {
        // Cueillie : la plante s'envole vers le panier.
        fd.fly = Math.max(0, fd.fly - dt * 2.2);
        fd.root.position.copy(fd.pos).addScaledVector(fd.up, (1 - fd.fly) * 1.6);
        fd.root.scale.setScalar(Math.max(0.001, fd.fly));
        if (fd.fly === 0) fd.root.visible = false;
      } else if (fd.fly < 0) {
        // Découverte : elle se déplie.
        fd.fly = Math.min(0, fd.fly + dt * 2.5);
        fd.root.scale.setScalar(1 + Math.sin(-fd.fly * Math.PI) * 0.25);
      }
    }
    if (this.outline) this.outline.render(this.scene, cam);
    else this.renderer!.render(this.scene, cam);
    // L'étiquette de la plante proche, la jauge et la boussole suivent chaque image.
    this.onChange();
  };
}
