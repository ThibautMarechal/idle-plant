import type { Family } from './data';
import { drawIcon } from './icons';

/** Les trois gestes de cueillette. */
export type PickKind = 'seeds' | 'pull' | 'slice';

/** Chaque famille se cueille à sa façon : on secoue les fleurs, on arrache ce qui a de grosses racines, on tranche les tiges. */
export const PICK_OF: Record<Family, PickKind> = {
  fleurs: 'seeds', aromatiques: 'seeds', orchidees: 'seeds',
  succulentes: 'pull', arbustes: 'pull', tropicales: 'pull',
  fougeres: 'slice', carnivores: 'slice',
};
export const PICK_TEXT: Record<PickKind, { title: string; hint: string }> = {
  seeds: { title: 'Secoue et rattrape', hint: 'Glisse le panier sous les graines qui tombent. Laisse passer les chenilles !' },
  pull: { title: 'Déterre et tire', hint: 'Secoue la plante de gauche à droite pour la déterrer, puis tire-la d\'un coup vers le haut. Le temps est compté !' },
  slice: { title: 'Tranche au bon endroit', hint: 'Tranche chaque tige d\'un coup de doigt, pile sur le trait rouge qui monte et descend.' },
};

const INK = '#1b1420';
const TAU = Math.PI * 2;

interface Drop { x: number; y: number; vx: number; vy: number; rot: number; bug: boolean; done: boolean }
interface Stem { x: number; phase: number; speed: number; cut: number; score: number; fall: number }

/**
 * Le jeu de cueillette, dessiné à plat par-dessus l'expédition. Trois gestes différents selon la plante,
 * plus exigeants quand elle est rare. Rend 0 (plante abîmée), 1 (cueillie) ou 2 (parfait : une graine en plus).
 */
