import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOMES, LAND_BIOMES, SPECIES_BY_ID, TREK_TIME } from './data';
import type { TrekSetup } from './sim';
import { buildPlant } from './plants3d';
import { artStyle, finish, mat } from './styles';

/** Un objet du monde : sa place sur la carte, et le groupe qu'on enroule sur la planète. */
interface Thing { x: number; z: number; obj: THREE.Object3D; spin: number }
interface Find {
  id: string;
  tier: number;
  thing: Thing;
  /** Ce qui s'anime (envol, dépliage) sans gêner l'enroulement. */
  inner: THREE.Group;
  /** Fourré qui cache la plante : on le frotte pour l'écarter avant de pouvoir cueillir. */
  cover: THREE.Group | null;
  rub: number;
  taken: boolean;
  fly: number;
}
interface Spot { x: number; z: number; r: number }

/**
 * Rayon de la boule qu'on voit sous ses pieds, et limites des régions sur la carte (mètres depuis la serre).
 * Le monde est une grande carte plate ; seule l'image est enroulée, comme dans une vidéo « petite planète ».
 */
const R = 14;
export const RINGS = [30, 60, 92];
/** Au-delà de cet angle, un objet est derrière la planète : on ne le dessine pas. De près, l'horizon est bien plus court. */
const VIS = 2.3;
const VIS_NEAR = 1.5;
/** Distance à laquelle on peut cueillir, et rayon du parvis de la serre. */
const REACH = 2.4;
export const CAMP = 4.6;
const SPEED = 4.4;
/**
 * Teinte du décor, par continent et par région : les mêmes arbres et rochers prennent les couleurs du lieu.
 * [couleur vers laquelle on tire, force, saturation ajoutée]
 */
const TINTS: ([number, number, number] | null)[][] = [
  [null, null, null],
  [[0x2f9a4a, 0.12, 0.04], [0x2f8a7a, 0.14, 0.03], [0x3c3436, 0.72, -0.08]],
  [[0xdfeaf0, 0.2, -0.05], [0xd9d8b8, 0.4, -0.05], [0xffffff, 0.68, 0]],
];
let TINT: [number, number, number] | null = null;
const _t1 = new THREE.Color(), _t2 = new THREE.Color();
function tinted(color: number): number {
  if (!TINT) return color;
  _t1.setHex(color).lerp(_t2.setHex(TINT[0]), TINT[1]);
  if (TINT[2]) _t1.offsetHSL(0, TINT[2], 0);
  return _t1.getHex();
}
const MIST = new THREE.Color(0xf4f8fa);
const UP = new THREE.Vector3(0, 1, 0);
const WATER = new THREE.MeshStandardMaterial({ color: 0x6fc0d0, roughness: 0.15, flatShading: true });

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(tinted(color)));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}
/** Une calotte qui épouse la planète : mare, plaque de sable. `s` est son rayon au sol, `h` sa hauteur au-dessus du sol. */
const caps = new Map<string, THREE.BufferGeometry>();
function cap(s: number, h: number): THREE.BufferGeometry {
  const key = `${s.toFixed(1)}-${h}`;
  let g = caps.get(key);
  if (!g) { g = new THREE.SphereGeometry(R + h, 22, 5, 0, Math.PI * 2, 0, s / R).translate(0, -R, 0); caps.set(key, g); }
  return g;
}
const group = (...parts: THREE.Object3D[]) => { const g = new THREE.Group(); g.add(...parts); return g; };

/** Formes partagées par tout le décor : des centaines d'arbres, trois géométries. */
let GEO: ReturnType<typeof makeGeo> | null = null;
function makeGeo() {
  // Une touffe d'herbe : trois brins en un seul morceau, pour ne pas multiplier les objets à dessiner.
  const blades = [-1, 0, 1].map((i) => new THREE.ConeGeometry(0.05, 0.45, 4).rotateZ(-i * 0.35).translate(i * 0.07, 0.22, 0));
  return {
    tuft: mergeGeometries(blades),
    // La tête d'un palmier : six palmes retombantes.
    crown: mergeGeometries([0, 1, 2, 3, 4, 5].map((i) => new THREE.ConeGeometry(0.2, 1.3, 4).scale(1, 1, 0.35).rotateZ(-1.9).translate(0.55, -0.12, 0).rotateY((i / 6) * Math.PI * 2))),
    log: new THREE.CylinderGeometry(0.22, 0.24, 1.6, 8).rotateZ(Math.PI / 2), reed: new THREE.CylinderGeometry(0.025, 0.03, 1.1, 5).translate(0, 0.55, 0), reedTop: new THREE.CylinderGeometry(0.06, 0.06, 0.28, 6).translate(0, 1.05, 0),
    petal: new THREE.IcosahedronGeometry(0.11, 0).translate(0, 0.3, 0), stalk: new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4).translate(0, 0.15, 0),
    trunk: new THREE.CylinderGeometry(0.16, 0.24, 1, 7), cone: new THREE.ConeGeometry(1, 1, 7), ball: new THREE.IcosahedronGeometry(1, 1), rock: new THREE.IcosahedronGeometry(1, 0),
    stem: new THREE.CylinderGeometry(0.1, 0.12, 0.26, 7), cap: new THREE.SphereGeometry(0.24, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    spike: new THREE.ConeGeometry(0.24, 0.8, 5), disc: new THREE.CylinderGeometry(1, 1, 0.05, 14), pad: new THREE.CylinderGeometry(0.25, 0.25, 0.03, 10), cactus: new THREE.CylinderGeometry(0.2, 0.22, 1, 8),
    arm: new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), dome: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), clod: new THREE.IcosahedronGeometry(0.26, 0), coin: new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12),
    base: new THREE.CylinderGeometry(0.34, 0.4, 0.08, 10), glint: new THREE.CylinderGeometry(0.08, 0.4, 9, 8, 1, true), slab: new THREE.BoxGeometry(0.5, 1.6, 0.35),
  };
}


