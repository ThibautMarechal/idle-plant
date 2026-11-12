import { BASE_SLOTS, SEASONS, FAMILIES, FAMILY_IDS, GLAZES, LEVEL_WORDS, PATTERNS, POT_SIZES, RARITIES, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, STAGES, ZONES } from './data';
import type { Family, Species } from './data';
import type { Scene3D } from './scene';
import { STYLES } from './styles';
import { THEMES, themeOf } from './themes';
import * as sim from './sim';
import { play, setMuted, unlock } from './sound';
import type { State } from './sim';

const EMOJI: Record<string, string> = {
  echeveria: '🪴', aloe: '🌵', lithops: '🪨', basilic: '🌿', menthe: '🍃', lavande: '🪻', boston: '☘️', capillaire: '🍀',
  pensee: '🌼', pelargonium: '🌺', strelitzia: '🦜', phalaenopsis: '🌸', paphiopedilum: '🥿', fantome: '👻',
  haworthia: '🦓', echinocactus: '🌵', opuntia: '🌵', thym: '🌿', romarin: '🌿', ciboulette: '🧅', platycerium: '🦌', asplenium: '🪺',
  cattleya: '💮', dendrobium: '🌸', tournesol: '🌻', tulipe: '🌷', hibiscus: '🌺', semper: '🌷', monstera: '🌴', calathea: '🍃',
  pilea: '🪙', chlorophytum: '🕷️', anthurium: '❤️', dionee: '🪤', drosera: '💧', sarracenia: '🏺',
  figuier: '🌳', hortensia: '💠', olivier: '🫒', citronnier: '🍋', camelia: '🏵️', erable: '🍁', bonsai: '🎍',
  dahlia: '🌺', muguet: '🔔', rose: '🌹', pivoine: '🌸',
};
const ZONE_SHORT = ['Ombre', 'Bassin', 'Porte', 'Plein sud'];

type SheetKind = 'season' | 'trophies' | 'atelier' | 'paint' | 'vitrine' | 'none' | 'seed' | 'buypot' | 'plant' | 'harvest' | 'packets' | 'market' | 'shop' | 'almanac' | 'fiche' | 'zone';