export class Pick {
  active = false;
  kind: PickKind = 'seeds';
  private ctx: CanvasRenderingContext2D;
  private w = 340;
  private h = 420;
  private emoji = '🌱';
  private level = 0;
  private done: (score: number) => void = () => {};
  private raf = 0;
  private last = 0;
  private t = 0;
  /** Fin de partie : résultat et temps d'affichage restant. */
  private result = -1;
  private hold = 0;
  private ptr: { x: number; y: number; sx: number; sy: number } | null = null;
  // Graines à rattraper
  private drops: Drop[] = [];
  private queue: { at: number; bug: boolean }[] = [];
  private bx = 170;
  private caught = 0;
  private bugs = 0;
  private total = 6;
  private shake = 0;
  // Déterrage : on secoue de gauche à droite, puis on tire d'un coup
  private loose = 0;
  private lean = 0;
  private side = 0;
  private stage = 0;
  private lift = 0;
  private fly = 0;
  private left = 8;
  private span = 8;
  private bits: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  // Tiges à trancher
  private stems: Stem[] = [];
  private trail: { x: number; y: number; t: number }[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active || this.result >= 0) return;
      canvas.setPointerCapture(e.pointerId);
      const p = at(e);
      this.ptr = { ...p, sx: p.x, sy: p.y };
      this.trail = [{ ...p, t: this.t }];
      if (this.kind === 'seeds') this.bx = p.x;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.active || !this.ptr || this.result >= 0) return;
      const p = at(e), q = this.ptr;
      if (this.kind === 'slice') this.cross(q.x, q.y, p.x, p.y);
      q.x = p.x; q.y = p.y;
      this.trail.push({ ...p, t: this.t });
      if (this.trail.length > 14) this.trail.shift();
    });
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { this.ptr = null; });
  }

  /** `level` : 0 commun, 1 rare, 2 exotique, 3 légendaire. */
  /** `ease` : gants du cueilleur (0, 1, 2), qui adoucissent le jeu. */
  start(kind: PickKind, emoji: string, level: number, done: (score: number) => void, ease = 0): void {
    level = Math.max(0, level - ease * 0.6);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth || 340;
    this.h = this.canvas.clientHeight || 420;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.kind = kind;
    this.emoji = emoji;
    this.level = level;
    this.done = done;
    this.t = 0;
    this.result = -1;
    this.hold = 0;
    this.ptr = null;
    this.trail = [];
    const rnd = Math.random;
    if (kind === 'seeds') {
      this.total = 6;
      this.caught = this.bugs = 0;
      this.bx = this.w / 2;
      this.drops = [];
      this.queue = [];
      for (let k = 0; k < this.total; k++) this.queue.push({ at: 0.7 + k * (0.95 - level * 0.08) + rnd() * 0.3, bug: false });
      for (let k = 0; k < level + 1; k++) this.queue.push({ at: 1.2 + rnd() * 4.2, bug: true });
      this.queue.sort((a, b) => a.at - b.at);
    } else if (kind === 'pull') {
      this.loose = this.lean = this.side = this.stage = this.lift = this.fly = 0;
      this.left = this.span = 8 + ease * 1.5;
      this.bits = [];
    } else {
      this.stems = [0, 1, 2].map((k) => ({ x: this.w * (0.22 + k * 0.28), phase: rnd() * TAU, speed: 1.6 + level * 0.45 + k * 0.35, cut: -1, score: 0, fall: 0 }));
    }
    this.active = true;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.active = false;
    cancelAnimationFrame(this.raf);
  }

  private end(score: number): void {
    if (this.result >= 0) return;
    this.result = score;
    this.hold = 0.9;
    this.ptr = null;
  }

  // ---------- règles ----------

  /** Hauteur du repère d'une tige, entre le bas et le haut de la tige. */
  private markY(s: Stem): number {
    const top = this.h * 0.3, bot = this.h * 0.8;
    return top + (bot - top) * (0.5 + 0.5 * Math.sin(this.t * s.speed + s.phase));
  }
  /** Le doigt vient de passer de (x0,y0) à (x1,y1) : quelles tiges a-t-il tranchées, et à quelle hauteur ? */
  private cross(x0: number, y0: number, x1: number, y1: number): void {
    for (const s of this.stems) {
      if (s.cut >= 0 || (x0 - s.x) * (x1 - s.x) > 0 || x0 === x1) continue;
      const y = y0 + ((s.x - x0) / (x1 - x0)) * (y1 - y0);
      if (y < this.h * 0.24 || y > this.h * 0.86) continue;
      const off = Math.abs(y - this.markY(s));
      s.cut = y;
      s.score = off < 13 ? 2 : off < 34 ? 1 : 0;
    }
    if (this.stems.every((s) => s.cut >= 0)) {
      const sum = this.stems.reduce((a, s) => a + s.score, 0);
      this.end(sum >= 5 ? 2 : sum >= 3 ? 1 : 0);
    }
  }

  private step(dt: number): void {
    const rnd = Math.random;
    if (this.kind === 'seeds') {
      if (this.ptr) this.bx += (this.ptr.x - this.bx) * Math.min(1, dt * 22);
      this.bx = Math.max(44, Math.min(this.w - 44, this.bx));
      this.shake = Math.max(0, this.shake - dt * 3);
      while (this.queue.length && this.queue[0].at <= this.t) {
        const q = this.queue.shift()!;
        this.shake = 1;
        this.drops.push({ x: this.w / 2 + (rnd() - 0.5) * 70, y: this.h * 0.2, vx: (rnd() - 0.5) * (150 + this.level * 30), vy: -40, rot: rnd() * TAU, bug: q.bug, done: false });
      }
      const by = this.h - 62;
      for (const d of this.drops) {
        if (d.done) continue;
        d.vy += (330 + this.level * 60) * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        d.rot += dt * 4;
        if (d.x < 16 || d.x > this.w - 16) { d.vx *= -0.8; d.x = Math.max(16, Math.min(this.w - 16, d.x)); }
        if (d.y > by - 14 && d.y < by + 22 && Math.abs(d.x - this.bx) < 46) { d.done = true; if (d.bug) this.bugs++; else this.caught++; }
        else if (d.y > this.h + 20) d.done = true;
      }
      if (!this.queue.length && this.drops.every((d) => d.done)) {
        const n = this.caught - this.bugs;
        this.end(n >= this.total - 1 ? 2 : n >= 3 ? 1 : 0);
      }
    } else if (this.kind === 'pull') {
      const cx = this.w / 2, ground = this.h * 0.66;
      if (this.stage < 2) this.left -= dt;
      if (this.stage === 0) {
        const want = this.ptr ? Math.max(-1, Math.min(1, (this.ptr.x - cx) / 70)) : 0;
        this.lean += (want - this.lean) * Math.min(1, dt * 20);
        // Seuls les vrais allers-retours comptent : il faut pencher franchement d'un côté puis de l'autre.
        const side = this.lean > 0.55 ? 1 : this.lean < -0.55 ? -1 : 0;
        if (side && side !== this.side) {
          if (this.side) {
            this.loose = Math.min(1, this.loose + 1 / (7 + this.level * 2));
            this.shake = 0.25;
            for (let k = 0; k < 7; k++) this.bits.push({ x: cx + side * (20 + rnd() * 30), y: ground - 4, vx: side * (40 + rnd() * 150), vy: -150 - rnd() * 190, life: 0.7 });
          }
          this.side = side;
        }
        if (this.loose >= 1) { this.stage = 1; if (this.ptr) this.ptr.sy = this.ptr.y; }
      } else if (this.stage === 1) {
        this.lean *= 1 - Math.min(1, dt * 10);
        const up = this.ptr ? this.ptr.sy - this.ptr.y : 0;
        this.lift = Math.max(0, Math.min(1, up / 110));
        if (up >= 110) {
          this.stage = 2;
          for (let k = 0; k < 16; k++) this.bits.push({ x: cx + (rnd() - 0.5) * 70, y: ground - 4, vx: (rnd() - 0.5) * 320, vy: -200 - rnd() * 260, life: 0.9 });
        }
      } else {
        this.fly += dt;
        if (this.fly > 0.55) this.end(this.left / this.span > 0.35 ? 2 : 1);
      }
      this.shake = Math.max(0, this.shake - dt);
      for (const b of this.bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.life -= dt; }
      this.bits = this.bits.filter((b) => b.life > 0);
      if (this.left <= 0 && this.stage < 2) this.end(0);
    } else {
      for (const s of this.stems) if (s.cut >= 0) s.fall += dt;
      if (this.t > 9 && this.result < 0) {
        const sum = this.stems.reduce((a, s) => a + s.score, 0);
        this.end(sum >= 5 ? 2 : sum >= 3 ? 1 : 0);
      }
    }
  }

  // ---------- dessin ----------

  private blob(x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot, 0, TAU);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.stroke();
  }
  /** Une flèche pleine, pointe vers (dx, dy). */
  private arrow(x: number, y: number, dx: number, dy: number): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(Math.atan2(dy, dx));
    c.beginPath();
    c.moveTo(16, 0); c.lineTo(0, -13); c.lineTo(0, -5); c.lineTo(-16, -5); c.lineTo(-16, 5); c.lineTo(0, 5); c.lineTo(0, 13);
    c.closePath();
    c.fillStyle = '#ffd23f'; c.fill();
    c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke();
    c.restore();
  }
  private text(s: string, x: number, y: number, size: number, color = INK, align: CanvasTextAlign = 'center'): void {
    const c = this.ctx;
    c.font = `800 ${size}px Inter, system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    // Un liseré clair garde le texte lisible sur le ciel comme sur la terre.
    c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size * 0.28);
    c.strokeStyle = color === '#fff' ? INK : '#fff';
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  private plant(x: number, y: number, size: number, rot = 0): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    drawIcon(c, this.emoji, 0, -size * 0.5, size * 1.15, true);
    c.restore();
  }

  private draw(): void {
    const c = this.ctx, w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    // Le ciel, et le sol au pied de la plante.
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#bfe9f6');
    sky.addColorStop(1, '#eaf7df');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    const ground = this.kind === 'pull' ? h * 0.66 : h * 0.86;
    c.fillStyle = this.kind === 'pull' ? '#9a6a48' : '#8fc27a';
    c.fillRect(0, ground, w, h - ground);
    c.fillStyle = INK;
    c.fillRect(0, ground - 1.5, w, 3);

    if (this.kind === 'seeds') {
      this.plant(w / 2 + Math.sin(this.t * 30) * this.shake * 7, h * 0.4, 118, Math.sin(this.t * 26) * this.shake * 0.12);
      for (const d of this.drops) {
        if (d.done) continue;
        if (d.bug) drawIcon(c, '🐛', d.x, d.y, 34);
        else { this.blob(d.x, d.y, 9, 13, '#c98a3c', d.rot); this.blob(d.x - 2, d.y - 3, 2.5, 4, '#f6d99a', d.rot); }
      }
      // Le panier.
      const by = h - 62;
      c.beginPath();
      c.moveTo(this.bx - 46, by - 6); c.lineTo(this.bx + 46, by - 6); c.lineTo(this.bx + 34, by + 34); c.lineTo(this.bx - 34, by + 34); c.closePath();
      c.fillStyle = '#d9a25a'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.beginPath();
      for (let k = -2; k <= 2; k++) { c.moveTo(this.bx + k * 15, by - 4); c.lineTo(this.bx + k * 12, by + 32); }
      c.moveTo(this.bx - 40, by + 12); c.lineTo(this.bx + 40, by + 12);
      c.lineWidth = 2; c.stroke();
      this.blob(this.bx, by - 6, 46, 7, '#b9803c');
      this.text(`Graines ${this.caught}/${this.total}${this.bugs ? ` · chenilles −${this.bugs}` : ''}`, w / 2, 20, 15);
    } else if (this.kind === 'pull') {
      const cx = w / 2;
      const rise = this.loose * 16 + this.lift * 46 + this.fly * this.fly * 2600;
      const rot = this.lean * 0.34 + (this.stage === 1 ? Math.sin(this.t * 40) * 0.02 : 0);
      // Les racines : cachées sous terre tant que la plante tient, visibles dès qu'elle sort.
      c.save();
      if (this.stage < 2) { c.beginPath(); c.rect(0, 0, w, ground); c.clip(); }
      c.translate(cx, ground + 6 - rise);
      c.rotate(rot);
      c.strokeStyle = INK; c.lineWidth = 10; c.lineCap = 'round';
      for (const pass of [0, 1]) {
        if (pass) { c.strokeStyle = '#efe2c8'; c.lineWidth = 5.5; }
        for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(k * 7, -8); c.quadraticCurveTo(k * 22, 22, k * 30 + Math.sin(k + 2) * 7, 56); c.stroke(); }
      }
      c.restore();
      this.plant(cx, ground + 6 - rise, 124, rot);
      // La motte, qui se fissure à mesure que la plante se déchausse.
      if (this.stage < 2) {
        this.blob(cx, ground + 6, 64 - this.loose * 14, 13, '#7a5236');
        c.strokeStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round';
        const cracks = Math.round(this.loose * 6);
        for (let k = 0; k < cracks; k++) {
          const dir = k % 2 ? 1 : -1, x0 = cx + dir * (16 + k * 7);
          c.beginPath(); c.moveTo(x0, ground + 3); c.lineTo(x0 + dir * 9, ground + 9 + (k % 3) * 2); c.lineTo(x0 + dir * 15, ground + 5); c.stroke();
        }
      } else this.blob(cx, ground + 6, 46, 11, '#5f3f2a');
      for (const b of this.bits) this.blob(b.x, b.y, 5, 5, '#7a5236');
      // Le doigt, et ce qu'il faut faire maintenant.
      if (this.ptr && this.stage < 2) this.blob(this.ptr.x, this.ptr.y, 15, 15, 'rgba(255,255,255,0.85)');
      if (this.result < 0) {
        if (this.stage === 0) {
          const sway = Math.sin(this.t * 7) * 16;
          this.text('Secoue !', cx, h * 0.84, 22);
          this.arrow(cx - 78 + sway, h * 0.835, -1, 0);
          this.arrow(cx + 78 + sway, h * 0.835, 1, 0);
        } else if (this.stage === 1) {
          const bob = Math.abs(Math.sin(this.t * 6)) * 14;
          this.text('Tire !', cx, h * 0.86, 26, '#e2473a');
          this.arrow(cx, h * 0.78 - bob, 0, -1);
        }
      }
      // Le temps qui reste, puis l'avancée du déterrage.
      const gx = 26, gw = w - 52, gy = 20, part = Math.max(0, this.left / this.span);
      c.fillStyle = '#fff'; c.fillRect(gx, gy, gw, 14);
      c.fillStyle = part > 0.35 ? '#4fbf6a' : '#e2604f'; c.fillRect(gx, gy, gw * part, 14);
      c.lineWidth = 3; c.strokeStyle = INK; c.strokeRect(gx, gy, gw, 14);
      c.fillStyle = INK; c.fillRect(gx + gw * 0.35 - 1, gy - 4, 2.5, 22);
      this.text(this.stage ? 'Elle est déterrée !' : `Déterrée à ${Math.round(this.loose * 100)} %`, cx, gy + 34, 13);
    } else {
      const top = h * 0.24, bot = ground;
      for (const s of this.stems) {
        const cut = s.cut >= 0, cy = cut ? s.cut : top;
        c.lineCap = 'round';
        // Le pied reste en terre.
        c.beginPath(); c.moveTo(s.x, bot); c.lineTo(s.x, cy);
        c.strokeStyle = INK; c.lineWidth = 15; c.stroke();
        c.strokeStyle = '#4f9a5c'; c.lineWidth = 9; c.stroke();
        // Le haut, qui tombe une fois tranché.
        c.save();
        c.translate(s.x, cut ? s.cut + s.fall * s.fall * 500 : top);
        c.rotate(cut ? s.fall * 2.4 * (s.x < w / 2 ? -1 : 1) : Math.sin(this.t * 1.7 + s.phase) * 0.05);
        if (cut) { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, top - s.cut); c.strokeStyle = INK; c.lineWidth = 15; c.stroke(); c.strokeStyle = '#4f9a5c'; c.lineWidth = 9; c.stroke(); }
        drawIcon(c, this.emoji, 0, (cut ? top - s.cut : 0) - 22, 76, true);
        c.restore();
        if (!cut) {
          // Le trait où couper, et le repère qui monte et descend.
          const my = this.markY(s);
          c.beginPath(); c.moveTo(s.x - 30, my); c.lineTo(s.x + 30, my);
          c.strokeStyle = '#fff'; c.lineWidth = 6; c.stroke();
          c.strokeStyle = '#e2473a'; c.lineWidth = 3; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]);
          drawIcon(c, '✂️', s.x + 44, my, 24);
        } else this.text(s.score === 2 ? 'Net !' : s.score === 1 ? 'Bien' : 'Raté', s.x, s.cut - 24 - Math.min(20, s.fall * 60), 16, s.score ? '#2a8a4a' : '#e2473a');
      }
      // La trace du doigt.
      const tr = this.trail.filter((p) => this.t - p.t < 0.18);
      if (tr.length > 1) {
        c.beginPath(); c.moveTo(tr[0].x, tr[0].y);
        for (const p of tr) c.lineTo(p.x, p.y);
        c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round'; c.stroke();
        c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      }
    }

    if (this.result >= 0) {
      c.fillStyle = 'rgba(255,255,255,0.72)';
      c.fillRect(0, h * 0.4, w, 76);
      this.text(['Abîmée…', 'Cueillie !', 'Parfait ! Une graine en plus'][this.result], w / 2, h * 0.4 + 38, this.result === 2 ? 22 : 26, ['#e2473a', '#2a8a4a', '#c98a00'][this.result]);
    }
  }

  private frame = (now: number): void => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (this.result < 0) this.step(dt);
    else {
      this.hold -= dt;
      if (this.hold <= 0) { this.active = false; cancelAnimationFrame(this.raf); this.draw(); this.done(this.result); return; }
    }
    this.draw();
  };
}