/** Le personnage, chapeau de paille et sac à dos, avec l'équipement qu'il porte : on voit ses progrès d'un coup d'œil. */
export function buildHero(g: TrekSetup['gear']): THREE.Group {
  const h = group(mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.75, 9), 0x4f8ad6, 0, 0.42, 0), mesh(new THREE.SphereGeometry(0.24, 10, 8), 0xf3c9a5, 0, 1.0, 0),
    mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 12), 0xf2d27a, 0, 1.17, 0), mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.2, 10), 0xf2d27a, 0, 1.27, 0),
    mesh(new THREE.BoxGeometry(0.34, 0.42, 0.2), 0xb5654a, 0, 0.5, 0.26));
  const M = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, rz = 0) => { const m = mesh(geo, color, x, y, z); m.rotation.set(rx, 0, rz); h.add(m); return m; };
  // Deux yeux sous le chapeau.
  for (const x of [-0.08, 0.08]) M(new THREE.SphereGeometry(0.03, 6, 5), 0x3b2a20, x, 1.03, -0.215).castShadow = false;
  // Bottes : brunes, puis rouges, puis dorées.
  if (g.boots) for (const x of [-0.11, 0.11]) M(new THREE.BoxGeometry(0.15, 0.13, 0.22), [0x6b4a34, 0x4f6f8a, 0xb5443a, 0x3f8a5a, 0xd8a83a][g.boots - 1], x, 0.065, -0.25);
  // Lanterne à la ceinture : elle s'allume à la tombée de la nuit.
  if (g.lantern) {
    M(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), 0x3b2a20, 0.33, 0.62, 0);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 8), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
    glass.position.set(0.33, 0.5, 0); glass.userData.raw = true;
    h.add(glass);
    M(new THREE.ConeGeometry(0.09, 0.07, 8), 0x3b2a20, 0.33, 0.6, 0);
    h.userData.lamp = new THREE.PointLight(0xffc860, 0, 4 + g.lantern * 1.5, 1.6);
    h.userData.lamp.position.set(0.33, 0.6, 0);
    h.add(h.userData.lamp);
    // Halo autour de la flamme et flaque de lumière au sol : on voit la lanterne de loin.
    const glow = (geo: THREE.BufferGeometry) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.userData.raw = true; (m.material as THREE.Material).userData.outlineParameters = { visible: false }; m.castShadow = false; return m; };
    const halo = glow(new THREE.SphereGeometry(0.22, 12, 8));
    halo.position.set(0.33, 0.5, 0);
    const pool = glow(new THREE.CircleGeometry(1.4 + g.lantern * 0.45, 28));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.04;
    h.add(halo, pool);
    h.userData.glow = [halo, pool];
  }
  // Serpe ou machette, glissée en travers du sac.
  if (g.machete) {
    M(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), 0x8a5f3c, -0.14, 0.82, 0.37, 0, 0.7);
    M(new THREE.BoxGeometry(0.07, 0.26 + g.machete * 0.05, 0.015), 0xcfd8dc, 0.03 + g.machete * 0.015, 0.98 + g.machete * 0.015, 0.37, 0, 0.7);
  }
  // Pelle ou pioche plantée dans le sac.
  if (g.shovel) {
    M(new THREE.CylinderGeometry(0.022, 0.022, 0.6, 5), 0xb07a4f, 0.13, 0.9, 0.33, -0.2, -0.25);
    if (g.shovel > 2) M(new THREE.BoxGeometry(0.34, 0.06, 0.05), 0x9fb4c4, 0.2, 1.18, 0.27, -0.2, -0.25);
    else M(new THREE.BoxGeometry(0.13, 0.15, 0.03), 0x9fb4c4, 0.2, 1.2, 0.28, -0.2, -0.25);
  }
  // Gants : deux petites mains vertes de part et d'autre.
  if (g.gloves) for (const x of [-0.27, 0.27]) M(new THREE.SphereGeometry(0.075, 8, 6), [0x7fbf6a, 0x6fa8d6, 0x9a6a3c, 0x3f8a5a, 0xd8a83a][g.gloves - 1], x, 0.45, -0.06);
  // Boussole en sautoir.
  if (g.compass) { const c = M(new THREE.CylinderGeometry(0.06 + g.compass * 0.01, 0.06 + g.compass * 0.01, 0.03, 12), g.compass >= 4 ? 0x5fbf8a : 0xd8a83a, 0, 0.66, -0.24, Math.PI / 2 - 0.3); c.castShadow = false; }
  // Le chapeau prend un ruban de couleur avec l'expérience.
  const total = Object.values(g).reduce((a, b) => a + (b ?? 0), 0);
  if (total >= 4) M(new THREE.CylinderGeometry(0.255, 0.255, 0.07, 12), total >= 30 ? 0xd8a83a : total >= 20 ? 0xe2574c : total >= 12 ? 0x3f8a5a : 0x4f8ad6, 0, 1.22, 0);
  return h;
}

/**
 * L'expédition : un grand monde qu'on parcourt à pied, vu comme une petite planète qui roule sous les pas.
 * La serre est au centre de la carte. La forêt l'entoure, le marais vient ensuite, les dunes sont tout au bout :
 * plus on s'éloigne, plus les plantes sont rares, mais il faut être rentré avant la nuit, sinon on perd la moitié du panier.
 * La cueillette elle-même est un petit jeu d'adresse que l'interface présente (`onPick`) et dont elle rend le résultat (`resolve`).
 * La scène ne touche jamais à la partie : l'interface lit le panier au retour.
 */
export class Planet {
  active = false;
  basket: string[] = [];
  /** Une graine en plus par cueillette parfaite. */
  bonus: string[] = [];
  cap = 4;
  left = 0;
  /** Plante à portée de main (-1 : aucune). */
  near = -1;
  /** Région où l'on se trouve : 0 forêt, 1 marais, 2 dunes. */
  biome = 0;
  /** Effets de l'équipement : vitesse gardée dans les ronces, aisance à la cueillette, butin multiplié, boussole. */
  slow = 0.35;
  ease = 0;
  lootMul = 1;
  compass = 0;
  private gear: TrekSetup['gear'] = {};
  private lamp: THREE.PointLight | null = null;
  private dark = false;
  /** Continent où l'on marche : ses trois régions sont BIOMES[land * 3 + région]. */
  land = 0;
  /** Vrai pendant le jeu de cueillette : le monde et le jour attendent. */
  picking = false;
  /** Manette sous le pouce, en pixels : origine et écart. */
  stick: { x: number; y: number; dx: number; dy: number } | null = null;
  /** Ramassé en chemin : argile et pièces. */
  loot = { clay: 0, coins: 0 };
  /** Vrai si la nuit est tombée loin de la serre. */
  lost = false;
  slowed = false;
  onChange: () => void = () => {};
  onEvent: (kind: 'pick' | 'perfect' | 'miss' | 'reveal' | 'slow' | 'dusk' | 'clay' | 'coins' | 'wall' | 'region', id?: string) => void = () => {};
  /** La plante à portée vient d'être touchée : à l'interface de lancer le jeu de cueillette. */
  onPick: (id: string) => void = () => {};
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
  private things: Thing[] = [];
  private finds: Find[] = [];
  private solids: Spot[] = [];
  private slows: Spot[] = [];
  private pickups: { thing: Thing; inner: THREE.Object3D; kind: 'clay' | 'coins'; n: number; got: boolean; lift: number }[] = [];
  private glints: THREE.Mesh[] = [];
  private sway: THREE.Object3D[] = [];
  private clouds = new THREE.Group();
  private hero = new THREE.Group();
  private ground: THREE.Mesh | null = null;
  private uni: { uP: { value: THREE.Vector2 } } | null = null;
  /** Pour chaque sommet du sol : son décalage sur la carte par rapport au personnage. */
  private offs = new Float32Array(0);
  /** Position sur la carte, et direction du regard. */
  private px = 0;
  private pz = -3.4;
  private fx = 0;
  private fz = -1;
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

