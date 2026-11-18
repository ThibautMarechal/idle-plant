import { MUSHROOMS, MUSH_BY_ID, CAVE_PRICE, SOILS, GEAR, GEAR_IDS, BIOMES, LAND_BIOMES, LANDS, GARDEN_EXT, GARDEN_INDEX, SEASONS, FAMILIES, FAMILY_IDS, GLAZES, PAINTS, POT_SIZES, RARITIES, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, STAGES, ZONES } from './data';
import type { Family } from './data';
import type { Scene3D } from './scene';
import { buildPlant } from './plants3d';
import { Studio } from './studio';
import { Planet, buildHero } from './planet';
import { photo } from './icons';
import { Pick, PICK_OF, PICK_TEXT } from './pick';
import { Stall } from './stall';
import { Cellar } from './cellar';
import { Cutting } from './cutting';
import { Pollen } from './pollen';
import { finish, STYLES } from './styles';
import { themeOf } from './themes';
import * as sim from './sim';
import { play, setMuted, unlock } from './sound';
import type { State } from './sim';

import type { SoilId, MushId } from './data';
import { EMOJI, SheetKind, $, fmt, stars, vname, hex, clock, potLabel, esc, rarTag } from './uikit';
import { sheetHtml, paintTarget } from './sheets';

/** Pour chaque objectif : où emmener le joueur quand il le touche, et quoi lui dire. */
const QUEST_GUIDE: Record<string, { sheet?: SheetKind; overview?: boolean; tip: string }> = {
  open: { sheet: 'packets', tip: 'Ouvre ton sachet gratuit.' },
  plant: { tip: 'Glisse une graine de la barquette sur un pot vide, ou touche un pot vide.' },
  bloom1: { tip: 'Arrose ta plante et laisse-la pousser : elle fleurit toute seule.' },
  move: { tip: 'Pose le doigt sur un pot et fais-le glisser vers un autre emplacement.' },
  compost: { sheet: 'packets', tip: 'Dans « Mes graines », transforme une graine en engrais.' },
  craft: { sheet: 'atelier', tip: 'Choisis une taille, modèle le pot au tour, puis défourne-le.' },
  zone1: { overview: true, tip: 'Touche un cadenas dans la serre pour aménager une zone.' },
  zone2: { overview: true, tip: 'Touche chaque cadenas de la serre pour tout aménager.' },
  show: { tip: 'Touche une plante en fleur, puis « Exposer ».' },
  show4: { tip: 'Expose quatre plantes en fleur dans la vitrine.' },
  paint: { tip: 'Touche un pot dans la serre, puis « Peindre ».' },
  order: { tip: 'La commande est affichée en bas : fais fleurir la bonne famille, puis « Livrer ».' },
  cutting: { tip: 'Touche une plante en fleur, puis « Bouturer ».' },
  cross: { tip: 'Touche une plante en fleur, puis « Croiser », et choisis sa partenaire.' },
  shrub: { sheet: 'atelier', tip: 'Les arbustes demandent un pot moyen ou grand : tourne-en un.' },
  gear: { sheet: 'shop', tip: 'Installe un équipement de la boutique.' },
  extra: { sheet: 'shop', tip: 'Les suspensions sont dans « Agrandir la serre ».' },
  contest: { sheet: 'season', tip: 'Fais fleurir les familles de la saison.' },
  harmony: { tip: 'Peins le fond d\'un pot dans la couleur marquée 💚 pour sa plante.' },
};

/** Une graine fermée, dessinée au trait. */
const SEED_SVG = '<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M24 4C38 14 44 28 40 42 37 52 31 57 24 57S11 52 8 42C4 28 10 14 24 4z" fill="#c98f52" stroke="#2b2118" stroke-width="3" stroke-linejoin="round"/><path d="M24 13v36" fill="none" stroke="#9a6534" stroke-width="2.2" stroke-linecap="round"/><path d="M17 19c-4.500 6.500-5.500 14-3.500 21" fill="none" stroke="#f3d6a4" stroke-width="3.500" stroke-linecap="round"/></svg>';

export class UI {
  kind: SheetKind = 'none';
  arg = 0;
  argId = '';
  /** Filtre de la liste des graines à semer. */
  seedFilter = 'all';
  private lastSheet = '';
  private lastHud = '';
  private lastQuest = '';
  private lastNav = '';
  /** Pot en cours de peinture : sur un emplacement ou sur l'étagère. */
  paintAt: { where: 'slot' | 'shelf'; k: number } = { where: 'slot', k: 0 };
  private studio!: Studio;
  private trek!: Planet;
  private pick!: Pick;
  private stall!: Stall;
  private cellar!: Cellar;
  private caveHtml = '';
  private caveTip = '';
  private caveTipAt = 0;
  private cavePick = -1;
  private cutGame: Cutting | Pollen | null = null;
  private stallHtml = '';
  /** Outil tenu au doigt : arrosoir ou gant, promené au-dessus des plantes. */
  private tool = '';
  private toolEl: HTMLElement | null = null;
  private toolAt: number[] = [];
  private toolUsed = false;
  private toolTarget = -1;
  private tipAt = 0;
  private seedsHtml = '';
  private seedOpen = 0;
  private trekLabel = '';
  private viewSlot = -1;
  private pointerDown = false;
  private slotEls: HTMLButtonElement[] = [];
  private lockEls: HTMLButtonElement[] = [];
  private toastTimer = 0;
  private resetAskedAt = 0;
  /** Première plante choisie pour un croisement, ou -1. */
  private crossing = -1;
  private swipedAt = 0;
  private celebrate: string[] = [];
  private drag = -1;
  private dragTarget = -1;
  private doorAt = 0;
  private crossedAt = 0;
  private holdAt: { x: number; y: number; i: number; t: number } | null = null;
  private edgeAt = 0;
  private showEl!: HTMLButtonElement;
  private hotEls: HTMLButtonElement[] = [];

