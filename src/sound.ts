/** Petits sons synthétisés, sans fichier audio. Muets tant que le joueur n'a pas touché l'écran. */
type Kind = 'tap' | 'coin' | 'water' | 'bloom' | 'card' | 'rare' | 'craft' | 'level' | 'plant';

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean): void {
  muted = m;
}

/** À appeler sur un geste du joueur : les navigateurs n'autorisent le son qu'après une interaction. */
export function unlock(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch { /* pas de son sur cet appareil */ }
}

function note(freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function play(kind: Kind): void {
  if (muted || !ctx || ctx.state !== 'running') return;
  try {
    switch (kind) {
      case 'tap': note(520, 0, 0.07, 0.05, 'triangle'); break;
      case 'plant': note(330, 0, 0.1, 0.07, 'triangle', 1.5); break;
      case 'water': note(900, 0, 0.16, 0.05, 'sine', 0.45); note(700, 0.07, 0.14, 0.04, 'sine', 0.5); break;
      case 'coin': note(988, 0, 0.09, 0.07, 'square'); note(1319, 0.07, 0.22, 0.07, 'square'); break;
      case 'card': note(440, 0, 0.09, 0.06, 'triangle', 1.6); break;
      case 'rare': [523, 659, 784, 1047].forEach((f, k) => note(f, k * 0.07, 0.3, 0.07, 'triangle')); break;
      case 'bloom': [659, 784, 988].forEach((f, k) => note(f, k * 0.09, 0.35, 0.07, 'sine')); break;
      case 'craft': note(180, 0, 0.18, 0.09, 'sine', 0.6); note(260, 0.1, 0.2, 0.06, 'triangle'); break;
      case 'level': [523, 659, 784, 1047, 1319].forEach((f, k) => note(f, k * 0.1, 0.45, 0.08, 'triangle')); break;
    }
  } catch { /* on ignore */ }
}
