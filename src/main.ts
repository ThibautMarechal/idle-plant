import './style.css';
import { Scene3D } from './scene';
import * as sim from './sim';
import { UI } from './ui';

const params = new URLSearchParams(location.search);
const speed = Math.max(1, Number(params.get('vitesse')) || 1);
const t0 = Date.now();
/** Horloge du jeu. `?vitesse=20` accélère le temps pour tester l'équilibrage. */
const clock = () => t0 + (Date.now() - t0) * speed;

let state = sim.load(clock());
const away = sim.advance(state, clock());

// Direction artistique retenue : la bande dessinée. Les parties commencées dans un autre style y passent une fois.
if (!state.hints?.bd) { state.style = 'bd'; (state.hints ??= {}).bd = true; }
// Essai en cours : la vue à la première personne. Elle devient le décor par défaut, une fois.
if (!state.hints?.fp) { state.theme = 'pavillon'; (state.hints ??= {}).fp = true; }
const scene = new Scene3D(document.getElementById('gl') as HTMLCanvasElement, state.theme, state.style);
const ui = new UI(state, scene, () => {
  sim.wipe();
  const { theme, style } = state;
  state = sim.newState(clock());
  state.theme = theme;
  state.style = style;
  (state.hints ??= {}).bd = true;
  state.hints.fp = true;
  ui.setState(state);
});

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function daily(): void {
  const now = new Date();
  const gift = sim.claimDaily(state, ymd(now), ymd(new Date(now.getTime() - 86400000)));
  if (gift) setTimeout(() => ui.toast(`🎁 Cadeau du jour ${gift.streak} : +${gift.coins} 🪙, +${gift.clay} argile, un sachet${gift.fert ? ' et une dose d\'engrais' : ''}. Reviens demain pour plus !`), 2600);
}
daily();
document.addEventListener('visibilitychange', () => { if (!document.hidden) daily(); });

if (away > 90) {
  const mins = Math.round(away / 60);
  const txt = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`;
  setTimeout(() => ui.toast(`Bon retour ! Tes plantes ont poussé pendant ${txt}.`), 600);
}

window.addEventListener('resize', () => { scene.resize(); ui.refresh(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) sim.save(state); });
window.addEventListener('pagehide', () => sim.save(state));

let last = performance.now();
let uiAcc = 1;
let saveAcc = 0;
function frame(nowMs: number): void {
  const dt = Math.min(0.1, (nowMs - last) / 1000);
  last = nowMs;
  sim.advance(state, clock());
  scene.sync(state);
  scene.render(nowMs / 1000, dt);
  ui.layout();
  uiAcc += dt;
  if (uiAcc > 0.25) { uiAcc = 0; ui.refresh(); }
  saveAcc += dt;
  if (saveAcc > 4) { saveAcc = 0; sim.save(state); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Accès console pour le débogage et les tests.
(window as unknown as Record<string, unknown>).grainier = { get state() { return state; }, sim, scene };
