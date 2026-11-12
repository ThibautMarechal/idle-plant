import * as THREE from 'three';
import { SLOT_COUNT, SLOTS_PER_ZONE, SPECIES_BY_ID, ZONES } from './data';
import { buildPlant, buildPot, mat, POT_TOP } from './plants3d';
import { fitOf, stageOf, zoneClimate, zoneOfSlot } from './sim';
import type { State } from './sim';

const ROW_Z = [-2.85, -0.95, 0.95, 2.85];
const COL_X = [-1.3, 0, 1.3];
const HALF_W = 2.8;
const HALF_D = 3.9;
const BASIN_X = 2.25;
const SHOW_X = [-1.95, -0.65, 0.65, 1.95];
const TABLE_Y = 0.62;
const ZONE_COLORS = [0x6f7f8f, 0x6fae8a, 0x9fb4c4, 0xf2d68a];

interface SlotView {
  root: THREE.Group;
  pot: THREE.Group | null;
  marker: THREE.Mesh;
  plant: THREE.Group | null;
  key: string;
  pop: number;
  base: THREE.Vector3;
}

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private slots: SlotView[] = [];
  private mist: THREE.Mesh[] = [];
  private water!: THREE.Mesh;
  private w = 1;
  private h = 1;
  private unit = 50;
  private view = { u: 50, cx: 0, cy: 0, ay: 100 };
  private goal = { u: 50, cx: 0, cy: 0, ay: 100 };
  private zone = -1;
  private crates: THREE.Group[] = [];
  private shows: { root: THREE.Group; plant: THREE.Group | null; key: string }[] = [];
  private gear: Record<string, THREE.Group> = {};
  private bugs: THREE.Mesh[] = [];
  private fanBlades: THREE.Group | null = null;
  private lifted = -1;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.add(new THREE.HemisphereLight(0xfff6e0, 0x8fae9a, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.1);
    sun.position.set(5, 9, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.002;
    sun.shadow.radius = 4;
    this.scene.add(sun);

    this.buildRoom();
    for (let i = 0; i < SLOT_COUNT; i++) this.slots.push(this.buildSlot(i));

    const yaw = 0.2, pitch = 0.85;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const target = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(target).addScaledVector(dir, 30);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(true);
    this.resize();
    this.view = { ...this.goal };
    this.applyView();
  }

  private buildRoom(): void {
    const s = this.scene;
    const W = HALF_W, D = HALF_D;
    s.add(box(W * 2 + 0.4, 0.4, D * 2 + 0.4, 0xd8c3a0, 0, -0.2, 0, false));
    s.add(box(W * 2 + 0.7, 0.25, D * 2 + 0.7, 0x9a7b5a, 0, -0.5, 0, false));
    ROW_Z.forEach((z, r) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - 0.3, 0.02, 1.6), new THREE.MeshStandardMaterial({
        color: ZONE_COLORS[r], roughness: 1, transparent: true, opacity: 0.55,
      }));
      strip.position.set(0, 0.011, z);
      strip.receiveShadow = true;
      s.add(strip);
    });
    // Murets et verrière : mur du fond (z-) et mur de gauche (x-).
    const glass = new THREE.MeshStandardMaterial({ color: 0xcfeef5, transparent: true, opacity: 0.32, roughness: 0.2 });
    const wx = -W - 0.1, wz = -D - 0.1;
    s.add(box(W * 2 + 0.4, 0.6, 0.25, 0xe9dcc6, 0, 0.3, wz));
    s.add(box(0.25, 0.6, D * 2 + 0.4, 0xe9dcc6, wx, 0.3, 0));
    const paneB = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.2, 2.6, 0.05), glass);
    paneB.position.set(0, 1.9, wz);
    const paneL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, D * 2 + 0.2), glass);
    paneL.position.set(wx, 1.9, 0);
    s.add(paneB, paneL);
    for (let k = 0; k <= 3; k++) s.add(box(0.1, 2.7, 0.1, 0xfdfaf2, wx + (k * (W * 2 + 0.2)) / 3, 1.95, wz));
    for (let k = 1; k <= 4; k++) s.add(box(0.1, 2.7, 0.1, 0xfdfaf2, wx, 1.95, wz + (k * (D * 2 + 0.2)) / 4));
    s.add(box(W * 2 + 0.3, 0.1, 0.1, 0xfdfaf2, 0, 3.25, wz));
    s.add(box(0.1, 0.1, D * 2 + 0.3, 0xfdfaf2, wx, 3.25, 0));
    s.add(box(W * 2 + 0.3, 0.07, 0.07, 0xfdfaf2, 0, 2.0, wz));
    s.add(box(0.07, 0.07, D * 2 + 0.3, 0xfdfaf2, wx, 2.0, 0));

    // Étagère du fond : elle fait de l'ombre aux pots du dessous.
    const sz = wz + 0.5;
    s.add(box(W * 2 - 0.2, 0.1, 0.9, 0xa9794f, 0, 2.15, sz));
    for (const x of [-W + 0.3, 0, W - 0.3]) s.add(box(0.08, 0.5, 0.08, 0x8a5f3c, x, 1.9, wz + 0.15));
    // La vitrine : quatre socles blancs sur l'étagère.
    SHOW_X.forEach((x) => {
      const root = new THREE.Group();
      root.position.set(x, 2.2, sz);
      root.scale.setScalar(0.72);
      root.add(buildPot(0xf4efe4, 0xffffff));
      s.add(root);
      this.shows.push({ root, plant: null, key: '' });
    });

    // Bassin et brume.
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.28, 12), mat(0xb9b2a6));
    ring.position.set(BASIN_X, 0.14, ROW_Z[1]);
    ring.castShadow = true;
    s.add(ring);
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x6fc7e0, roughness: 0.15, flatShading: true }));
    this.water.position.set(BASIN_X, 0.27, ROW_Z[1]);
    s.add(this.water);
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mistMat.clone());
      m.userData.phase = k / 6;
      this.mist.push(m);
      s.add(m);
    }

    // Porte sur le mur de gauche.
    const dz = ROW_Z[2];
    s.add(box(0.12, 2.3, 1.15, 0x5f9f8a, wx + 0.04, 1.15, dz));
    s.add(box(0.14, 0.9, 0.8, 0xcfeef5, wx + 0.06, 1.6, dz, false));
    s.add(box(0.1, 0.08, 0.08, 0xf2c94c, wx + 0.14, 1.05, dz + 0.4, false));
    s.add(box(0.6, 0.03, 1.0, 0xb96f5a, wx + 0.5, 0.02, dz, false));

    // Table plein sud.
    const tz = ROW_Z[3];
    s.add(box(W * 2 - 0.5, 0.12, 1.2, 0xc99a66, 0, TABLE_Y - 0.06, tz));
    for (const x of [-W + 0.45, W - 0.45]) for (const z of [tz - 0.45, tz + 0.45]) s.add(box(0.12, TABLE_Y - 0.12, 0.12, 0xa9794f, x, (TABLE_Y - 0.12) / 2, z));

    // Caisses et bâche : une zone pas encore aménagée est encombrée.
    ROW_Z.forEach((z, r) => {
      const g = new THREE.Group();
      const y = r === 3 ? TABLE_Y : 0;
      COL_X.forEach((x, c) => {
        const sz = 0.55 + ((r + c) % 3) * 0.12;
        const crate = box(sz, sz * 0.8, sz, c % 2 ? 0xb98a5a : 0xa9794f, x + (c - 1) * 0.1, y + sz * 0.4, z);
        crate.rotation.y = (r * 3 + c) * 0.5;
        g.add(crate);
        g.add(box(sz * 1.04, 0.05, sz * 0.2, 0x8a5f3c, x + (c - 1) * 0.1, y + sz * 0.8, z));
      });
      const tarp = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - 0.3, 0.03, 1.6), new THREE.MeshStandardMaterial({ color: 0x6b6f66, transparent: true, opacity: 0.45 }));
      tarp.position.set(0, 0.03, z);
      if (r !== 3) g.add(tarp);
      g.visible = false;
      this.crates.push(g);
      s.add(g);
    });

    this.buildGear();

    // Arrosoir décoratif.
    const can = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.34, 8), mat(0x5a9fd4));
    body.position.y = 0.17;
    body.castShadow = true;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 6), mat(0x5a9fd4));
    spout.position.set(0.28, 0.24, 0);
    spout.rotation.z = -0.9;
    can.add(body, spout);
    can.position.set(BASIN_X, 0, ROW_Z[2]);
    can.rotation.y = 2.4;
    s.add(can);
  }

  /** Équipements : invisibles tant qu'ils ne sont pas achetés. */
  private buildGear(): void {
    const s = this.scene;
    const W = HALF_W, D = HALF_D;
    const add = (name: string, ...parts: THREE.Object3D[]) => {
      const g = new THREE.Group();
      if (parts.length) g.add(...parts);
      g.visible = false;
      this.gear[name] = g;
      s.add(g);
      return g;
    };
    // Arrosage automatique : une conduite le long du mur de gauche, un goutteur par rangée.
    const pipes: THREE.Object3D[] = [box(0.07, 0.07, D * 2 - 0.4, 0xc98a4a, -W + 0.12, 0.75, 0)];
    ROW_Z.forEach((z, r) => {
      const y = r === 3 ? TABLE_Y : 0;
      COL_X.forEach((x) => {
        pipes.push(box(0.04, 0.5, 0.04, 0xc98a4a, x - 0.47, y + 0.3, z));
        pipes.push(box(0.16, 0.04, 0.04, 0xc98a4a, x - 0.41, y + 0.56, z));
        pipes.push(box(0.05, 0.07, 0.05, 0x5a9fd4, x - 0.33, y + 0.53, z));
      });
    });
    add('water', ...pipes);
    // Coccinelles.
    const bugGroup = add('bugs');
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xe2382f));
      b.scale.y = 0.6;
      b.userData.k = k;
      this.bugs.push(b);
      bugGroup.add(b);
    }
    // Brumisateur sous l'étagère.
    add('mist', box(0.5, 0.16, 0.2, 0xe8eef0, -1.3, 1.95, -D + 0.25), box(0.5, 0.16, 0.2, 0xe8eef0, 1.3, 1.95, -D + 0.25),
      box(2.6, 0.04, 0.04, 0xb0c4cc, 0, 1.95, -D + 0.25));
    // Lampe horticole au-dessus de la rangée de la porte.
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0xff9ad8 }));
    glow.position.set(-W + 0.75, 1.86, ROW_Z[2] - 0.75);
    add('lamp', box(0.6, 0.1, 0.34, 0x4a4a52, -W + 0.75, 1.93, ROW_Z[2] - 0.75), glow, box(0.5, 0.05, 0.05, 0x4a4a52, -W + 0.25, 1.95, ROW_Z[2] - 0.75));
    // Radiateur près de la porte.
    const fins: THREE.Object3D[] = [];
    for (let k = 0; k < 5; k++) fins.push(box(0.1, 0.5, 0.3, 0xf2efe6, -W + 0.35, 0.3, ROW_Z[2] + 0.85 + k * 0.13 - 0.26));
    fins.push(box(0.06, 0.06, 0.06, 0xe2604f, -W + 0.35, 0.6, ROW_Z[2] + 0.55));
    add('heat', ...fins);
    // Ventilateur au bout de la table.
    const blades = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const bl = box(0.3, 0.07, 0.02, 0xdfe6e8, 0.15, 0, 0, false);
      const arm = new THREE.Group();
      arm.rotation.z = (k / 3) * Math.PI * 2;
      arm.add(bl);
      blades.add(arm);
    }
    blades.position.set(BASIN_X + 0.05, TABLE_Y + 0.5, ROW_Z[3]);
    blades.rotation.y = -Math.PI / 2;
    this.fanBlades = blades;
    add('fan', box(0.08, 0.5, 0.08, 0x7a8288, BASIN_X + 0.1, TABLE_Y + 0.25, ROW_Z[3]), box(0.3, 0.05, 0.3, 0x7a8288, BASIN_X + 0.1, TABLE_Y + 0.03, ROW_Z[3]), blades);
  }

  private buildSlot(i: number): SlotView {
    const r = Math.floor(i / SLOTS_PER_ZONE);
    const c = i % SLOTS_PER_ZONE;
    const base = new THREE.Vector3(COL_X[c], r === 3 ? TABLE_Y : 0, ROW_Z[r]);
    const root = new THREE.Group();
    root.position.copy(base);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.38, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.03;
    root.add(marker);
    this.scene.add(root);
    return { root, pot: null, marker, plant: null, key: '', pop: 0, base };
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.renderer.setSize(this.w, this.h, false);
    this.setView(this.zone);
    this.view = { ...this.goal };
    this.applyView();
  }

  /** Cadre la vue d'ensemble (-1) ou une zone (0..3). La caméra y glisse en douceur. */
  setView(zone: number): void {
    this.zone = zone;
    if (zone < 0) {
      // Le décor occupe ~6,7 unités de large et ~8,6 de haut à l'écran ; on le cale sous le bandeau du haut.
      this.goal = { u: Math.min(this.w / 6.7, (this.h - 290) / 8.6), cx: 0.25, cy: 5.05, ay: 150 };
    } else {
      const c = new THREE.Vector3(0, (zone === 3 ? TABLE_Y : 0) + 0.75, ROW_Z[zone]).applyMatrix4(this.camera.matrixWorldInverse);
      this.goal = { u: Math.min(this.w / 4.1, (this.h - 300) / 3.4), cx: c.x, cy: c.y, ay: this.h * 0.46 };
    }
  }

  get currentZone(): number {
    return this.zone;
  }

  private applyView(): void {
    const v = this.view;
    this.unit = v.u;
    this.camera.left = v.cx - this.w / (2 * v.u);
    this.camera.right = v.cx + this.w / (2 * v.u);
    this.camera.top = v.cy + v.ay / v.u;
    this.camera.bottom = this.camera.top - this.h / v.u;
    this.camera.updateProjectionMatrix();
  }

  /** Aligne le décor sur l'état du jeu. Ne reconstruit un modèle que si son aspect change. */
  sync(s: State): void {
    this.crates.forEach((c, z) => { c.visible = !s.zonesOpen[z]; });
    for (const k of Object.keys(this.gear)) this.gear[k].visible = !!s.upgrades[k as keyof State['upgrades']];
    s.showcase.forEach((h, k) => {
      const v = this.shows[k];
      const key = h ? `${h.sp}|${h.vr}` : '';
      if (key === v.key) return;
      if (v.plant) v.root.remove(v.plant);
      v.plant = h ? buildPlant(SPECIES_BY_ID[h.sp], 4, 1, h.vr) : null;
      if (v.plant) {
        v.plant.position.y = POT_TOP;
        v.root.add(v.plant);
      }
      v.key = key;
    });
    s.slots.forEach((slot, i) => {
      const v = this.slots[i];
      v.marker.visible = !slot.pot && s.zonesOpen[Math.floor(i / SLOTS_PER_ZONE)];
      if (!slot.pot && v.pot) {
        v.root.remove(v.pot);
        v.pot = null;
      }
      if (slot.pot && !v.pot) {
        v.pot = buildPot();
        v.root.add(v.pot);
        if (v.key !== '') v.pop = 1;
      }
      const p = slot.plant;
      let key = slot.pot ? 'pot' : 'none';
      if (p) {
        const sp = SPECIES_BY_ID[p.sp];
        const fit = fitOf(sp, zoneClimate(s, zoneOfSlot(i)));
        const health = Math.min(fit, p.water > 0 ? 1 : 0.75) * (p.pests > 0 ? 0.8 : 1);
        key = `${p.sp}|${stageOf(p.prog)}|${Math.round(health * 5)}|${stageOf(p.prog) >= 2 ? p.vr : 0}`;
        if (key !== v.key) {
          if (v.plant) v.root.remove(v.plant);
          v.plant = buildPlant(sp, stageOf(p.prog), health, stageOf(p.prog) >= 2 ? p.vr : 0);
          v.plant.position.y = POT_TOP;
          v.root.add(v.plant);
          if (v.key.split('|')[1] !== key.split('|')[1]) v.pop = 1;
        }
        const st = stageOf(p.prog);
        const frac = st >= 4 ? 1 : p.prog * 4 - st;
        v.plant!.userData.grow = 0.82 + 0.18 * frac;
      } else if (v.plant) {
        v.root.remove(v.plant);
        v.plant = null;
      }
      v.key = key;
    });
  }

  /** Soulève un pot pendant qu'on le déplace (-1 pour tout reposer). */
  lift(i: number): void {
    this.lifted = i;
  }

  pop(i: number): void {
    this.slots[i].pop = 1;
  }

  render(t: number, dt: number): void {
    const k = Math.min(1, dt * 7);
    const v = this.view, g = this.goal;
    if (Math.abs(v.u - g.u) + Math.abs(v.cx - g.cx) + Math.abs(v.cy - g.cy) + Math.abs(v.ay - g.ay) > 0.01) {
      v.u += (g.u - v.u) * k; v.cx += (g.cx - v.cx) * k; v.cy += (g.cy - v.cy) * k; v.ay += (g.ay - v.ay) * k;
      this.applyView();
    }
    this.slots.forEach((v, i) => {
      v.pop = Math.max(0, v.pop - dt * 2.6);
      const bounce = 1 + Math.sin(v.pop * Math.PI) * 0.22;
      v.root.scale.set(bounce, 1 + Math.sin(v.pop * Math.PI) * 0.3, bounce);
      v.root.position.y += ((v.base.y + (this.lifted === i ? 0.45 : 0)) - v.root.position.y) * Math.min(1, dt * 12);
      if (v.plant) {
        const g = (v.plant.userData.grow as number) ?? 1;
        v.plant.scale.setScalar(1.25 * g);
        v.plant.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.035;
        v.plant.rotation.x = Math.cos(t * 1.1 + i * 0.9) * 0.025;
      }
      if (v.marker.visible) v.marker.scale.setScalar(1 + Math.sin(t * 2.2 + i) * 0.06);
    });
    this.mist.forEach((m) => {
      const ph = (t * 0.12 + m.userData.phase) % 1;
      m.position.set(BASIN_X - ph * 1.6 + Math.sin(ph * 9 + m.userData.phase * 20) * 0.15, 0.4 + ph * 1.1, ROW_Z[1] + Math.sin(m.userData.phase * 30) * 0.3);
      m.scale.setScalar(0.6 + ph * 1.6);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.34 * Math.sin(ph * Math.PI);
    });
    this.water.position.y = 0.27 + Math.sin(t * 1.5) * 0.008;
    this.bugs.forEach((b) => {
      const k = b.userData.k as number;
      const a = t * 0.35 + k * 1.9;
      b.position.set(COL_X[k % 3] + Math.cos(a) * 0.42, (k >= 3 ? 0 : 0) + 0.05, ROW_Z[(k * 2 + 1) % 3] + Math.sin(a) * 0.42);
    });
    if (this.fanBlades) this.fanBlades.rotation.x = t * 9;
    this.shows.forEach((v, k) => { if (v.plant) v.plant.rotation.z = Math.sin(t * 1.1 + k) * 0.03; });
    this.renderer.render(this.scene, this.camera);
  }

  /** Position écran (px, relative au canvas) du pied et du sommet d'un emplacement. */
  slotRect(i: number): { x: number; top: number; bottom: number; unit: number } {
    const v = this.slots[i];
    const foot = v.base.clone().project(this.camera);
    const head = v.base.clone().setY(v.base.y + 1.55).project(this.camera);
    return {
      x: (foot.x * 0.5 + 0.5) * this.w,
      bottom: (1 - (foot.y * 0.5 + 0.5)) * this.h,
      top: (1 - (head.y * 0.5 + 0.5)) * this.h,
      unit: this.unit,
    };
  }

  /** Position écran d'un socle de la vitrine. */
  showRect(k: number): { x: number; y: number } {
    const p = new THREE.Vector3(SHOW_X[k], 3.55, -HALF_D + 0.4).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (1 - (p.y * 0.5 + 0.5)) * this.h };
  }

  /** Position écran du centre d'une zone, pour y accrocher un cadenas. */
  zoneCenter(r: number): { x: number; y: number } {
    const p = new THREE.Vector3(0, (r === 3 ? TABLE_Y : 0) + 0.9, ROW_Z[r]).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (1 - (p.y * 0.5 + 0.5)) * this.h };
  }
}
export const ZONE_COUNT = ZONES.length;
