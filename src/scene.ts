import * as THREE from 'three';
import { SLOT_COUNT, SLOTS_PER_ZONE, SPECIES_BY_ID, ZONES } from './data';
import { buildPlant, buildPot, mat, POT_TOP } from './plants3d';
import { fitOf, stageOf, zoneClimate, zoneOfSlot } from './sim';
import type { State } from './sim';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { artStyle, finish, setArtStyle } from './styles';
import { box, themeOf } from './themes';
import type { Theme, V3 } from './themes';

interface SlotView {
  root: THREE.Group;
  pot: THREE.Group | null;
  marker: THREE.Mesh;
  crate: THREE.Object3D;
  drip: THREE.Object3D;
  plant: THREE.Group | null;
  key: string;
  pop: number;
  base: THREE.Vector3;
}

const v3 = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private theme!: Theme;
  private slots: SlotView[] = [];
  private mist: THREE.Mesh[] = [];
  private waters: THREE.Object3D[] = [];
  private w = 1;
  private h = 1;
  private unit = 50;
  private view = { u: 50, cx: 0, cy: 0, ay: 100 };
  private goal = { u: 50, cx: 0, cy: 0, ay: 100 };
  private zone = -1;
  private shows: { root: THREE.Group; plant: THREE.Group | null; key: string }[] = [];
  private gear: Record<string, THREE.Object3D> = {};
  private bugs: THREE.Mesh[] = [];
  private fanBlades: THREE.Group | null = null;
  private lifted = -1;
  private outline: OutlineEffect | null = null;
  private composer: EffectComposer | null = null;

  constructor(private canvas: HTMLCanvasElement, themeId?: string, styleId?: string) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.theme = themeOf(themeId);
    this.setStyle(styleId);
  }

  get styleId(): string {
    return artStyle().id;
  }

  /** Change de direction artistique : tout est repeint et reconstruit. */
  setStyle(id?: string): void {
    const st = setArtStyle(id);
    this.outline = st.outline ? new OutlineEffect(this.renderer, { defaultThickness: st.outline, defaultColor: [0.03, 0.02, 0.05], defaultAlpha: 1 }) : null;
    this.composer?.dispose();
    this.composer = null;
    if (st.pixel) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPixelatedPass(st.pixel, this.scene, this.camera, { normalEdgeStrength: 0.25, depthEdgeStrength: 0.5 }));
      this.composer.addPass(new OutputPass());
    }
    this.canvas.style.imageRendering = st.pixel ? 'pixelated' : '';
    this.setTheme(this.theme.id);
  }

  get themeId(): string {
    return this.theme.id;
  }

  /** Reconstruit tout le décor. Les plantes sont replacées au prochain `sync`. */
  setTheme(id?: string): void {
    const t = themeOf(id);
    const st = artStyle();
    this.theme = t;
    this.scene.remove(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.slots = [];
    this.mist = [];
    this.waters = [];
    this.shows = [];
    this.gear = {};
    this.bugs = [];
    this.fanBlades = null;
    this.lifted = -1;
    const add = (...o: THREE.Object3D[]) => { this.world.add(...o); };

    add(new THREE.HemisphereLight(t.hemi[0], t.hemi[1], t.hemi[2] * st.hemi));
    const sun = new THREE.DirectionalLight(t.sun[0], t.sun[1] * st.sun);
    sun.position.copy(v3(t.sun[2]));
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 34;
    sun.shadow.bias = -0.002;
    sun.shadow.radius = st.shadowRadius;
    add(sun);

    t.build(add);
    this.world.traverse((o) => { if (o.userData.water) this.waters.push(o); });

    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), mistMat.clone());
      m.userData.phase = k / 6;
      this.mist.push(m);
      add(m);
    }
    t.shows.forEach((p) => {
      const root = new THREE.Group();
      root.position.copy(v3(p));
      root.scale.setScalar(0.72);
      root.add(buildPot(t.showPot[0], t.showPot[1]));
      add(root);
      this.shows.push({ root, plant: null, key: '' });
    });
    for (let i = 0; i < SLOT_COUNT; i++) this.slots.push(this.buildSlot(i));
    this.buildGear();
    finish(this.world);

    const dir = new THREE.Vector3(Math.sin(t.yaw) * Math.cos(t.pitch), Math.sin(t.pitch), Math.cos(t.yaw) * Math.cos(t.pitch));
    this.camera.position.copy(dir.multiplyScalar(30));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld(true);
    this.resize();
  }

  /** Équipements : invisibles tant qu'ils ne sont pas achetés. */
  private buildGear(): void {
    const g = this.theme.gear;
    const add = (name: string, ...parts: THREE.Object3D[]) => {
      const grp = new THREE.Group();
      if (parts.length) grp.add(...parts);
      grp.visible = false;
      this.gear[name] = grp;
      this.world.add(grp);
      return grp;
    };
    // Coccinelles.
    const bugGroup = add('bugs');
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xe2382f));
      b.scale.y = 0.6;
      b.userData.k = k;
      this.bugs.push(b);
      bugGroup.add(b);
    }
    // Brumisateur.
    const [mx, my, mz] = g.mist;
    add('mist', box(0.5, 0.16, 0.22, 0xe8eef0, mx, my, mz), box(0.1, 0.1, 0.1, 0x6fc7e0, mx, my - 0.12, mz + 0.05));
    // Lampe horticole sur pied.
    const [lx, ly, lz] = g.lamp;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0xff9ad8 }));
    glow.position.set(lx, ly - 0.07, lz);
    add('lamp', box(0.6, 0.1, 0.34, 0x4a4a52, lx, ly, lz), glow, box(0.05, ly, 0.05, 0x4a4a52, lx - 0.3, ly / 2, lz - 0.12));
    // Radiateur.
    const [hx, hy, hz] = g.heat;
    const fins: THREE.Object3D[] = [];
    for (let k = 0; k < 5; k++) fins.push(box(0.1, 0.5, 0.3, 0xf2efe6, hx, hy + 0.3, hz + k * 0.13 - 0.26));
    fins.push(box(0.06, 0.06, 0.06, 0xe2604f, hx, hy + 0.6, hz - 0.3));
    add('heat', ...fins);
    // Ventilateur.
    const [fx, fy, fz] = g.fan;
    const blades = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Group();
      arm.rotation.z = (k / 3) * Math.PI * 2;
      arm.add(box(0.3, 0.07, 0.02, 0xdfe6e8, 0.15, 0, 0, false));
      blades.add(arm);
    }
    blades.position.set(fx, fy + 0.5, fz + 0.06);
    this.fanBlades = blades;
    add('fan', box(0.08, 0.5, 0.08, 0x7a8288, fx, fy + 0.25, fz), box(0.3, 0.05, 0.3, 0x7a8288, fx, fy + 0.03, fz), blades);
  }

  private buildSlot(i: number): SlotView {
    const base = v3(this.theme.slots[i]);
    const root = new THREE.Group();
    root.position.copy(base);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.38, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.03;
    root.add(marker);
    // Une zone pas encore aménagée est encombrée de caisses.
    const sz = 0.55 + (i % 3) * 0.1;
    const crate = new THREE.Group();
    crate.add(box(sz, sz * 0.8, sz, i % 2 ? 0xb98a5a : 0xa9794f, 0, sz * 0.4, 0), box(sz * 1.04, 0.05, sz * 0.2, 0x8a5f3c, 0, sz * 0.8, 0));
    crate.position.copy(base);
    crate.rotation.y = i * 0.5;
    crate.visible = false;
    // Goutteur de l'arrosage automatique, accroché au bord du pot.
    const drip = new THREE.Group();
    drip.add(box(0.04, 0.5, 0.04, 0xc98a4a, -0.47, 0.3, 0), box(0.16, 0.04, 0.04, 0xc98a4a, -0.41, 0.56, 0), box(0.05, 0.07, 0.05, 0x5a9fd4, -0.33, 0.53, 0));
    drip.visible = false;
    root.add(drip);
    this.world.add(root, crate);
    return { root, pot: null, marker, crate, drip, plant: null, key: '', pop: 0, base };
  }

  private cam(p: THREE.Vector3): THREE.Vector3 {
    return p.clone().applyMatrix4(this.camera.matrixWorldInverse);
  }

  private frame(points: THREE.Vector3[]): { minX: number; maxX: number; minY: number; maxY: number } {
    const f = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const p of points) {
      const c = this.cam(p);
      f.minX = Math.min(f.minX, c.x); f.maxX = Math.max(f.maxX, c.x);
      f.minY = Math.min(f.minY, c.y); f.maxY = Math.max(f.maxY, c.y);
    }
    return f;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.renderer.setSize(this.w, this.h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(this.w, this.h);
    this.setView(this.zone);
    this.view = { ...this.goal };
    this.applyView();
  }

  /** Cadre la vue d'ensemble (-1) ou une zone (0..3). La caméra y glisse en douceur. */
  setView(zone: number): void {
    this.zone = zone;
    if (zone < 0) {
      // Tout le décor, calé sous le bandeau du haut et au-dessus de la barre du bas.
      const pts = this.theme.bounds.map(v3)
        .concat(this.slots.map((s) => s.base.clone().setY(s.base.y + 1.4)))
        .concat(this.theme.shows.map((p) => v3(p).setY(p[1] + 1.2)));
      const f = this.frame(pts);
      const room = this.h - 290;
      const u = Math.min(this.w / (f.maxX - f.minX + 0.9), room / (f.maxY - f.minY));
      // Centré entre le bandeau du haut et la barre du bas.
      this.goal = { u, cx: (f.minX + f.maxX) / 2, cy: (f.minY + f.maxY) / 2, ay: 135 + room / 2 };
    } else {
      const pts = this.slots.slice(zone * SLOTS_PER_ZONE, (zone + 1) * SLOTS_PER_ZONE)
        .flatMap((s) => [s.base, s.base.clone().setY(s.base.y + 1.5)]);
      const f = this.frame(pts);
      const u = Math.min(this.w / 4.1, this.w / (f.maxX - f.minX + 1.5), (this.h - 330) / (f.maxY - f.minY + 0.5));
      this.goal = { u, cx: (f.minX + f.maxX) / 2, cy: (f.minY + f.maxY) / 2, ay: this.h * 0.47 };
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
    for (const k of Object.keys(this.gear)) this.gear[k].visible = !!s.upgrades[k as keyof State['upgrades']];
    s.showcase.forEach((h, k) => {
      const v = this.shows[k];
      const key = h ? `${h.sp}|${h.vr}` : '';
      if (key === v.key) return;
      if (v.plant) v.root.remove(v.plant);
      v.plant = h ? finish(buildPlant(SPECIES_BY_ID[h.sp], 4, 1, h.vr)) : null;
      if (v.plant) {
        v.plant.position.y = POT_TOP;
        v.root.add(v.plant);
      }
      v.key = key;
    });
    s.slots.forEach((slot, i) => {
      const v = this.slots[i];
      const open = s.zonesOpen[Math.floor(i / SLOTS_PER_ZONE)];
      v.crate.visible = !open;
      v.marker.visible = !slot.pot && open;
      v.drip.visible = slot.pot && s.upgrades.water;
      if (!slot.pot && v.pot) {
        v.root.remove(v.pot);
        v.pot = null;
      }
      if (slot.pot && !v.pot) {
        v.pot = finish(buildPot(this.theme.pot[0], this.theme.pot[1]));
        v.root.add(v.pot);
        if (v.key !== '') v.pop = 1;
      }
      const p = slot.plant;
      let key = slot.pot ? 'pot' : 'none';
      if (p) {
        const sp = SPECIES_BY_ID[p.sp];
        const fit = fitOf(sp, zoneClimate(s, zoneOfSlot(i)));
        const health = Math.min(fit, p.water > 0 ? 1 : 0.75) * (p.pests > 0 ? 0.8 : 1);
        const st = stageOf(p.prog);
        key = `${p.sp}|${st}|${Math.round(health * 5)}|${st >= 2 ? p.vr : 0}`;
        if (key !== v.key) {
          if (v.plant) v.root.remove(v.plant);
          v.plant = finish(buildPlant(sp, st, health, st >= 2 ? p.vr : 0));
          v.plant.position.y = POT_TOP;
          v.root.add(v.plant);
          if (v.key.split('|')[1] !== key.split('|')[1]) v.pop = 1;
        }
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
    if (this.lifted >= 0 && this.lifted !== i) this.slots[this.lifted].root.position.copy(this.slots[this.lifted].base);
    this.lifted = i;
  }

  /** Amène le pot soulevé sous le doigt : on projette le point de l'écran sur le plan où il flotte. */
  dragTo(sx: number, sy: number): void {
    if (this.lifted < 0) return;
    const v = this.slots[this.lifted];
    const y = v.base.y + 0.45;
    const o = new THREE.Vector3((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1, -1).unproject(this.camera);
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    const t = (y - o.y) / d.y;
    v.root.position.set(o.x + d.x * t, y, o.z + d.z * t);
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
    this.slots.forEach((sv, i) => {
      sv.pop = Math.max(0, sv.pop - dt * 2.6);
      const bounce = 1 + Math.sin(sv.pop * Math.PI) * 0.22;
      sv.root.scale.set(bounce, 1 + Math.sin(sv.pop * Math.PI) * 0.3, bounce);
      if (this.lifted !== i) sv.root.position.lerp(sv.base, Math.min(1, dt * 14));
      if (sv.plant) {
        const grow = (sv.plant.userData.grow as number) ?? 1;
        sv.plant.scale.setScalar(1.25 * grow);
        sv.plant.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.035;
        sv.plant.rotation.x = Math.cos(t * 1.1 + i * 0.9) * 0.025;
      }
      if (sv.marker.visible) sv.marker.scale.setScalar(1 + Math.sin(t * 2.2 + i) * 0.06);
    });
    const [mx, my, mz] = this.theme.mist, [dx, dy, dz] = this.theme.mistDir;
    this.mist.forEach((m) => {
      const ph = (t * 0.12 + m.userData.phase) % 1;
      m.position.set(mx + dx * ph + Math.sin(ph * 9 + m.userData.phase * 20) * 0.15, my + dy * ph, mz + dz * ph + Math.sin(m.userData.phase * 30) * 0.3);
      m.scale.setScalar(0.6 + ph * 1.6);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.34 * Math.sin(ph * Math.PI);
    });
    this.waters.forEach((w) => { w.scale.y = 1 + Math.sin(t * 1.5) * 0.25; });
    this.bugs.forEach((b) => {
      const n = b.userData.k as number;
      const a = t * 0.35 + n * 1.9;
      const home = this.slots[(n * 5 + 1) % SLOT_COUNT].base;
      b.position.set(home.x + Math.cos(a) * 0.45, home.y + 0.05, home.z + Math.sin(a) * 0.45);
    });
    if (this.fanBlades) this.fanBlades.rotation.z = t * 9;
    this.shows.forEach((sv, n) => { if (sv.plant) sv.plant.rotation.z = Math.sin(t * 1.1 + n) * 0.03; });
    if (this.composer) this.composer.render(dt);
    else if (this.outline) this.outline.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  private screen(p: THREE.Vector3): { x: number; y: number } {
    const q = p.clone().project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * this.w, y: (1 - (q.y * 0.5 + 0.5)) * this.h };
  }

  /** Position écran (px, relative au canvas) du pied et du sommet d'un emplacement. */
  slotRect(i: number): { x: number; top: number; bottom: number; unit: number } {
    const v = this.slots[i];
    const foot = this.screen(v.base);
    const head = this.screen(v.base.clone().setY(v.base.y + 1.55));
    return { x: foot.x, bottom: foot.y, top: head.y, unit: this.unit };
  }

  /** Position écran d'un socle de la vitrine. */
  showRect(k: number): { x: number; y: number } {
    return this.screen(v3(this.theme.shows[k]).add(new THREE.Vector3(0, 1.35, 0)));
  }

  /** Position écran du centre d'une zone, pour y accrocher un cadenas. */
  zoneCenter(r: number): { x: number; y: number } {
    const c = new THREE.Vector3();
    for (let k = 0; k < SLOTS_PER_ZONE; k++) c.add(this.slots[r * SLOTS_PER_ZONE + k].base);
    return this.screen(c.multiplyScalar(1 / SLOTS_PER_ZONE).add(new THREE.Vector3(0, 1.1, 0)));
  }
}
export const ZONE_COUNT = ZONES.length;
