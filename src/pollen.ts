import type { Species } from './data';

const INK = '#1b1420';
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/**
 * Le croisement, au pinceau, comme un vrai pollinisateur.
 * 1. Sur la première fleur, on frotte le pinceau sur les étamines pour le charger de pollen.
 * 2. Sur la seconde, qui se balance, on tient le pinceau sur le pistil le temps de déposer le pollen.
 * Frotter les pétales fait tomber le pollen, et chaque étape a son temps compté.
 * Rend 0 (raté), 1 (réussi) ou 2 (réussi vite et proprement).
 */
export class Pollen {
  private ctx: CanvasRenderingContext2D;
  private w = 320;
  private h = 400;
  private raf = 0;
  private last = 0;
  private t = 0;
  private phase: 'collect' | 'deposit' | 'end' = 'collect';
  private left = 8;
  private span = 8;
  private quick = 0;
  private pollen = 0;
  private deposit = 0;
  private ptr: { x: number; y: number; px: number; py: number } | null = null;
  private grade = 0;
  private endIn = 0;
  private level = 0;
  private dust: { x: number; y: number; vy: number; life: number }[] = [];
  private note: (text: string) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private a: Species, private b: Species, level: number, private done: (score: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    this.level = level;
    this.span = this.left = 8 - level;
    // La pointe du pinceau dépasse au-dessus du doigt : on voit ce qu'on touche.
    const at = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left - 18, y: e.clientY - r.top - 46 }; };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const p = at(e);
      this.ptr = { ...p, px: p.x, py: p.y };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.ptr) return;
      const p = at(e);
      this.ptr.px = this.ptr.x; this.ptr.py = this.ptr.y;
      this.ptr.x = p.x; this.ptr.y = p.y;
    });
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { this.ptr = null; });
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
    this.note(`Frotte le pinceau sur les étamines jaunes de ${this.a.name} pour le charger de pollen. Évite les pétales !`);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** Centre de la fleur, qui se balance davantage pendant le dépôt et pour les plantes rares. */
  private center(): { x: number; y: number } {
    const amp = this.phase === 'deposit' ? 18 + this.level * 10 : 4;
    return { x: this.w / 2 + Math.sin(this.t * 1.3) * amp, y: this.h * 0.45 + Math.sin(this.t * 2.1) * amp * 0.5 };
  }
  private anthers(): { x: number; y: number }[] {
    const c = this.center();
    return Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + 0.3, r = 34 + Math.sin(this.t * 3 + k) * 3;
      return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    });
  }

  private end(grade: number, text: string): void {
    this.grade = grade;
    this.phase = 'end';
    this.endIn = 2.2;
    this.note(text);
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const p = this.ptr;
    const moved = p ? Math.hypot(p.x - p.px, p.y - p.py) : 0;
    if (p) { p.px = p.x; p.py = p.y; }
    if (this.phase === 'collect' || this.phase === 'deposit') {
      this.left -= dt;
      const c = this.center(), d = p ? Math.hypot(p.x - c.x, p.y - c.y) : 999;
      // Les pétales s'étendent jusqu'à ~95 px : les frotter fait tomber le pollen.
      const onPetal = p && d > 52 && d < 98;
      if (onPetal && moved > 1 && this.pollen > 0) {
        this.pollen = Math.max(0, this.pollen - dt * 0.35);
        if (Math.random() < 0.5) this.dust.push({ x: p!.x, y: p!.y, vy: 40, life: 0.8 });
      }
      if (this.phase === 'collect') {
        const near = p && this.anthers().some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 16);
        if (near && moved > 0.5) this.pollen = Math.min(1, this.pollen + dt * 0.75);
        if (this.pollen >= 1) {
          this.quick += this.left / this.span;
          this.phase = 'deposit';
          this.left = this.span = 9 - this.level;
          this.note(`Le pinceau est chargé. Pose-le sur le pistil de ${this.b.name}, au centre, et tiens-le dessus malgré le vent.`);
        } else if (this.left <= 0) this.end(0, 'Trop lent : le pollen n\'a pas été récolté à temps.');
      } else {
        const r = Math.max(9, 16 - this.level * 2);
        if (p && d < r) this.deposit = Math.min(1, this.deposit + dt * 0.6);
        if (this.deposit >= 1) {
          this.quick += this.left / this.span;
          this.end(this.quick > 0.9 && this.pollen > 0.6 ? 2 : 1, 'Pollinisée ! Une graine nouvelle mûrit dans la fleur.');
        } else if (this.pollen <= 0) this.end(0, 'Tout le pollen est tombé sur les pétales : raté.');
        else if (this.left <= 0) this.end(0, 'Le vent a gagné : la fleur n\'a pas été pollinisée.');
      }
    }
    if (this.phase === 'end') {
      this.endIn -= dt;
      if (this.endIn <= 0) { cancelAnimationFrame(this.raf); this.done(this.grade); return; }
    }
    this.dust = this.dust.filter((q) => { q.life -= dt; q.y += q.vy * dt; return q.life > 0; });
    this.draw();
  };

  private draw(): void {
    const c = this.ctx, w = this.w, h = this.h;
    const sp = this.phase === 'collect' || (this.phase === 'end' && this.deposit === 0) ? this.a : this.b;
    c.clearRect(0, 0, w, h);
    c.fillStyle = this.phase === 'deposit' ? '#e6f2f6' : '#f6efdf';
    c.fillRect(0, 0, w, h);
    const o = this.center();
    // Tige et feuilles.
    c.beginPath(); c.moveTo(o.x, o.y); c.quadraticCurveTo(w / 2, h * 0.75, w / 2, h + 5);
    c.lineWidth = 10; c.strokeStyle = INK; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#6aa04a'; c.stroke();
    const flower = hex(sp.flower ?? 0xf2a0c0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      c.save(); c.translate(o.x, o.y); c.rotate(a);
      c.beginPath(); c.ellipse(64, 0, 38, 24, 0, 0, Math.PI * 2);
      c.fillStyle = flower; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.restore();
    }
    c.beginPath(); c.arc(o.x, o.y, 30, 0, Math.PI * 2); c.fillStyle = '#fbe9a6'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    if (sp === this.a) {
      for (const a of this.anthers()) {
        c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(a.x, a.y); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
        c.beginPath(); c.ellipse(a.x, a.y, 7, 5, 0, 0, Math.PI * 2); c.fillStyle = '#f2b51f'; c.fill(); c.lineWidth = 2; c.stroke();
      }
    } else {
      // Le pistil : la cible, qui reçoit le pollen.
      const r = Math.max(9, 16 - this.level * 2);
      c.beginPath(); c.arc(o.x, o.y, r, 0, Math.PI * 2); c.fillStyle = '#7fd36a'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      if (this.deposit > 0) { c.beginPath(); c.moveTo(o.x, o.y); c.arc(o.x, o.y, r, -Math.PI / 2, -Math.PI / 2 + this.deposit * Math.PI * 2); c.closePath(); c.fillStyle = '#f2b51f'; c.fill(); }
    }
    for (const q of this.dust) { c.beginPath(); c.arc(q.x, q.y, 2.5, 0, Math.PI * 2); c.fillStyle = `rgba(242,181,31,${q.life})`; c.fill(); }
    // Le pinceau, sous le doigt.
    if (this.ptr) {
      const { x, y } = this.ptr;
      c.beginPath(); c.moveTo(x + 8, y + 10); c.lineTo(x + 30, y + 60); c.lineWidth = 8; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#b5654a'; c.stroke();
      c.beginPath(); c.ellipse(x + 3, y + 4, 7, 11, -0.6, 0, Math.PI * 2);
      c.fillStyle = this.pollen > 0.05 ? `rgb(242,${Math.round(230 - this.pollen * 50)},${Math.round(200 - this.pollen * 170)})` : '#f4efe0';
      c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    }
    // Pollen sur le pinceau et temps restant.
    const bar = (y: number, k: number, col: string, label: string) => {
      c.fillStyle = '#fff'; c.fillRect(14, y, w - 28, 12); c.fillStyle = col; c.fillRect(14, y, (w - 28) * Math.max(0, k), 12);
      c.lineWidth = 2.5; c.strokeStyle = INK; c.strokeRect(14, y, w - 28, 12);
      c.font = '800 11px sans-serif'; c.textAlign = 'left'; c.fillStyle = INK; c.fillText(label, 16, y - 4);
    };
    if (this.phase !== 'end') {
      bar(22, this.pollen, '#f2b51f', 'Pollen sur le pinceau');
      bar(h - 22, this.left / this.span, this.left / this.span < 0.3 ? '#e2604f' : '#4aa8d8', 'Temps');
    } else {
      c.font = '800 44px sans-serif'; c.textAlign = 'center';
      c.fillStyle = this.grade ? '#3f9d6b' : '#e2342c';
      c.fillText(this.grade === 2 ? '✓✓' : this.grade ? '✓' : '✗', w / 2, h * 0.14);
    }
  }
}
