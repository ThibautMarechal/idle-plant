import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { BIOMES, SPECIES_BY_ID, TREK_TIME } from './data';
import { buildPlant } from './plants3d';
import { artStyle, finish, mat } from './styles';

interface Find {
  id: string;
  pos: THREE.Vector3;
  root: THREE.Group;
  /** Fourré qui cache la plante : on l'écarte d'un geste avant de pouvoir cueillir. */
  cover: THREE.Group | null;
  taken: boolean;
  fly: number;
}

const EYE = 1.5;
const HALF_FOV = 0.5;

function mesh(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/**
 * L'expédition : une clairière à la première personne. On tourne la tête au doigt, on touche une plante
 * pour marcher jusqu'à elle, puis on glisse le doigt en travers de sa tige pour la prélever.
 * Comme l'établi, elle ne touche jamais à la partie : l'interface lit le panier au retour.
 */
export class Trek {
  active = false;
  basket: string[] = [];
  cap = 4;
  left = 0;
  /** Plante devant laquelle on se tient (-1 : aucune). */
  near = -1;
  biome = 0;
  /** Appelé quand le panier, la plante proche ou la fin de la sortie changent. */
  onChange: () => void = () => {};
  onPick: (id: string) => void = () => {};
  onEnd: () => void = () => {};

  private renderer: THREE.WebGLRenderer | null = null;
  private outline: OutlineEffect | null = null;
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 120);
  private finds: Find[] = [];
  private yaw = 0;
  private pitch = 0;
  private goal = new THREE.Vector3(0, EYE, 0);
  private aimYaw: number | null = null;
  private aimPitch = 0;
  private raf = 0;
  private last = 0;
  private down: { x: number; y: number; sx: number; sy: number; cut: boolean; len: number } | null = null;
  private sway: THREE.Object3D[] = [];
  private ended = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene.add(this.world);
    this.camera.rotation.order = 'YXZ';
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => this.onUp(e as PointerEvent));
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
  }

  open(biome: number, finds: { id: string; hidden: boolean }[], cap: number): void {
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
    this.left = TREK_TIME;
    this.near = -1;
    this.ended = false;
    this.yaw = 0;
    this.pitch = 0.02;
    this.aimYaw = null;
    this.goal.set(0, EYE, 0);
    this.camera.position.copy(this.goal);
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

  private build(list: { id: string; hidden: boolean }[]): void {
    const b = BIOMES[this.biome];
    const w = this.world;
    // Un tirage stable par sortie suffit : le décor n'a pas besoin d'être rejouable.
    const rnd = Math.random;
    this.scene.fog = new THREE.Fog(b.fog, 14, 46);
    w.add(new THREE.HemisphereLight(0xfff6e0, 0x8fae9a, 1.2));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.9);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 50;
    sun.shadow.bias = -0.002;
    w.add(sun);
    const ground = mesh(new THREE.CylinderGeometry(90, 90, 0.2, 40), b.ground, 0, -0.1, 0, false);
    w.add(ground);

    const patch = b.id === 'dunes' ? 0xdcc48c : b.id === 'marais' ? 0x6f9e7a : 0x7fb56c;
    for (let k = 0; k < 22; k++) {
      const a = rnd() * Math.PI * 2, r = 2 + rnd() * 16;
      const p = mesh(new THREE.CylinderGeometry(1 + rnd() * 1.8, 1, 0.02, 9), patch, Math.sin(a) * r, 0.005 + k * 0.0005, -Math.cos(a) * r, false);
      p.scale.z = 0.5 + rnd() * 0.5;
      p.userData.flat = true;
      w.add(p);
    }
    const ring = (n: number, r0: number, r1: number, make: (x: number, z: number, k: number) => void) => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.3, r = r0 + rnd() * (r1 - r0);
        make(Math.sin(a) * r, -Math.cos(a) * r, k);
      }
    };
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
    if (b.id === 'foret') {
      ring(26, 11, 24, (x, z, k) => {
        const h = 4.5 + rnd() * 3.5;
        w.add(mesh(new THREE.CylinderGeometry(0.22, 0.34, h * 0.5, 7), 0x8a5f3c, x, h * 0.25, z),
          mesh(new THREE.ConeGeometry(1.5 + rnd() * 0.6, h * 0.75, 7), k % 2 ? 0x4f9a5c : 0x3f8552, x, h * 0.8, z),
          mesh(new THREE.ConeGeometry(1.0, h * 0.5, 7), k % 2 ? 0x5fae68 : 0x4f9a5c, x, h * 1.2, z));
      });
      ring(8, 4, 9, (x, z) => w.add(mesh(new THREE.IcosahedronGeometry(0.35 + rnd() * 0.3, 0), 0x9a9a92, x, 0.15, z)));
      ring(5, 5, 9, (x, z) => w.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 7), 0xe9dcc6, x, 0.15, z), mesh(new THREE.SphereGeometry(0.26, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xe2604f, x, 0.3, z)));
      ring(46, 2, 12, (x, z, k) => tuft(x, z, k % 2 ? 0x6fae5a : 0x7fbf6a));
    } else if (b.id === 'marais') {
      ring(9, 4, 12, (x, z) => {
        const pond = new THREE.Mesh(new THREE.CylinderGeometry(1.4 + rnd() * 1.6, 1.4, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x6fb7c4, roughness: 0.15, flatShading: true }));
        pond.position.set(x, 0.02, z);
        pond.scale.z = 0.6 + rnd() * 0.5;
        pond.receiveShadow = true;
        const pads = [mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 10), 0x5fae68, x + 0.5, 0.05, z + 0.2, false), mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10), 0x6fbf78, x - 0.6, 0.05, z - 0.1, false)];
        for (const m of [pond, ...pads]) m.userData.flat = true;
        w.add(pond, ...pads);
      });
      ring(18, 12, 24, (x, z, k) => {
        const h = 3.5 + rnd() * 2.5;
        w.add(mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 6), 0x7a6a55, x, h / 2, z), mesh(new THREE.IcosahedronGeometry(1.5 + rnd(), 1), k % 2 ? 0x6fa27a : 0x5f946c, x, h + 0.5, z));
      });
      ring(40, 2, 12, (x, z, k) => {
        tuft(x, z, k % 2 ? 0x8fb86a : 0x7fa85a, 2.2);
        if (k % 4 === 0) w.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 6), 0x6b4a34, x, 1.05, z, false));
      });
    } else {
      ring(14, 17, 30, (x, z, k) => {
        const dune = mesh(new THREE.SphereGeometry(4 + rnd() * 3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), k % 2 ? 0xf0dcae : 0xe6cd96, x, -0.3, z, false);
        dune.scale.y = 0.35 + rnd() * 0.2;
        dune.userData.flat = true;
        w.add(dune);
      });
      ring(9, 4, 11, (x, z, k) => {
        const h = 1.2 + rnd() * 1.4;
        w.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, h, 8), 0x5f9a6a, x, h / 2, z));
        if (k % 2) w.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 6), 0x5f9a6a, x + 0.4, h * 0.55, z));
      });
      ring(10, 3, 10, (x, z) => w.add(mesh(new THREE.IcosahedronGeometry(0.3 + rnd() * 0.4, 0), 0xc9a27a, x, 0.15, z)));
      ring(24, 2, 12, (x, z, k) => tuft(x, z, k % 2 ? 0xb9b86a : 0xa9a85a, 0.9));
    }

    // Les plantes sauvages : réparties tout autour, à portée de marche.
    this.finds = list.map((f, k) => {
      const a = (k / list.length) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
      const r = 3.6 + (k % 3) * 1.7 + rnd() * 0.8;
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
      w.add(root);
      return { id: f.id, pos, root, cover, taken: false, fly: 0 };
    });
    finish(w);
    // Ce qui est à plat sur le sol ne prend pas de contour encré : il ferait une bande noire.
    w.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.userData.flat) return;
      m.material = (m.material as THREE.Material).clone();
      m.material.userData.outlineParameters = { visible: false };
    });
  }

  // ---------- gestes ----------

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private screen(p: THREE.Vector3): { x: number; y: number; ok: boolean } {
    const c = p.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const q = p.clone().project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (1 - (q.y * 0.5 + 0.5)) * this.canvas.clientHeight, ok: c.z < -0.3 };
  }

  /** Position écran de la plante proche, pour y accrocher son étiquette. */
  nearRect(): { x: number; y: number } | null {
    const f = this.finds[this.near];
    if (!f) return null;
    const s = this.screen(f.pos.clone().setY(1.45));
    return s.ok ? s : null;
  }

  /** Vrai si la plante proche est encore cachée dans son fourré. */
  get nearHidden(): boolean {
    return !!this.finds[this.near]?.cover;
  }
  get nearId(): string {
    return this.finds[this.near]?.id ?? '';
  }
  get full(): boolean {
    return this.basket.length >= this.cap;
  }

  private onDown(e: PointerEvent): void {
    if (!this.active || this.ended) return;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.at(e);
    // Un geste qui part près de la plante devant soi est une cueillette, pas un regard.
    const n = this.nearRect();
    const cut = !!n && Math.hypot(p.x - n.x, p.y - (n.y + 40)) < 150;
    this.down = { x: p.x, y: p.y, sx: p.x, sy: p.y, cut, len: 0 };
  }

  private onMove(e: PointerEvent): void {
    const d = this.down;
    if (!d || !this.active) return;
    const p = this.at(e);
    const dx = p.x - d.x, dy = p.y - d.y;
    d.len += Math.hypot(dx, dy);
    d.x = p.x; d.y = p.y;
    if (d.cut) {
      if (d.len > 70) { this.gather(); this.down = null; }
      return;
    }
    const k = ((2 * HALF_FOV) / this.canvas.clientWidth) * 1.3;
    this.yaw -= dx * k;
    this.pitch = Math.max(-0.55, Math.min(0.45, this.pitch + dy * k));
    this.aimYaw = null;
  }

  private onUp(e: PointerEvent): void {
    const d = this.down;
    this.down = null;
    if (!d || !this.active || this.ended) return;
    const p = this.at(e);
    if (Math.hypot(p.x - d.sx, p.y - d.sy) > 10) return;
    // Une touche : on marche vers la plante touchée.
    let best = -1, bestD = 90;
    this.finds.forEach((f, i) => {
      if (f.taken) return;
      const s = this.screen(f.pos.clone().setY(0.6));
      const dist = Math.hypot(s.x - p.x, s.y - p.y);
      if (s.ok && dist < bestD) { bestD = dist; best = i; }
    });
    if (best >= 0) this.walkTo(best);
  }

  private walkTo(i: number): void {
    const f = this.finds[i];
    const from = this.camera.position.clone().setY(0);
    const dir = f.pos.clone().sub(from);
    if (dir.length() < 0.01) dir.set(0, 0, -1);
    dir.normalize();
    this.goal.copy(f.pos).addScaledVector(dir, -1.9).setY(EYE);
    this.aimYaw = Math.atan2(dir.x, -dir.z);
    // On tourne par le plus court.
    this.aimYaw = this.yaw + Math.atan2(Math.sin(this.aimYaw - this.yaw), Math.cos(this.aimYaw - this.yaw));
    this.aimPitch = -0.3;
    this.near = i;
    this.onChange();
  }

  /** Le geste de cueillette : d'abord écarter le fourré, puis prélever. */
  private gather(): void {
    const f = this.finds[this.near];
    if (!f || f.taken) return;
    if (f.cover) {
      f.root.remove(f.cover);
      f.cover = null;
      f.root.children[0].visible = true;
      f.fly = -1;
      this.onChange();
      return;
    }
    if (this.full) { this.onChange(); return; }
    f.taken = true;
    f.fly = 1;
    this.basket.push(f.id);
    this.near = -1;
    // On relève la tête pour chercher la suivante.
    this.aimYaw = this.yaw;
    this.aimPitch = 0;
    this.onPick(f.id);
    this.onChange();
    if (this.full || this.finds.every((x) => x.taken)) this.finish();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    setTimeout(() => this.onEnd(), 700);
  }

  // ---------- image ----------

  private frame = (now: number): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;
    if (!this.ended) {
      const before = Math.ceil(this.left);
      this.left = Math.max(0, this.left - dt);
      if (Math.ceil(this.left) !== before) this.onChange();
      if (this.left <= 0) this.finish();
    }
    const cam = this.camera;
    cam.position.lerp(this.goal, Math.min(1, dt * 3));
    cam.position.y = EYE + Math.sin(t * 7) * 0.025 * Math.min(1, cam.position.distanceTo(this.goal));
    if (this.aimYaw !== null) {
      this.yaw += (this.aimYaw - this.yaw) * Math.min(1, dt * 4);
      this.pitch += (this.aimPitch - this.pitch) * Math.min(1, dt * 4);
      if (Math.abs(this.aimYaw - this.yaw) < 0.005 && Math.abs(this.aimPitch - this.pitch) < 0.01) this.aimYaw = null;
    }
    cam.rotation.set(this.pitch, -this.yaw, 0);
    cam.updateMatrixWorld(true);
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
    // L'étiquette de la plante proche suit la caméra.
    if (this.near >= 0) this.onChange();
  };
}
