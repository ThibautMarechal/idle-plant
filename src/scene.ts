import * as THREE from 'three';
import { BASE_SLOTS, GARDEN_FIRST, GARDEN_INDEX, POT_SIZES, SLOT_COUNT, SLOTS_PER_ZONE, SPECIES_BY_ID, ZONES } from './data';
import { buildPlant, buildPot, mat, POT_TOP } from './plants3d';
import { fitOf, slotOpen, stageOf, zoneClimate, zoneOfSlot } from './sim';
import type { State } from './sim';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { potModel } from './pots';
import { artStyle, finish, setArtStyle } from './styles';
import { box, themeOf } from './themes';
import type { Theme, V3 } from './themes';

interface SlotView {
  root: THREE.Group;
  pot: THREE.Group | null;
  potKey: string;
  marker: THREE.Mesh;
  crate: THREE.Object3D;
  /** Planche et cordes d'une suspension (emplacements 12 et plus). */
  hanger: THREE.Object3D | null;
  drip: THREE.Object3D;
  plant: THREE.Group | null;
  key: string;
  pop: number;
  base: THREE.Vector3;
}

const v3 = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);
/** En première personne, la vue se cale tous les huitièmes de tour. */
const STEP = Math.PI / 4;
/** Demi-champ horizontal, vue calée : un pan de mur et ses trois pots tiennent dans la largeur. */
const HALF_FOV = 0.43;

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera: THREE.OrthographicCamera | THREE.PerspectiveCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  /** Première personne : cap (0 = face au premier coin, sens horaire), inclinaison, grossissement. */
  private look = { yaw: 0, pitch: 0, zoom: 1 };
  private aim = { yaw: 0, pitch: 0, zoom: 1 };
  private pannedAt = 0;
  private panStart = 0;
  /** Où l'on se tient : 0 dans la serre, 1 au jardin. */
  spot = 0;
  private doors: THREE.Object3D[] = [];
  private now = 0;
  private theme!: Theme;
  private slots: SlotView[] = [];
  private mist: THREE.Mesh[] = [];
  private waters: THREE.Object3D[] = [];
  private w = 1;
  private h = 1;
  private unit = 50;
  private view = { u: 50, cx: 0, cy: 0, ay: 100 };
  private goal = { u: 50, cx: 0, cy: 0, ay: 100 };
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
    const far = t.fp ? 17 : 7;
    if (t.fp) sun.shadow.mapSize.set(2048, 2048);
    sc.left = -far; sc.right = far; sc.top = far; sc.bottom = -far; sc.near = 1; sc.far = 34 + far;
    sun.shadow.bias = -0.002;
    sun.shadow.radius = st.shadowRadius;
    add(sun);

    t.build(add);
    this.doors = [];
    this.world.traverse((o) => { if (o.userData.water) this.waters.push(o); if (o.userData.door) this.doors.push(o); });

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

    if (t.fp) {
      this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);
      this.camera.rotation.order = 'YXZ';
      this.spot = 0;
      this.camera.position.set(0, t.fp.eye, 0);
      this.aim = { yaw: Math.round(this.aim.yaw / STEP) * STEP, pitch: t.fp.pitch, zoom: 1 };
      this.look = { ...this.aim };
    } else {
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      const dir = new THREE.Vector3(Math.sin(t.yaw) * Math.cos(t.pitch), Math.sin(t.pitch), Math.cos(t.yaw) * Math.cos(t.pitch));
      this.camera.position.copy(dir.multiplyScalar(30));
      this.camera.lookAt(0, 0, 0);
    }
    this.camera.updateMatrixWorld(true);
    if (this.composer) for (const p of this.composer.passes) if ('camera' in p) (p as unknown as { camera: THREE.Camera }).camera = this.camera;
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
    const fp = !!this.theme.fp;
    const place = (grp: THREE.Group, p: V3) => { grp.position.set(p[0], p[1], p[2]); grp.rotation.y = fp ? -Math.atan2(p[0], -p[2]) : 0; };
    // Brumisateur.
    place(add('mist', box(0.5, 0.16, 0.22, 0xe8eef0, 0, 0, 0), box(0.1, 0.1, 0.1, 0x6fc7e0, 0, -0.12, 0.05)), g.mist);
    // Lampe horticole sur pied.
    const ly = g.lamp[1];
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.26), new THREE.MeshBasicMaterial({ color: 0xff9ad8 }));
    glow.position.set(0, -0.07, 0);
    place(add('lamp', box(0.6, 0.1, 0.34, 0x4a4a52, 0, 0, 0), glow, box(0.05, ly, 0.05, 0x4a4a52, -0.3, -ly / 2, -0.12)), g.lamp);
    // Radiateur.
    const fins: THREE.Object3D[] = [];
    for (let k = 0; k < 5; k++) fins.push(fp ? box(0.1, 0.5, 0.2, 0xf2efe6, k * 0.13 - 0.26, 0.3, 0) : box(0.1, 0.5, 0.3, 0xf2efe6, 0, 0.3, k * 0.13 - 0.26));
    fins.push(box(0.06, 0.06, 0.06, 0xe2604f, fp ? -0.36 : 0, 0.6, fp ? 0 : -0.3));
    place(add('heat', ...fins), g.heat);
    // Ventilateur.
    const blades = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Group();
      arm.rotation.z = (k / 3) * Math.PI * 2;
      arm.add(box(0.3, 0.07, 0.02, 0xdfe6e8, 0.15, 0, 0, false));
      blades.add(arm);
    }
    blades.position.set(0, 0.5, 0.06);
    this.fanBlades = blades;
    place(add('fan', box(0.08, 0.5, 0.08, 0x7a8288, 0, 0.25, 0), box(0.3, 0.05, 0.3, 0x7a8288, 0, 0.03, 0), blades), g.fan);
  }

  private buildSlot(i: number): SlotView {
    // Un décor sans jardin range ces emplacements hors de vue.
    const base = v3(this.theme.slots[i] ?? [0, -80, 0]);
    const root = new THREE.Group();
    root.position.copy(base);
    // En première personne, chaque pot fait face au jardinier.
    if (this.theme.fp) root.rotation.y = -Math.atan2(base.x, -base.z);
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
    if (i < BASE_SLOTS) crate.add(box(sz, sz * 0.8, sz, i % 2 ? 0xb98a5a : 0xa9794f, 0, sz * 0.4, 0), box(sz * 1.04, 0.05, sz * 0.2, 0x8a5f3c, 0, sz * 0.8, 0));
    crate.position.copy(base);
    crate.rotation.y = i * 0.5;
    crate.visible = false;
    // Goutteur de l'arrosage automatique, accroché au bord du pot.
    const drip = new THREE.Group();
    drip.add(box(0.04, 0.5, 0.04, 0xc98a4a, -0.47, 0.3, 0), box(0.16, 0.04, 0.04, 0xc98a4a, -0.41, 0.56, 0), box(0.05, 0.07, 0.05, 0x5a9fd4, -0.33, 0.53, 0));
    drip.visible = false;
    root.add(drip);
    let hanger: THREE.Group | null = null;
    if (i >= BASE_SLOTS && i < GARDEN_FIRST) {
      hanger = new THREE.Group();
      hanger.add(box(0.95, 0.06, 0.6, 0xb98a5a, 0, -0.03, 0));
      for (const sx of [-0.42, 0.42]) hanger.add(box(0.025, 1.9, 0.025, 0xe8dcc0, sx, 0.95, 0, false));
      hanger.visible = false;
      root.add(hanger);
    }
    this.world.add(root, crate);
    return { root, hanger, pot: null, potKey: '', marker, crate, drip, plant: null, key: '', pop: 0, base };
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
    this.setView(-1);
    this.view = { ...this.goal };
    this.look = { ...this.aim };
    this.applyView();
  }

  /** Cadre de la vue d'ensemble : zoom minimal et limites de déplacement. */
  private fit = { u: 50, minX: 0, maxX: 0, minY: 0, maxY: 0 };

  /** Cadre la vue d'ensemble (-1) ou une zone (0..3). La caméra y glisse en douceur. */
  setView(zone: number): void {
    if (this.theme.fp) {
      this.aim.zoom = 1;
      this.aim.pitch = this.theme.fp.pitch;
      this.aim.yaw = zone >= 0 ? this.near(zone * 2 * STEP) : Math.round(this.aim.yaw / STEP) * STEP;
      return;
    }
    // Vue d'ensemble : tous les pots et la vitrine, entre le bandeau du haut et la barre du bas.
    const all = this.slots.map((s) => s.base.clone().setY(s.base.y + 1.4)).concat(this.slots.map((s) => s.base))
      .concat(this.theme.shows.map((p) => v3(p).setY(p[1] + 1.2)));
    const fa = this.frame(all);
    const room = this.h - 250;
    this.fit = { u: Math.min(this.w / (fa.maxX - fa.minX + 1.3), room / (fa.maxY - fa.minY + 0.6)), ...fa };
    if (zone < 0) {
      this.goal = { u: this.fit.u, cx: (fa.minX + fa.maxX) / 2, cy: (fa.minY + fa.maxY) / 2, ay: 70 + room / 2 };
    } else {
      const pts = this.slots.slice(zone * SLOTS_PER_ZONE, (zone + 1) * SLOTS_PER_ZONE).concat(this.slots[BASE_SLOTS + zone])
        .flatMap((s) => [s.base, s.base.clone().setY(s.base.y + 1.5)]);
      const f = this.frame(pts);
      const u = Math.min(this.w / 4.1, this.w / (f.maxX - f.minX + 1.5), (this.h - 330) / (f.maxY - f.minY + 0.5));
      this.goal = { u, cx: (f.minX + f.maxX) / 2, cy: (f.minY + f.maxY) / 2, ay: this.h * 0.47 };
    }
  }

  /** Garde la vue dans le décor, et revient pile sur la vue d'ensemble quand on dézoome à fond. */
  private clampGoal(): void {
    const g = this.goal, f = this.fit;
    g.u = Math.max(f.u, Math.min(this.w / 4.4, g.u));
    if (g.u <= f.u * 1.03) { this.setView(-1); return; }
    g.cx = Math.max(f.minX, Math.min(f.maxX, g.cx));
    // Centre visible en hauteur : cy + (ay - h/2) / u.
    const off = (g.ay - this.h / 2) / g.u;
    g.cy = Math.max(f.minY, Math.min(f.maxY, g.cy + off)) - off;
  }

  /** Déplace la vue du doigt : le décor suit exactement. */
  panBy(dx: number, dy: number, edge = false): void {
    if (this.theme.fp) {
      // Le décor suit le doigt : un écran de large vaut le champ de vision.
      const k = ((2 * HALF_FOV) / this.aim.zoom / this.w) * 1.35;
      // Début d'un geste : on retient le coin d'où l'on part.
      if (this.now - this.pannedAt > 0.25) this.panStart = Math.round(this.aim.yaw / STEP) * STEP;
      this.aim.yaw -= dx * k * (edge ? 1.6 : 1);
      if (!edge) this.aim.pitch = Math.max(-0.3, Math.min(0.5, this.aim.pitch + dy * k));
      this.look = { ...this.aim };
      this.pannedAt = this.now;
      this.applyView();
      return;
    }
    if (!this.zoomed) return;
    const g = this.goal;
    g.cx -= dx / g.u;
    g.cy += dy / g.u;
    this.clampGoal();
    this.view = { ...this.goal };
    this.applyView();
  }

  /** Zoome d'un facteur k en gardant fixe le point (sx, sy) de l'écran. `smooth` : la caméra y glisse. */
  zoomAt(k: number, sx: number, sy: number, smooth = false): void {
    if (this.theme.fp) {
      this.aim.zoom = Math.max(1, Math.min(2.6, this.aim.zoom * k));
      this.pannedAt = this.now;
      if (!smooth) { this.look.zoom = this.aim.zoom; this.applyView(); }
      return;
    }
    const g = this.goal;
    const u2 = Math.max(this.fit.u, Math.min(this.w / 4.4, g.u * k));
    const X = g.cx - this.w / (2 * g.u) + sx / g.u;
    const Y = g.cy + g.ay / g.u - sy / g.u;
    g.cx = X + this.w / (2 * u2) - sx / u2;
    g.cy = Y + sy / u2 - g.ay / u2;
    g.u = u2;
    this.clampGoal();
    if (!smooth) { this.view = { ...this.goal }; this.applyView(); }
  }

  /** Double-touche : on s'approche de l'endroit touché, ou on revient à la vue d'ensemble. */
  toggleZoom(sx: number, sy: number): void {
    if (this.theme.fp) {
      if (this.zoomed) { this.setView(-1); return; }
      // On se tourne vers l'endroit touché et on s'en approche.
      const t = Math.tan(HALF_FOV) / this.aim.zoom;
      this.aim.yaw += Math.atan(((sx / this.w) * 2 - 1) * t);
      this.aim.pitch = Math.max(-0.3, Math.min(0.5, this.aim.pitch + Math.atan((1 - (sy / this.h) * 2) * t * (this.h / this.w)) * 0.7));
      this.aim.zoom = 1.9;
      this.pannedAt = this.now;
      return;
    }
    if (this.zoomed) this.setView(-1);
    else this.zoomAt((this.w / 5.2) / this.goal.u, sx, sy, true);
  }

  /** Cap équivalent à `yaw` le plus proche du cap actuel : on tourne par le plus court. */
  private near(yaw: number): number {
    const d = yaw - this.aim.yaw;
    return this.aim.yaw + d - Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  }

  get fp(): boolean {
    return !!this.theme.fp;
  }

  /** Doigt levé après un balayage : un petit geste suffit pour passer au coin voisin, dans le sens du geste. */
  release(): void {
    if (!this.theme.fp || this.aim.zoom > 1.15) return;
    const d = this.aim.yaw - this.panStart;
    this.aim.yaw = Math.abs(d) < 0.07 ? this.panStart : this.panStart + Math.sign(d) * Math.max(1, Math.round(Math.abs(d) / STEP)) * STEP;
    this.pannedAt = -1;
  }

  /** Passe la porte : on marche jusqu'à l'autre endroit, tourné vers `deg`. */
  walk(spot: number, deg: number): void {
    if (!this.theme.fp) return;
    this.spot = spot;
    this.aim.zoom = 1;
    this.aim.pitch = this.theme.fp.pitch;
    this.aim.yaw = this.near((deg * Math.PI) / 180);
    this.pannedAt = this.now;
  }

  /** Vrai si l'emplacement est là où l'on se tient. */
  private here(i: number): boolean {
    return !this.theme.fp || (i >= GARDEN_FIRST ? 1 : 0) === this.spot;
  }

  /** Position écran d'un objet cliquable du décor, et taille d'une unité à cet endroit. */
  hotRect(k: number): { x: number; y: number; unit: number } {
    const h = this.theme.fp?.hot[k];
    if (!h || (h.spot >= 0 && h.spot !== this.spot)) return { x: -9999, y: -9999, unit: 0 };
    const a = this.screen(v3(h.at)), b = this.screen(v3(h.at).setY(h.at[1] + 1));
    return { x: a.x, y: a.y, unit: Math.abs(a.y - b.y) };
  }

  /** Vrai en première personne : il n'y a pas de vue d'ensemble, on est toujours près des pots. */
  get close(): boolean {
    return !!this.theme.fp || this.zoomed;
  }

  get zoomed(): boolean {
    if (this.theme.fp) return this.aim.zoom > 1.15;
    return this.goal.u > this.fit.u * 1.25;
  }

  private applyView(): void {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const c = this.camera, l = this.look;
      c.aspect = this.w / this.h;
      c.fov = Math.min(100, (2 * Math.atan(Math.tan(HALF_FOV) / c.aspect) * 180) / Math.PI);
      c.zoom = l.zoom;
      c.rotation.set(l.pitch, -l.yaw, 0);
      c.updateProjectionMatrix();
      c.updateMatrixWorld(true);
      return;
    }
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
    for (const d of this.doors) d.visible = !s.zonesOpen[GARDEN_INDEX];
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
      const open = slotOpen(s, i);
      v.crate.visible = !open && i < BASE_SLOTS;
      if (v.hanger) v.hanger.visible = open;
      v.marker.visible = !slot.pot && open;
      v.drip.visible = slot.pot && s.upgrades.water;
      // Le pot : taille, émail et motif viennent de l'atelier ; sans dessin, c'est le pot du décor.
      const pd = slot.pd;
      const scale = slot.pot ? POT_SIZES[(pd?.size ?? 1) - 1].scale : 1;
      const potKey = slot.pot ? `${pd?.size ?? 1}|${pd?.glaze ?? -1}|${pd?.pat ?? 0}|${pd?.pv ?? 0}|${pd?.prof?.join(',') ?? ''}` : '';
      if (potKey !== v.potKey) {
        if (v.pot) v.root.remove(v.pot);
        v.pot = null;
        if (slot.pot) {
          v.pot = finish(potModel(pd, this.theme.pot));
          v.pot.scale.setScalar(scale);
          v.root.add(v.pot);
          if (v.key !== '') v.pop = 1;
        }
        v.potKey = potKey;
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
          v.root.add(v.plant);
          if (v.key.split('|')[1] !== key.split('|')[1]) v.pop = 1;
        }
        const frac = st >= 4 ? 1 : p.prog * 4 - st;
        v.plant!.position.y = POT_TOP * scale;
        v.plant!.userData.grow = (0.82 + 0.18 * frac) * [1, 1.1, 1.2][(sp.size ?? 1) - 1];
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

  /** Amène le pot soulevé sous le doigt : on projette le point de l'écran sur le plan qui coupe le pot à mi-hauteur. */
  dragTo(sx: number, sy: number): void {
    if (this.lifted < 0) return;
    const v = this.slots[this.lifted];
    if (this.theme.fp) {
      // Le pot reste à bout de bras, à la distance des étagères.
      const d = new THREE.Vector3((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
      const t = 3.9 / Math.max(0.2, Math.hypot(d.x, d.z));
      v.root.position.copy(this.camera.position).addScaledVector(d, t);
      v.root.position.y -= 0.3;
      return;
    }
    const y = v.base.y + 0.45;
    const o = new THREE.Vector3((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1, -1).unproject(this.camera);
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    // Le doigt tient le pot par son milieu, pas par son pied.
    const t = (y + 0.26 - o.y) / d.y;
    v.root.position.set(o.x + d.x * t, y, o.z + d.z * t);
  }

  pop(i: number): void {
    this.slots[i].pop = 1;
  }

  render(t: number, dt: number): void {
    const k = Math.min(1, dt * 7);
    this.now = t;
    if (this.theme.fp) {
      const l = this.look, a = this.aim;
      // Doigt levé, la vue se cale en douceur face au coin le plus proche.
      if (t - this.pannedAt > 0.3 && a.zoom <= 1.15 && this.lifted < 0) a.yaw = Math.round(a.yaw / STEP) * STEP;
      const [px, , pz] = this.theme.fp.spots[this.spot];
      const cp = this.camera.position, far = Math.abs(cp.x - px) + Math.abs(cp.z - pz) > 0.002;
      if (far) { cp.x += (px - cp.x) * Math.min(1, dt * 3.2); cp.z += (pz - cp.z) * Math.min(1, dt * 3.2); }
      if (far || Math.abs(l.yaw - a.yaw) + Math.abs(l.pitch - a.pitch) + Math.abs(l.zoom - a.zoom) > 0.0005) {
        l.yaw += (a.yaw - l.yaw) * k; l.pitch += (a.pitch - l.pitch) * k; l.zoom += (a.zoom - l.zoom) * k;
        this.applyView();
      }
    }
    const v = this.view, g = this.goal;
    if (!this.theme.fp && Math.abs(v.u - g.u) + Math.abs(v.cx - g.cx) + Math.abs(v.cy - g.cy) + Math.abs(v.ay - g.ay) > 0.01) {
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
      const home = this.slots[(n * 5 + 1) % BASE_SLOTS].base;
      b.position.set(home.x + Math.cos(a) * 0.45, home.y + 0.05, home.z + Math.sin(a) * 0.45);
    });
    if (this.fanBlades) this.fanBlades.rotation.z = t * 9;
    this.shows.forEach((sv, n) => { if (sv.plant) sv.plant.rotation.z = Math.sin(t * 1.1 + n) * 0.03; });
    if (this.composer) this.composer.render(dt);
    else if (this.outline) this.outline.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  private screen(p: THREE.Vector3): { x: number; y: number } {
    // Derrière soi : hors écran.
    if (this.theme.fp && this.cam(p).z > -0.3) return { x: -9999, y: -9999 };
    const q = p.clone().project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * this.w, y: (1 - (q.y * 0.5 + 0.5)) * this.h };
  }

  /** Position écran (px, relative au canvas) du pied et du sommet d'un emplacement. */
  slotRect(i: number): { x: number; top: number; bottom: number; unit: number } {
    const v = this.slots[i];
    if (!this.here(i)) return { x: -9999, bottom: -9999, top: -9999, unit: 1 };
    const foot = this.screen(v.base);
    const head = this.screen(v.base.clone().setY(v.base.y + 1.55));
    return { x: foot.x, bottom: foot.y, top: head.y, unit: this.theme.fp ? (foot.y - head.y) / 1.55 : this.unit };
  }

  /** Position écran d'un socle de la vitrine. */
  showRect(k: number): { x: number; y: number } {
    if (this.theme.fp && this.spot) return { x: -9999, y: -9999 };
    return this.screen(v3(this.theme.shows[k]).add(new THREE.Vector3(0, 1.35, 0)));
  }

  /** Position écran du centre d'une zone, pour y accrocher un cadenas. */
  zoneCenter(r: number): { x: number; y: number } {
    const c = new THREE.Vector3();
    if (this.theme.fp && this.spot) return { x: -9999, y: -9999 };
    for (let k = 0; k < SLOTS_PER_ZONE; k++) c.add(this.slots[r * SLOTS_PER_ZONE + k].base);
    return this.screen(c.multiplyScalar(1 / SLOTS_PER_ZONE).add(new THREE.Vector3(0, 1.1, 0)));
  }
}
export const ZONE_COUNT = ZONES.length;