  open(finds: { id: string; hidden: boolean; tier: number; ring: number }[], setup: Partial<TrekSetup> & { time: number; speed: number; cap: number; reach: number; land?: number }): void {
    this.slow = setup.slow ?? 0.35;
    this.ease = setup.ease ?? 0;
    this.lootMul = setup.loot ?? 1;
    this.compass = setup.compass ?? 0;
    this.gear = setup.gear ?? {};
    this.land = setup.land ?? 0;
    this.dark = !!setup.dark;
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
    this.picking = false;
    this.stick = null;
    this.down = null;
    this.ended = false;
    this.lost = false;
    this.dusk = false;
    this.slowed = false;
    // On sort de la serre, dos à elle : on la voit juste derrière soi.
    this.px = 0; this.pz = -3.4;
    this.fx = 0; this.fz = -1;
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
    this.things = [];
    this.finds = [];
    this.sway = [];
    this.solids = [];
    this.slows = [];
    this.pickups = [];
    this.glints = [];
    this.clouds = new THREE.Group();
    this.hero = new THREE.Group();
    this.ground = null;
  }

  resize(): void {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- la carte ----------

  /** Région d'un point de la carte : 0 forêt, 1 marais, 2 dunes, avec des frontières ondulées. */
  private ringAt(x: number, z: number): number {
    const d = Math.hypot(x, z) + Math.sin(Math.atan2(x, -z) * 7) * 2.2 + Math.sin(x * 0.9) * Math.sin(z * 0.8) * 0.9;
    return d < RINGS[0] ? 0 : d < RINGS[1] ? 1 : 2;
  }
  /** Jusqu'où l'on peut marcher : le bord de la dernière région ouverte. */
  private get edge(): number {
    return RINGS[this.reach - 1];
  }

  private add(obj: THREE.Object3D, x: number, z: number, spin = 0): Thing {
    const t = { x, z, obj, spin };
    obj.visible = false;
    this.things.push(t);
    this.world.add(obj);
    return t;
  }

  /** Enroule un objet de la carte sur la planète, autour du personnage qui en occupe toujours le sommet. */
  private wrap(t: Thing): void {
    const dx = t.x - this.px, dz = t.z - this.pz, d = Math.hypot(dx, dz), f = d / R;
    if (f > (this.zoom > 18 ? VIS : VIS_NEAR)) { t.obj.visible = false; return; }
    t.obj.visible = true;
    if (d < 0.001) { t.obj.position.set(0, R, 0); t.obj.rotation.set(0, t.spin, 0); return; }
    const cx = dx / d, cz = dz / d, s = Math.sin(f), c = Math.cos(f);
    const up = _a.set(s * cx, c, s * cz);
    // Les axes de la carte, couchés sur la boule à cet endroit.
    const ax = _b.set(c * cx * cx + cz * cz, -s * cx, c * cx * cz - cz * cx);
    const az = _c.crossVectors(ax, up);
    t.obj.position.copy(up).multiplyScalar(R);
    t.obj.quaternion.setFromRotationMatrix(_m.makeBasis(ax, up, az)).multiply(_q.setFromAxisAngle(UP, t.spin));
  }

  private build(list: { id: string; hidden: boolean; tier: number; ring: number }[]): void {
    const w = this.world;
    const rnd = Math.random;
    const L = this.land;
    const ground = [0, 1, 2].map((k) => new THREE.Color(BIOMES[L * LAND_BIOMES + k].ground));
    const tint = (ring: number) => { TINT = ring < 0 ? null : TINTS[L]?.[ring] ?? null; };
    tint(-1);
    const G = GEO ?? (GEO = makeGeo());
    const part = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, shadow = true) => { const m = mesh(geo, color, x, y, z, shadow); m.scale.set(sx, sy, sz); return m; };
    this.amb = new THREE.AmbientLight(0xffffff, 1.35);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.002;
    sun.target.position.set(0, R, 0);
    this.sun = sun;
    w.add(this.amb, sun, sun.target);

    // Le sol : une boule dont la peinture défile sous les pas, région par région.
    const geo = new THREE.SphereGeometry(R, 96, 64);
    const pos = geo.getAttribute('position');
    this.offs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = Math.hypot(x, z) || 1;
      const d = Math.acos(Math.max(-1, Math.min(1, pos.getY(i) / R))) * R;
      this.offs[i * 2] = (x / h) * d;
      this.offs[i * 2 + 1] = (z / h) * d;
    }
    geo.setAttribute('aOff', new THREE.BufferAttribute(this.offs, 2));
    // La peinture se calcule au pixel près d'après la carte : frontières nettes, cernées d'un trait, quel que soit le maillage.
    const gm = mat(0xffffff).clone() as THREE.MeshToonMaterial;
    const uni = { uP: { value: new THREE.Vector2() }, uEdge: { value: this.edge }, uC0: { value: ground[0] }, uC1: { value: ground[1] }, uC2: { value: ground[2] }, uMist: { value: MIST } };
    this.uni = uni;
    gm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aOff;\nvarying vec2 vOff;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOff = aOff;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec2 uP;\nuniform float uEdge;\nuniform vec3 uC0;\nuniform vec3 uC1;\nuniform vec3 uC2;\nuniform vec3 uMist;\nvarying vec2 vOff;')
        .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 m = uP + vOff;
          float d0 = length(m);
          float d = d0 + sin(atan(m.x, -m.y) * 7.0) * 2.2 + sin(m.x * 0.9) * sin(m.y * 0.8) * 0.9;
          float r0 = ${RINGS[0].toFixed(1)}, r1 = ${RINGS[1].toFixed(1)};
          vec3 g = d < r0 ? uC0 : d < r1 ? uC1 : uC2;
          // Grandes taches claires et petits points sombres : le sol n'est pas un aplat.
          if (sin(m.x * 0.45) * sin(m.y * 0.38 + m.x * 0.1) > 0.3) g *= 1.05;
          if (sin(m.x * 2.3 + m.y * 0.7) * sin(m.y * 2.1 - m.x * 0.5) > 0.9) g *= 0.93;
          // Entre deux régions : un trait d'encre, bordé d'un liseré clair du côté de la serre.
          float b = min(abs(d - r0), abs(d - r1));
          if (b < 0.09) g *= 0.42;
          else if (b < 0.55 && (d < r0 || (d > r0 + 1.0 && d < r1))) g = mix(g, vec3(1.0), 0.22);
          if (d0 < ${CAMP.toFixed(1)}) g *= 1.1;
          if (d0 > uEdge + 0.3) g = uMist;
          diffuseColor.rgb = g;
        }`);
    };
    gm.customProgramCacheKey = () => 'planet-ground';
    this.ground = new THREE.Mesh(geo, gm);
    this.ground.receiveShadow = true;
    this.ground.userData.raw = true;
    w.add(this.ground);

    // Les plantes sauvages d'abord : le décor s'installe autour d'elles.
    const tierPart: [number, number][] = [[0.3, 0.6], [0.5, 0.85], [0.8, 0.95]];
    const count: Record<string, number> = {};
    this.finds = list.map((f) => {
      const key = `${f.ring}-${f.tier}`;
      const k = count[key] = (count[key] ?? -1) + 1;
      const n = list.filter((o) => o.ring === f.ring && o.tier === f.tier).length;
      const a = (k / n) * Math.PI * 2 + f.tier * 0.9 + f.ring * 0.4 + (rnd() - 0.5) * 0.6;
      const r0 = f.ring ? RINGS[f.ring - 1] : 0, span = RINGS[f.ring] - r0;
      // Près de la serre, les plantes communes sont à deux pas ; les paliers rares touchent le bord de la région.
      const r = f.ring === 0 && f.tier === 0 ? 7 + rnd() * 14 : r0 + span * (tierPart[f.tier][0] + rnd() * (tierPart[f.tier][1] - tierPart[f.tier][0]));
      const inner = new THREE.Group();
      const plant = buildPlant(SPECIES_BY_ID[f.id], 4, 1, 0);
      plant.scale.setScalar(1.25);
      inner.add(plant, part(G.base, 0x6b4a34, 0, 0.03, 0, 1, 1, 1, false));
      let cover: THREE.Group | null = null;
      if (f.hidden) {
        cover = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const ca = (i / 5) * Math.PI * 2;
          cover.add(part(G.ball, i % 2 ? 0x4f9a5c : 0x5fae68, Math.sin(ca) * 0.4, 0.5 + (i % 2) * 0.2, Math.cos(ca) * 0.4, 0.5 + rnd() * 0.2));
        }
        cover.add(part(G.ball, 0x6fbf78, 0, 0.95, 0, 0.55));
        inner.add(cover);
        plant.visible = false;
      }
      // Une lueur monte des plantes rares : on la voit dépasser de l'horizon.
      if (f.tier > 0) {
        const glint = new THREE.Mesh(G.glint, new THREE.MeshBasicMaterial({ color: f.tier === 2 ? 0xffd84d : 0xbfe9ff, transparent: true, opacity: f.tier === 2 ? 0.4 : 0.26, depthWrite: false, side: THREE.DoubleSide }));
        glint.position.y = 4.5;
        glint.userData.raw = true;
        inner.add(glint);
        this.glints.push(glint);
      }
      const thing = this.add(group(inner), Math.sin(a) * r, -Math.cos(a) * r, rnd() * 6);
      return { id: f.id, tier: f.tier, thing, inner, cover, rub: 0, taken: false, fly: 0 };
    });

    // Place libre : ni sur le parvis de la serre, ni sur une plante, ni dans un tronc.
    const free = (x: number, z: number, r: number) => Math.hypot(x, z) > CAMP + r + 0.6 && this.finds.every((f) => Math.hypot(f.thing.x - x, f.thing.z - z) > r + 1.5) && this.solids.every((s) => Math.hypot(s.x - x, s.z - z) > r + s.r)
      // Seules les herbes et les roseaux poussent dans l'eau et les ronces.
      && (r < 0.3 || this.slows.every((s) => Math.hypot(s.x - x, s.z - z) > r + s.r));
    /** Sème `n` objets entre deux distances de la serre. */
    const scatter = (n: number, r0: number, r1: number, size: number, make: (x: number, z: number, k: number) => void) => {
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 6; tries++) {
          // Tirage uniforme en surface : pas d'entassement près du centre.
          const a = rnd() * Math.PI * 2, r = Math.sqrt(r0 * r0 + rnd() * (r1 * r1 - r0 * r0));
          const x = Math.sin(a) * r, z = -Math.cos(a) * r;
          if (!free(x, z, size)) continue;
          make(x, z, k);
          break;
        }
      }
    };
    const solid = (x: number, z: number, r: number) => this.solids.push({ x, z, r });
    const slow = (x: number, z: number, r: number) => this.slows.push({ x, z, r });
    const flat = (m: THREE.Mesh) => { m.userData.flat = true; m.castShadow = false; return m; };
    const tuft = (x: number, z: number, color: number, s = 1) => {
      const g = part(G.tuft, color, 0, 0, 0, s, s, s, false);
      this.add(group(g), x, z, rnd() * 6);
      this.sway.push(g);
    };
    const rock = (x: number, z: number, color: number, s = 0.3 + rnd() * 0.45) => { this.add(group(part(G.rock, color, 0, s * 0.4, 0, s)), x, z, rnd() * 6); solid(x, z, s + 0.15); };
    const pine = (x: number, z: number, k: number, h = 1.7 + rnd() * 1.1) => {
      this.add(group(part(G.trunk, 0x8a5f3c, 0, h * 0.25, 0, h / 2.2, h * 0.5, h / 2.2), part(G.cone, k % 2 ? 0x4f9a5c : 0x3f8552, 0, h * 0.8, 0, h * 0.42, h * 0.75, h * 0.42), part(G.cone, k % 2 ? 0x5fae68 : 0x4f9a5c, 0, h * 1.2, 0, h * 0.27, h * 0.5, h * 0.27)), x, z, rnd() * 6);
      solid(x, z, 0.2 + h * 0.1);
    };
    const pond = (x: number, z: number, s: number) => {
      s = Math.round(s * 10) / 10;
      const water = new THREE.Mesh(cap(s, 0.06), WATER);
      water.receiveShadow = true;
      // Une berge sombre déborde sous l'eau : la mare est cernée, et posée sur la courbure.
      this.add(group(flat(mesh(cap(s + 0.22, 0.03), 0x3f6f6a, 0, 0, 0, false)), flat(water), flat(part(G.pad, 0x5fae68, s * 0.3, 0.09, s * 0.12, 1.1)), flat(part(G.pad, 0x6fbf78, -s * 0.35, 0.09, -s * 0.1, 0.8))), x, z, rnd() * 6);
      slow(x, z, s);
    };
    const bush = (x: number, z: number, c1: number, c2: number, s = 0.45 + rnd() * 0.3) => {
      this.add(group(part(G.ball, c1, 0, s * 0.7, 0, s), part(G.ball, c2, s * 0.75, s * 0.5, 0.1, s * 0.7), part(G.ball, c1, -s * 0.6, s * 0.45, 0.25, s * 0.6)), x, z, rnd() * 6);
      solid(x, z, s * 0.9);
    };
    const palm = (x: number, z: number) => {
      const h = 1.8 + rnd() * 1.2;
      const trunk = part(G.trunk, 0xb58a5a, 0.12, h / 2, 0, 0.7, h, 0.7);
      trunk.rotation.z = -0.12;
      this.add(group(trunk, part(G.crown, 0x5fae5a, 0.24, h, 0, 1), part(G.rock, 0x8a5f3c, 0.24, h - 0.1, 0, 0.16)), x, z, rnd() * 6);
      solid(x, z, 0.3);
    };
    const [F, M, D] = RINGS;
    /** Un arbre à tête ronde : feuillu de la jungle, arbre du marais. */
    const broad = (x: number, z: number, k: number, h = 1.5 + rnd() * 0.9, c1 = 0x6fa27a, c2 = 0x5f946c) => {
      const s = (0.8 + rnd() * 0.35) * (h / 2);
      this.add(group(part(G.trunk, 0x7a6a55, 0, h / 2, 0, Math.max(1, h / 2.5), h, Math.max(1, h / 2.5)), part(G.ball, k % 2 ? c1 : c2, 0, h + s * 0.5, 0, s), part(G.ball, k % 2 ? c2 : c1, s * 0.6, h + s * 0.1, 0.2, s * 0.6)), x, z, rnd() * 6);
      solid(x, z, 0.3 + h * 0.06);
    };
    /** Une aiguille de glace, pour les cimes. */
    const ice = (x: number, z: number) => {
      const h = 0.9 + rnd() * 1.5;
      this.add(group(part(G.cone, 0xbfe2f2, 0, h / 2, 0, 0.32, h, 0.32), part(G.cone, 0xdff2fa, 0.3, h * 0.3, 0.1, 0.2, h * 0.6, 0.2)), x, z, rnd() * 6);
      solid(x, z, 0.4);
    };
    // Les arbres du continent : sapins chez soi et dans le nord, feuillus et palmiers dans l'archipel.
    const tree = L === 1 ? (x: number, z: number, k: number) => (k % 3 ? broad(x, z, k, 2.2 + rnd() * 1.4, 0x4fae5a, 0x3f9a52) : palm(x, z)) : pine;

    // Trois repères qu'on reconnaît de loin : l'arbre géant, le grand lac, les pierres levées.
    tint(0);
    if (L === 1) broad(-13, -17, 0, 6, 0x4fae5a, 0x3f9a52); else pine(-13, -17, 0, 6.5);
    tint(1);
    pond(34, 30, 6);
    tint(2);
    if (L === 1) {
      // Dans l'archipel, c'est un volcan qui fume au bout du monde.
      const lava = new THREE.Mesh(G.cone, new THREE.MeshBasicMaterial({ color: 0xff7a3a }));
      lava.position.set(0, 7.4, 0); lava.scale.set(1.5, 1.2, 1.5); lava.userData.raw = true;
      this.add(group(part(G.cone, 0x6a5a58, 0, 3.6, 0, 6.5, 7.6, 6.5), lava, part(G.ball, 0xe9e4e0, 0.4, 9.3, 0, 1.1, 1.1, 1.1, false), part(G.ball, 0xf4f0ec, -0.5, 10.8, 0.3, 1.5, 1.5, 1.5, false)), -52, 52);
      solid(-52, 52, 6.2);
    } else for (let i = 0; i < 7; i++) {
      const sa = (i / 7) * Math.PI * 2;
      const x = -52 + Math.sin(sa) * 3.2, z = 52 + Math.cos(sa) * 3.2;
      this.add(group(part(G.slab, 0xc9a27a, 0, 0.8 + (i % 2) * 0.2, 0, 1, 1 + (i % 2) * 0.25, 1)), x, z, -sa);
      solid(x, z, 0.45);
    }

    // Forêt : sapins, rochers, champignons, et des ronces qui ralentissent.
    tint(0);
    scatter(170, 5, F - 1, 0.9, tree);
    scatter(40, 5, F, 0.7, (x, z) => rock(x, z, 0x9a9a92));
    scatter(40, 5, F, 0.4, (x, z) => this.add(group(part(G.stem, 0xe9dcc6, 0, 0.13, 0), part(G.cap, 0xe2604f, 0, 0.26, 0)), x, z));
    scatter(24, 8, F - 2, 1.7, (x, z) => {
      const g = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const sa = rnd() * Math.PI * 2, sr = rnd() * 1.3;
        const spike = part(G.spike, i % 2 ? 0x7a4a5a : 0x5f6a4a, Math.sin(sa) * sr, 0.3, Math.cos(sa) * sr);
        spike.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
        g.add(spike);
      }
      this.add(g, x, z);
      slow(x, z, 1.6);
    });
    scatter(150, 2, F, 0.2, (x, z, k) => tuft(x, z, k % 2 ? 0x6fae5a : 0x7fbf6a));
    scatter(50, 5, F, 0.7, (x, z, k) => bush(x, z, k % 2 ? 0x5fae68 : 0x4f9a5c, 0x6fbf78));
    scatter(18, 6, F, 1.1, (x, z) => { this.add(group(part(G.log, 0x8a5f3c, 0, 0.22, 0), part(G.cap, 0x6fbf78, 0.2, 0.4, 0, 0.7, 0.4, 0.7)), x, z, rnd() * 6); solid(x, z, 0.55); });
    scatter(70, 4, F, 0.2, (x, z, k) => this.add(group(part(G.stalk, 0x4f9a5c, 0, 0, 0, 1, 1, 1, false), part(G.petal, [0xf2c94c, 0xe58ab0, 0xfdfaf2, 0x8a6fd0][k % 4], 0, 0, 0, 1, 1, 1, false)), x, z));

    // Marais : des mares où l'on patauge, des arbres à grosse tête, des roseaux.
    tint(1);
    scatter(L === 2 ? 30 : 80, F + 2, M - 2, 2.2, (x, z) => pond(x, z, 1.3 + rnd() * 1.3));
    scatter(L === 2 ? 90 : 300, F + 1, M - 1, 0.9, (x, z, k) => {
      // La toundra n'a presque plus d'arbres : quelques sapins rabougris.
      if (L === 2) { pine(x, z, k, 0.9 + rnd() * 0.6); return; }
      const h = 1.5 + rnd() * 0.9, s = 0.8 + rnd() * 0.35;
      this.add(group(part(G.trunk, 0x7a6a55, 0, h / 2, 0, 1, h, 1), part(G.ball, k % 2 ? 0x6fa27a : 0x5f946c, 0, h + 0.4, 0, s)), x, z);
      solid(x, z, 0.4);
    });
    scatter(320, F, M, 0.2, (x, z, k) => tuft(x, z, k % 2 ? 0x8fb86a : 0x7fa85a, 2));
    scatter(260, F, M, 0.2, (x, z) => { const h = 0.8 + rnd() * 0.5; this.add(group(part(G.reed, 0x7fa85a, 0, 0, 0, 1, h, 1, false), part(G.reedTop, 0x7a4a2a, 0, 0, 0, 1, h, 1, false), part(G.reed, 0x8fb86a, 0.12, 0, 0.05, 1, h * 0.7, 1, false)), x, z, rnd() * 6); });
    scatter(110, F + 1, M, 0.7, (x, z, k) => bush(x, z, k % 2 ? 0x5f946c : 0x4f8a7a, 0x6fa27a));
    scatter(60, F + 1, M, 0.7, (x, z) => rock(x, z, 0x7f8f86));
    scatter(60, F, M, 0.4, (x, z) => this.add(group(part(G.stem, 0xe9dcc6, 0, 0.13, 0), part(G.cap, 0x8a6fd0, 0, 0.26, 0)), x, z));

    // Dunes : cactus, pierres chaudes, bosses de sable et plaques de sable mou.
    tint(2);
    scatter(90, M + 2, D - 1, 1.8, (x, z) => { const s = Math.round((1.3 + rnd() * 1.0) * 10) / 10; this.add(group(flat(mesh(cap(s, 0.04), 0xc9a86a, 0, 0, 0, false))), x, z); slow(x, z, s); });
    // Des oasis : une mare et ses palmiers.
    scatter(9, M + 5, D - 4, 5, (x, z) => { pond(x, z, 2.4); for (let i = 0; i < 4; i++) { const a = i * 1.6 + rnd(); (L === 2 ? ice : palm)(x + Math.sin(a) * 3.3, z + Math.cos(a) * 3.3); } });
    scatter(150, M + 1, D + 4, 1.6, (x, z, k) => { const s = 1.8 + rnd(); this.add(group(flat(part(G.dome, k % 2 ? 0xf0dcae : 0xe6cd96, 0, -0.1, 0, s, s * 0.35, s, false))), x, z); });
    scatter(380, M + 1, D + 4, 0.8, (x, z, k) => {
      if (L === 2) { ice(x, z); return; }
      const h = 1.0 + rnd() * 1.2;
      const g = group(part(G.cactus, 0x5f9a6a, 0, h / 2, 0, 1, h, 1));
      if (k % 2) g.add(part(G.arm, 0x5f9a6a, 0.36, h * 0.55, 0));
      this.add(g, x, z, rnd() * 6);
      solid(x, z, 0.4);
    });
    scatter(240, M + 1, D + 4, 0.7, (x, z) => rock(x, z, 0xc9a27a));
    scatter(90, M + 1, D + 4, 0.6, L === 2 ? (x, z) => rock(x, z, 0x9aa4ac, 0.6 + rnd() * 0.7) : palm);
    scatter(140, M + 1, D + 4, 0.6, (x, z, k) => bush(x, z, k % 2 ? 0xb9a86a : 0xa9985a, 0xc9b87a, 0.3 + rnd() * 0.2));
    scatter(300, M, D + 4, 0.2, (x, z, k) => tuft(x, z, k % 2 ? 0xb9b86a : 0xa9a85a, 0.9));

    tint(-1);
    // À ramasser en marchant : des mottes d'argile et des pièces perdues, plus généreuses loin de la serre.
    scatter(10 + this.reach * 12, 7, this.edge - 2, 0.6, (x, z, k) => {
      const kind = k % 2 ? 'clay' : 'coins', far = Math.hypot(x, z);
      const inner = new THREE.Group();
      if (kind === 'clay') inner.add(part(G.clod, 0xb9744f, 0, 0.2, 0), part(G.clod, 0xc98360, 0.24, 0.12, 0.1, 0.6));
      else {
        const coin = part(G.coin, 0xf2c94c, 0, 0.55, 0);
        coin.rotation.x = Math.PI / 2;
        inner.add(coin);
      }
      this.pickups.push({ thing: this.add(group(inner), x, z), inner, kind, n: kind === 'clay' ? (far > RINGS[1] ? 3 : far > RINGS[0] ? 2 : 1) : Math.round(far / 10) * 5 + 10, got: false, lift: 0 });
    });

    // Au bord de la dernière région ouverte, une mer de nuages cache la suite.
    // Elle commence là où l'on est arrêté : on bute dans les nuages, jamais dans le vide.
    {
      const n = Math.round((this.edge * Math.PI * 2) / 1.1);
      for (let k = 0; k < n; k++) {
        const s = 1.0 + rnd() * 0.6, a = (k / n) * Math.PI * 2, r = this.edge - 0.3 + (k % 3) * 1.2 + rnd() * 0.5;
        this.add(group(part(G.ball, 0xfdfdfd, 0, s * 0.5, 0, s, s, s, false), part(G.ball, 0xeef4f8, 0.5, s * 0.9, 0.9, s * 0.7, s * 0.7, s * 0.7, false)), Math.sin(a) * r, -Math.cos(a) * r, rnd() * 6);
      }
    }

    // La serre, au centre de la carte : un pavillon de verre. C'est là qu'il faut être quand la nuit tombe.
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
    this.add(house, 0, 0);
    solid(0, 0, 2.3);
    for (let i = 0; i < 5; i++) this.add(group(flat(part(G.disc, 0xd9cdb8, 0, 0.04, 0, 0.34, 1, 0.34, false))), (i % 2) * 0.3 - 0.15, -3.0 - i * 0.7);

    // Le personnage : chapeau de paille, sac à dos. Il reste au sommet de la planète, c'est elle qui roule.
    this.hero = buildHero(this.gear);
    this.lamp = this.hero.userData.lamp ?? null;
    this.hero.position.set(0, R, 0);
    w.add(this.hero);

    // Des nuages tournent lentement autour de la planète.
    this.clouds = new THREE.Group();
    for (let k = 0; k < 14; k++) {
      const s = 1.2 + rnd() * 1.2;
      const puff = group(part(G.ball, 0xffffff, 0, 0, 0, s, s, s, false), part(G.ball, 0xffffff, s * 0.9, -s * 0.15, 0, s * 0.7, s * 0.7, s * 0.7, false), part(G.ball, 0xf2f8fb, -s * 0.85, -s * 0.2, 0.2, s * 0.6, s * 0.6, s * 0.6, false));
      const d = new THREE.Vector3().setFromSphericalCoords(R + 7 + rnd() * 3, 0.9 + rnd() * 1.8, rnd() * Math.PI * 2);
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
    this.paint();
    for (const t of this.things) this.wrap(t);
  }

  /** Fait défiler la peinture du sol sous le personnage. */
  private paint(): void {
    this.uni?.uP.value.set(this.px, this.pz);
  }

  // ---------- lecture pour l'interface ----------

  private screen(q: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const c = q.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const s = q.clone().project(this.camera);
    return { x: (s.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (1 - (s.y * 0.5 + 0.5)) * this.canvas.clientHeight, ok: c.z < -0.3 };
  }
  private above(f: Find, h: number): THREE.Vector3 {
    return f.thing.obj.position.clone().multiplyScalar(1 + h / R);
  }

  /** Position écran de la plante à portée, pour y accrocher son étiquette. */
  nearRect(): { x: number; y: number } | null {
    const f = this.finds[this.near];
    if (!f) return null;
    const s = this.screen(this.above(f, 1.7));
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
  /** Distance à la serre, en mètres. */
  /**
   * Ce que vise l'aiguille dorée de la boussole, selon son niveau : la plante rare la plus proche à 25 m, puis 50 m,
   * puis partout ; ensuite les exotiques et légendaires d'abord ; au dernier niveau, elle dit laquelle.
   */
  get rare(): { angle: number; dist: number; id: string | null } | null {
    const lv = this.compass;
    if (!lv) return null;
    const range = lv === 1 ? 25 : lv === 2 ? 50 : Infinity;
    let best: Find | null = null, bd = Infinity;
    for (const f of this.finds) {
      if (f.taken || f.tier < 1 || Math.hypot(f.thing.x, f.thing.z) > this.edge) continue;
      const d = Math.hypot(f.thing.x - this.px, f.thing.z - this.pz);
      if (d > range) continue;
      // Au niveau 4, une trouvaille lointaine passe avant une rare ordinaire.
      const score = d - (lv >= 4 && f.tier === 2 ? 1000 : 0);
      if (score < bd) { bd = score; best = f; }
    }
    if (!best) return null;
    return { angle: Math.atan2(-(best.thing.x - this.px), best.thing.z - this.pz), dist: Math.hypot(best.thing.x - this.px, best.thing.z - this.pz), id: lv >= 5 ? best.id : null };
  }
  get campDist(): number {
    return Math.hypot(this.px, this.pz);
  }
  get atCamp(): boolean {
    return this.campDist < CAMP;
  }
  /** Angle de la serre à l'écran : 0 vers le haut, positif à droite. */
  get campAngle(): number {
    return Math.atan2(-this.px, this.pz);
  }
  /** 0 en plein jour, 1 à la nuit tombée. Partie de nuit, la sortie reste dans le noir. */
  get night(): number {
    const n = Math.max(0, Math.min(1, 1 - this.left / (TREK_TIME * 0.45)));
    return this.dark ? Math.max(0.9, n) : n;
  }
  get lantern(): number {
    return this.gear.lantern ?? 0;
  }
  /** Le personnage à l'écran, pour centrer la lumière de la lanterne. */
  get heroScreen(): { x: number; y: number } {
    const s = this.screen(new THREE.Vector3(0, R + 0.6, 0));
    return { x: s.x, y: s.y };
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
    const s = this.screen(this.above(f, 0.6));
    return s.ok && Math.hypot(p.x - s.x, p.y - s.y) < 78;
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || this.ended || this.picking) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.at(e);
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
          f.inner.remove(f.cover);
          f.cover = null;
          f.inner.children[0].visible = true;
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
    if (!d || !this.active || this.ended || d.rub || this.picking) return;
    const p = this.at(e);
    // Une touche brève sur la plante à portée : la cueillette commence.
    if (Math.hypot(p.x - d.sx, p.y - d.sy) > 12 || performance.now() - d.t > 400) return;
    const f = this.finds[this.near];
    if (!f || f.cover || !this.onPlant(p)) return;
    if (this.full) { this.onChange(); return; }
    this.picking = true;
    this.fx = f.thing.x - this.px; this.fz = f.thing.z - this.pz;
    this.onChange();
    this.onPick(f.id);
  }

  /** Résultat du jeu de cueillette : 0 la plante est abîmée, 1 elle est cueillie, 2 cueillette parfaite (une graine en plus). */
  resolve(score: number): void {
    const f = this.finds[this.near];
    this.picking = false;
    this.last = performance.now();
    if (!f || f.taken) return;
    f.taken = true;
    this.near = -1;
    if (score <= 0) {
      f.fly = 0.5;
      this.onEvent('miss', f.id);
    } else {
      f.fly = 1;
      this.basket.push(f.id);
      if (score >= 2) { this.bonus.push(f.id); this.onEvent('perfect', f.id); }
      else this.onEvent('pick', f.id);
    }
    this.onChange();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
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

    if (!this.ended && !this.picking) {
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

    // Marche : le personnage va là où pousse le pouce, et la planète roule sous lui.
    let moving = false;
    if (this.stick && !this.picking && !this.ended) {
      const sx = this.stick.dx / 70, sz = this.stick.dy / 70, len = Math.hypot(sx, sz);
      if (len > 0.12) {
        moving = true;
        const slowed = this.slows.some((o) => Math.hypot(o.x - this.px, o.z - this.pz) < o.r);
        if (slowed && !this.slowed) this.onEvent('slow');
        this.slowed = slowed;
        const v = Math.min(1, len) * SPEED * this.speed * (slowed ? this.slow : 1) * dt;
        this.fx = sx / len; this.fz = sz / len;
        this.px += this.fx * v; this.pz += this.fz * v;
        this.step += v;
        // On contourne les troncs, les rochers et la serre.
        for (const o of this.solids) {
          const dx = this.px - o.x, dz = this.pz - o.z, d = Math.hypot(dx, dz), min = o.r + 0.4;
          if (d < min && d > 0.001) { this.px = o.x + (dx / d) * min; this.pz = o.z + (dz / d) * min; }
        }
        // Le bout du monde connu : la mer de nuages, ou le bord de la carte.
        const far = Math.hypot(this.px, this.pz), lim = this.edge + 0.2;
        if (far > lim) {
          this.px *= lim / far; this.pz *= lim / far;
          if (now - this.wallAt > 5000) { this.wallAt = now; this.onEvent('wall', this.reach < RINGS.length ? 'lock' : 'end'); }
        }
        // Rentrer, c'est revenir pousser la porte de la serre.
        if (far < 3.05 && this.total - this.left > 1.5 && -(this.fx * this.px + this.fz * this.pz) > 0.3 * far) this.finish();
        const ring = Math.min(this.reach - 1, this.ringAt(this.px, this.pz));
        if (ring !== this.biome) { this.biome = ring; this.onEvent('region', String(ring)); }
      }
    }
    this.hero.rotation.y = Math.atan2(-this.fx, -this.fz);
    this.hero.position.y = R + (moving ? Math.abs(Math.sin(this.step * 2.6)) * 0.12 : 0);
    if (moving || this.zoom > 16) { this.paint(); for (const th of this.things) this.wrap(th); }

    // La caméra : de très haut au départ (on voit toute la planète), puis elle plonge derrière le personnage.
    this.intro = Math.max(0, this.intro - dt);
    const goal = this.intro > 0 ? 66 : this.picking ? 9 : this.ended ? 30 : 13;
    this.zoom += (goal - this.zoom) * Math.min(1, dt * (this.zoom > 16 && !this.ended ? 1.6 : 3));
    const z = this.zoom, far = Math.max(0, Math.min(1, (z - 16) / 34));
    // De loin, on regarde la planète entière ; de près, le personnage, un peu en avant de lui.
    cam.position.set(0, R + z, z * 0.5 * (1 - far));
    cam.up.set(0, far > 0.5 ? 0 : 1, far > 0.5 ? -1 : 0);
    cam.lookAt(0, (R + 0.6) * (1 - far), -1.6 * (1 - far));
    cam.updateMatrixWorld(true);

    // On ramasse ce sur quoi on marche.
    for (const k of this.pickups) {
      if (k.got) { if (k.inner.visible) { k.lift += dt * 4; k.inner.position.y = k.lift; k.inner.scale.multiplyScalar(1 - Math.min(1, dt * 5)); if (k.lift > 1.6) k.inner.visible = false; } continue; }
      if (k.kind === 'coins') k.inner.rotation.y = t * 2.5;
      if (this.ended || Math.hypot(k.thing.x - this.px, k.thing.z - this.pz) > 1.2) continue;
      k.got = true;
      const n = Math.round(k.n * this.lootMul);
      this.loot[k.kind] += n;
      this.onEvent(k.kind, String(n));
    }
    if (this.lamp) this.lamp.intensity = this.night * (2 + (this.gear.lantern ?? 1) * 0.8);
    const glow = this.hero.userData.glow as THREE.Mesh[] | undefined;
    if (glow) {
      const f = 1 + Math.sin(t * 7) * 0.04;
      (glow[0].material as THREE.MeshBasicMaterial).opacity = this.night * 0.55;
      glow[0].scale.setScalar(f);
      (glow[1].material as THREE.MeshBasicMaterial).opacity = this.night * 0.3;
    }
    this.glints.forEach((g, i) => { g.rotation.y = t * 0.6 + i; g.visible = this.zoom < 20; });
    this.clouds.rotation.y = t * 0.02;

    // La plante à portée de main : la plus proche.
    if (!this.picking) {
      let best = -1, bestD = REACH;
      this.finds.forEach((fd, i) => {
        if (fd.taken) return;
        const d = Math.hypot(fd.thing.x - this.px, fd.thing.z - this.pz);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== this.near) { this.near = best; this.onChange(); }
    }

    // Le soir tombe : la lumière baisse et rougit.
    const n = this.night;
    if (this.sun && this.amb) {
      this.sun.intensity = 1.7 - n * 1.3;
      this.sun.color.setHSL(0.11 - n * 0.07, 0.9, 0.82 - n * 0.2);
      this.amb.intensity = 1.35 - n * 0.8;
      this.sun.position.set(9 + n * 10, R + 16 - n * 9, 6);
    }

    this.sway.forEach((g, i) => { if (g.parent?.visible) g.rotation.z = Math.sin(t * 1.4 + i) * 0.12; });
    for (const fd of this.finds) {
      if (fd.fly > 0) {
        // Cueillie : la plante s'envole vers le panier.
        fd.fly = Math.max(0, fd.fly - dt * 2.2);
        fd.inner.position.y = (1 - fd.fly) * 1.6;
        fd.inner.scale.setScalar(Math.max(0.001, fd.fly));
        if (fd.fly === 0) fd.inner.visible = false;
      } else if (fd.fly < 0) {
        // Découverte : elle se déplie.
        fd.fly = Math.min(0, fd.fly + dt * 2.5);
        fd.inner.scale.setScalar(1 + Math.sin(-fd.fly * Math.PI) * 0.25);
      }
    }
    if (this.outline) this.outline.render(this.scene, cam);
    else this.renderer!.render(this.scene, cam);
    // L'étiquette de la plante proche et la boussole suivent chaque image.
    this.onChange();
  };
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
