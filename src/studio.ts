import * as THREE from 'three';
import { DEFAULT_PROF, GLAZES, PAINT_H, PAINT_W, POT_RINGS, POT_SIZES, PROF_MAX, PROF_MIN } from './data';
import { BODY_H, craftPot, decodePaint, drawPaint, encodePaint, potGeometry, potModel } from './pots';
import type { CraftPot } from './pots';
import type { PotDesign } from './sim';
import { finish, mat, matMap } from './styles';

export type StudioMode = '' | 'wheel' | 'paint' | 'view';
const RING_H = BODY_H / (POT_RINGS - 1);
/** Rayon du pinceau, en rangées de la grille. */
const BRUSH = [1.5, 3.2, 5.5];
/** Une case est plus large que haute sur le pot : on corrige pour garder un pinceau rond. */
const CELL_RATIO = 1.5;

/** Texture d'argile humide : des stries qui rendent la rotation du tour visible. */
function clayTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b98360';
  ctx.fillRect(0, 0, 128, 64);
  for (let y = 0; y < 64; y += 3) { ctx.fillStyle = `rgba(90,50,30,${0.05 + 0.06 * Math.random()})`; ctx.fillRect(0, y, 128, 1); }
  for (let k = 0; k < 70; k++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,225,200,0.22)' : 'rgba(80,45,25,0.2)';
    ctx.fillRect(Math.random() * 128, Math.random() * 64, 3 + Math.random() * 14, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/**
 * L'établi : un petit théâtre 3D à part où l'on tourne un pot au doigt, où on le peint au pinceau,
 * et où l'on admire une plante en grand. Il ne touche jamais à la partie : l'interface lit le résultat.
 */
export class Studio {
  mode: StudioMode = '';
  prof: number[] = [...DEFAULT_PROF];
  size = 1;
  grid: Uint8Array = new Uint8Array(PAINT_W * PAINT_H);
  /** Émail de fond. */
  base = 0;
  /** 0 = gomme, sinon 1 + index dans PAINTS. */
  color = 11;
  brush = 1;
  hand = false;
  spin = false;
  /** Vrai dès que le joueur a modelé ou peint quelque chose. */
  touched = false;

  private renderer: THREE.WebGLRenderer | null = null;
  private world = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  private pivot = new THREE.Group();
  private craft: CraftPot | null = null;
  private wheel: THREE.Mesh | null = null;
  private wheelSoil: THREE.Mesh | null = null;
  private ray = new THREE.Raycaster();
  private raf = 0;
  private last = 0;
  private down = false;
  private onPot = false;
  private px = 0;
  private py = 0;
  private dirty = false;
  private idle = 0;
  private cy = 0.25;
  private halfW = 0.72;
  private halfH = 0.5;

  constructor(private canvas: HTMLCanvasElement) {
    this.world.add(new THREE.HemisphereLight(0xffffff, 0xcdb89a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.1);
    sun.position.set(2.5, 4, 3);
    this.world.add(sun, this.pivot);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { this.down = false; });
    window.addEventListener('resize', () => { if (this.mode) this.resize(); });
  }

  // ---------- ouverture ----------

  private start(mode: StudioMode): void {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    }
    this.mode = mode;
    this.pivot.clear();
    this.pivot.rotation.set(0, 0, 0);
    this.craft = null;
    this.wheel = null;
    this.down = false;
    this.touched = false;
    this.idle = 0;
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private table(r: number): void {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.06, 40), mat(0x8d7257));
    t.position.y = -0.03;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.04), mat(0xf2e4c4));
    mark.position.set(r - 0.08, 0.003, 0);
    this.pivot.add(t, mark);
  }

  /** Tour de potier : une motte d'argile qui tourne, à modeler au doigt. */
  openWheel(size: number): void {
    this.start('wheel');
    this.size = size;
    this.prof = [...DEFAULT_PROF];
    this.table(0.62);
    this.wheel = new THREE.Mesh(potGeometry(this.prof), matMap(clayTexture()));
    this.wheelSoil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.02, 24), mat(0x7d5238));
    this.wheelSoil.position.y = 0.3;
    this.pivot.add(this.wheel, this.wheelSoil);
    this.shape();
    this.frameBox(0.72, -0.08, 0.62);
  }

  /** Peinture : le pot cuit, son dessin actuel, et un pinceau. */
  openPaint(pd: PotDesign): void {
    this.start('paint');
    this.base = pd.glaze;
    this.grid = decodePaint(pd.paint);
    this.craft = craftPot({ ...pd, paint: undefined }, GLAZES[this.base].color);
    this.table(0.6);
    this.pivot.add(this.craft.group);
    this.dirty = true;
    this.frameBox(0.72, -0.08, 0.62);
  }

  /** Vue en grand : le pot et sa plante, à faire tourner. */
  openView(pd: PotDesign | undefined, themePot: [number, number], plant: THREE.Object3D | null, plantScale: number): void {
    this.start('view');
    const scale = POT_SIZES[(pd?.size ?? 1) - 1].scale;
    const pot = finish(potModel(pd, themePot));
    pot.scale.setScalar(scale);
    this.pivot.add(pot);
    if (plant) {
      plant.position.set(0, 0.485 * scale, 0);
      plant.scale.setScalar(plantScale);
      this.pivot.add(plant);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62 * scale, 32), new THREE.MeshBasicMaterial({ color: 0x3a2f20, transparent: true, opacity: 0.13 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    this.pivot.add(shadow);
    const box = new THREE.Box3().setFromObject(this.pivot);
    const r = Math.max(0.6, Math.abs(box.min.x), box.max.x, Math.abs(box.min.z), box.max.z);
    this.frameBox(r + 0.12, -0.1, box.max.y + 0.15);
    this.pivot.rotation.y = -0.5;
  }

  close(): void {
    this.mode = '';
    cancelAnimationFrame(this.raf);
    this.pivot.clear();
    this.craft = null;
    this.wheel = null;
  }

  /** Le dessin tel qu'il sera enregistré dans la partie. */
  paintResult(): { glaze: number; paint: string } {
    return { glaze: this.base, paint: encodePaint(this.grid) };
  }

  setBase(glaze: number): void {
    this.base = glaze;
    this.dirty = true;
    this.touched = true;
  }
  clearPaint(): void {
    this.grid.fill(0);
    this.dirty = true;
    this.touched = true;
  }
  resetWheel(): void {
    this.prof = [...DEFAULT_PROF];
    this.shape();
  }

  // ---------- cadrage ----------

  private frameBox(halfW: number, y0: number, y1: number): void {
    this.halfW = halfW;
    this.cy = (y0 + y1) / 2;
    this.halfH = (y1 - y0) / 2;
    this.resize();
  }

  resize(): void {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    const a = w / h;
    // Assez large pour le pot, assez haut pour la plante.
    const half = Math.max(this.halfH * 1.12, this.halfW / a);
    this.camera.left = -half * a; this.camera.right = half * a;
    this.camera.top = half; this.camera.bottom = -half;
    const pitch = 0.3;
    this.camera.position.set(0, this.cy + Math.sin(pitch) * 20, Math.cos(pitch) * 20);
    this.camera.lookAt(0, this.cy, 0);
    this.camera.updateProjectionMatrix();
  }

  // ---------- gestes ----------

  private aim(x: number, y: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
  }

  private onDown(e: PointerEvent): void {
    if (!this.mode) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.down = true;
    this.px = e.clientX; this.py = e.clientY;
    this.idle = 0;
    if (this.mode === 'wheel') this.sculpt(e.clientX, e.clientY);
    else if (this.mode === 'paint') this.onPot = !this.hand && this.dab(e.clientX, e.clientY);
  }

  private onMove(e: PointerEvent): void {
    if (!this.down || !this.mode) return;
    const x = e.clientX, y = e.clientY;
    this.idle = 0;
    if (this.mode === 'wheel') this.sculpt(x, y);
    else if (this.mode === 'paint' && this.onPot) {
      // Un trait continu : on repique le pinceau tous les quelques pixels entre deux positions.
      const n = Math.max(1, Math.ceil(Math.hypot(x - this.px, y - this.py) / 5));
      for (let k = 1; k <= n; k++) this.dab(this.px + ((x - this.px) * k) / n, this.py + ((y - this.py) * k) / n);
    } else this.pivot.rotation.y += (x - this.px) * 0.012;
    this.px = x; this.py = y;
  }

  /** Le doigt pousse ou tire la paroi : l'anneau à sa hauteur suit, ses voisins un peu. */
  private sculpt(x: number, y: number): void {
    this.aim(x, y);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    const t = -o.z / d.z;
    const hx = Math.abs(o.x + d.x * t), hy = o.y + d.y * t;
    if (hy < -0.06 || hy > BODY_H + 0.12 || hx > 0.75) return;
    const k = Math.max(0, Math.min(POT_RINGS - 1, Math.round(hy / RING_H)));
    const target = Math.max(PROF_MIN, Math.min(PROF_MAX, hx));
    const pull = (i: number, f: number) => { if (i >= 0 && i < POT_RINGS) this.prof[i] += (target - this.prof[i]) * f; };
    pull(k, 0.45); pull(k - 1, 0.16); pull(k + 1, 0.16);
    // Une paroi ne peut pas faire d'angle trop brutal : l'argile s'affaisserait.
    for (let i = 1; i < POT_RINGS; i++) this.prof[i] = Math.max(this.prof[i - 1] - 0.11, Math.min(this.prof[i - 1] + 0.11, this.prof[i]));
    this.touched = true;
    this.shape();
  }

  private shape(): void {
    if (!this.wheel || !this.wheelSoil) return;
    this.wheel.geometry.dispose();
    this.wheel.geometry = potGeometry(this.prof);
    const top = this.prof[POT_RINGS - 1] - 0.02;
    this.wheelSoil.position.y = 0.4;
    this.wheelSoil.scale.set(top, 1, top);
  }

  /** Pose le pinceau à cet endroit de l'écran. Renvoie faux si le doigt n'est pas sur le pot. */
  private dab(x: number, y: number): boolean {
    if (!this.craft) return false;
    this.aim(x, y);
    const hit = this.ray.intersectObject(this.craft.body, false)[0];
    if (!hit?.uv) return false;
    const cu = hit.uv.x * PAINT_W, cv = (1 - hit.uv.y) * PAINT_H;
    const r = BRUSH[this.brush];
    const rx = Math.ceil(r / CELL_RATIO), ry = Math.ceil(r);
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const gx = Math.floor(cu) + dx, gy = Math.floor(cv) + dy;
      if (gy < 0 || gy >= PAINT_H) continue;
      const ex = (gx + 0.5 - cu) * CELL_RATIO, ey = gy + 0.5 - cv;
      if (ex * ex + ey * ey > r * r) continue;
      this.grid[gy * PAINT_W + (((gx % PAINT_W) + PAINT_W) % PAINT_W)] = this.color;
    }
    this.dirty = true;
    this.touched = true;
    return true;
  }

  // ---------- boucle ----------

  private frame = (now: number): void => {
    if (!this.mode || !this.renderer) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.idle += dt;
    if (this.mode === 'wheel') this.pivot.rotation.y += dt * 7;
    else if (this.mode === 'paint') {
      if (this.spin) {
        // Pinceau immobile sur un pot qui tourne : une bande continue tout autour.
        const steps = this.down && this.onPot ? Math.ceil((dt * 2.4) / 0.03) : 1;
        for (let k = 0; k < steps; k++) {
          this.pivot.rotation.y += (dt * 2.4) / steps;
          if (this.down && this.onPot) { this.pivot.updateMatrixWorld(true); this.dab(this.px, this.py); }
        }
      }
    } else if (!this.down && this.idle > 1.2) this.pivot.rotation.y += dt * 0.5;
    if (this.dirty && this.craft) {
      drawPaint(this.craft.canvas, GLAZES[this.base].color, this.grid);
      this.craft.tex.needsUpdate = true;
      this.dirty = false;
    }
    this.renderer.render(this.world, this.camera);
  };
}
