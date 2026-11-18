import type { Species } from './data';

const INK = '#1b1420';
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/**
 * Le bouturage, à la main et en deux temps.
 * 1. La coupe : la tige se balance, on la tranche d'un geste en biais, juste sous un nœud (là où partent les feuilles).
 * 2. Le repiquage : on enfonce la bouture dans son godet en gardant le doigt appuyé, et on lâche quand elle tient.
 * Rend 0 (ratée : la bouture pourrit), 1 (elle prend) ou 2 (coupe parfaite : deux boutures).
 */
export class Cutting {
  private ctx: CanvasRenderingContext2D;
  private w = 320;
  private h = 400;
  private raf = 0;
  private last = 0;
  private t = 0;
  private phase: 'cut' | 'plant' | 'end' = 'cut';
  private sway = 10;
  private tol = 8;
  private nodes: number[] = [];
  private ptr: { x: number; y: number; sx: number; sy: number } | null = null;
  private trail: { x: number; y: number }[] = [];
  private cutY = 0;
  private cutAng = 0;
  private grade = 0;
  private fall = 0;
  private push = 0;
  private holding = false;
  private planting = false;
  private bob = 0;
  private endIn = 0;
  private say = '';
  private note: (text: string) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private sp: Species, level: number, private done: (score: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    // Plus la plante est rare, plus la tige bouge et plus la marge est étroite.
    this.sway = 8 + level * 6;
    this.tol = Math.max(4, 9 - level * 1.5);
    const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const p = at(e);
      this.ptr = { ...p, sx: p.x, sy: p.y };
      this.trail = [p];
      if (this.phase === 'plant') this.holding = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.ptr) return;
      const p = at(e), q = this.ptr;
      if (this.phase === 'cut') this.slash(q.x, q.y, p.x, p.y);
      q.x = p.x; q.y = p.y;
      this.trail.push(p);
      if (this.trail.length > 12) this.trail.shift();
    });
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => {
      this.ptr = null;
      this.trail = [];
      if (this.phase === 'plant' && this.holding) { this.holding = false; this.release(); }
    });
  }

  onNote(f: (text: string) => void): void {
    this.note = f;
  }

  start(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width || 320;
    this.h = r.height || 400;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = this.h * 0.12, bot = this.h * 0.9;
    this.nodes = [0.22, 0.42, 0.62, 0.8].map((k) => top + (bot - top) * k);
    this.note('Coupe la tige d\'un geste en biais, juste sous un nœud, là où partent les feuilles.');
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private stemX(y: number): number {
    // Le pied est tenu, la tête se balance.
    const k = 1 - (y - this.h * 0.08) / (this.h * 0.86);
    return this.w / 2 + Math.sin(this.t * 1.7) * this.sway * Math.max(0, k);
  }

  private slash(x1: number, y1: number, x2: number, y2: number): void {
    if (Math.abs(x2 - x1) < 2) return;
    // Où le geste croise-t-il la tige ?
    for (let k = 0; k <= 1; k += 0.1) {
      const y = y1 + (y2 - y1) * k, x = x1 + (x2 - x1) * k, sx = this.stemX(y);
      const nx = x1 + (x2 - x1) * Math.min(1, k + 0.1);
      if ((x - sx) * (nx - sx) > 0 && k < 0.95) continue;
      if (Math.abs(x - sx) > 16 && Math.abs(nx - sx) > 16) continue;
      const p = this.ptr!;
      const dx = x2 - p.sx, dy = y2 - p.sy;
      this.cut(y, Math.abs((Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI));
      return;
    }
  }

  private cut(y: number, ang: number): void {
    if (this.phase !== 'cut') return;
    this.cutY = y;
    this.cutAng = ang;
    // Seuls les deux nœuds du bas laissent une bouture assez longue.
    const ok = this.nodes.slice(2);
    let best = Infinity, d = 0;
    for (const n of ok) { const dd = y - (n + 7); if (Math.abs(dd) < Math.abs(best)) { best = dd; } }
    d = best;
    if (y < this.nodes[2] - 20) { this.grade = 0; this.say = 'Trop haut : la bouture est trop courte pour s\'enraciner.'; }
    else if (Math.abs(d) <= this.tol) { this.grade = 2; this.say = 'Coupe nette, pile sous le nœud !'; }
    else if (Math.abs(d) <= this.tol * 2.2) { this.grade = 1; this.say = d < 0 ? 'Un peu haut, mais ça devrait prendre.' : 'Un peu bas : il reste un bout de tige sans nœud.'; }
    else { this.grade = 0; this.say = d < 0 ? 'En plein nœud : la tige est écrasée.' : 'Trop loin du nœud : sans nœud, pas de racines.'; }
    if (this.grade > 0 && ang < 14) { this.grade--; this.say += ' Coupée à plat, elle prendra moins bien.'; }
    this.fall = 0.001;
    this.note(this.say);
    if (this.grade === 0) { this.phase = 'end'; this.endIn = 2.2; return; }
    setTimeout(() => {
      this.phase = 'plant';
      this.planting = true;
      this.note('Pose le doigt et garde-le appuyé pour enfoncer la bouture, lâche quand la jauge est dans le vert.');
    }, 1100);
  }

  private release(): void {
    if (this.push < 0.55) { this.grade = 0; this.say = 'Pas assez enfoncée : elle se couche et sèche.'; this.bob = 1; }
    else if (this.push > 0.85) { this.grade = 0; this.say = 'Trop enfoncée : la tige s\'est pliée.'; }
    else this.say = this.grade === 2 ? 'Bien plantée : deux belles boutures prennent racine !' : 'Bien plantée : la bouture prend racine.';
    this.note(this.say);
    this.phase = 'end';
    this.endIn = 2.2;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    if (this.fall > 0 && this.fall < 1) this.fall = Math.min(1, this.fall + dt * 1.6);
    if (this.phase === 'plant' && this.holding) this.push = Math.min(1, this.push + dt * 0.55);
    if (this.bob > 0) this.bob = Math.max(0, this.bob - dt);
    if (this.phase === 'end') {
      this.endIn -= dt;
      if (this.endIn <= 0) { cancelAnimationFrame(this.raf); this.done(this.grade); return; }
    }
    this.draw();
  };

  private leafPair(x: number, y: number, s: number, color: string): void {
    const c = this.ctx;
    for (const dir of [-1, 1]) {
      c.save();
      c.translate(x, y);
      c.rotate(dir * 0.9 - 0.15 * dir);
      c.beginPath();
      c.ellipse(dir * 18 * s, -6 * s, 20 * s, 8 * s, dir * 0.2, 0, Math.PI * 2);
      c.fillStyle = color; c.fill();
      c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
      c.restore();
    }
    c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fillStyle = '#5a8a3a'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  }

  private draw(): void {
    const c = this.ctx, w = this.w, h = this.h, sp = this.sp;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#f6efdf'; c.fillRect(0, 0, w, h);
    const leaf = hex(sp.leaf ?? 0x5fae5a), flower = hex(sp.flower ?? 0xf2a0c0);
    if (!this.planting) {
      // Le pot de la plante mère et sa tige.
      c.fillStyle = '#c9714a'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.moveTo(w / 2 - 46, h * 0.9); c.lineTo(w / 2 + 46, h * 0.9); c.lineTo(w / 2 + 34, h + 4); c.lineTo(w / 2 - 34, h + 4); c.closePath(); c.fill(); c.stroke();
      const cy = this.fall > 0 ? this.cutY : -1;
      const seg = (y0: number, y1: number, off: number, dx: number) => {
        c.beginPath();
        for (let y = y0; y <= y1; y += 6) { const x = this.stemX(y) + dx; if (y === y0) c.moveTo(x, y + off); else c.lineTo(x, y + off); }
        c.lineWidth = 9; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#6aa04a'; c.stroke();
      };
      const fallOff = this.fall * this.fall * h * 0.6, fallDx = this.fall * 60;
      if (cy > 0) { seg(h * 0.08, cy, fallOff, fallDx); seg(cy, h * 0.9, 0, 0); }
      else seg(h * 0.08, h * 0.9, 0, 0);
      this.nodes.forEach((n) => {
        const above = cy > 0 && n < cy;
        this.leafPair(this.stemX(n) + (above ? fallDx : 0), n + (above ? fallOff : 0), 1, leaf);
      });
      // La fleur au sommet.
      const fy = h * 0.08 + (cy > 0 ? fallOff : 0), fx = this.stemX(h * 0.08) + (cy > 0 ? fallDx : 0);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + this.t * 0.3;
        c.beginPath(); c.arc(fx + Math.cos(a) * 9, fy + Math.sin(a) * 9, 8, 0, Math.PI * 2); c.fillStyle = flower; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      }
      c.beginPath(); c.arc(fx, fy, 6, 0, Math.PI * 2); c.fillStyle = '#f2c94c'; c.fill(); c.stroke();
      if (cy > 0) {
        c.beginPath(); c.moveTo(this.stemX(cy) - 14, cy + 4); c.lineTo(this.stemX(cy) + 14, cy - (this.cutAng > 14 ? 6 : 0)); c.lineWidth = 2; c.strokeStyle = '#e2342c'; c.stroke();
      }
    } else {
      // Le godet, et la bouture qu'on enfonce.
      const gx = w / 2, gy = h * 0.62;
      c.fillStyle = '#3a2818'; c.fillRect(gx - 50, gy - 6, 100, 14);
      const depth = this.push * 70, tilt = this.phase === 'end' && this.grade === 0 && this.push < 0.55 ? (1 - this.bob) * 1.2 : this.phase === 'end' && this.grade === 0 ? 0.5 : 0;
      c.save();
      c.translate(gx, gy - 90 + depth);
      c.rotate(tilt);
      c.beginPath(); c.moveTo(0, -60); c.lineTo(0, 90); c.lineWidth = 9; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#6aa04a'; c.stroke();
      c.restore();
      this.leafPair(gx + Math.sin(tilt) * 60, gy - 150 + depth, 0.9, leaf);
      c.fillStyle = '#c9714a'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.moveTo(gx - 56, gy); c.lineTo(gx + 56, gy); c.lineTo(gx + 42, gy + 96); c.lineTo(gx - 42, gy + 96); c.closePath(); c.fill(); c.stroke();
      // La jauge : du rouge, du vert, du rouge.
      const bx = w - 34, by = h * 0.18, bh = h * 0.6;
      c.fillStyle = '#fff'; c.fillRect(bx, by, 18, bh);
      c.fillStyle = '#7fd36a'; c.fillRect(bx, by + bh * (1 - 0.85), 18, bh * 0.3);
      c.fillStyle = '#4aa8d8'; c.fillRect(bx + 4, by + bh * (1 - this.push), 10, bh * this.push);
      c.lineWidth = 3; c.strokeStyle = INK; c.strokeRect(bx, by, 18, bh);
    }
    if (this.trail.length > 1 && this.phase === 'cut') {
      c.beginPath(); c.moveTo(this.trail[0].x, this.trail[0].y);
      for (const p of this.trail) c.lineTo(p.x, p.y);
      c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineCap = 'round'; c.stroke();
    }
    if (this.phase === 'end') {
      c.font = '800 44px sans-serif'; c.textAlign = 'center';
      c.fillStyle = this.grade ? '#3f9d6b' : '#e2342c';
      c.fillText(this.grade === 2 ? '✓✓' : this.grade ? '✓' : '✗', w / 2, h * 0.14);
    }
  }
}