const $ = (id: string) => document.getElementById(id)!;
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
const mult = (p: number) => '×' + p.toFixed(2).replace('.', ',');
const stars = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);
const vname = (sp: Species, vr: number) => sp.name + (vr ? ' ' + sim.VARIANTS[vr] : '');
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const clock = (sec: number) => { const w = Math.max(0, Math.ceil(sec)); return `${Math.floor(w / 60)}:${String(w % 60).padStart(2, '0')}`; };
/** Pastille de couleur et nom d'un pot. */
function potLabel(pd: sim.PotDesign | undefined): string {
  const g = GLAZES[pd?.glaze ?? 0];
  const size = POT_SIZES[(pd?.size ?? 1) - 1];
  return `<span class="potdot" style="background:${hex(g.color)};border-color:${hex(g.rim)}"></span>${size.name} · ${g.name.toLowerCase()}${pd?.pat ? ' à ' + PATTERNS[pd.pat].toLowerCase() : ''}`;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function rarTag(sp: Species): string {
  const r = RARITIES[sp.rarity];
  return `<span class="rar" style="background:${r.color}">${r.name}</span>`;
}

function needsChips(sp: Species, c?: { light: number; temp: number; hum: number }): string {
  const one = (icon: string, k: 'light' | 'temp' | 'hum') => {
    const cls = c ? (c[k] === sp[k] ? 'ok' : 'ko') : '';
    return `<span class="chip ${cls}">${icon} ${LEVEL_WORDS[k][sp[k]]}</span>`;
  };
  return `<div class="chips">${one('☀️', 'light')}${one('🌡️', 'temp')}${one('💧', 'hum')}</div>`;
}

/** Diagnostic en langage de jardinier : dit toujours pourquoi ça va bien ou mal. */
function conditions(sp: Species, c: { light: number; temp: number; hum: number }): string {
  const line = (k: 'light' | 'temp' | 'hum', label: string, hi: string, lo: string) => {
    const d = c[k] - sp[k];
    if (d === 0) return `<div>✅ ${label} : ${LEVEL_WORDS[k][c[k]].toLowerCase()}, parfait</div>`;
    return `<div>⚠️ ${d > 0 ? hi : lo}</div>`;
  };
  return `<div class="cond">${
    line('light', 'Lumière', 'Trop de soleil : ses feuilles frisent et jaunissent.', 'Pas assez de lumière : elle s\'étiole.')
  }${line('temp', 'Température', 'Trop chaud ici : elle flétrit.', 'Trop frais ici : elle pousse au ralenti.')
  }${line('hum', 'Humidité', 'Air trop humide : gare à la moisissure.', 'Air trop sec : le bout des feuilles brunit.')}</div>`;
}

function sparkline(hist: number[], color: string): string {
  const w = 86, h = 30;
  const lo = Math.min(0.8, ...hist) - 0.05, hi = Math.max(1.2, ...hist) + 0.05;
  const yOf = (p: number) => h - 3 - ((p - lo) / (hi - lo)) * (h - 6);
  const pts = hist.map((p, i) => `${((i / Math.max(1, hist.length - 1)) * w).toFixed(1)},${yOf(p).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}"><line x1="0" x2="${w}" y1="${yOf(1)}" y2="${yOf(1)}" stroke="#d9cdb0" stroke-dasharray="3 3"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Couleur selon le niveau du cours : vert quand il est bon pour vendre, rouge quand il est bas. */
function level(p: number): string {
  return p >= 1.1 ? 'up' : p <= 0.9 ? 'down' : '';
}

function trend(hist: number[]): { cls: string; arrow: string } {
  const a = hist[hist.length - 1], b = hist[Math.max(0, hist.length - 4)];
  if (a - b > 0.03) return { cls: 'up', arrow: '▲' };
  if (b - a > 0.03) return { cls: 'down', arrow: '▼' };
  return { cls: '', arrow: '•' };
}

export class UI {
  private kind: SheetKind = 'none';
  private arg = 0;
  private argId = '';
  private lastSheet = '';
  private lastHud = '';
  private lastQuest = '';
  private lastNav = '';
  private lastOrder = '';
  /** Pot en cours de peinture : sur un emplacement ou sur l'étagère. */
  private paintAt: { where: 'slot' | 'shelf'; k: number } = { where: 'slot', k: 0 };
  private lastNewsT = 0;
  private pointerDown = false;
  private slotEls: HTMLButtonElement[] = [];
  private lockEls: HTMLButtonElement[] = [];
  private toastTimer = 0;
  private resetAskedAt = 0;
  /** Emplacement du pot en cours de déplacement, ou -1. */
  private moving = -1;
  /** Première plante choisie pour un croisement, ou -1. */
  private crossing = -1;
  private swipedAt = 0;
  private celebrate: string[] = [];
  private drag = -1;
  private dragTarget = -1;
  private holdAt: { x: number; y: number; i: number } | null = null;
  private edgeAt = 0;
  private showEl!: HTMLButtonElement;

  constructor(private s: State, private scene: Scene3D, private onReset: () => void) {
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
        this.holdAt = this.s.slots[i].pot && this.moving < 0 ? { x: e.clientX, y: e.clientY, i } : null;
      });
      overlay.appendChild(b);
      this.slotEls.push(b);
    });
    this.showEl = document.createElement('button');
    this.showEl.className = 'showb';
    this.showEl.onclick = () => { if (Date.now() - this.swipedAt > 350) this.open('vitrine'); };
    overlay.appendChild(this.showEl);
    this.applyTheme();
    const app = $('app');
    let sx = 0, sy = 0, st = 0, onScene = false;
    setMuted(!!this.s.mute);
    app.addEventListener('pointerdown', (e) => {
      unlock();
      this.pointerDown = true;
      sx = e.clientX; sy = e.clientY; st = Date.now();
      onScene = !(e.target as HTMLElement).closest('#sheet, #modal, #bottom, #hud, #backdrop');
    });
    app.addEventListener('pointermove', (e) => {
      if (this.drag < 0) {
        if (!this.holdAt || Math.hypot(e.clientX - this.holdAt.x, e.clientY - this.holdAt.y) < 10) return;
        this.drag = this.holdAt.i;
        this.dragTarget = -1;
        this.scene.lift(this.drag);
        this.buzz(20);
        this.refresh(true);
      }
      this.moveGhost(e.clientX, e.clientY);
      // Près du bord haut ou bas, on change de zone sans lâcher le pot.
      const rect = app.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (this.scene.currentZone >= 0 && Date.now() - this.edgeAt > 800 && (y < 170 || y > rect.height - 200)) {
        this.edgeAt = Date.now();
        this.goZone(Math.max(0, Math.min(ZONES.length - 1, this.scene.currentZone + (y < 170 ? -1 : 1))));
      }
    });
    app.addEventListener('pointerup', (e) => {
      this.pointerDown = false;
      const onPot = !!this.holdAt;
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
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (onPot || !onScene || Date.now() - st > 900 || Math.max(Math.abs(dx), Math.abs(dy)) < 45) return;
      // Balayer vers la gauche ou vers le haut avance d'une zone ; l'inverse recule.
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : (dy < 0 ? 1 : -1);
      this.swipedAt = Date.now();
      this.goZone(Math.max(-1, Math.min(ZONES.length - 1, this.scene.currentZone + dir)));
    });
    for (const ev of ['pointercancel', 'pointerleave']) app.addEventListener(ev, () => { this.pointerDown = false; this.holdAt = null; if (this.drag >= 0) { this.endDrag(); this.refresh(true); } });
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
  }

  private goZone(z: number): void {
    this.scene.setView(z);
    this.refresh(true);
  }

  private zname(z: number): string {
    return themeOf(this.scene.themeId).zones[z];
  }

  private applyTheme(): void {
    $('app').style.background = themeOf(this.scene.themeId).bg;
    document.body.dataset.style = this.scene.styleId;
  }

  setState(s: State): void {
    this.s = s;
    this.moving = -1;
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
      const got = sim.cross(s, from, i);
      if (got) { this.scene.pop(i); this.scene.pop(from); this.buzz(30); this.showPacket([got]); }
      this.refresh(true);
      return;
    }
    if (this.moving >= 0) {
      const from = this.moving;
      this.moving = -1;
      if (from !== i && sim.movePot(s, from, i)) {
        this.scene.pop(i);
        this.float(i, '🪴');
        this.buzz(15);
      }
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
    if (p.water < 0.5 && !s.upgrades.water) {
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
      case 'flip': this.flipNext(); break;
      case 'move':
        this.moving = this.arg;
        this.close();
        this.toast('Touche l\'emplacement où poser ce pot. Balaye pour changer de zone.');
        break;
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
      case 'extra':
        if (sim.buyExtra(s, n)) { this.toast(`Suspension installée : ${this.zname(n)} gagne un emplacement.`); play('craft'); this.buzz(25); this.close(); this.goZone(n); }
        else this.toast(s.zonesOpen[n] ? 'Pas assez de pièces.' : 'Aménage d\'abord cette zone.');
        break;
      case 'contest': {
        const r = sim.claimContest(s);
        if (r) { this.toast(`Palier ${r.label} : +${fmt(r.coins)} 🪙 et +${r.clay} argile !`); play('rare'); this.bumpCoins(); this.buzz(40); }
        break;
      }
      case 'cancelmove': this.moving = -1; this.crossing = -1; break;
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
        if (sim.openZone(s, this.arg)) { this.toast(`${this.zname(this.arg)} : zone aménagée !`); this.buzz(30); this.close(); this.goZone(this.arg); }
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
      case 'paintslot': this.paintAt = { where: 'slot', k: this.arg }; this.open('paint', this.arg); break;
      case 'paintshelf': this.paintAt = { where: 'shelf', k: n }; this.open('paint', this.arg); break;
      case 'glaze':
      case 'pattern': {
        const cur = this.paintTarget();
        const g = name === 'glaze' ? n : cur?.glaze ?? 0;
        const pt = name === 'pattern' ? n : cur?.pat ?? 0;
        if (!sim.glazeOpen(s, g)) this.toast(`Cet émail se débloque à ${GLAZES[g].stars} ⭐ dans l'almanach.`);
        else if (sim.paintPot(s, this.paintAt.where, this.paintAt.k, g, pt)) { if (this.paintAt.where === 'slot') this.scene.pop(this.paintAt.k); this.buzz(15); }
        else if (s.coins < sim.PAINT_PRICE) this.toast('Pas assez de pièces.');
        break;
      }
      case 'cutting':
        if (sim.harvestCutting(s, this.arg)) { this.float(this.arg, '✂️ +2 graines'); this.buzz(15); this.close(); }
        break;
      case 'deliver': {
        const who = s.order?.who ?? '';
        const clay = s.order?.clay ?? 0;
        const gain = sim.deliver(s, this.arg);
        if (gain) { this.coinFx(this.arg, gain); this.toast(`${who} est ravi : +${fmt(gain)} 🪙 et +${clay} argile.`); this.close(); }
        break;
      }
      case 'orderinfo':
        if (s.order) this.toast(`Fais fleurir une plante de la famille ${FAMILIES[s.order.family].name.toLowerCase()}, qualité ${sim.qualityWord(s.order.minQ).toLowerCase()} ou mieux, puis choisis « Livrer » à la récolte.`);
        break;
      case 'buypot':
        if (sim.buyPot(s, this.arg)) { this.scene.pop(this.arg); this.buzz(20); this.open('seed', this.arg); }
        break;
      case 'water':
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
    const done = this.flipped >= this.pack.length;
    const cards = this.pack.map((g, k) => {
      const sp = SPECIES_BY_ID[g.id];
      const col = RARITIES[sp.rarity].color;
      if (k >= this.flipped) return `<button class="rc back${k === this.flipped ? ' next' : ''}" data-act="flip"><span class="e">🌱</span>?</button>`;
      return `<div class="rc${k === this.flipped - 1 ? ' pop' : ''}${sp.rarity !== 'commun' ? ' glow' : ''}" style="border-color:${col};--glow:${col}">${g.isNew ? '<span class="new">NOUVEAU</span>' : ''}<span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${rarTag(sp)}</div>`;
    }).join('');
    const best = this.pack.slice(0, this.flipped).some((g) => SPECIES_BY_ID[g.id].rarity !== 'commun');
    $('modal').innerHTML = `<div class="mtitle">${done ? (best ? 'Belle trouvaille !' : 'Voilà tes graines') : 'Retourne tes graines'}</div><div class="reveal" data-act="flip">${cards}</div>${done
      ? `<div class="mrowb">${s.packets > 0 ? `<button class="btn gold" data-act="free">🎁 Sachet suivant (${s.packets})</button>` : ''}<button class="btn primary" data-act="closemodal">Au jardin !</button></div>`
      : '<p class="sub">Touche une graine pour la retourner.</p>'}`;
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
      <div class="fact">${vr ? (vr === 2 ? 'Une variante dorée, rarissime : elle vaut six fois plus et fera venir les visiteurs en vitrine.' : 'Une variante panachée : son feuillage marbré de crème vaut deux fois et demie le prix normal.') : esc(sp.fact)}</div>
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
    const sr = this.scene.showRect(1), sr2 = this.scene.showRect(2);
    this.showEl.style.left = (sr.x + sr2.x) / 2 + 'px';
    this.showEl.style.top = sr.y + 'px';
    this.lockEls.forEach((el, r) => {
      const c = this.scene.zoneCenter(r);
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
    });
  }

  private needsCare(i: number): boolean {
    const p = this.s.slots[i].plant;
    return !!p && (p.pests > 0 || p.prog >= 1 || (p.water < 0.5 && !this.s.upgrades.water));
  }

  refresh(force = false): void {
    const s = this.s;
    this.layout();
    // Emplacements
    s.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      const badge = el.firstElementChild as HTMLElement;
      const bar = el.lastElementChild as HTMLElement;
      const p = slot.plant;
      const open = sim.slotOpen(s, i);
      el.hidden = !open;
      let cls = 'badge', txt = '';
      if (this.drag >= 0) {
        if (i === this.drag) cls += ' hidden';
        else if (i === this.dragTarget) { cls += ' ready'; txt = slot.pot ? '⇄' : '⬇'; }
        else if (!slot.pot) { cls += ' ghost'; txt = '+'; }
        else cls += ' hidden';
      } else if (this.moving >= 0) {
        if (i === this.moving) { cls += ' alert'; txt = '✋'; }
        else if (!slot.pot) { cls += ' plus'; txt = '⬇'; }
        else { cls += ' swap'; txt = '⇄'; }
      } else if (!slot.pot) { cls += ' ghost'; txt = '+'; }
      else if (!p) { cls += ' plus'; txt = '🌱'; }
      else if (p.pests > 0) { cls += ' alert'; txt = '🐛'.repeat(p.pests); }
      else if (p.prog >= 1) { cls += ' ready'; txt = '🌸'; }
      else if (p.water < 0.5 && !s.upgrades.water) { cls += ' alert'; txt = '💧'; }
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
    const cur = this.scene.currentZone;
    const tabs = [`<button class="tab${cur < 0 ? ' on' : ''}" data-act="view" data-arg="-1">${themeOf(this.scene.themeId).all}</button>`].concat(ZONES.map((z, r) => {
      const care = s.zonesOpen[r] && [r * SLOTS_PER_ZONE, r * SLOTS_PER_ZONE + 1, r * SLOTS_PER_ZONE + 2, BASE_SLOTS + r].some((i) => this.needsCare(i));
      return `<button class="tab${cur === r ? ' on' : ''}${s.zonesOpen[r] ? '' : ' off'}" data-act="view" data-arg="${r}">${s.zonesOpen[r] ? z.icon : '🔒'} ${ZONE_SHORT[r]}${care ? '<i class="care"></i>' : ''}</button>`;
    })).join('');
    let info = '';
    if (this.crossing >= 0) info = `<div class="ticker"><span>🧬 Avec quelle plante la croiser ?</span><button class="btn small" data-act="cancelmove">Annuler</button></div>`;
    else if (this.moving >= 0) info = `<div class="ticker"><span>Où poser ce pot ?</span><button class="btn small" data-act="cancelmove">Annuler</button></div>`;
    else if (cur >= 0) {
      const c = sim.zoneClimate(s, ZONES[cur]);
      info = `<div class="zinfo"><b>${this.zname(cur)}</b> ☀️ ${LEVEL_WORDS.light[c.light]} · 🌡️ ${LEVEL_WORDS.temp[c.temp]} · 💧 ${LEVEL_WORDS.hum[c.hum]}</div>`;
    }
    const lv = sim.levelOf(s);
    const se = sim.seasonOf(s);
    const ct = sim.contestOf(s);
    const prize = !!sim.CONTEST[ct.claimed] && ct.blooms >= sim.CONTEST[ct.claimed].need;
    const ready = sim.TROPHIES.filter((x) => sim.trophyReady(s, x)).length;
    const hud = `<div class="hudrow"><div class="pill coins">🪙 ${fmt(s.coins)}</div><button class="pill season" data-act="nav" data-arg="season">${SEASONS[se.index].icon}${prize ? '<i class="dot">!</i>' : ''}</button><button class="pill lvl" data-act="nav" data-arg="trophies">🎓 ${lv.level}<i class="xp"><i style="width:${Math.round(100 * lv.into / lv.span)}%"></i></i>${ready ? `<i class="dot">${ready}</i>` : ''}</button><button class="pill" data-act="nav" data-arg="almanac">📖 ${col.bloomed}/${SPECIES.length} <small>⭐ ${col.stars}</small></button></div><div class="tabs">${tabs}</div>${info}`;
    if (hud !== this.lastHud && (force || !this.pointerDown)) { $('hud').innerHTML = hud; this.lastHud = hud; }

    // Nouvelles fiches à fêter
    if (s.fresh.length) { this.celebrate.push(...s.fresh); s.fresh = []; }
    if (this.celebrate.length && !$('modal').classList.contains('on') && this.kind === 'none') this.showBloom(this.celebrate.shift()!);

    // Objectif
    const q = sim.currentQuest(s);
    const qh = q ? `<div class="qt"><small>Objectif</small>${esc(q.text)}</div>${q.done(s)
      ? `<button class="btn gold small" data-act="quest">+${q.reward} 🪙</button>`
      : `<span class="chip">+${q.reward} 🪙</span>`}` : '';
    if (qh !== this.lastQuest && (force || !this.pointerDown)) { $('quest').innerHTML = qh; this.lastQuest = qh; }

    // Commande en cours
    const o = s.order;
    const oh = o ? `<div class="qt" data-act="orderinfo"><small>Commande · ${clock(o.left)}</small><b>${esc(o.who)}</b> cherche ${FAMILIES[o.family].icon} ${FAMILIES[o.family].name.toLowerCase()}, ${sim.qualityWord(o.minQ).toLowerCase()} ou mieux</div><span class="chip">+${o.coins} 🪙 · +${o.clay} 🧱</span>` : '';
    if (oh !== this.lastOrder && (force || !this.pointerDown)) { $('order').innerHTML = oh; this.lastOrder = oh; }

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
      const html = this.sheetHtml();
      if (html !== this.lastSheet && (force || !this.pointerDown)) {
        const body = $('sheet').querySelector('.sh-body');
        const top = body?.scrollTop ?? 0;
        $('sheet').innerHTML = html;
        this.lastSheet = html;
        const nb = $('sheet').querySelector('.sh-body');
        if (nb) nb.scrollTop = top;
      }
    }
  }

  private head(title: string): string {
    return `<div class="sh-head"><h2>${title}</h2><button class="x" data-act="close">✕</button></div>`;
  }

  private sheetHtml(): string {
    const s = this.s;
    switch (this.kind) {
      case 'buypot': return this.buyPotHtml();
      case 'seed': return this.seedHtml();
      case 'plant': return this.plantHtml();
      case 'harvest': return this.harvestHtml();
      case 'packets': return this.packetsHtml();
      case 'market': return this.marketHtml();
      case 'shop': return this.shopHtml();
      case 'almanac': return this.almanacHtml();
      case 'fiche': return this.ficheHtml(SPECIES_BY_ID[this.argId]);
      case 'zone': return this.zoneHtml();
      case 'vitrine': return this.vitrineHtml();
      case 'atelier': return this.atelierHtml();
      case 'trophies': return this.trophiesHtml();
      case 'season': return this.seasonHtml();
      case 'paint': return this.paintHtml();
      default: return '';
    }
    void s;
  }

  private zoneLine(i: number): string {
    const z = sim.zoneOfSlot(i);
    const c = sim.zoneClimate(this.s, z);
    return `<p class="sub">${z.icon} <b>${this.zname(ZONES.indexOf(z))}</b> : ${LEVEL_WORDS.light[c.light].toLowerCase()}, ${LEVEL_WORDS.temp[c.temp].toLowerCase()}, ${LEVEL_WORDS.hum[c.hum].toLowerCase()}.</p>`;
  }

  private vitrineHtml(): string {
    const s = this.s;
    const tips = Math.floor(s.tips);
    const perMin = sim.showcaseRate(s) * 60;
    const rows = s.showcase.map((h, k) => {
      if (!h) return '<div class="card"><div class="ico">▫️</div><div class="mid"><div class="nm">Socle libre</div><div class="ds">Expose une plante en fleur au lieu de la vendre.</div></div></div>';
      const sp = SPECIES_BY_ID[h.sp];
      const rate = sp.value * sim.qualityMult(h.q) * sim.VARIANT_MULT[h.vr] * sim.TIP_RATE * 60;
      return `<div class="card"><div class="ico">${EMOJI[sp.id]}</div><div class="mid"><div class="nm">${esc(vname(sp, h.vr))}</div><div class="ds">${sim.qualityWord(h.q)} · ${rate.toFixed(1).replace('.', ',')} 🪙 par minute</div></div><button class="btn small" data-act="unshow" data-arg="${k}">Vendre ${fmt(sim.saleValue(s, h))} 🪙</button></div>`;
    }).join('');
    return this.head('🏛️ Vitrine') + `<div class="sh-body">
      <p class="sub">Tes plus beaux spécimens exposés sur l'étagère attirent des visiteurs, qui laissent des pourboires même en ton absence. Les plantes rares, les variantes et les belles qualités rapportent le plus.</p>
      <div class="kv"><span>Visiteurs accueillis</span><b>${fmt(s.visitors)}</b></div>
      <div class="kv"><span>Pourboires</span><b>${perMin.toFixed(1).replace('.', ',')} 🪙 par minute</b></div>
      <button class="btn gold wide" data-act="tips" ${tips > 0 ? '' : 'disabled'}>Ramasser les pourboires · ${fmt(tips)} 🪙</button>
      ${rows}</div>`;
  }

  private zoneHtml(): string {
    const s = this.s;
    const z = ZONES[this.arg];
    const price = sim.ZONE_PRICES[this.arg];
    const can = s.coins >= price;
    const c = sim.zoneClimate(s, z);
    const fans = SPECIES.filter((sp) => sim.fitOf(sp, c) >= 1 && s.disc[sp.id]?.seen).map((sp) => `${EMOJI[sp.id]} ${sp.name}`);
    return this.head(`${z.icon} ${this.zname(this.arg)}`) + `<div class="sh-body">
      <p class="sub">Ce coin est encore encombrée. Aménage-la pour gagner trois emplacements au climat différent.</p>
      ${this.zoneLine(this.arg * SLOTS_PER_ZONE)}
      <p class="sub">${fans.length ? 'Parfaite pour : ' + fans.join(', ') + '.' : 'Aucune de tes espèces connues n\'y serait parfaitement à l\'aise pour l\'instant.'}</p>
      <button class="btn primary wide" data-act="openzone" ${can ? '' : 'disabled'}>Aménager · ${fmt(price)} 🪙</button>
      ${can ? '' : `<p class="sub center">Il te manque ${fmt(price - s.coins)} 🪙.</p>`}</div>`;
  }

  private paintTarget(): sim.PotDesign | undefined {
    const { where, k } = this.paintAt;
    if (where === 'shelf') return this.s.shelf[k];
    return this.s.slots[k]?.pot ? this.s.slots[k].pd ?? { size: 1, glaze: 0, pat: 0 } : undefined;
  }

  private buyPotHtml(): string {
    const s = this.s;
    const price = sim.potPrice(s);
    const can = s.coins >= price;
    const shelf = s.shelf.map((pd, k) => `<button class="card" data-act="place" data-arg="${k}"><div class="ico">🏺</div><div class="mid"><div class="nm">${potLabel(pd)}</div><div class="ds">Façonné à l'atelier</div></div><div class="end">Poser</div></button>`).join('');
    return this.head('Emplacement libre') + `<div class="sh-body">${this.zoneLine(this.arg)}
      ${shelf ? `<h3>Tes pots façonnés</h3>${shelf}` : ''}
      <h3>Pot tout fait</h3>
      <p class="sub">Un petit pot en terre cuite, tout de suite. Les pots moyens et grands, pour les arbustes et les grandes plantes, se façonnent à l'atelier.</p>
      <button class="btn primary wide" data-act="buypot" ${can ? '' : 'disabled'}>Acheter un petit pot · ${fmt(price)} 🪙</button>
      ${can ? '' : `<p class="sub center">Il te manque ${fmt(price - s.coins)} 🪙.</p>`}
      <button class="btn wide" data-act="nav" data-arg="atelier">🏺 Aller à l'atelier</button></div>`;
  }

  private atelierHtml(): string {
    const s = this.s;
    const k = s.kiln;
    const kiln = !k ? '<p class="sub">Le four est vide. Choisis une taille de pot à façonner.</p>'
      : k.left > 0
        ? `<div class="kv"><span>${POT_SIZES[k.size - 1].name} en cuisson</span><b>${clock(k.left)}</b></div><div class="kilnbar"><i style="width:${Math.round((1 - k.left / POT_SIZES[k.size - 1].fire) * 100)}%"></i></div>`
        : `<button class="btn gold wide" data-act="kiln">🔥 Défourner le ${POT_SIZES[k.size - 1].name.toLowerCase()}</button>`;
    const sizes = POT_SIZES.map((d, n) => {
      const ok = !k && s.clay >= d.clay;
      const what = n === 0 ? 'Pour la plupart des plantes.' : n === 1 ? 'Pour les grandes plantes et les petits arbustes.' : 'Pour les arbres : figuier, olivier, citronnier, érable.';
      return `<div class="card"><div class="ico" style="font-size:${18 + n * 7}px">🏺</div><div class="mid"><div class="nm">${d.name}</div><div class="ds">${what} Cuisson ${d.fire < 60 ? d.fire + ' s' : Math.round(d.fire / 60) + ' min'}.</div></div><button class="btn small ${ok ? 'primary' : ''}" data-act="craft" data-arg="${n + 1}" ${ok ? '' : 'disabled'}>${d.clay} 🧱</button></div>`;
    }).join('');
    const shelf = s.shelf.map((pd, n) => `<div class="card"><div class="ico">🏺</div><div class="mid"><div class="nm">${potLabel(pd)}</div><div class="ds">Touche un emplacement libre de la serre pour le poser.</div></div><button class="btn small" data-act="paintshelf" data-arg="${n}">🎨 Peindre</button></div>`).join('');
    const next = sim.CLAY_EVERY - s.clayAcc;
    return this.head('🏺 Atelier de poterie') + `<div class="sh-body">
      <p class="sub">Façonne tes pots, cuis-les au four puis peins-les. Un émail accordé à la famille de la plante la fait pousser ${Math.round((sim.HARMONY_SPEED - 1) * 100)} % plus vite.</p>
      <div class="kv"><span>🧱 Argile</span><b>${s.clay} / ${sim.clayCap(s)}${s.clay < sim.clayCap(s) ? ` · +1 dans ${clock(next)}` : ' · bac plein'}</b></div>
      <p class="sub">L'argile se dépose toute seule dans le bac. Les commandes des clients en rapportent aussi.</p>
      <h3>Four</h3>${kiln}
      <h3>Tour de potier</h3>${sizes}
      <h3>Étagère (${s.shelf.length}/${sim.SHELF_CAP})</h3>${shelf || '<p class="sub">Aucun pot en attente.</p>'}
      <p class="sub">Pour peindre un pot déjà posé, touche-le dans la serre puis choisis « Peindre le pot ».</p></div>`;
  }

  private paintHtml(): string {
    const s = this.s;
    const pd = this.paintTarget();
    if (!pd) return this.head('🎨 Peinture') + '<div class="sh-body"><p class="sub">Ce pot n\'est plus là.</p></div>';
    const plant = this.paintAt.where === 'slot' ? s.slots[this.paintAt.k].plant : null;
    const fav = plant ? FAMILIES[SPECIES_BY_ID[plant.sp].family] : null;
    const st = sim.collection(s).stars;
    const glazes = GLAZES.map((g, n) => {
      const open = st >= g.stars;
      return `<button class="sw-b${pd.glaze === n ? ' on' : ''}${open ? '' : ' lock'}" data-act="glaze" data-arg="${n}"><i style="background:${hex(g.color)};border-color:${hex(g.rim)}"></i>${g.name}${open ? (fav && fav.glaze === n ? '<small>💚 accordé</small>' : '') : `<small>🔒 ${g.stars} ⭐</small>`}</button>`;
    }).join('');
    const pats = PATTERNS.map((nm, n) => `<button class="btn small ${pd.pat === n ? 'primary' : ''}" data-act="pattern" data-arg="${n}">${nm}</button>`).join('');
    return this.head('🎨 Peinture') + `<div class="sh-body">
      <div class="kv"><span>Ce pot</span><b>${potLabel(pd)}</b></div>
      <p class="sub">Chaque coup de pinceau coûte ${sim.PAINT_PRICE} 🪙. Les émaux se débloquent avec les étoiles de l'almanach (tu en as ${st}).</p>
      ${fav ? `<p class="sub">${fav.icon} Les ${fav.name.toLowerCase()} préfèrent l'émail <b>${GLAZES[fav.glaze].name.toLowerCase()}</b>.</p>` : ''}
      <h3>Émail</h3><div class="swatches">${glazes}</div>
      <h3>Motif</h3><div class="row">${pats}</div></div>`;
  }

  private seedHtml(): string {
    const s = this.s;
    const c = sim.zoneClimate(s, sim.zoneOfSlot(this.arg));
    const ids = Object.keys(s.seeds).sort((a, b) => sim.fitOf(SPECIES_BY_ID[b], c) - sim.fitOf(SPECIES_BY_ID[a], c));
    const size = sim.potSize(s.slots[this.arg]);
    const list = ids.map((id) => {
      const sp = SPECIES_BY_ID[id];
      const small = sim.sizeOf(sp) > size;
      return `<button class="card" data-act="plant" data-arg="${id}" ${small ? 'disabled style="opacity:.55"' : ''}><div class="ico">${EMOJI[id]}</div><div class="mid"><div class="nm">${esc(sp.name)} ${rarTag(sp)}</div>${sim.inSeason(s, sp) ? `<div class="ds">${SEASONS[sim.seasonOf(s).index].icon} De saison : pousse plus vite</div>` : ''}${small ? `<div class="ds">🏺 Il lui faut un ${POT_SIZES[sim.sizeOf(sp) - 1].name.toLowerCase()} : façonne-le à l'atelier.</div>` : needsChips(sp, c)}</div><div class="end">×${s.seeds[id]}</div></button>`;
    }).join('');
    const empty = `<p class="sub">Tu n'as plus de graines.</p>${s.packets > 0
      ? '<button class="btn gold wide" data-act="free">🎁 Ouvrir un sachet gratuit</button>'
      : `<button class="btn primary wide" data-act="buypacket" ${s.coins >= sim.PRICES.packet ? '' : 'disabled'}>Sachet mystère · ${sim.PRICES.packet} 🪙</button>`}`;
    return this.head('Que semer ici ?') + `<div class="sh-body">${this.zoneLine(this.arg)}${ids.length ? `<p class="sub">En vert : ce qui convient à cet emplacement.</p>${list}` : empty}<div class="kv"><span>Ce pot</span><b>${potLabel(s.slots[this.arg].pd)}</b></div><div class="row"><button class="btn small" data-act="move">✋ Déplacer</button><button class="btn small" data-act="paintslot">🎨 Peindre</button><button class="btn small" data-act="stow">📥 Ranger</button></div></div>`;
  }

  private plantHtml(): string {
    const s = this.s;
    const p = s.slots[this.arg].plant;
    if (!p) return this.head('Pot vide') + '<div class="sh-body"></div>';
    const sp = SPECIES_BY_ID[p.sp];
    const c = sim.zoneClimate(s, sim.zoneOfSlot(this.arg));
    const fit = sim.fitOf(sp, c);
    const left = ((1 - p.prog) * sp.grow) / (fit * (p.water > 0 ? 1 : 0.25) * (p.pests > 0 ? 0.5 : 1));
    const eta = left < 60 ? `${Math.ceil(left)} s` : `${Math.ceil(left / 60)} min`;
    const vr = sim.stageOf(p.prog) >= 2 ? p.vr : 0;
    return this.head(`${EMOJI[sp.id]} ${esc(vname(sp, vr))}`) + `<div class="sh-body">
      <div class="kv"><span>${STAGES[sim.stageOf(p.prog)]}</span><b>${p.prog >= 1 ? 'Prête' : 'encore ' + eta}</b></div>
      <div class="prog"><i style="width:${Math.round(p.prog * 100)}%"></i></div>
      <div class="kv"><span>Qualité</span><b>${sim.qualityWord(p.q)}</b></div>
      <div class="kv"><span>Arrosage</span><b>${s.upgrades.water ? 'Automatique' : p.water > 0 ? Math.round(p.water * 100) + ' %' : 'À sec : elle tourne au ralenti'}</b></div>
      <div class="kv"><span>Pot</span><b>${potLabel(s.slots[this.arg].pd)}${sim.harmony(s.slots[this.arg]) ? ' 💚' : ''}</b></div>
      ${sim.harmony(s.slots[this.arg]) ? `<p class="sub">💚 Émail accordé à sa famille : elle pousse ${Math.round((sim.HARMONY_SPEED - 1) * 100)} % plus vite.</p>` : ''}
      ${this.zoneLine(this.arg)}${conditions(sp, c)}
      <div class="row">${s.upgrades.water ? '' : `<button class="btn primary" data-act="water" ${p.water > 0.95 ? 'disabled' : ''}>💧 Arroser</button>`}<button class="btn" data-act="fert" ${s.fert > 0 && p.prog < 1 ? '' : 'disabled'}>🧪 Engrais (${s.fert})</button></div>
      <div class="row"><button class="btn small" data-act="move">✋ Déplacer</button><button class="btn small" data-act="paintslot">🎨 Peindre le pot</button><button class="btn small" data-act="fiche" data-arg="${sp.id}">📖 Fiche</button></div></div>`;
  }

  private marketHint(p: number): string {
    if (p >= 1.2) return '<span class="up">Cours haut : c\'est le moment de vendre.</span>';
    if (p <= 0.85) return '<span class="down">Cours bas : mieux vaut attendre en réserve.</span>';
    return 'Cours proche de la normale.';
  }

  private harvestHtml(): string {
    const s = this.s;
    const p = s.slots[this.arg].plant;
    if (!p) return this.head('Récolte') + '<div class="sh-body"></div>';
    const sp = SPECIES_BY_ID[p.sp];
    const m = s.market[sp.family];
    const full = s.stock.length >= s.stockCap;
    const d = s.disc[sp.id];
    const n = sim.starsOf(d);
    const next = n >= 3 ? 'Fiche complète : tu as obtenu un spécimen d\'exposition.' : 'Pour une étoile de plus, fais-la pousser dans un coin qui lui convient parfaitement, bien arrosée et sans pucerons.';
    const freeShow = s.showcase.some((h) => !h);
    return this.head(`${EMOJI[sp.id]} ${esc(vname(sp, p.vr))} en fleur`) + `<div class="sh-body">
      <div class="big">${stars(n)}</div>
      <div class="kv"><span>Ce spécimen</span><b>${sim.qualityWord(p.q)}</b></div>
      <p class="sub">${next}</p>
      ${s.order && sim.orderFits(s, p) ? `<button class="btn gold wide" data-act="deliver">📦 Livrer à ${esc(s.order.who)} · ${fmt(sim.saleValue(s, p) + s.order.coins)} 🪙 +${s.order.clay} 🧱</button>` : ''}
      <button class="btn primary wide" data-act="sell">Récolter et vendre · ${fmt(sim.saleValue(s, p))} 🪙</button>
      <p class="sub center">Cours ${FAMILIES[sp.family].name.toLowerCase()} : <b class="${level(m.p)}">${mult(m.p)}</b>. ${this.marketHint(m.p)}</p>
      <button class="btn gold wide" data-act="show" ${freeShow ? '' : 'disabled'}>🏛️ Exposer en vitrine${freeShow ? '' : ' (pleine)'}</button>
      <div class="row wrap"><button class="btn small" data-act="cutting">✂️ Bouturer</button>${sim.CROSS_FEE[sp.rarity] ? `<button class="btn small" data-act="cross">🧬 Croiser · ${sim.CROSS_FEE[sp.rarity]} 🪙</button>` : ''}<button class="btn small" data-act="store" ${full ? 'disabled' : ''}>📦 Réserve (${s.stock.length}/${s.stockCap})</button><button class="btn small" data-act="move">✋ Déplacer</button><button class="btn small" data-act="fiche" data-arg="${sp.id}">📖 Fiche</button></div></div>`;
  }

  private packetsHtml(): string {
    const s = this.s;
    const wait = Math.max(0, Math.ceil(s.packetIn));
    const timer = `${Math.floor(wait / 60)} min ${String(wait % 60).padStart(2, '0')}`;
    const seeds = Object.keys(s.seeds).map((id) => {
      const sp = SPECIES_BY_ID[id];
      return `<div class="card"><button class="ico" data-act="fiche" data-arg="${id}">${EMOJI[id]}</button><div class="mid"><div class="nm">${esc(sp.name)} ×${s.seeds[id]}</div><div class="ds">${rarTag(sp)}</div></div><button class="btn small" data-act="compost" data-arg="${id}">🧪 Composter</button></div>`;
    }).join('');
    return this.head('🎁 Sachets de graines') + `<div class="sh-body">
      <p class="sub">Un sachet gratuit toutes les ${Math.round(sim.PACKET_EVERY / 60)} minutes, même en ton absence. Ils se cumulent jusqu'à ${sim.MAX_PACKETS}.</p>
      <button class="btn gold wide" data-act="free" ${s.packets > 0 ? '' : 'disabled'}>${s.packets > 0 ? `Ouvrir un sachet gratuit (${s.packets})` : `Prochain sachet dans ${timer}`}</button>
      <button class="btn wide" data-act="buypacket" ${s.coins >= sim.PRICES.packet ? '' : 'disabled'}>Sachet mystère · ${sim.PRICES.packet} 🪙</button>
      <h3>Mes graines</h3><p class="sub">Une graine en trop ? Composte-la : elle devient une dose d'engrais (tu en as ${s.fert}), qui fait gagner un quart de la croissance.</p>${seeds || '<p class="sub">Aucune graine en attente. Touche un pot vide dans la serre pour semer.</p>'}</div>`;
  }

  private marketHtml(): string {
    const s = this.s;
    const rows = FAMILY_IDS.map((f) => {
      const m = s.market[f];
      const t = trend(m.hist);
      return `<div class="mrow"><span class="fi">${FAMILIES[f].icon}</span><span class="fn">${FAMILIES[f].name}</span>${sparkline(m.hist, FAMILIES[f].color)}<span class="pv ${level(m.p)}">${mult(m.p)} ${t.arrow}</span></div>`;
    }).join('');
    const stock = s.stock.map((h, k) => {
      const sp = SPECIES_BY_ID[h.sp];
      return `<div class="card"><div class="ico">${EMOJI[sp.id]}</div><div class="mid"><div class="nm">${esc(vname(sp, h.vr))}</div><div class="ds">${sim.qualityWord(h.q)} · cours ${mult(s.market[sp.family].p)}</div></div><button class="btn primary small" data-act="sellstock" data-arg="${k}">Vendre ${fmt(sim.saleValue(s, h))} 🪙</button></div>`;
    }).join('');
    const news = s.news.slice(0, 6).map((n) => `<div class="news"><b class="${n.dir > 0 ? 'up' : 'down'}">${FAMILIES[n.family].icon} ${n.dir > 0 ? '▲' : '▼'}</b> ${esc(n.text)}</div>`).join('');
    return this.head('📈 Marché') + `<div class="sh-body">
      <p class="sub">Vendre finance ta collection. Le prix suit le cours de la famille : ×1,00 est le prix normal.</p>${rows}
      <h3>Réserve (${s.stock.length}/${s.stockCap})</h3>${stock || '<p class="sub">Vide. Quand un cours est bas, garde tes plantes en fleur ici et vends au prochain pic.</p>'}
      <h3>Dernières nouvelles</h3>${news || '<p class="sub">Le marché est calme pour l\'instant.</p>'}</div>`;
  }

  private shopHtml(): string {
    const s = this.s;
    const item = (ico: string, nm: string, ds: string, price: number, act: string, arg: string, owned = false) =>
      `<div class="card"><div class="ico">${ico}</div><div class="mid"><div class="nm">${nm}</div><div class="ds">${ds}</div></div>${owned
        ? '<span class="chip ok">Installé</span>'
        : `<button class="btn ${s.coins >= price ? 'primary' : ''} small" data-act="${act}" data-arg="${arg}" ${s.coins >= price ? '' : 'disabled'}>${fmt(price)} 🪙</button>`}</div>`;
    const gear = (ico: string, nm: string, ds: string, k: sim.ClimateGear) => !s.upgrades[k] ? item(ico, nm, ds, sim.PRICES[k], 'upgrade', k)
      : `<div class="card"><div class="ico">${ico}</div><div class="mid"><div class="nm">${nm}</div><div class="ds">${ds}</div></div><button class="btn small ${s.off[k] ? '' : 'primary'}" data-act="gear" data-arg="${k}">${s.off[k] ? 'Éteint' : 'Allumé'}</button></div>`;
    return this.head('🛒 Boutique') + `<div class="sh-body">
      <h3>Style graphique</h3>
      <p class="sub">Quatre directions artistiques à comparer. Elles changent le rendu des plantes, la lumière et toute l'interface.</p>
      <div class="themes">${STYLES.map((t) => `<button class="theme ${t.id === this.scene.styleId ? 'on' : ''}" data-act="style" data-arg="${t.id}"><span class="sw" style="background:${t.swatch}"></span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>
      <h3>Décor</h3>
      <p class="sub">Trois lieux à essayer. Tes plantes et tes pots restent en place.</p>
      <div class="themes">${THEMES.map((t) => `<button class="theme ${t.id === this.scene.themeId ? 'on' : ''}" data-act="theme" data-arg="${t.id}"><span class="sw" style="background:${t.bg}"></span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>
      <p class="sub">Tout le reste s'achète avec les pièces gagnées en vendant tes plantes.</p>
      <h3>Équipement</h3>
      ${item('🚿', 'Arrosage automatique', 'Plus jamais de pot à sec, même en ton absence.', sim.PRICES.water, 'upgrade', 'water', s.upgrades.water)}
      ${item('🐞', 'Lâcher de coccinelles', 'Elles mangent les pucerons à ta place.', sim.PRICES.bugs, 'upgrade', 'bugs', s.upgrades.bugs)}
      <h3>Climat</h3>
      <p class="sub">Ces appareils changent le climat d'une zone. Tu peux les éteindre et les rallumer à volonté.</p>
      ${gear('🌫️', 'Brumisateur', 'Zone d\'ombre : l\'air devient humide. Pour les fougères.', 'mist')}
      ${gear('💡', 'Lampe horticole', 'Zone fraîche : plein soleil. Pour les tulipes.', 'lamp')}
      ${gear('♨️', 'Radiateur', 'Zone fraîche : tempéré au lieu de frais.', 'heat')}
      ${gear('🌀', 'Ventilateur', 'Zone plein sud : tempéré au lieu de chaud. Pour lavande, thym et romarin.', 'fan')}
      ${s.stockCap < 10 ? item('📦', 'Réserve agrandie', `Deux places de plus (${s.stockCap} aujourd'hui).`, sim.PRICES.stock, 'upgrade', 'stock') : ''}
      <h3>Agrandir la serre</h3>
      <p class="sub">Une suspension ajoute un quatrième emplacement à une zone aménagée.</p>
      ${ZONES.map((z, r) => item(z.icon, `Suspension · ${this.zname(r)}`, s.zonesOpen[r] ? 'Un emplacement de plus, en hauteur.' : 'Aménage d\'abord cette zone.', sim.EXTRA_PRICES[r], 'extra', String(r), !!s.extra?.[r])).join('')}
      <h3>Atelier</h3>
      ${item('🔥', 'Four à double foyer', 'Les pots cuisent deux fois plus vite.', sim.PRICES.fastKiln, 'upgrade', 'fastKiln', !!s.upgrades.fastKiln)}
      ${item('🧱', 'Grand bac d\'argile', 'Le bac contient deux fois plus d\'argile.', sim.PRICES.bigClay, 'upgrade', 'bigClay', !!s.upgrades.bigClay)}
      <h3>Graines</h3>
      ${item('💎', 'Sachet prestige', 'Trois graines, toutes rares ou mieux.', sim.PRICES.prestige, 'prestige', '')}
      ${item('🎁', 'Sachet mystère', 'Trois graines de toutes familles.', sim.PRICES.packet, 'buypacket', '')}
      ${FAMILY_IDS.map((f) => item(FAMILIES[f].icon, `Sachet ${FAMILIES[f].name.toLowerCase()}`, 'Trois graines de cette famille.', sim.PRICES.familyPacket, 'buypacket', f)).join('')}
      <p class="sub">Pour un nouveau pot ou une nouvelle zone, touche un emplacement libre ou un cadenas dans la serre.</p></div>`;
  }

  private seasonHtml(): string {
    const s = this.s;
    const se = sim.seasonOf(s);
    const season = SEASONS[se.index];
    const next = SEASONS[(se.index + 1) % SEASONS.length];
    const ct = sim.contestOf(s);
    const tiers = sim.CONTEST.map((c, k) => {
      const end = k < ct.claimed ? '<span class="chip ok">Remporté</span>'
        : k === ct.claimed && ct.blooms >= c.need ? `<button class="btn gold small" data-act="contest">Réclamer</button>`
          : `<span class="chip">${Math.min(ct.blooms, c.need)} / ${c.need}</span>`;
      return `<div class="card"><div class="ico">${['🥉', '🥈', '🥇'][k]}</div><div class="mid"><div class="nm">Palier ${c.label}</div><div class="ds">+${c.coins} 🪙 · +${c.clay} argile${k === 2 ? ' · 2 sachets' : ''}</div></div>${end}</div>`;
    }).join('');
    const fams = season.fams.map((f) => `${FAMILIES[f].icon} ${FAMILIES[f].name}`).join(' et ');
    return this.head(`${season.icon} ${season.name}`) + `<div class="sh-body">
      <p class="sub">${season.text}</p>
      <div class="kv"><span>Familles de saison</span><b>${fams}</b></div>
      <div class="kv"><span>Bonus</span><b>Croissance +${Math.round((sim.SEASON_SPEED - 1) * 100)} %</b></div>
      <div class="kv"><span>Saison suivante</span><b>${next.icon} ${next.name} dans ${clock(se.left)}</b></div>
      <h3>Concours de la saison</h3>
      <p class="sub">Fais fleurir des plantes des familles de saison avant qu'elle ne se termine. Le compteur repart de zéro à chaque saison.</p>
      <div class="big">${ct.blooms} 🌼</div>
      ${tiers}</div>`;
  }

  private trophiesHtml(): string {
    const s = this.s;
    const lv = sim.levelOf(s);
    const rank = (x: sim.Trophy) => (sim.trophyReady(s, x) ? 0 : s.trophies?.[x.id] ? 2 : 1);
    const rows = [...sim.TROPHIES].sort((a, b) => rank(a) - rank(b)).map((x) => {
      const [a, b] = x.at(s);
      const done = !!s.trophies?.[x.id];
      const end = done ? '<span class="chip ok">Obtenu</span>'
        : a >= b ? `<button class="btn gold small" data-act="trophy" data-arg="${x.id}">+${fmt(x.reward)} 🪙</button>`
          : `<span class="chip">${fmt(a)} / ${fmt(b)}</span>`;
      return `<div class="card" ${done ? 'style="opacity:.6"' : ''}><div class="ico">${x.icon}</div><div class="mid"><div class="nm">${esc(x.name)}</div><div class="ds">${esc(x.text)}</div>${done || a >= b ? '' : `<div class="prog" style="height:6px;margin-top:5px"><i style="width:${Math.round(100 * a / b)}%"></i></div>`}</div>${end}</div>`;
    }).join('');
    const got = sim.TROPHIES.filter((x) => s.trophies?.[x.id]).length;
    return this.head('🎓 Jardinier') + `<div class="sh-body">
      <div class="big">Niveau ${lv.level}</div>
      <div class="prog"><i style="width:${Math.round(100 * lv.into / lv.span)}%"></i></div>
      <p class="sub center">${fmt(lv.into)} / ${fmt(lv.span)} points d'expérience. Chaque floraison, commande, croisement et pot façonné en rapporte. Un niveau gagné offre des pièces, de l'argile et un sachet.</p>
      <h3>Trophées (${got}/${sim.TROPHIES.length})</h3>${rows}</div>`;
  }

  private almanacHtml(): string {
    const s = this.s;
    const col = sim.collection(s);
    const cells = SPECIES.map((sp) => {
      const d = s.disc[sp.id];
      if (!d?.seen) return '<div class="sp locked"><span class="e">❔</span>???</div>';
      return `<button class="sp" data-act="fiche" data-arg="${sp.id}" style="border-color:${RARITIES[sp.rarity].color}55"><span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${d.bloomed ? `<span class="st">${stars(sim.starsOf(d))}${d.vars[1] ? '🤍' : ''}${d.vars[2] ? '💛' : ''}</span>` : '<span class="chip">à faire fleurir</span>'}</button>`;
    }).join('');
    return this.head('📖 Almanach') + `<div class="sh-body">
      <div class="big">${col.bloomed} / ${SPECIES.length}</div>
      <p class="sub center">espèces fleuries · ⭐ ${col.stars} sur ${SPECIES.length * 3} · ✨ ${col.variants} variantes sur ${SPECIES.length * 2}</p>
      <p class="sub">Chaque floraison ajoute l'espèce à ta collection. Les plus beaux spécimens gagnent jusqu'à trois étoiles, et il arrive qu'une graine donne une variante panachée 🤍 ou dorée 💛.</p>
      <button class="btn wide" data-act="nav" data-arg="vitrine">🏛️ Voir la vitrine</button>
      <div class="grid">${cells}</div>
      <div class="kv"><span>Plantes vendues</span><b>${fmt(s.stats.sold)}</b></div>
      <div class="kv"><span>Pièces gagnées</span><b>${fmt(s.stats.earned)} 🪙</b></div>
      <button class="btn wide" data-act="nav" data-arg="trophies">🎓 Niveau et trophées</button>
      <button class="btn wide" data-act="mute">${s.mute ? '🔇 Sons coupés' : '🔊 Sons activés'}</button>
      <button class="linkb" data-act="reset">Recommencer la partie</button></div>`;
  }

  private ficheHtml(sp: Species): string {
    const d = this.s.disc[sp.id];
    const bloomed = !!d?.bloomed;
    const mins = Math.round(sp.grow / 60 * 10) / 10;
    return this.head(`${EMOJI[sp.id]} ${esc(sp.name)}`) + `<div class="sh-body">
      <p class="sub"><i>${esc(sp.latin)}</i> · ${FAMILIES[sp.family].name} · ${esc(sp.origin)}</p>
      <div>${rarTag(sp)} <span class="st">${stars(sim.starsOf(d))}</span></div>
      <h3>Ce qu'elle aime</h3>${needsChips(sp)}
      <p class="sub">Idéal : ${ZONES.filter((z) => sim.fitOf(sp, sim.zoneClimate(this.s, z)) >= 1).map((z) => this.zname(ZONES.indexOf(z))).join(', ') || 'aucun coin parfait pour l\'instant, cherche le moins mauvais ou équipe la serre'}.</p>
      <div class="kv"><span>Taille adulte</span><b>${esc(sp.height)}</b></div>
      <div class="kv"><span>Pot nécessaire</span><b>${POT_SIZES[sim.sizeOf(sp) - 1].name}${sim.sizeOf(sp) > 1 ? ' ou plus grand' : ''}</b></div>
      <div class="kv"><span>Émail préféré</span><b>${GLAZES[FAMILIES[sp.family].glaze].name}</b></div>
      ${sp.pets ? `<div class="kv"><span>Chats et chiens</span><b>${sp.pets === 'ok' ? 'Sans danger' : 'Toxique si mâchouillée'}</b></div>` : ''}
      <h3>Dans ta collection</h3>
      <div class="kv"><span>Variantes obtenues</span><b>${d?.bloomed ? 'Normale' : 'Aucune'}${d?.vars[1] ? ' · Panachée 🤍' : ''}${d?.vars[2] ? ' · Dorée 💛' : ''}</b></div>
      <div class="kv"><span>Spécimens vendus</span><b>${fmt(d?.sold ?? 0)}</b></div>
      <h3>Dans le jeu</h3>
      <div class="kv"><span>Valeur de base</span><b>${fmt(sp.value)} 🪙</b></div>
      <div class="kv"><span>Croissance idéale</span><b>${String(mins).replace('.', ',')} min</b></div>
      <h3>Le savais-tu ?</h3>
      <div class="fact ${bloomed ? '' : 'lock'}">${bloomed ? esc(sp.fact) : '🔒 Fais-la fleurir une première fois pour découvrir son anecdote.'}</div>
      <h3>Chez toi</h3>
      <div class="fact ${bloomed ? '' : 'lock'}">${bloomed ? esc(sp.tip) : '🔒 Un vrai conseil de culture t\'attend à la première floraison.'}</div></div>`;
  }
}
export { SLOTS_PER_ZONE };