  constructor(public s: State, readonly scene: Scene3D, private onReset: () => void) {
    const overlay = $('overlay');
    ZONES.forEach((_, r) => {
      const b = document.createElement('button');
      b.className = 'zlock';
      b.onclick = () => { if (Date.now() - this.swipedAt > 350) this.open('zone', r); };
      overlay.appendChild(b);
      this.lockEls.push(b);
    });
    this.s.slots.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'slot';
      b.innerHTML = '<div class="badge hidden"></div><div class="bar"><i></i></div>';
      b.onclick = () => { if (Date.now() - this.swipedAt > 350) this.tapSlot(i); };
      // Glisser un pot : dès que le doigt bouge, le pot se soulève et suit.
      b.addEventListener('pointerdown', (e) => {
        this.holdAt = this.s.slots[i].pot ? { x: e.clientX, y: e.clientY, i, t: Date.now() } : null;
      });
      overlay.appendChild(b);
      this.slotEls.push(b);
    });
    this.showEl = document.createElement('button');
    this.showEl.className = 'showb';
    this.showEl.onclick = () => { if (Date.now() - this.swipedAt > 350) this.open('vitrine'); };
    overlay.appendChild(this.showEl);
    this.applyTheme();
    $('studio').innerHTML = '<div class="st-head"><h2 id="st-title"></h2><button class="x" data-act="st-close">✕</button></div><p id="st-hint"></p><canvas id="stgl"></canvas><div id="st-tools"></div>';
    this.studio = new Studio($('stgl') as HTMLCanvasElement);
    $('trek').innerHTML = '<canvas id="trgl"></canvas><div id="tr-night"></div><div class="tr-top"><div class="tr-time"><i id="tr-bar"></i></div><div class="tr-row"><span class="pill" id="tr-basket"></span><span class="pill" id="tr-rare">🧭<b id="tr-rarr"><svg viewBox="0 0 12 28" width="11" height="26"><path d="M6 1L10 14H2z" fill="#f2b51f" stroke="#3b2a20" stroke-width="1.2" stroke-linejoin="round"/><path d="M2 14h8L6 27z" fill="#fdfaf2" stroke="#3b2a20" stroke-width="1.2" stroke-linejoin="round"/><circle cx="6" cy="14" r="1.6" fill="#3b2a20"/></svg></b><span id="tr-rd"></span></span><span class="pill" id="tr-camp"><b id="tr-arrow"><svg viewBox="0 0 12 28" width="11" height="26"><path d="M6 1L10 14H2z" fill="#e2342c" stroke="#3b2a20" stroke-width="1.2" stroke-linejoin="round"/><path d="M2 14h8L6 27z" fill="#fdfaf2" stroke="#3b2a20" stroke-width="1.2" stroke-linejoin="round"/><circle cx="6" cy="14" r="1.6" fill="#3b2a20"/></svg></b><span id="tr-dist"></span></span></div></div><div id="tr-stick"><i></i></div><div id="tr-label"></div><p id="tr-hint"></p><div id="pick"><div class="pk-card"><b id="pk-title"></b><canvas id="pkc"></canvas><p id="pk-hint"></p></div></div>';
    this.trek = new Planet($('trgl') as HTMLCanvasElement);
    this.trek.onChange = () => this.trekHud();
    this.pick = new Pick($('pkc') as HTMLCanvasElement);
    // Chaque famille se cueille d'un geste différent, plus exigeant quand la plante est rare.
    this.trek.onPick = (id) => {
      const sp = SPECIES_BY_ID[id], kind = PICK_OF[sp.family];
      $('pick').className = 'on';
      $('pk-title').textContent = `${EMOJI[id]} ${sp.name} · ${PICK_TEXT[kind].title}`;
      $('pk-hint').textContent = PICK_TEXT[kind].hint;
      play('tap');
      this.pick.start(kind, EMOJI[id], Object.keys(RARITIES).indexOf(sp.rarity), (score) => { $('pick').className = ''; this.trek.resolve(score); }, this.trek.ease);
    };
    this.trek.onEvent = (kind, id) => {
      if (kind === 'wall') { this.toast(id === 'lock' ? 'Une mer de nuages : la région suivante se débloque depuis le sac à dos de la serre.' : 'La mer de nuages : c\'est le bout du monde connu.'); return; }
      if (kind === 'region') { const b = BIOMES[this.trek.land * LAND_BIOMES + Number(id)]; this.toast(`${b.icon} ${b.name}`); return; }
      if (kind === 'clay' || kind === 'coins') { play('coin'); this.buzz(12); this.toast(kind === 'clay' ? `Un filon d'argile : +${id} 🧱` : `Une bourse oubliée : +${id} 🪙`); return; }
      const name = id ? `${EMOJI[id]} ${SPECIES_BY_ID[id].name}` : '';
      if (kind === 'perfect') { play('rare'); this.buzz(30); this.toast(`Cueillette parfaite ! ${name} et une graine en plus.`); }
      else if (kind === 'pick') { play('plant'); this.buzz(15); this.toast(`${name} dans le panier.`); }
      else if (kind === 'miss') { play('tap'); this.buzz(60); this.toast(`Raté : ${name} est abîmée.`); }
      else if (kind === 'reveal') { play('craft'); this.buzz(20); }
      else if (kind === 'slow') this.toast(`${BIOMES[this.trek.land * LAND_BIOMES + this.trek.biome].slow} Tu avances au ralenti.`);
      else if (kind === 'dusk') { play('tap'); this.toast('Le soleil se couche : rentre à la serre avant la nuit !'); }
    };
    this.trek.onEnd = () => this.trekHome();
    $('stall').innerHTML = '<canvas id="slgl"></canvas><div class="tr-top"><div class="tr-row"><span class="pill" id="sl-earn"></span><span class="pill" id="sl-combo"></span><span class="pill" id="sl-queue"></span><button class="btn small" data-act="stall-close">Fermer</button></div></div><div id="sl-bubbles"></div><p id="sl-hint" class="on"></p>';
    this.stall = new Stall($('slgl') as HTMLCanvasElement);
    this.stall.wishOf = (left) => sim.stallWish(left);
    this.stall.onSale = (h, match, patience, combo) => sim.stallSell(this.s, h, sim.stallMult(match, patience, combo));
    this.stall.onChange = () => this.stallHud();
    this.stall.onEvent = (kind, gain) => {
      if (kind === 'great') { play('rare'); this.buzz(30); this.toast(`Client ravi ! +${fmt(gain ?? 0)} 🪙`); }
      else if (kind === 'sale') { play('coin'); this.buzz(15); this.toast(`Vendu : +${fmt(gain ?? 0)} 🪙`); }
      else if (kind === 'refuse') { play('tap'); this.buzz(50); this.toast('Ce n\'est pas ce qu\'il cherche.'); }
      else if (kind === 'leave') { play('tap'); this.toast('Un client repart les mains vides : la série est perdue.'); }
    };
    this.stall.onEnd = () => this.stallEnd();
    $('cave').innerHTML = '<canvas id="cvgl"></canvas><div class="tr-top"><div class="tr-row cv-row"><button class="btn small cv-up" data-act="cave-close">Remonter</button><span class="pill" id="cv-coins"></span><span class="pill" id="cv-time"></span></div></div><div id="cv-labels"></div><p id="cv-hint" class="on"></p><div id="cv-pick"></div>';
    this.cellar = new Cellar($('cvgl') as HTMLCanvasElement);
    this.cellar.state = () => this.s;
    this.cellar.onChange = () => this.caveHud();
    this.cellar.onAsk = (i) => { this.cavePick = i; this.cavePanel(); };
    this.cellar.onPick = (i) => {
      const gain = sim.pickBed(this.s, i);
      if (gain) { play('coin'); this.buzz(25); this.caveSay(`Cueilli : +${fmt(gain)} 🪙${sim.isNight(this.s) ? ' (prime de nuit)' : ''}`); this.bumpCoins(); }
    };
    this.cellar.onClear = (i) => { if (sim.clearBed(this.s, i)) { play('tap'); this.buzz(15); this.caveSay('Bac vidé : tu peux le réensemencer.'); } };
    this.cellar.onHint = (i, k) => {
      if (k === 'buy') { const p = sim.caveBedPrice(this.s); this.caveSay(p === null ? 'La cave est pleine.' : `Un bac de plus : ${fmt(p)} 🪙. Touche « Bac en plus » en bas.`); return; }
      this.caveSay(k === 'cut' ? 'Mûr ! Balaie le bac d\'un coup de doigt pour cueillir.' : 'Garde le doigt sur le bac pour le brumiser.');
    };
    $('tools').innerHTML = '<button class="tool" data-tool="shears">✂️</button><button class="tool" data-tool="basket">🧺</button><button class="tool" data-tool="can">🚿</button><button class="tool" data-tool="glove">🧤</button>';
    const grab = (tool: string, label: string, el: HTMLElement, e: PointerEvent) => {
      this.tool = tool;
      this.toolUsed = false;
      this.toolTarget = -1;
      this.toolEl = document.createElement('div');
      this.toolEl.className = 'toolghost' + (tool.startsWith('seed:') ? ' seed' : '');
      this.toolEl.textContent = label;
      $('fx').appendChild(this.toolEl);
      el.classList.add('held');
      this.useTool(e.clientX, e.clientY);
    };
    $('tools').querySelectorAll<HTMLElement>('.tool').forEach((b) => b.addEventListener('pointerdown', (e) => grab(b.dataset.tool!, b.textContent!, b, e)));
    // Graines à glisser : on prend une graine dans la barquette et on la lâche sur un pot vide.
    $('seeds').addEventListener('pointerdown', (e) => {
      const chip = (e.target as HTMLElement).closest('.seedchip[data-id]') as HTMLElement | null;
      if (chip) this.seedOpen = Date.now();
      if (chip) grab('seed:' + chip.dataset.id, EMOJI[chip.dataset.id!], chip, e);
    });
    const app = $('app');
    let sx = 0, sy = 0, onScene = false;
    setMuted(!!this.s.mute);
    // Doigts posés sur la serre : un doigt déplace la vue, deux doigts zooment.
    const fingers = new Map<number, { x: number; y: number }>();
    let panning = false, pinch = 0, lastTap = 0;
    const local = (x: number, y: number) => { const r = app.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; };
    const spread = () => { const [a, b] = [...fingers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), ...local((a.x + b.x) / 2, (a.y + b.y) / 2) }; };
    app.addEventListener('pointerdown', (e) => {
      unlock();
      this.pointerDown = true;
      sx = e.clientX; sy = e.clientY;
      onScene = !(e.target as HTMLElement).closest('#sheet, #modal, #bottom, #hud, #backdrop, #studio, #trek, #stall');
      panning = false;
      if (!onScene || this.tool) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size === 2) {
        // Un second doigt : on lâche le pot éventuel et on pince.
        this.holdAt = null;
        if (this.drag >= 0) { this.endDrag(); this.refresh(true); }
        pinch = spread().d;
      }
    });
    app.addEventListener('pointermove', (e) => {
      if (this.tool) { this.useTool(e.clientX, e.clientY); return; }
      const f = fingers.get(e.pointerId);
      if (fingers.size === 2 && f) {
        const before = spread();
        f.x = e.clientX; f.y = e.clientY;
        const now = spread();
        if (pinch > 0 && now.d > 0) this.scene.zoomAt(now.d / before.d, now.x, now.y);
        this.scene.panBy(now.x - before.x, now.y - before.y);
        this.swipedAt = Date.now();
        return;
      }
      // À la première personne, un geste vif parti d'un pot est un balayage ; pour prendre le pot, on pose le doigt un instant.
      if (this.drag < 0 && this.holdAt && this.scene.fp && Date.now() - this.holdAt.t < 180 && Math.hypot(e.clientX - this.holdAt.x, e.clientY - this.holdAt.y) >= 10) this.holdAt = null;
      if (this.drag < 0 && !this.holdAt) {
        // Un doigt sur le décor : la vue suit.
        if (!f) return;
        if (!panning && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
        panning = true;
        this.scene.panBy(e.clientX - f.x, e.clientY - f.y);
        f.x = e.clientX; f.y = e.clientY;
        return;
      }
      if (this.drag < 0) {
        if (!this.holdAt || Math.hypot(e.clientX - this.holdAt.x, e.clientY - this.holdAt.y) < 10) return;
        this.drag = this.holdAt.i;
        this.dragTarget = -1;
        this.scene.lift(this.drag);
        this.buzz(20);
        this.refresh(true);
      }
      // Près d'un bord, la vue glisse pour atteindre un emplacement plus loin sans lâcher le pot.
      const at = local(e.clientX, e.clientY);
      const rect = app.getBoundingClientRect();
      if (Date.now() - this.edgeAt > 30) {
        this.edgeAt = Date.now();
        const px = at.x < 44 ? 14 : at.x > rect.width - 44 ? -14 : 0;
        const py = at.y < 150 ? 14 : at.y > rect.height - 190 ? -14 : 0;
        if (px || py) this.scene.panBy(px, py, true);
      }
      this.moveGhost(e.clientX, e.clientY);
    });
    app.addEventListener('pointerup', (e) => {
      fingers.delete(e.pointerId);
      pinch = 0;
      if (this.tool) { this.dropTool(); return; }
      this.pointerDown = false;
      this.holdAt = null;
      if (this.drag >= 0) {
        const from = this.drag, to = this.dragTarget;
        this.endDrag();
        this.swipedAt = Date.now();
        if (to >= 0 && to !== from && sim.movePot(this.s, from, to)) {
          this.scene.pop(to);
          this.buzz(15);
        }
        this.refresh(true);
        return;
      }
      if (panning) { panning = false; this.scene.release(); this.swipedAt = Date.now(); this.refresh(true); return; }
      // Double-touche sur le décor : on s'approche, ou on revient à la vue d'ensemble.
      if (onScene && Math.hypot(e.clientX - sx, e.clientY - sy) < 8 && !(e.target as HTMLElement).closest('.slot, .zlock, .showb')) {
        if (Date.now() - lastTap < 320) { const at = local(e.clientX, e.clientY); this.scene.toggleZoom(at.x, at.y); lastTap = 0; this.refresh(true); }
        else lastTap = Date.now();
      }
    });
    app.addEventListener('wheel', (e) => {
      if ((e.target as HTMLElement).closest('#sheet, #modal, #studio, #trek, #stall')) return;
      const at = local(e.clientX, e.clientY);
      this.scene.zoomAt(Math.exp(-e.deltaY * 0.0016), at.x, at.y);
    }, { passive: true });
    for (const ev of ['pointercancel', 'pointerleave']) app.addEventListener(ev, (e) => { fingers.delete((e as PointerEvent).pointerId); this.dropTool(); this.pointerDown = false; this.holdAt = null; if (this.drag >= 0) { this.endDrag(); this.refresh(true); } });
    app.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (t && !t.hasAttribute('disabled')) this.act(t.dataset.act!, t.dataset.arg ?? '');
    });
    $('backdrop').onclick = () => this.close();
  }

  private endDrag(): void {
    this.drag = -1;
    this.dragTarget = -1;
    this.scene.lift(-1);
  }

  private moveGhost(cx: number, cy: number): void {
    const rect = $('app').getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    // Le pot entier suit le doigt, centré dessous.
    this.scene.dragTo(x, y);
    let best = -1, bestD = Infinity;
    this.s.slots.forEach((_, i) => {
      if (!sim.slotOpen(this.s, i)) return;
      const r = this.scene.slotRect(i);
      const d = Math.hypot(r.x - x, r.bottom - r.unit * 0.45 - y);
      if (d < bestD && d < r.unit * 0.95) { bestD = d; best = i; }
    });
    if (best !== this.dragTarget) { this.dragTarget = best; this.refresh(true); }
    // Le pot tenu un instant devant la porte la franchit avec nous : serre et jardin s'échangent leurs pots.
    const hot = themeOf(this.scene.themeId).fp?.hot ?? [];
    const k = hot.findIndex((h) => h.act === 'door');
    const dr = k >= 0 && this.s.zonesOpen[GARDEN_INDEX] ? this.scene.hotRect(k) : null;
    const over = !!dr && Date.now() - this.crossedAt > 1500 && x > 44 && x < rect.width - 44 && Math.hypot(dr.x - x, dr.y - y) < dr.unit * hot[k].r;
    if (!over) this.doorAt = 0;
    else if (!this.doorAt) this.doorAt = Date.now();
    else if (Date.now() - this.doorAt > 450) {
      this.doorAt = 0;
      this.crossedAt = Date.now();
      this.scene.walk(this.scene.spot ? 0 : 1, this.scene.spot ? 0 : 135);
      play('tap');
      this.buzz(25);
      this.refresh(true);
    }
  }

  /** L'outil suit le doigt et agit sur chaque plante qu'il survole. */
  private useTool(cx: number, cy: number): void {
    const rect = $('app').getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    if (this.toolEl) { this.toolEl.style.left = x + 'px'; this.toolEl.style.top = y + 'px'; }
    const s = this.s;
    const now = Date.now();
    const near = (i: number, lift: number, reach: number) => {
      if (!sim.slotOpen(s, i)) return Infinity;
      const r = this.scene.slotRect(i);
      const d = Math.hypot(r.x - x, r.bottom - r.unit * lift - y);
      return d < r.unit * reach ? d : Infinity;
    };
    if (this.tool.startsWith('seed:')) {
      // La graine vise le pot vide le plus proche du doigt ; elle sera semée au lâcher.
      const id = this.tool.slice(5);
      let best = -1, bestD = Infinity;
      s.slots.forEach((slot, i) => {
        if (!slot.pot || slot.plant || sim.potSize(slot) < sim.sizeOf(SPECIES_BY_ID[id])) return;
        const d = near(i, 0.45, 0.95);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== this.toolTarget) { this.toolTarget = best; this.refresh(true); }
      return;
    }
    s.slots.forEach((slot, i) => {
      if (!slot.plant || near(i, 0.7, 0.8) === Infinity || now - (this.toolAt[i] ?? 0) < 280) return;
      let fx = '';
      if (this.tool === 'can') { const wet = sim.drowns(s, i); if (sim.water(s, i)) fx = wet ? '💦 Trop d\'eau !' : '💧'; if (wet) this.drownWarn(i, true); }
      else if (this.tool === 'glove') { if (sim.squash(s, i)) fx = slot.plant.pests > 0 ? '🐛' : '✨ Propre !'; }
      else if (this.tool === 'shears') { if (sim.prune(s, i)) fx = '✂️ Taillée !'; }
      else if (slot.plant.prog >= 1) {
        if (sim.harvestStore(s, i)) fx = '📦';
        else if (now - this.toolAt[99] > 2000 || !this.toolAt[99]) { this.toolAt[99] = now; this.toast('La réserve est pleine : vends au Marché ou agrandis-la.'); }
      }
      if (!fx) return;
      this.toolAt[i] = now;
      this.toolUsed = true;
      this.scene.pop(i);
      this.float(i, fx);
      play(this.tool === 'can' ? 'water' : 'tap');
      this.buzz(10);
      this.refresh(true);
    });
  }

  private dropTool(): void {
    if (!this.tool) return;
    const s = this.s;
    if (this.tool.startsWith('seed:')) {
      const i = this.toolTarget;
      this.toolTarget = -1;
      if (i >= 0 && sim.plantSeed(s, i, this.tool.slice(5))) { play('plant'); this.scene.pop(i); this.float(i, '🌱'); this.buzz(12); }
      else this.toast('Glisse la graine jusqu\'à un pot vide assez grand pour elle.');
    } else if (!this.toolUsed) {
      this.toast(this.tool === 'can' ? 'Garde le doigt sur l\'arrosoir et promène-le au-dessus des plantes assoiffées.'
        : this.tool === 'shears' ? 'Garde le doigt sur le sécateur et passe sur les plantes qui demandent une taille.'
        : this.tool === 'glove' ? 'Garde le doigt sur le gant et frotte les plantes envahies pour chasser les chenilles.'
        : 'Garde le doigt sur le panier et passe sur les plantes en fleur : elles partent en réserve, à vendre au bon moment.');
    }
    this.tool = '';
    this.toolEl?.remove();
    this.toolEl = null;
    document.querySelectorAll('#tools .held, #seeds .held').forEach((b) => b.classList.remove('held'));
    this.seedsHtml = '';
    this.refresh(true);
    this.swipedAt = Date.now();
  }

  private goZone(z: number): void {
    this.scene.setView(z);
    this.refresh(true);
  }

  zname(z: number): string {
    return themeOf(this.scene.themeId).zones[z] ?? 'Le jardin';
  }

  private applyTheme(): void {
    $('app').style.background = themeOf(this.scene.themeId).bg;
    // Objets du décor qui ouvrent un menu : une zone tactile par objet, avec son étiquette.
    this.hotEls.forEach((el) => el.remove());
    this.hotEls = (themeOf(this.scene.themeId).fp?.hot ?? []).map((h) => {
      const b = document.createElement('button');
      b.className = 'hot';
      b.innerHTML = `<span>${h.label}</span>`;
      b.onclick = () => {
        if (Date.now() - this.swipedAt < 350) return;
        if (h.act.startsWith('gext')) return this.open('gext', Number(h.act.slice(4)) - 1);
        if (h.act === 'cave') return this.act('cave-go', '');
        if (h.act !== 'door') return this.act('nav', h.act);
        if (!this.s.zonesOpen[GARDEN_INDEX]) return this.open('zone', GARDEN_INDEX);
        this.scene.walk(this.scene.spot ? 0 : 1, this.scene.spot ? 315 : 135);
        play('tap');
        this.refresh(true);
      };
      $('overlay').appendChild(b);
      return b;
    });
    document.body.dataset.style = this.scene.styleId;
    document.body.dataset.fp = this.scene.fp ? '1' : '';
  }

  setState(s: State): void {
    this.s = s;
    this.close();
  }

  // ---------- interactions ----------

  private tapSlot(i: number): void {
    const s = this.s;
    const slot = s.slots[i];
    const p = slot.plant;
    const z = sim.zoneIndexOfSlot(i);
    if (!s.zonesOpen[z]) return this.open('zone', z);
    if (!sim.slotOpen(s, i)) return;
    if (this.crossing >= 0) {
      const from = this.crossing;
      if (from === i) { this.crossing = -1; this.refresh(true); return; }
      const why = sim.crossBlock(s, from, i);
      if (why) { this.toast(why); return; }
      this.crossing = -1;
      this.showPollen(from, i);
      this.refresh(true);
      return;
    }
    if (!slot.pot) return this.open('buypot', i);
    if (!p) return this.open('seed', i);
    if (p.pests > 0) {
      sim.squash(s, i);
      this.scene.pop(i);
      this.float(i, p.pests > 0 ? '🐛' : '✨ Propre !');
      this.buzz(15);
      return;
    }
    if (p.prog >= 1) return this.open('harvest', i);
    if (p.water < 0.5 && !sim.dripOn(s, i) && !sim.drowns(s, i)) {
      sim.water(s, i);
      this.scene.pop(i);
      this.float(i, '💧');
      play('water');
      this.buzz(10);
      return;
    }
    this.open('plant', i);
  }

  private act(name: string, arg: string): void {
    const s = this.s;
    const n = Number(arg);
    switch (name) {
      case 'close': this.close(); break;
      case 'nav': this.open(arg as SheetKind); break;
      case 'view': this.goZone(n); break;
      case 'show':
        if (sim.harvestShow(s, this.arg)) { this.float(this.arg, '🏛️'); this.buzz(20); this.close(); }
        else this.toast('La vitrine est pleine.');
        break;
      case 'unshow': {
        const gain = sim.sellShowcase(s, n);
        if (gain) { this.toast(`Vendu ! +${fmt(gain)} 🪙`); this.bumpCoins(); }
        break;
      }
      case 'tips': {
        const got = sim.collectTips(s);
        if (got) { this.toast(`Les visiteurs ont laissé ${fmt(got)} 🪙`); this.bumpCoins(); this.buzz(20); }
        break;
      }
      case 'compost':
        if (sim.compost(s, arg)) { this.toast('Compostée : +1 dose d\'engrais 🧪'); this.buzz(10); }
        break;
      case 'fert':
        if (sim.fertilize(s, this.arg)) { this.scene.pop(this.arg); this.float(this.arg, '🧪'); this.buzz(15); }
        break;
      case 'gear': sim.toggleGear(s, arg as sim.ClimateGear); break;
      case 'pump': this.showPump(); break;
      case 'testmode':
        sim.setTestMode(s, !s.test);
        this.toast(s.test ? 'Mode test activé : tout est illimité.' : 'Mode test coupé : tes vraies réserves sont revenues.');
        this.bumpCoins();
        this.refresh(true);
        break;
      case 'cut-cancel': this.cutGame?.stop(); this.cutGame = null; $('modal').classList.remove('on'); break;
      case 'seedfilter': this.seedFilter = arg; this.refresh(true); break;
      case 'valve': sim.toggleValve(s, Number(arg)); play('tap'); break;
      case 'buytank': if (sim.buyTank(s)) { this.toast('Cuve agrandie et remplie !'); this.buzz(25); play('coin'); } break;
      case 'flip': this.flipNext(); break;
      case 'flipall': this.flipAll(); break;
      case 'buygext': if (sim.buyGardenExt(s)) { this.toast(`${GARDEN_EXT[(s.gardenExt ?? 1) - 1].name} : parcelle aménagée, trois emplacements de plus !`); this.buzz(30); play('coin'); this.close(); this.scene.walk(1, (s.gardenExt ?? 1) === 1 ? 45 : 225); } break;
      case 'trophy': {
        const r = sim.claimTrophy(s, arg);
        if (r) { this.toast(`Trophée obtenu ! +${fmt(r)} 🪙`); play('coin'); this.bumpCoins(); this.buzz(30); }
        break;
      }
      case 'mute':
        s.mute = !s.mute;
        setMuted(s.mute);
        if (!s.mute) play('tap');
        break;
      case 'tier':
        if (sim.buyTier(s, n)) { this.toast(`La verrière s'agrandit : ${this.zname(n)} gagne un gradin de trois pots.`); play('level'); this.buzz(30); this.close(); this.goZone(n); }
        else this.toast(s.zonesOpen[n] ? 'Pas assez de pièces.' : 'Aménage d\'abord cette zone.');
        break;
      case 'extra':
        if (sim.buyExtra(s, n)) { this.toast(`Suspension installée : ${this.zname(n)} gagne un emplacement.`); play('craft'); this.buzz(25); this.close(); this.goZone(n); }
        else this.toast(s.zonesOpen[n] ? 'Pas assez de pièces.' : 'Aménage d\'abord cette zone.');
        break;
      case 'contest': {
        const r = sim.claimContest(s);
        if (r) { this.toast(`Palier ${r.label} : +${fmt(r.coins)} 🪙 et +${r.clay} argile !`); play('rare'); this.bumpCoins(); this.buzz(40); }
        break;
      }
      case 'cancelmove': this.crossing = -1; break;
      case 'cross':
        this.crossing = this.arg;
        this.close();
        this.toast('Touche une autre plante en fleur de la même famille et de la même rareté.');
        break;
      case 'prestige': {
        const got = sim.buyPrestige(s);
        if (got) this.showPacket(got);
        else this.toast('Pas assez de pièces.');
        break;
      }
      case 'openzone':
        if (sim.openZone(s, this.arg)) { this.toast(`${this.zname(this.arg)} : zone aménagée !`); this.buzz(30); const z = this.arg; this.close(); if (z === GARDEN_INDEX) this.scene.walk(1, 135); else this.goZone(z); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'plant':
        if (sim.plantSeed(s, this.arg, arg)) { play('plant'); this.scene.pop(this.arg); this.float(this.arg, '🌱'); this.buzz(12); this.close(); }
        break;
      case 'craft':
        if (sim.startPot(s, n)) { play('craft'); this.toast('Au four ! La cuisson continue même en ton absence.'); this.buzz(15); }
        else this.toast(s.kiln ? 'Le four est déjà occupé.' : 'Pas assez d\'argile.');
        break;
      case 'kiln':
        if (sim.collectKiln(s)) { play('craft'); this.toast('Pot défourné : il t\'attend sur l\'étagère.'); this.buzz(25); }
        else if (s.shelf.length >= sim.SHELF_CAP) this.toast('L\'étagère est pleine : pose un pot dans la serre.');
        break;
      case 'place':
        if (sim.placePot(s, this.arg, n)) { this.scene.pop(this.arg); this.buzz(20); this.open('seed', this.arg); }
        break;
      case 'stow':
        if (sim.stowPot(s, this.arg)) { this.toast('Pot rangé sur l\'étagère de l\'atelier.'); this.close(); }
        else this.toast('L\'étagère est pleine.');
        break;
      case 'paintslot': this.paintAt = { where: 'slot', k: this.arg }; this.openStudio('paint'); break;
      case 'paintshelf': this.paintAt = { where: 'shelf', k: n }; this.openStudio('paint'); break;
      case 'wheel': this.studio.size = n; this.openStudio('wheel'); break;
      case 'admire': this.viewSlot = this.arg; this.openStudio('view'); break;
      case 'st-close': this.closeStudio(); break;
      case 'st-size': this.studio.size = n; this.studioTools(); break;
      case 'st-reset': this.studio.resetWheel(); break;
      case 'st-fire':
        if (sim.startPot(s, this.studio.size, this.studio.prof)) { play('craft'); this.closeStudio(); this.toast('Au four ! La cuisson continue même en ton absence.'); this.buzz(15); this.open('atelier'); }
        else this.toast(s.kiln ? 'Le four est déjà occupé.' : 'Pas assez d\'argile.');
        break;
      case 'st-color':
        if (n > 0 && sim.collection(s).stars < PAINTS[n - 1].stars) { this.toast(`Cette couleur se débloque à ${PAINTS[n - 1].stars} ⭐ dans l'almanach.`); break; }
        this.studio.color = n; this.studio.hand = false; this.studioTools(); break;
      case 'st-brush': this.studio.brush = n; this.studio.hand = false; this.studioTools(); break;
      case 'st-hand': this.studio.hand = !this.studio.hand; this.studioTools(); break;
      case 'st-spin': this.studio.spin = !this.studio.spin; this.studioTools(); break;
      case 'st-base':
        if (!sim.glazeOpen(s, n)) { this.toast(`Cet émail se débloque à ${GLAZES[n].stars} ⭐ dans l'almanach.`); break; }
        this.studio.setBase(n); this.studioTools(); break;
      case 'st-clear': this.studio.clearPaint(); break;
      case 'st-done': {
        if (!this.studio.touched) { this.closeStudio(); break; }
        const r = this.studio.paintResult();
        if (sim.savePaint(s, this.paintAt.where, this.paintAt.k, r.glaze, r.paint)) {
          play('craft'); this.buzz(20); this.closeStudio(); this.toast('Ton pot est peint !');
          if (this.paintAt.where === 'slot') this.scene.pop(this.paintAt.k);
        } else this.toast(s.coins < sim.PAINT_PRICE ? 'Pas assez de pièces.' : 'Ce pot n\'est plus là.');
        break;
      }
      case 'st-paint': this.paintAt = { where: 'slot', k: this.viewSlot }; this.openStudio('paint'); break;
      case 'prune':
        if (sim.prune(s, this.arg)) { this.scene.pop(this.arg); this.float(this.arg, '✂️ Taillée !'); this.buzz(12); }
        break;
      case 'cutting': this.showCutting(this.arg); break;
      case 'deliver': {
        const who = s.order?.who ?? '';
        const clay = s.order?.clay ?? 0;
        const gain = sim.deliver(s, this.arg);
        if (gain) { this.coinFx(this.arg, gain); this.toast(`${who} est ravi : +${fmt(gain)} 🪙 et +${clay} argile.`); this.close(); }
        break;
      }
      case 'trek-biome':
        if (sim.openBiome(s, n)) {
          play('craft'); this.buzz(25);
          if (n % LAND_BIOMES === 0) { sim.setLand(s, n / LAND_BIOMES); this.toast(`${LANDS[n / LAND_BIOMES].name} : un nouveau continent s'ouvre à toi, avec des plantes qu'on ne trouve que là-bas !`); }
          else this.toast(`${BIOMES[n].name} : la mer de nuages se retire, une nouvelle région t'attend !`);
        } else this.toast(sim.biomeBlock(s, n) || 'Pas assez de pièces.');
        break;
      case 'trek-land':
        if (sim.setLand(s, n)) play('tap');
        break;
      case 'trek-basket':
        if (sim.buyBasket(s)) { play('craft'); this.buzz(20); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'trek-gear': {
        const k = GEAR_IDS[n];
        if (k && sim.buyTrekGear(s, k)) { play('craft'); this.buzz(20); const g = GEAR[k], lv = sim.gearLv(s, k); this.toast(`${g.icon} ${g.names[lv - 1]} : ${g.say(g.v[lv]).replace(/^./, (c) => c.toLowerCase())}`); }
        else this.toast('Pas assez de pièces.');
        break;
      }
      case 'trek-go': {
        if (sim.trekDarkBlocked(s)) { this.toast('Il fait nuit noire : il te faut une lanterne pour partir.'); break; }
        const finds = sim.planetFinds(s, Math.random);
        if (!finds.length) { this.toast('Repose-toi encore un peu avant de repartir.'); break; }
        this.close();
        $('trek').className = 'on';
        this.trek.open(finds, { ...sim.trekSetup(s), reach: sim.trekReach(s), land: sim.landOf(s) });
        this.trekHud();
        break;
      }
      case 'stall-go':
        if (!s.stock.length) { this.toast('Ta réserve est vide : range d\'abord des plantes en fleur.'); break; }
        this.close();
        $('stall').className = 'on';
        this.stall.open([...s.stock]);
        this.stallHud();
        break;
      case 'cave-go':
        if (!s.cave) { this.open('cave'); break; }
        this.close();
        $('cave').className = 'on';
        this.cavePick = -1;
        this.caveHtml = '';
        this.cellar.open();
        this.cavePanel();
        break;
      case 'cave-buy':
        if (sim.buyCave(s)) { play('level'); this.buzz(30); this.act('cave-go', ''); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'cave-close':
        this.cellar.close();
        $('cave').className = '';
        break;
      case 'cave-bed':
        if (sim.buyCaveBed(s)) { play('craft'); this.buzz(20); this.caveSay('Nouveau bac installé sur l\'étagère.'); this.cavePanel(); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'cave-seed':
        if (sim.seedBed(s, this.cavePick, arg as MushId)) { play('plant'); this.buzz(15); this.caveSay(`${MUSH_BY_ID[arg as MushId].name} : ensemencé. Garde le bac humide.`); this.cavePick = -1; this.cavePanel(); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'cave-cancel':
        this.cavePick = -1;
        this.cavePanel();
        break;
      case 'stall-close':
        this.stall.shut();
        break;
      case 'seedbag':
        this.seedOpen = this.seedOpen ? 0 : Date.now();
        this.refresh(true);
        break;
      case 'orderinfo':
        if (s.order) this.toast(`📦 ${s.order.who} (+${s.order.coins} 🪙) : fais fleurir une plante de la famille ${FAMILIES[s.order.family].name.toLowerCase()}, qualité ${sim.qualityWord(s.order.minQ).toLowerCase()} ou mieux, puis choisis « Livrer » à la récolte.`);
        break;
      case 'buypot':
        if (sim.buyPot(s, this.arg)) { this.scene.pop(this.arg); this.buzz(20); this.open('seed', this.arg); }
        break;
      case 'soil': this.open('soil', this.arg); break;
      case 'setsoil': {
        const k = arg as SoilId;
        if (sim.setSoil(s, this.arg, k)) { play('plant'); this.buzz(15); this.scene.pop(this.arg); this.toast(`🟫 ${SOILS[k].name} dans ce pot.`); this.open(s.slots[this.arg].plant ? 'plant' : 'seed', this.arg); }
        else this.toast('Pas assez de pièces.');
        break;
      }
      case 'water':
        if (this.drownWarn(this.arg)) break;
        if (sim.water(s, this.arg)) { this.scene.pop(this.arg); this.float(this.arg, '💧'); }
        break;
      case 'sell': {
        const gain = sim.harvestSell(s, this.arg);
        if (gain) { this.coinFx(this.arg, gain); this.close(); }
        break;
      }
      case 'store':
        if (sim.harvestStore(s, this.arg)) { this.float(this.arg, '📦'); this.close(); }
        else this.toast('La réserve est pleine.');
        break;
      case 'sellstock': {
        const gain = sim.sellStock(s, n);
        if (gain) { this.toast(`Vendu ! +${fmt(gain)} 🪙`); this.bumpCoins(); this.buzz(20); }
        break;
      }
      case 'free': {
        const chained = $('modal').classList.contains('on');
        const got = sim.openFreePacket(s);
        if (got) this.showPacket(got, chained);
        break;
      }
      case 'buypacket': {
        const got = sim.buyPacket(s, Math.random, (arg || undefined) as Family | undefined);
        if (got) this.showPacket(got);
        else this.toast('Pas assez de pièces.');
        break;
      }
      case 'upgrade':
        if (sim.buyUpgrade(s, arg as 'water' | 'bugs' | 'mist' | 'stock')) { this.toast('Installé dans la serre !'); this.buzz(25); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'style':
        s.style = arg;
        this.scene.setStyle(arg);
        this.applyTheme();
        this.close();
        this.toast(`Style : ${STYLES.find((x) => x.id === arg)?.name ?? ''}`);
        break;
      case 'theme':
        s.theme = arg;
        this.scene.setTheme(arg);
        this.applyTheme();
        this.close();
        this.toast(`Décor : ${themeOf(arg).name}`);
        break;
      case 'quest': {
        const r = sim.claimQuest(s);
        if (r) { play('coin'); this.toast(`Objectif atteint ! +${fmt(r)} 🪙`); this.bumpCoins(); this.buzz(30); }
        break;
      }
      case 'questgo': {
        // Toucher l'objectif y emmène, ou dit où aller.
        const q = sim.currentQuest(s);
        const go = q && QUEST_GUIDE[q.id];
        if (!q || q.done(s)) break;
        if (go?.sheet) this.open(go.sheet);
        if (go?.overview) this.goZone(-1);
        this.toast(go?.tip ?? 'Continue à faire fleurir de nouvelles espèces : chaque sachet peut en cacher une.');
        break;
      }
      case 'fiche': this.argId = arg; this.open('fiche', this.arg); break;
      case 'closemodal': $('modal').classList.remove('on'); break;
      case 'reset':
        // Pas de boîte de dialogue native : deux touches rapprochées valent confirmation.
        if (Date.now() - this.resetAskedAt < 4000) { this.resetAskedAt = 0; this.onReset(); this.toast('Nouvelle partie.'); }
        else { this.resetAskedAt = Date.now(); this.toast('Touche encore une fois pour tout effacer.'); }
        break;
    }
    this.refresh(true);
  }

  private open(kind: SheetKind, arg = 0): void {
    this.kind = kind;
    this.arg = arg;
    this.lastSheet = '';
    $('sheet').classList.add('on');
    $('backdrop').classList.add('on');
    this.refresh(true);
    $('sheet').querySelector('.sh-body')?.scrollTo(0, 0);
  }

  private openStudio(mode: 'wheel' | 'paint' | 'view'): void {
    const s = this.s;
    const st = this.studio;
    let title = '', hint = '';
    if (mode === 'paint') {
      const pd = paintTarget(this);
      if (!pd) return;
      title = '🎨 Peinture';
      hint = 'Peins au doigt, directement sur le pot. Glisse à côté du pot pour le tourner.';
    } else if (mode === 'wheel') {
      title = '🏺 Tour de potier';
      hint = 'Pose le doigt sur l\'argile : pousse vers le centre pour resserrer, tire vers l\'extérieur pour évaser.';
    } else {
      const slot = s.slots[this.viewSlot];
      if (!slot?.pot) return;
      const p = slot.plant;
      title = p ? `${EMOJI[p.sp]} ${esc(vname(SPECIES_BY_ID[p.sp], sim.stageOf(p.prog) >= 2 ? p.vr : 0))}` : '🏺 Ton pot';
      hint = 'Glisse pour faire tourner.';
    }
    this.close();
    $('st-title').innerHTML = title;
    $('st-hint').textContent = hint;
    $('studio').className = 'on ' + mode;
    // Le canevas doit avoir sa taille d'écran avant que la scène ne se cadre.
    if (mode === 'paint') st.openPaint(paintTarget(this)!);
    else if (mode === 'wheel') st.openWheel(st.size);
    else {
      const slot = s.slots[this.viewSlot];
      const p = slot.plant;
      let plant = null, scale = 1;
      if (p) {
        const sp = SPECIES_BY_ID[p.sp];
        const stage = sim.stageOf(p.prog);
        const fit = sim.fitOf(sp, sim.zoneClimate(s, sim.zoneOfSlot(this.viewSlot)));
        const health = Math.min(fit, p.water > 0 ? 1 : 0.75) * (p.pests > 0 ? 0.8 : 1);
        plant = finish(buildPlant(sp, stage, health, stage >= 2 ? p.vr : 0));
        scale = (0.82 + 0.18 * (stage >= 4 ? 1 : p.prog * 4 - stage)) * [1, 1.1, 1.2][(sp.size ?? 1) - 1];
      }
      st.openView(slot.pd, themeOf(s.theme).pot, plant, scale);
    }
    this.studioTools();
    st.resize();
  }

  private closeStudio(): void {
    this.studio.close();
    $('studio').className = '';
  }

  /** Bandeau de l'expédition : jour restant, panier, boussole du camp, manette, étiquette et jauge de coupe. */
  /** Le portrait du personnage avec son équipement, dans le sac à dos de l'expédition. */
  private heroShot: { key: string; c: HTMLCanvasElement } | null = null;
  private heroPic(): void {
    const box = document.getElementById('heropic');
    if (!box) return;
    const gear = sim.trekSetup(this.s).gear, key = JSON.stringify(gear);
    if (this.heroShot?.key !== key) {
      const c = photo(buildHero(gear), 240);
      if (!c) return;
      this.heroShot = { key, c };
    }
    const src = this.heroShot.c, c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d')?.drawImage(src, 0, 0);
    box.replaceChildren(c);
  }

  /** Prévient avant d'arroser une plante qui craint l'excès d'eau. Avec l'arrosoir, le mal est fait : on l'explique. */
  private drownAt = 0;
  private drownWarn(i: number, done = false): boolean {
    const p = this.s.slots[i].plant;
    if (!p || !sim.drowns(this.s, i)) return false;
    if (Date.now() - this.drownAt > 3000) {
      this.drownAt = Date.now();
      this.toast(done ? `💦 Trop d'eau ! ${SPECIES_BY_ID[p.sp].name} craint l'excès d'eau : attends que sa terre sèche.` : `${SPECIES_BY_ID[p.sp].name} boit peu : sa terre est encore humide, attends avant d'arroser.`);
    }
    return !done;
  }

  private trekHud(): void {
    const t = this.trek;
    if (!t.active) return;
    const px = (el: HTMLElement, x: number, y: number) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
    ($('tr-bar') as HTMLElement).style.width = t.day * 100 + '%';
    $('tr-bar').classList.toggle('late', t.left < 35);
    const tn = $('tr-night') as HTMLElement;
    tn.style.opacity = String(t.night * (t.lantern ? 0.8 : 0.55));
    // La lanterne perce la nuit : un cercle de lumière autour du personnage.
    const hs = t.heroScreen;
    const mask = t.lantern && t.night > 0.05 ? `radial-gradient(circle at ${Math.round(hs.x)}px ${Math.round(hs.y)}px, transparent ${55 + t.lantern * 14}px, #000 ${110 + t.lantern * 26}px)` : '';
    if (tn.dataset.mask !== mask) { tn.dataset.mask = mask; tn.style.maskImage = mask; tn.style.webkitMaskImage = mask; }
    const count: Record<string, number> = {};
    for (const id of t.bonus) count[id] = (count[id] ?? 0) + 1;
    // Un petit panier se montre en entier ; un grand se résume aux trois dernières trouvailles et au compte.
    const room = t.compass >= 5 ? 2 : t.compass ? 3 : 5;
    const shown = t.basket.map((id) => EMOJI[id] + (count[id]-- > 0 ? '✨' : '')).slice(-room).join('');
    const b = t.cap > room ? `🧺 ${shown} ${t.basket.length}/${t.cap}` : `🧺 ${shown}${'·'.repeat(Math.max(0, t.cap - t.basket.length))}${t.loot.clay ? ` 🧱${t.loot.clay}` : ''}${t.loot.coins ? ` 🪙${t.loot.coins}` : ''}`;
    if ($('tr-basket').textContent !== b) $('tr-basket').textContent = b;
    const dist = t.atCamp ? '🏡 Pousse la porte' : `🏡 ${Math.round(t.campDist)} m`;
    if ($('tr-dist').textContent !== dist) $('tr-dist').textContent = dist;
    // Boussole : la plante rare la plus proche.
    const rare = t.compass ? t.rare : null;
    ($('tr-rare') as HTMLElement).style.display = rare ? '' : 'none';
    if (rare) {
      ($('tr-rarr') as HTMLElement).style.transform = `rotate(${rare.angle}rad)`;
      const rd = `${rare.id ? EMOJI[rare.id] + ' ' : ''}${Math.round(rare.dist)} m`;
      if ($('tr-rd').textContent !== rd) $('tr-rd').textContent = rd;
    }
    const arrow = $('tr-arrow');
    arrow.style.transform = `rotate(${t.campAngle}rad)`;
    arrow.style.visibility = t.atCamp ? 'hidden' : 'visible';
    const stick = $('tr-stick');
    stick.className = t.stick ? 'on' : '';
    if (t.stick) {
      px(stick, t.stick.x, t.stick.y);
      (stick.firstElementChild as HTMLElement).style.transform = `translate(${t.stick.dx}px, ${t.stick.dy}px)`;
    }
    const lab = $('tr-label'), r = t.nearRect();
    let html = '', hint = !t.atCamp ? '' : t.day > 0.93 && !t.basket.length ? 'Pose le pouce n\'importe où et pousse dans la direction où aller. Plus tu t\'éloignes de la serre, plus les plantes sont rares.' : 'Pour rentrer, marche jusqu\'à la serre et pousse sa porte.';
    if (r && t.near >= 0) {
      const sp = SPECIES_BY_ID[t.nearId];
      html = t.nearHidden ? '<b>Un fourré…</b>' : `<b>${EMOJI[sp.id]} ${esc(sp.name)}</b>${rarTag(sp)}${this.s.disc[sp.id]?.seen ? '' : '<i>NOUVEAU</i>'}`;
      hint = t.picking ? '' : t.nearHidden ? 'Frotte le fourré du doigt pour écarter ses branches.' : t.full ? 'Ton panier est plein : rentre à la serre.' : 'Touche la plante pour la cueillir.';
      px(lab, r.x, r.y);
    } else if (t.full) hint = 'Ton panier est plein : rentre à la serre.';
    if (t.lost) hint = 'La nuit t\'a surpris loin de la serre : tu perds la moitié du panier.';
    if (html !== this.trekLabel) { this.trekLabel = html; lab.innerHTML = html; lab.className = html ? 'on' : ''; }
    const hintEl = $('tr-hint');
    if (hintEl.textContent !== hint) { hintEl.textContent = hint; hintEl.className = hint ? 'on' : ''; }
  }

  /** Une phrase en bas de la cave, qui s'efface d'elle-même. */
  private caveSay(text: string): void {
    this.caveTip = text;
    this.caveTipAt = Date.now();
  }

  /** Le bas de la cave : choisir un champignon pour un bac vide, ou acheter un bac de plus. */
  private cavePanel(): void {
    const s = this.s, c = s.cave, box = $('cv-pick');
    if (!c) { box.innerHTML = ''; return; }
    if (this.cavePick >= 0 && !c.beds[this.cavePick]) {
      const rows = MUSHROOMS.map((m) => {
        const open = sim.mushOpen(s, m.id), can = open && s.coins >= m.price;
        const ds = open ? `${m.glow ? 'Seulement la nuit · ' : ''}${Math.round(m.grow / 60)} min de nuit par volée · ${sim.MUSH_FLUSHES_N} volées de ~${fmt(m.value)} 🪙` : `Après ${m.need} cueillettes (tu en as ${c.total})`;
        return `<button class="card${open ? '' : ' dim'}" data-act="cave-seed" data-arg="${m.id}" ${can ? '' : 'disabled'}><div class="ico">🍄</div><div class="mid"><div class="nm">${esc(m.name)}</div><div class="ds">${ds}</div></div><div class="end">${open ? `${fmt(m.price)} 🪙` : '🔒'}</div></button>`;
      }).join('');
      box.innerHTML = `<div class="cv-panel"><div class="cv-head"><b>Que faire pousser ?</b><button class="btn small" data-act="cave-cancel">Fermer</button></div><div class="cv-list">${rows}</div></div>`;
      box.className = 'on';
      return;
    }
    const p = sim.caveBedPrice(s);
    box.innerHTML = p !== null ? `<button class="btn small cv-more" data-act="cave-bed" ${s.coins >= p ? '' : 'disabled'}>Bac en plus · ${fmt(p)} 🪙</button>` : '';
    box.className = '';
  }

  /** Bandeau de la cave et une étiquette au-dessus de chaque bac. */
  private caveHud(): void {
    const t = this.cellar, s = this.s, c = s.cave;
    if (!t.active || !c) return;
    const set = (id: string, txt: string) => { const el = $(id); if (el.textContent !== txt) el.textContent = txt; };
    set('cv-coins', `🪙 ${fmt(s.coins)}`);
    set('cv-time', sim.isNight(s) ? `🌑 Nuit` : `☀️ Nuit dans ${clock(Math.max(0, sim.untilNight(s)))}`);
    const labels = c.beds.map((b, i) => {
      if (!b) return `<div class="cvl empty" data-i="${i}"><small>Bac vide</small><small>Touche pour semer</small></div>`;
      const m = MUSH_BY_ID[b.m], nm = m.name.replace(/^Champignon de /, '');
      if (sim.mushRotten(b)) return `<div class="cvl rot" data-i="${i}"><small>${esc(nm)}</small><small>Pourri · touche pour vider</small></div>`;
      const ripe = b.prog >= 1;
      return `<div class="cvl${ripe ? ' ripe' : ''}${b.wet < 0.2 ? ' dry' : ''}" data-i="${i}"><small>${esc(nm)} · ${b.flush + 1}/${sim.MUSH_FLUSHES_N}</small>${ripe ? `<small>Mûr · ${fmt(sim.mushValue(s, b))} 🪙</small>` : '<i class="pg"><u></u></i>'}<i class="wt"><u></u></i></div>`;
    }).join('');
    const box = $('cv-labels');
    if (labels !== this.caveHtml) { this.caveHtml = labels; box.innerHTML = labels; }
    c.beds.forEach((b, i) => {
      const el = box.children[i] as HTMLElement | undefined;
      if (!el) return;
      const r = t.bedScreen(i);
      el.style.left = r.x + 'px';
      el.style.top = r.y + 'px';
      if (!b) return;
      const pg = el.querySelector('.pg u') as HTMLElement | null, wt = el.querySelector('.wt u') as HTMLElement | null;
      if (pg) pg.style.width = Math.round(b.prog * 100) + '%';
      if (wt) wt.style.width = Math.round(b.wet * 100) + '%';
    });
    const ripe = c.beds.some((b) => b && b.prog >= 1 && !sim.mushRotten(b)), dry = c.beds.some((b) => b && b.wet < 0.2 && b.prog < 1);
    const fresh = Date.now() - this.caveTipAt < 2600;
    const hint = fresh ? this.caveTip : t.mode === 'mist' ? '💦 Brumisation…' : ripe ? 'Balaie un bac mûr du doigt pour cueillir.' : dry ? 'Un bac a soif : garde le doigt dessus pour le brumiser.' : c.beds.every((b) => !b) ? 'Touche un bac vide pour y semer du blanc de champignon.' : sim.isNight(s) ? 'La nuit, les champignons poussent trois fois plus vite.' : '';
    set('cv-hint', hint);
    $('cv-hint').className = hint ? 'on' : '';
  }

  /** Bandeau de l'étal : recette, série, clients à venir, et une bulle par client qui attend. */
  private stallHud(): void {
    const t = this.stall;
    if (!t.active) return;
    const set = (id: string, txt: string) => { const el = $(id); if (el.textContent !== txt) el.textContent = txt; };
    set('sl-earn', `🪙 +${fmt(t.earned)}`);
    set('sl-combo', t.combo > 1 ? `🔥 Série de ${t.combo}` : `🌼 ${t.left} à vendre`);
    set('sl-queue', `👥 ${t.queue}`);
    const bs = t.bubbles();
    const html = bs.map((b) => `<div class="bub${b.aim ? ' aim' : ''}${b.fit ? ' fit' : ''}${b.left < 0.3 ? ' late' : ''}" data-seat="${b.seat}"><b>${b.wish ? FAMILIES[b.wish].icon : '💛'}</b><small>${b.wish ? esc(FAMILIES[b.wish].name) : 'Coup de cœur'}</small><i><u></u></i></div>`).join('');
    const box = $('sl-bubbles');
    if (html !== this.stallHtml) { this.stallHtml = html; box.innerHTML = html; }
    bs.forEach((b, k) => {
      const el = box.children[k] as HTMLElement;
      el.style.left = b.x + 'px';
      el.style.top = b.y + 'px';
      (el.querySelector('u') as HTMLElement).style.width = Math.max(0, b.left) * 100 + '%';
    });
    set('sl-hint', t.closing ? 'On ferme l\'étal…' : t.held >= 0 ? (t.target >= 0 ? 'Lâche pour servir ce client.' : `${EMOJI[t.heldId]} ${SPECIES_BY_ID[t.heldId].name} (${FAMILIES[SPECIES_BY_ID[t.heldId].family].name}) : glisse-la jusqu'au client qui la veut.`)
      : t.served + t.missed === 0 ? 'Chaque client annonce la famille qu\'il cherche. Sers-le vite : il paie mieux, et les clients ravis à la suite font monter la série.' : '');
    $('sl-hint').className = $('sl-hint').textContent ? 'on' : '';
  }

  /** Fin de la vente : la recette est fêtée, les invendus retournent en réserve. */
  private stallEnd(): void {
    if (!this.stall.active) return;
    const { earned, served, missed, left } = this.stall;
    this.stall.close();
    $('stall').className = '';
    this.stallHtml = '';
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">${served ? 'Recette du jour' : 'Étal fermé'}</div><div class="take"><b>+${fmt(earned)} 🪙</b><span>${served} client${served > 1 ? 's' : ''} servi${served > 1 ? 's' : ''}${missed ? ` · ${missed} reparti${missed > 1 ? 's' : ''} sans rien` : ''}</span>${left ? `<span>${left} plante${left > 1 ? 's' : ''} retourne${left > 1 ? 'nt' : ''} en réserve.</span>` : ''}</div><button class="btn primary" data-act="closemodal">Retour à la serre</button>`;
    m.classList.add('on');
    if (earned) { play('level'); this.bumpCoins(); }
    this.refresh(true);
  }

  /** Retour à la serre : le panier devient des graines, fêtées comme un sachet. */
  private trekHome(): void {
    if (!this.trek.active) return;
    const lost = this.trek.lost;
    const loot = { ...this.trek.loot };
    const got = sim.trekEnd(this.s, this.trek.basket, this.trek.bonus, loot);
    const extra = [loot.clay ? `+${loot.clay} argile` : '', loot.coins ? `+${fmt(loot.coins)} 🪙` : ''].filter(Boolean).join(' et ');
    this.pick.stop();
    $('pick').className = '';
    this.trek.close();
    $('trek').className = '';
    this.trekLabel = '';
    if (got.length) {
      this.showPacket(got);
      const title = $('modal').querySelector('.mtitle');
      if (title) title.textContent = lost ? 'Ce qu\'il reste de ta cueillette' : 'Ta cueillette';
      if (extra) this.toast(`Ramassé en chemin : ${extra}.`);
    } else this.toast(extra ? `Panier vide, mais tu rapportes ${extra}.` : lost ? 'La nuit t\'a tout fait perdre. Rentre plus tôt la prochaine fois !' : 'Tu rentres le panier vide. La prochaine sortie sera la bonne !');
    this.refresh(true);
  }

  /** Les outils sous l'établi, selon ce qu'on y fait. */
  private studioTools(): void {
    const s = this.s;
    const st = this.studio;
    let html = '';
    if (st.mode === 'wheel') {
      const def = POT_SIZES[st.size - 1];
      const why = s.kiln ? 'Four occupé' : s.clay < def.clay ? `Il manque ${def.clay - s.clay} 🧱` : '';
      html = `<div class="row">${POT_SIZES.map((d, n) => `<button class="btn small ${st.size === n + 1 ? 'primary' : ''}" data-act="st-size" data-arg="${n + 1}">${d.name.replace(/ ?pot ?/i, '').replace(/^./, (c) => c.toUpperCase())} · ${d.clay} 🧱</button>`).join('')}</div>
        <p class="sub center">Tu as ${s.clay} 🧱. La taille décide de ce qui peut y pousser ; la forme, c'est toi.</p>
        <div class="row"><button class="btn" data-act="st-reset">↺ Recommencer</button><button class="btn gold" data-act="st-fire" ${why ? 'disabled' : ''}>${why || '🔥 Au four'}</button></div>`;
    } else if (st.mode === 'paint') {
      const stars = sim.collection(s).stars;
      const plant = this.paintAt.where === 'slot' ? s.slots[this.paintAt.k].plant : null;
      const fav = plant ? FAMILIES[SPECIES_BY_ID[plant.sp].family] : null;
      const cols = PAINTS.map((c, n) => [stars < c.stars ? 1 : 0, `<button class="pdot${st.color === n + 1 && !st.hand ? ' on' : ''}${stars < c.stars ? ' lock' : ''}" data-act="st-color" data-arg="${n + 1}" style="background:${hex(c.color)}">${stars < c.stars ? '🔒' : ''}</button>`] as [number, string]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
      const bases = GLAZES.map((g, n) => `<button class="pdot sq${st.base === n ? ' on' : ''}${stars < g.stars ? ' lock' : ''}" data-act="st-base" data-arg="${n}" style="background:${hex(g.color)}">${stars < g.stars ? '🔒' : fav && fav.glaze === n ? '💚' : ''}</button>`).join('');
      html = `<div class="dots"><button class="pdot gum${st.color === 0 && !st.hand ? ' on' : ''}" data-act="st-color" data-arg="0">🧽</button>${cols}</div>
        <div class="row tools">${[0, 1, 2].map((b) => `<button class="btn small ${st.brush === b && !st.hand ? 'primary' : ''}" data-act="st-brush" data-arg="${b}"><i class="tip" style="width:${6 + b * 6}px;height:${6 + b * 6}px"></i></button>`).join('')}<button class="btn small ${st.hand ? 'primary' : ''}" data-act="st-hand">🖐 Tourner</button><button class="btn small ${st.spin ? 'primary' : ''}" data-act="st-spin">🌀 Tour</button></div>
        <div class="dots"><span class="lbl">Fond</span>${bases}</div>
        ${fav ? `<p class="sub center">💚 Les ${fav.name.toLowerCase()} poussent plus vite sur un fond ${GLAZES[fav.glaze].name.toLowerCase()}.</p>` : ''}
        <div class="row"><button class="btn" data-act="st-clear">Tout effacer</button><button class="btn gold" data-act="st-done">✅ Terminer · ${sim.PAINT_PRICE} 🪙</button></div>`;
    } else if (st.mode === 'view') {
      const slot = s.slots[this.viewSlot];
      const p = slot.plant;
      html = `${p ? `<div class="kv"><span>${STAGES[sim.stageOf(p.prog)]}</span><b>${sim.qualityWord(p.q)}</b></div>` : ''}
        <div class="kv"><span>Pot</span><b>${potLabel(slot.pd)}${sim.harmony(slot) ? ' 💚' : ''}</b></div>
        <button class="btn primary wide" data-act="st-paint">🎨 Peindre ce pot</button>`;
    }
    $('st-tools').innerHTML = html;
  }

  private close(): void {
    this.kind = 'none';
    $('sheet').classList.remove('on');
    $('backdrop').classList.remove('on');
  }

  // ---------- effets ----------

  private buzz(ms: number): void {
    try { navigator.vibrate?.(ms); } catch { /* pas de vibreur */ }
  }

  toast(text: string): void {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), 2600);
  }

  private float(i: number, text: string): void {
    const r = this.scene.slotRect(i);
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.left = r.x + 'px';
    el.style.top = r.top + 20 + 'px';
    $('fx').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  private bumpCoins(): void {
    const c = document.querySelector('.pill.coins');
    c?.classList.remove('bump');
    void (c as HTMLElement | null)?.offsetWidth;
    c?.classList.add('bump');
  }

  private coinFx(i: number, gain: number): void {
    this.float(i, `+${fmt(gain)} 🪙`);
    play('coin');
    this.bumpCoins();
    this.buzz(25);
  }

  private pack: { id: string; isNew: boolean }[] = [];
  private flipped = 0;

  /** Ouverture façon paquet de cartes : on déchire, puis on retourne les graines une à une. */
  /** Le bouturage à la main : couper sous un nœud, puis repiquer. La plante mère repart de plus bas. */
  private showCutting(i: number): void {
    const p = this.s.slots[i]?.plant;
    if (!p || p.prog < 1) return;
    const sp = SPECIES_BY_ID[p.sp];
    this.close();
    const m = $('modal');
    m.innerHTML = `<div class="pk-card cut-card"><b>✂️ Bouturer ${esc(sp.name)}</b><canvas id="ctc"></canvas><p class="sub" id="ct-hint"></p><button class="btn small" data-act="cut-cancel">Laisser la plante</button></div>`;
    m.classList.add('on');
    const level = ['commun', 'rare', 'exotique', 'legendaire'].indexOf(sp.rarity);
    const game = new Cutting($('ctc') as HTMLCanvasElement, sp, Math.max(0, level), (score) => {
      this.cutGame = null;
      const n = sim.takeCutting(this.s, i, score);
      m.classList.remove('on');
      if (n) { play('plant'); this.buzz(25); this.float(i, `✂️ +${n} graine${n > 1 ? 's' : ''}`); this.toast(n > 1 ? `Coupe parfaite : deux boutures de ${sp.name} prennent racine.` : `La bouture de ${sp.name} prend racine.`); }
      else { play('tap'); this.buzz(60); this.toast('Bouture ratée : elle ne prendra pas. La plante mère, elle, repousse.'); }
      this.refresh(true);
    });
    game.onNote((t) => { $('ct-hint').textContent = t; });
    this.cutGame = game;
    requestAnimationFrame(() => game.start());
  }

  /** Le croisement au pinceau : le prix est payé et les fleurs utilisées, que la pollinisation réussisse ou non. */
  private showPollen(i: number, j: number): void {
    const s = this.s, a = s.slots[i]?.plant, b = s.slots[j]?.plant;
    if (!a || !b) return;
    const spa = SPECIES_BY_ID[a.sp], spb = SPECIES_BY_ID[b.sp];
    const fee = sim.CROSS_FEE[spa.rarity];
    const from = sim.pollinate(s, i, j);
    if (!from) return;
    this.close();
    this.scene.pop(i); this.scene.pop(j);
    const m = $('modal');
    m.innerHTML = `<div class="pk-card cut-card"><b>🧬 ${esc(spa.name)} × ${esc(spb.name)}</b><canvas id="ctc"></canvas><p class="sub" id="ct-hint"></p></div>`;
    m.classList.add('on');
    const level = Math.max(0, ['commun', 'rare', 'exotique', 'legendaire'].indexOf(spa.rarity));
    const game = new Pollen($('ctc') as HTMLCanvasElement, spa, spb, level, (score) => {
      this.cutGame = null;
      m.classList.remove('on');
      if (!score) { play('tap'); this.buzz(60); this.toast(`Pollinisation ratée : les ${fmt(fee)} pièces sont perdues, les deux plantes refleuriront.`); this.refresh(true); return; }
      const got = sim.crossSeed(this.s, from);
      if (score > 1) { this.s.seeds[from] = (this.s.seeds[from] ?? 0) + 1; this.toast(`Pollinisation parfaite : une graine de ${spa.name} en prime.`); }
      this.buzz(30);
      this.showPacket([got]);
      this.refresh(true);
    });
    game.onNote((t) => { $('ct-hint').textContent = t; });
    this.cutGame = game;
    requestAnimationFrame(() => game.start());
  }

  /** La pompe à bras : on abaisse le levier du doigt, chaque coup complet verse un arrosage dans la cuve. */
  private showPump(): void {
    const s = this.s;
    if (!s.upgrades.water) return;
    this.close();
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">Pompe à bras</div><p class="sub">Abaisse le levier jusqu'en bas, puis relève-le. Chaque coup verse un arrosage dans la cuve.</p>
      <div class="pump" id="pump"><svg viewBox="0 0 220 240" width="220" height="240">
        <rect x="18" y="168" width="74" height="62" rx="8" fill="#9fc6d6" stroke="#2b2118" stroke-width="4"/>
        <rect id="pw" x="22" y="226" width="66" height="0" fill="#4aa8d8"/>
        <rect x="104" y="60" width="34" height="150" rx="6" fill="#4f6f7a" stroke="#2b2118" stroke-width="4"/>
        <rect x="92" y="204" width="58" height="22" rx="5" fill="#3b4a52" stroke="#2b2118" stroke-width="4"/>
        <path d="M106 96 H62 V150" fill="none" stroke="#2b2118" stroke-width="16" stroke-linecap="round"/>
        <path d="M106 96 H62 V150" fill="none" stroke="#5f8590" stroke-width="9" stroke-linecap="round"/>
        <g id="pdrops" opacity="0"><ellipse cx="62" cy="164" rx="5" ry="8" fill="#4aa8d8" stroke="#2b2118" stroke-width="2"/><ellipse cx="56" cy="182" rx="3.5" ry="6" fill="#4aa8d8" stroke="#2b2118" stroke-width="2"/></g>
        <g id="plever" style="transform-origin:121px 64px"><rect x="121" y="56" width="92" height="16" rx="8" fill="#b5443a" stroke="#2b2118" stroke-width="4"/><circle cx="203" cy="64" r="13" fill="#e2604f" stroke="#2b2118" stroke-width="4"/></g>
        <circle cx="121" cy="64" r="8" fill="#f2c94c" stroke="#2b2118" stroke-width="4"/>
      </svg></div><div class="tankbar pumpbar"><i id="pbar"></i><span id="ptxt"></span></div><button class="btn primary" data-act="closemodal">C'est bon</button>`;
    m.classList.add('on');
    const pump = $('pump'), lever = $('plever') as unknown as SVGGElement, drops = $('pdrops') as unknown as SVGGElement;
    let ang = -28, armed = true, from: { y: number; a: number } | null = null, raf = 0;
    const show = () => {
      const cap = sim.tankCap(s), left = sim.tankOf(s);
      ($('pbar') as HTMLElement).style.width = Math.round((100 * left) / cap) + '%';
      $('ptxt').textContent = left >= cap ? `Cuve pleine · ${left} / ${cap}` : `${left} / ${cap} arrosages`;
      ($('pw') as unknown as SVGRectElement).setAttribute('height', String(Math.round((52 * left) / cap)));
      ($('pw') as unknown as SVGRectElement).setAttribute('y', String(226 - Math.round((52 * left) / cap)));
      lever.style.transform = `rotate(${ang}deg)`;
    };
    show();
    pump.onpointerdown = (e) => { pump.setPointerCapture(e.pointerId); from = { y: e.clientY, a: ang }; };
    pump.onpointermove = (e) => {
      if (!from) return;
      ang = Math.max(-28, Math.min(30, from.a + (e.clientY - from.y) * 0.45));
      if (ang > 24 && armed) {
        armed = false;
        if (sim.pumpStroke(s)) {
          play('water'); this.buzz(18);
          drops.style.transition = 'none'; drops.setAttribute('opacity', '1');
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => { drops.style.transition = 'opacity 0.5s'; drops.setAttribute('opacity', '0'); });
        } else if (sim.tankOf(s) >= sim.tankCap(s)) this.toast('La cuve est pleine.');
      }
      if (ang < -12) armed = true;
      show();
    };
    const up = () => {
      from = null;
      // Relâché, le levier remonte tout seul.
      let last = performance.now();
      const back = (now: number) => {
        if (from || !m.contains(pump)) return;
        ang = Math.max(-28, ang - Math.min(0.1, (now - last) / 1000) * 220);
        last = now;
        if (ang < -12) armed = true;
        show();
        if (ang > -28) requestAnimationFrame(back);
      };
      requestAnimationFrame(back);
    };
    pump.onpointerup = pump.onpointercancel = up;
  }

  private showPacket(got: { id: string; isNew: boolean }[], chained = false): void {
    this.close();
    this.pack = got;
    this.flipped = 0;
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">Ton sachet de graines</div><button class="packet" id="pk"><span>🌱</span>${chained ? '' : 'Touche pour ouvrir'}</button>`;
    m.classList.add('on');
    const tear = () => {
      if ($('pk').classList.contains('open')) return;
      $('pk').classList.add('open');
      this.buzz(40);
      setTimeout(() => this.renderPack(), 480);
    };
    $('pk').onclick = tear;
    if (chained) setTimeout(tear, 350);
  }

  private renderPack(): void {
    const s = this.s;
    const n = this.pack.length;
    const done = this.flipped >= n;
    const seedHtml = (g: { id: string; isNew: boolean }, k: number) => {
      const sp = SPECIES_BY_ID[g.id];
      const col = RARITIES[sp.rarity].color;
      if (k >= this.flipped) return `<button class="sd${k === this.flipped ? ' next' : ''}" data-act="flip" style="--k:${k}" aria-label="Graine à ouvrir">${SEED_SVG}</button>`;
      const fresh = k === this.flipped - 1;
      return `<div class="sd open${fresh ? ' pop' : ''}${sp.rarity !== 'commun' ? ' glow' : ''}" style="--glow:${col}">${fresh ? '<i class="half l"></i><i class="half r"></i>' : ''}<span class="disc">${g.isNew ? '<span class="new">NOUVEAU</span>' : ''}<span class="e">${EMOJI[sp.id]}</span></span><b>${esc(sp.name)}</b>${rarTag(sp)}</div>`;
    };
    const best = this.pack.slice(0, this.flipped).some((g) => SPECIES_BY_ID[g.id].rarity !== 'commun');
    // Le nombre de colonnes suit le nombre de graines : tout tient à l'écran, même après une grosse cueillette.
    const cols = n <= 3 ? n : n === 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5;
    const title = done ? (best ? 'Belle trouvaille !' : 'Voilà tes graines') : n > 1 ? `Ouvre tes ${n} graines` : 'Ouvre ta graine';
    const foot = done
      ? `${s.packets > 0 ? `<button class="btn gold" data-act="free">🎁 Sachet suivant (${s.packets})</button>` : ''}<button class="btn primary" data-act="closemodal">Au jardin !</button>`
      : `<p class="sub">Touche une graine pour voir ce qu'elle donnera.</p>${n - this.flipped > 3 ? '<button class="btn small" data-act="flipall">Tout ouvrir</button>' : ''}`;
    // Une graine ouverte ne touche qu'à elle-même : les autres gardent leur animation et la grille sa position.
    const grid = $('modal').querySelector('.seeds');
    if (grid && this.flipped > 0 && grid.children.length === n) {
      const k = this.flipped - 1;
      grid.children[k].outerHTML = seedHtml(this.pack[k], k);
      grid.children[this.flipped]?.classList.add('next');
      $('modal').querySelector('.mtitle')!.textContent = title;
      $('modal').querySelector('.mrowb')!.innerHTML = foot;
      return;
    }
    $('modal').innerHTML = `<div class="mtitle">${title}</div><div class="seeds c${cols}" data-act="flip" style="--cols:${cols}">${this.pack.map(seedHtml).join('')}</div><div class="mrowb">${foot}</div>`;
  }

  /** Ouvre toutes les graines restantes, l'une après l'autre. */
  private flipAll(): void {
    if (this.flipped >= this.pack.length) return;
    this.flipNext();
    setTimeout(() => { if ($('modal').classList.contains('on') && $('modal').querySelector('.seeds')) this.flipAll(); }, 170);
  }

  private flipNext(): void {
    if (this.flipped >= this.pack.length) return;
    const sp = SPECIES_BY_ID[this.pack[this.flipped].id];
    this.flipped++;
    this.buzz(sp.rarity === 'commun' ? 12 : 60);
    play(sp.rarity === 'commun' ? 'card' : 'rare');
    this.renderPack();
  }

  private showLevel(level: number): void {
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">Niveau ${level} !</div>
      <div class="rc solo" style="border-color:var(--gold)"><span class="e">🎓</span>Jardinier niveau ${level}<i>Ta serre prend de l'ampleur</i></div>
      <div class="fact">Récompense : +${25 * level} 🪙, +2 argile et un sachet de graines.</div>
      <button class="btn primary" data-act="closemodal">Continuer</button>`;
    m.classList.add('on');
    this.buzz(60);
    play('level');
  }

  private showBloom(key: string): void {
    const [id, v] = key.split(':');
    if (id === 'lvl') return this.showLevel(Number(v));
    const vr = Number(v) || 0;
    const sp = SPECIES_BY_ID[id];
    const d = this.s.disc[id];
    const n = sim.starsOf(d);
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">${vr ? `Variante ${sim.VARIANTS[vr]} !` : n === 1 ? 'Nouvelle espèce dans l\'almanach !' : n === 3 ? 'Spécimen d\'exposition !' : 'Encore plus belle !'}</div>
      <div class="rc solo" style="border-color:${RARITIES[sp.rarity].color}"><span class="e">${EMOJI[id]}</span>${esc(vname(sp, vr))}<i>${esc(sp.latin)}</i><span class="st">${stars(n)}</span></div>
      <div class="fact">${vr ? `${sim.VARIANT_TEXT[vr]} Rareté du spécimen : ${RARITIES[sim.VARIANT_RARITY[vr]].name.toLowerCase()}.` : esc(sp.fact)}</div>
      <button class="btn primary" data-act="closemodal">Continuer</button>`;
    m.classList.add('on');
    this.buzz(40);
    play('bloom');
  }

  // ---------- rendu ----------

  /** Recale les zones tactiles sur le décor. Appelé à chaque image : la caméra peut être en mouvement. */
  layout(): void {
    this.s.slots.forEach((_, i) => {
      const el = this.slotEls[i];
      const r = this.scene.slotRect(i);
      el.style.left = r.x + 'px';
      el.style.top = r.top + 'px';
      el.style.width = r.unit * 1.25 + 'px';
      el.style.height = r.bottom - r.top + 'px';
    });
    this.hotEls.forEach((el, k) => {
      const r = this.scene.hotRect(k), h = themeOf(this.scene.themeId).fp!.hot[k];
      el.style.left = r.x + 'px';
      el.style.top = r.y + 'px';
      el.style.width = el.style.height = r.unit * h.r * 2 + 'px';
    });
    const sr = this.scene.showRect(1), sr2 = this.scene.showRect(2);
    this.showEl.style.left = (sr.x + sr2.x) / 2 + 'px';
    this.showEl.style.top = sr.y + 'px';
    this.lockEls.forEach((el, r) => {
      const c = this.scene.zoneCenter(r);
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
    });
  }

  refresh(force = false): void {
    const s = this.s;
    this.layout();
    // Outils à promener : visibles seulement quand ils servent.
    const thirsty = s.slots.some((sl, i) => sl.plant && sl.plant.water < 0.5 && !sim.dripOn(s, i));
    const bugs = s.slots.some((sl) => sl.plant && sl.plant.pests > 0);
    const ripe = s.slots.filter((sl) => sl.plant && sl.plant.prog >= 1).length;
    const tools = $('tools').children;
    const shaggy = s.slots.some((sl) => sl.plant?.cut === 1 && sl.plant.prog < 1);
    tools[0].classList.toggle('off', !shaggy && this.tool !== 'shears');
    tools[1].classList.toggle('off', ripe < 2 && this.tool !== 'basket');
    tools[2].classList.toggle('off', !thirsty && this.tool !== 'can');
    tools[3].classList.toggle('off', !bugs && this.tool !== 'glove');
    // Barquette de graines : visible dès qu'un pot vide attend.
    if (!this.tool) {
      const free = s.slots.some((sl, i) => sl.pot && !sl.plant && sim.slotOpen(s, i));
      // Rangée : un seul bouton. On l'ouvre pour choisir une graine, elle se referme toute seule.
      const total = Object.values(s.seeds).reduce((a, b) => a + b, 0);
      if (this.seedOpen && (!free || Date.now() - this.seedOpen > 9000)) this.seedOpen = 0;
      const ids = free && this.seedOpen ? Object.keys(s.seeds).sort((a, b) => s.seeds[b] - s.seeds[a]).slice(0, 5) : [];
      const html = !free || !total ? '' : `<button class="seedchip bag${this.seedOpen ? ' open' : ''}" data-act="seedbag">${this.seedOpen ? '✕' : '🌱'}${this.seedOpen ? '' : `<small>×${total}</small>`}</button>`
        + ids.map((id) => `<button class="seedchip" data-id="${id}">${EMOJI[id]}<small>×${s.seeds[id]}</small></button>`).join('');
      if (html !== this.seedsHtml) { this.seedsHtml = html; $('seeds').innerHTML = html; }
      // Chaque geste est expliqué une seule fois, au moment où il devient utile.
      const tip = (k: string, on: boolean, text: string) => {
        if (!on || s.hints?.[k] || this.kind !== 'none' || this.studio.mode || this.trek.active || this.stall.active || Date.now() - this.tipAt < 6000) return;
        (s.hints ??= {})[k] = true;
        this.tipAt = Date.now();
        this.toast(text);
      };
      tip('zoom', true, '👆 Pince pour zoomer, glisse pour te déplacer, touche deux fois pour t\'approcher.');
      tip('seeds', !!html, '🌱 Prends une graine et glisse-la sur un pot vide : 💚 marque les emplacements qui lui conviennent.');
      tip('can', thirsty, '🚿 Une plante a soif : prends l\'arrosoir et promène-le au-dessus d\'elle.');
      tip('glove', bugs, '🧤 Des chenilles ! Prends le gant et frotte la plante.');
      tip('shears', shaggy, '✂️ Une plante fait des pousses folles : passe le sécateur dessus, elle poussera plus vite et plus belle.');
      tip('basket', ripe >= 2, '🧺 Plusieurs plantes en fleur : le panier les range en réserve d\'un seul geste.');
      tip('door', this.scene.fp && s.zonesOpen[GARDEN_INDEX] && s.slots.some((sl) => sl.pot), '🚪 Pour sortir un pot au jardin, fais-le glisser sur la porte et tiens-le là un instant.');
      tip('cavenight', sim.isNight(s) && !!s.cave, '🍄 C\'est la nuit : descends à la cave par la trappe, tes champignons poussent trois fois plus vite et se vendent mieux.');
      tip('night', sim.isNight(s), '🌑 La nuit tombe : les plantes boivent moins et poussent moins vite, sauf les nocturnes qui s\'épanouissent dans le noir.');
      tip('drip', s.slots.filter((sl) => sl.plant).length >= 5, '💧 Trop de plantes à arroser ? Le tonneau d\'arrosage de la serre arrose tout seul les pots dont la vanne est ouverte.');
      tip('land', !sim.landOpen(s, 1) && sim.collection(s).bloomed >= 20, '🌴 Un autre continent t\'attend au-delà de l\'océan : fais fleurir 25 espèces, puis débloque-le depuis le sac à dos de l\'expédition.');
      tip('drag', s.slots.filter((sl) => sl.pot).length >= 2 && s.stats.planted >= 2, '✋ Un pot se déplace en le faisant glisser du doigt vers un autre emplacement.');
    }
    // Emplacements
    s.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      const badge = el.firstElementChild as HTMLElement;
      const bar = el.lastElementChild as HTMLElement;
      const p = slot.plant;
      const open = sim.slotOpen(s, i);
      el.hidden = !open;
      let cls = 'badge', txt = '';
      if (this.tool.startsWith('seed:')) {
        // Pendant qu'on tient une graine, chaque pot vide dit s'il lui convient.
        const sp = SPECIES_BY_ID[this.tool.slice(5)];
        if (!slot.pot || p || !open || sim.potSize(slot) < sim.sizeOf(sp)) cls += ' hidden';
        else {
          const ok = sim.fitOf(sp, sim.zoneClimate(s, sim.zoneOfSlot(i))) >= 1;
          cls += i === this.toolTarget ? ' ready' : ok ? ' plus' : ' ghost';
          txt = ok ? '💚' : '🌱';
        }
      } else if (this.drag >= 0) {
        if (i === this.drag) cls += ' hidden';
        else if (i === this.dragTarget) { cls += ' ready'; txt = slot.pot ? '⇄' : '⬇'; }
        else if (!slot.pot) { cls += ' ghost'; txt = '+'; }
        else cls += ' hidden';
      } else if (!slot.pot) { if (this.scene.close) { cls += ' ghost'; txt = '+'; } else cls += ' hidden'; }
      else if (!p) { cls += ' plus'; txt = '🌱'; }
      else if (p.pests > 0) { cls += ' alert'; txt = '🐛'.repeat(p.pests); }
      else if (p.cut === 1 && p.prog < 1) { cls += ' alert'; txt = '✂️'; }
      else if (p.prog >= 1) { cls += ' ready'; txt = '🌸'; }
      else if (p.water < 0.5 && !sim.dripOn(s, i)) { cls += ' alert'; txt = '💧'; }
      else cls += ' hidden';
      cls += slot.pot ? '' : ' low';
      if (badge.className !== cls) badge.className = cls;
      if (badge.textContent !== txt) badge.textContent = txt;
      const showBar = !!p && p.prog < 1;
      bar.hidden = !showBar;
      if (showBar) {
        bar.className = 'bar' + (p!.water <= 0 ? ' dry' : '');
        (bar.firstElementChild as HTMLElement).style.width = Math.round(p!.prog * 100) + '%';
      }
    });
    // Les étiquettes du décor disent ce qui s'y passe : sachet prêt, four en cours, repos avant la prochaine sortie.
    const pwait = Math.max(0, Math.ceil(s.packetIn));
    const kilnOn = !!s.kiln, kilnDone = kilnOn && s.kiln!.left <= 0;
    const rest = sim.trekOf(s).rest;
    const marketHot = FAMILY_IDS.some((f) => s.market[f].p >= 1.25) && s.stock.length > 0;
    this.hotEls.forEach((el, k) => {
      const h = themeOf(this.scene.themeId).fp!.hot[k];
      let txt = h.label, alert = false;
      if (h.act === 'door' && this.drag >= 0 && s.zonesOpen[GARDEN_INDEX]) { txt = '🚪 Tiens le pot ici'; alert = true; }
      else if (h.act === 'door') txt = !s.zonesOpen[GARDEN_INDEX] ? `🔒 Jardin · ${fmt(sim.ZONE_PRICES[GARDEN_INDEX])} 🪙` : this.scene.spot ? '🚪 Rentrer' : '🌳 Jardin';
      else if (h.act.startsWith('gext')) {
        const n = Number(h.act.slice(4)) - 1, got = s.gardenExt ?? 0;
        txt = n < got ? '' : n === got ? `🔒 ${GARDEN_EXT[n].name} · ${fmt(GARDEN_EXT[n].price)} 🪙` : `🔒 ${GARDEN_EXT[n].name}`;
        alert = n === got && s.coins >= GARDEN_EXT[n].price;
      }
      else if (h.act === 'packets') { alert = s.packets > 0; txt = alert ? `🎁 ${s.packets} à ouvrir` : `🎁 ${clock(pwait)}`; }
      else if (h.act === 'atelier') { alert = kilnDone; txt = kilnDone ? '🏺 Pot cuit !' : kilnOn ? `🔥 ${clock(s.kiln!.left)}` : h.label; }
      else if (h.act === 'cave') {
        const ripe = s.cave ? s.cave.beds.filter((b) => b && b.prog >= 1 && !sim.mushRotten(b)).length : 0;
        alert = ripe > 0 || (!s.cave && s.coins >= CAVE_PRICE);
        txt = !s.cave ? `🔒 Cave · ${fmt(CAVE_PRICE)} 🪙` : ripe ? `🍄 ${ripe} à cueillir` : sim.isNight(s) ? '🍄 Cave · ça pousse' : '🍄 Cave';
      }
      else if (h.act === 'trek') { alert = rest <= 0; txt = rest > 0 ? `🥾 Demain · ${clock(rest)}` : '🥾 Partir'; }
      else if (h.act === 'water') {
        const left = sim.tankOf(s), cap = sim.tankCap(s);
        alert = s.upgrades.water && left < 1;
        txt = !s.upgrades.water ? '💧 Arrosage' : left < 1 ? '💧 Cuve vide !' : `💧 ${Math.floor(left)} / ${cap}`;
      }
      else if (h.act === 'market') { alert = marketHot; txt = marketHot ? '📈 Ça grimpe !' : s.stock.length ? `💐 Étal · ${s.stock.length}` : h.label; }
      const sp = el.firstElementChild!;
      if (sp.textContent !== txt) sp.textContent = txt;
      sp.classList.toggle('alert', alert);
      el.style.display = txt ? '' : 'none';
    });
    this.lockEls.forEach((el, r) => {
      el.hidden = s.zonesOpen[r];
      const txt = `🔒 ${fmt(sim.ZONE_PRICES[r])} 🪙`;
      if (el.textContent !== txt) el.textContent = txt;
      el.classList.toggle('can', s.coins >= sim.ZONE_PRICES[r]);
    });

    const tips = Math.floor(s.tips);
    const shown = s.showcase.filter(Boolean).length;
    const st = `🏛️ Vitrine ${shown}/${sim.SHOWCASE_SIZE}${tips > 0 ? ` · +${fmt(tips)} 🪙` : ''}`;
    if (this.showEl.textContent !== st) this.showEl.textContent = st;
    this.showEl.classList.toggle('can', tips >= 5);

    // Haut d'écran
    const col = sim.collection(s);
    let info = '';
    if (this.crossing >= 0) info = `<div class="ticker"><span>🧬 Avec quelle plante la croiser ?</span><button class="btn small" data-act="cancelmove">Annuler</button></div>`;
    else if (this.scene.zoomed) info = '<div class="zrow"><button class="zback" data-act="view" data-arg="-1">⤢</button></div>';
    const lv = sim.levelOf(s);
    const se = sim.seasonOf(s);
    const ct = sim.contestOf(s);
    const prize = !!sim.CONTEST[ct.claimed] && ct.blooms >= sim.CONTEST[ct.claimed].need;
    const ready = sim.TROPHIES.filter((x) => sim.trophyReady(s, x)).length;
    const hud = `<div class="hudrow"><div class="pill coins">🪙 ${fmt(s.coins)}</div><button class="pill season" data-act="nav" data-arg="season">${sim.isNight(s) ? '🌑' : SEASONS[se.index].icon}<small>${Math.floor(sim.hourOf(s))} h</small>${prize ? '<i class="dot">!</i>' : ''}</button><button class="pill lvl" data-act="nav" data-arg="trophies"><span>🎓 <small>Niv.</small> ${lv.level}</span><i class="xp"><i style="width:${Math.round(100 * lv.into / lv.span)}%"></i></i>${ready ? `<i class="dot">${ready}</i>` : ''}</button><button class="pill" data-act="nav" data-arg="almanac">📖 ${col.bloomed}<small>/${SPECIES.length}</small></button></div>${info}`;
    if (hud !== this.lastHud && (force || !this.pointerDown)) { $('hud').innerHTML = hud; this.lastHud = hud; }

    // Nouvelles fiches à fêter
    if (s.fresh.length) { this.celebrate.push(...s.fresh); s.fresh = []; }
    if (this.celebrate.length && !$('modal').classList.contains('on') && this.kind === 'none') this.showBloom(this.celebrate.shift()!);

    // Objectif
    const q = sim.currentQuest(s);
    const o = s.order;
    // Sans barre du bas, ce qui est prêt se signale ici d'une pastille, même quand on regarde ailleurs.
    const al = this.scene.fp ? (s.packets > 0 ? `<button class="chip ord al" data-act="nav" data-arg="packets">🎁 ${s.packets}</button>` : '')
      + (kilnDone ? '<button class="chip ord al" data-act="nav" data-arg="atelier">🏺 !</button>' : '') : '';
    const oc = al + (o ? `<button class="chip ord" data-act="orderinfo">📦 ${FAMILIES[o.family].icon} ${clock(o.left)}</button>` : '');
    const qh = (q ? `<button class="qt" data-act="questgo">🎯 ${esc(q.text)}</button>${q.done(s)
      ? `<button class="btn gold small" data-act="quest">+${q.reward} 🪙</button>`
      : `<span class="chip">+${q.reward} 🪙</span>`}` : oc ? '<span class="qt"></span>' : '') + oc;
    if (qh !== this.lastQuest && (force || !this.pointerDown)) { $('quest').innerHTML = qh; this.lastQuest = qh; }

    // Navigation
    const seeds = Object.values(s.seeds).reduce((a, b) => a + b, 0);
    const wait = Math.max(0, Math.ceil(s.packetIn));
    const timer = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
    const hot = FAMILY_IDS.some((f) => s.market[f].p >= 1.25) && s.stock.length > 0;
    const nav = [
      ['packets', '🎁', s.packets > 0 ? 'Sachets' : timer, s.packets > 0 ? String(s.packets) : '', s.packets > 0 && seeds === 0],
      ['almanac', '📖', 'Almanach', '', false],
      ['atelier', '🏺', s.kiln && s.kiln.left > 0 ? clock(s.kiln.left) : 'Atelier', s.kiln && s.kiln.left <= 0 ? '!' : '', !!s.kiln && s.kiln.left <= 0],
      ['shop', '🛒', 'Boutique', '', false],
      ['market', '📈', 'Marché', hot ? '!' : '', false],
    ].map(([k, e, l, d, pulse]) => `<button class="navb${pulse ? ' pulse' : ''}" data-act="nav" data-arg="${k}"><span>${e}</span>${l}${d ? `<i class="dot">${d}</i>` : ''}</button>`).join('');
    if (nav !== this.lastNav && (force || !this.pointerDown)) { $('nav').innerHTML = nav; this.lastNav = nav; }

    // Panneau
    if (this.kind !== 'none') {
      const html = sheetHtml(this);
      if (html !== this.lastSheet && (force || !this.pointerDown)) {
        const body = $('sheet').querySelector('.sh-body');
        const top = body?.scrollTop ?? 0;
        $('sheet').innerHTML = html;
        this.lastSheet = html;
        this.heroPic();
        const nb = $('sheet').querySelector('.sh-body');
        if (nb) nb.scrollTop = top;
      }
    }
  }

}
export { SLOTS_PER_ZONE };

