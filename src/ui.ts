import { FAMILIES, FAMILY_IDS, LEVEL_WORDS, RARITIES, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, STAGES, ZONES } from './data';
import type { Family, Species } from './data';
import type { Scene3D } from './scene';
import * as sim from './sim';
import type { State } from './sim';

const EMOJI: Record<string, string> = {
  echeveria: '🪴', aloe: '🌵', lithops: '🪨', basilic: '🌿', menthe: '🍃', lavande: '🪻', boston: '☘️', capillaire: '🍀',
  pensee: '🌼', pelargonium: '🌺', strelitzia: '🦜', phalaenopsis: '🌸', paphiopedilum: '🌷', fantome: '👻',
};
const ZONE_SHORT = ['Ombre', 'Bassin', 'Porte', 'Plein sud'];

type SheetKind = 'none' | 'seed' | 'buypot' | 'plant' | 'harvest' | 'packets' | 'market' | 'shop' | 'almanac' | 'fiche' | 'zone';

const $ = (id: string) => document.getElementById(id)!;
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
const mult = (p: number) => '×' + p.toFixed(2).replace('.', ',');
const stars = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);
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
  private lastNewsT = 0;
  private pointerDown = false;
  private slotEls: HTMLButtonElement[] = [];
  private lockEls: HTMLButtonElement[] = [];
  private toastTimer = 0;
  private resetAskedAt = 0;
  /** Emplacement du pot en cours de déplacement, ou -1. */
  private moving = -1;
  private swipedAt = 0;
  private celebrate: string[] = [];

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
      overlay.appendChild(b);
      this.slotEls.push(b);
    });
    const app = $('app');
    let sx = 0, sy = 0, st = 0, onScene = false;
    app.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      sx = e.clientX; sy = e.clientY; st = Date.now();
      onScene = !(e.target as HTMLElement).closest('#sheet, #modal, #bottom, #hud, #backdrop');
    });
    app.addEventListener('pointerup', (e) => {
      this.pointerDown = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!onScene || Date.now() - st > 900 || Math.max(Math.abs(dx), Math.abs(dy)) < 45) return;
      // Balayer vers la gauche ou vers le haut avance d'une zone ; l'inverse recule.
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : (dy < 0 ? 1 : -1);
      this.swipedAt = Date.now();
      this.goZone(Math.max(-1, Math.min(ZONES.length - 1, this.scene.currentZone + dir)));
    });
    for (const ev of ['pointercancel', 'pointerleave']) app.addEventListener(ev, () => { this.pointerDown = false; });
    app.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (t && !t.hasAttribute('disabled')) this.act(t.dataset.act!, t.dataset.arg ?? '');
    });
    $('backdrop').onclick = () => this.close();
  }

  private goZone(z: number): void {
    this.scene.setView(z);
    this.refresh(true);
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
      case 'move':
        this.moving = this.arg;
        this.close();
        this.toast('Touche l\'emplacement où poser ce pot. Balaye pour changer de zone.');
        break;
      case 'cancelmove': this.moving = -1; break;
      case 'openzone':
        if (sim.openZone(s, this.arg)) { this.toast(`${ZONES[this.arg].name} : zone aménagée !`); this.buzz(30); this.close(); this.goZone(this.arg); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'plant':
        if (sim.plantSeed(s, this.arg, arg)) { this.scene.pop(this.arg); this.float(this.arg, '🌱'); this.buzz(12); this.close(); }
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
        const got = sim.openFreePacket(s);
        if (got) this.showPacket(got);
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
      case 'quest': {
        const r = sim.claimQuest(s);
        if (r) { this.toast(`Objectif atteint ! +${fmt(r)} 🪙`); this.bumpCoins(); this.buzz(30); }
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
    this.bumpCoins();
    this.buzz(25);
  }

  private showPacket(got: { id: string; isNew: boolean }[]): void {
    this.close();
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">Ton sachet de graines</div><button class="packet" id="pk"><span>🌱</span>Touche pour ouvrir</button>`;
    m.classList.add('on');
    $('pk').onclick = () => {
      $('pk').classList.add('open');
      this.buzz(40);
      setTimeout(() => {
        const best = got.some((g) => SPECIES_BY_ID[g.id].rarity !== 'commun');
        m.innerHTML = `<div class="mtitle">${best ? 'Belle trouvaille !' : 'Voilà tes graines'}</div><div class="reveal">${got.map((g, k) => {
          const sp = SPECIES_BY_ID[g.id];
          const col = RARITIES[sp.rarity].color;
          return `<div class="rc" style="border-color:${col};animation-delay:${k * 0.35}s">${g.isNew ? '<span class="new">NOUVEAU</span>' : ''}<span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${rarTag(sp)}</div>`;
        }).join('')}</div><button class="btn primary" data-act="closemodal">Au jardin !</button>`;
      }, 520);
    };
  }

  private showBloom(id: string): void {
    const sp = SPECIES_BY_ID[id];
    const d = this.s.disc[id];
    const n = sim.starsOf(d);
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">${n === 1 ? 'Nouvelle espèce dans l\'almanach !' : n === 3 ? 'Spécimen d\'exposition !' : 'Encore plus belle !'}</div>
      <div class="rc solo" style="border-color:${RARITIES[sp.rarity].color}"><span class="e">${EMOJI[id]}</span>${esc(sp.name)}<i>${esc(sp.latin)}</i><span class="st">${stars(n)}</span></div>
      <div class="fact">${esc(sp.fact)}</div>
      <button class="btn primary" data-act="closemodal">Continuer</button>`;
    m.classList.add('on');
    this.buzz(40);
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
      const open = s.zonesOpen[sim.zoneIndexOfSlot(i)];
      el.hidden = !open;
      let cls = 'badge', txt = '';
      if (this.moving >= 0) {
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

    // Haut d'écran
    const col = sim.collection(s);
    const cur = this.scene.currentZone;
    const tabs = [`<button class="tab${cur < 0 ? ' on' : ''}" data-act="view" data-arg="-1">Serre</button>`].concat(ZONES.map((z, r) => {
      const care = s.zonesOpen[r] && [0, 1, 2].some((c) => this.needsCare(r * SLOTS_PER_ZONE + c));
      return `<button class="tab${cur === r ? ' on' : ''}${s.zonesOpen[r] ? '' : ' off'}" data-act="view" data-arg="${r}">${s.zonesOpen[r] ? z.icon : '🔒'} ${ZONE_SHORT[r]}${care ? '<i class="care"></i>' : ''}</button>`;
    })).join('');
    let info = '';
    if (this.moving >= 0) info = `<div class="ticker"><span>Où poser ce pot ?</span><button class="btn small" data-act="cancelmove">Annuler</button></div>`;
    else if (cur >= 0) {
      const c = sim.zoneClimate(s, ZONES[cur]);
      info = `<div class="zinfo"><b>${ZONES[cur].name}</b> ☀️ ${LEVEL_WORDS.light[c.light]} · 🌡️ ${LEVEL_WORDS.temp[c.temp]} · 💧 ${LEVEL_WORDS.hum[c.hum]}</div>`;
    }
    const hud = `<div class="hudrow"><div class="pill coins">🪙 ${fmt(s.coins)}</div><button class="pill" data-act="nav" data-arg="almanac">📖 ${col.bloomed}/${SPECIES.length} <small>⭐ ${col.stars}</small></button></div><div class="tabs">${tabs}</div>${info}`;
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

    // Navigation
    const seeds = Object.values(s.seeds).reduce((a, b) => a + b, 0);
    const wait = Math.max(0, Math.ceil(s.packetIn));
    const timer = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
    const hot = FAMILY_IDS.some((f) => s.market[f].p >= 1.25) && s.stock.length > 0;
    const nav = [
      ['packets', '🎁', s.packets > 0 ? 'Sachets' : timer, s.packets > 0 ? String(s.packets) : '', s.packets > 0 && seeds === 0],
      ['almanac', '📖', 'Almanach', '', false],
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
      default: return '';
    }
    void s;
  }

  private zoneLine(i: number): string {
    const z = sim.zoneOfSlot(i);
    const c = sim.zoneClimate(this.s, z);
    return `<p class="sub">${z.icon} <b>${z.name}</b> : ${LEVEL_WORDS.light[c.light].toLowerCase()}, ${LEVEL_WORDS.temp[c.temp].toLowerCase()}, ${LEVEL_WORDS.hum[c.hum].toLowerCase()}.</p>`;
  }

  private zoneHtml(): string {
    const s = this.s;
    const z = ZONES[this.arg];
    const price = sim.ZONE_PRICES[this.arg];
    const can = s.coins >= price;
    const c = sim.zoneClimate(s, z);
    const fans = SPECIES.filter((sp) => sim.fitOf(sp, c) >= 1 && s.disc[sp.id]?.seen).map((sp) => `${EMOJI[sp.id]} ${sp.name}`);
    return this.head(`${z.icon} ${z.name}`) + `<div class="sh-body">
      <p class="sub">Cette partie de la serre est encore encombrée. Aménage-la pour gagner trois emplacements au climat différent.</p>
      ${this.zoneLine(this.arg * SLOTS_PER_ZONE)}
      <p class="sub">${fans.length ? 'Parfaite pour : ' + fans.join(', ') + '.' : 'Aucune de tes espèces connues n\'y serait parfaitement à l\'aise pour l\'instant.'}</p>
      <button class="btn primary wide" data-act="openzone" ${can ? '' : 'disabled'}>Aménager · ${fmt(price)} 🪙</button>
      ${can ? '' : `<p class="sub center">Il te manque ${fmt(price - s.coins)} 🪙.</p>`}</div>`;
  }

  private buyPotHtml(): string {
    const price = sim.potPrice(this.s);
    const can = this.s.coins >= price;
    return this.head('Emplacement libre') + `<div class="sh-body">${this.zoneLine(this.arg)}
      <p class="sub">Achète un pot pour le poser ici. Tu pourras le déplacer ensuite, avec sa plante, vers n'importe quel emplacement libre.</p>
      <button class="btn primary wide" data-act="buypot" ${can ? '' : 'disabled'}>Acheter un pot · ${fmt(price)} 🪙</button>
      ${can ? '' : `<p class="sub center">Il te manque ${fmt(price - this.s.coins)} 🪙.</p>`}</div>`;
  }

  private seedHtml(): string {
    const s = this.s;
    const c = sim.zoneClimate(s, sim.zoneOfSlot(this.arg));
    const ids = Object.keys(s.seeds).sort((a, b) => sim.fitOf(SPECIES_BY_ID[b], c) - sim.fitOf(SPECIES_BY_ID[a], c));
    const list = ids.map((id) => {
      const sp = SPECIES_BY_ID[id];
      return `<button class="card" data-act="plant" data-arg="${id}"><div class="ico">${EMOJI[id]}</div><div class="mid"><div class="nm">${esc(sp.name)} ${rarTag(sp)}</div>${needsChips(sp, c)}</div><div class="end">×${s.seeds[id]}</div></button>`;
    }).join('');
    const empty = `<p class="sub">Tu n'as plus de graines.</p>${s.packets > 0
      ? '<button class="btn gold wide" data-act="free">🎁 Ouvrir un sachet gratuit</button>'
      : `<button class="btn primary wide" data-act="buypacket" ${s.coins >= sim.PRICES.packet ? '' : 'disabled'}>Sachet mystère · ${sim.PRICES.packet} 🪙</button>`}`;
    return this.head('Que semer ici ?') + `<div class="sh-body">${this.zoneLine(this.arg)}${ids.length ? `<p class="sub">En vert : ce qui convient à cet emplacement.</p>${list}` : empty}<button class="btn wide" data-act="move">✋ Déplacer ce pot</button></div>`;
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
    return this.head(`${EMOJI[sp.id]} ${esc(sp.name)}`) + `<div class="sh-body">
      <div class="kv"><span>${STAGES[sim.stageOf(p.prog)]}</span><b>${p.prog >= 1 ? 'Prête' : 'encore ' + eta}</b></div>
      <div class="prog"><i style="width:${Math.round(p.prog * 100)}%"></i></div>
      <div class="kv"><span>Qualité</span><b>${sim.qualityWord(p.q)}</b></div>
      <div class="kv"><span>Arrosage</span><b>${s.upgrades.water ? 'Automatique' : p.water > 0 ? Math.round(p.water * 100) + ' %' : 'À sec : elle tourne au ralenti'}</b></div>
      ${this.zoneLine(this.arg)}${conditions(sp, c)}
      <div class="row">${s.upgrades.water ? '' : `<button class="btn primary" data-act="water" ${p.water > 0.95 ? 'disabled' : ''}>💧 Arroser</button>`}<button class="btn" data-act="move">✋ Déplacer</button><button class="btn" data-act="fiche" data-arg="${sp.id}">📖 Fiche</button></div></div>`;
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
    return this.head(`${EMOJI[sp.id]} ${esc(sp.name)} en fleur`) + `<div class="sh-body">
      <div class="big">${stars(n)}</div>
      <div class="kv"><span>Ce spécimen</span><b>${sim.qualityWord(p.q)}</b></div>
      <p class="sub">${next}</p>
      <button class="btn primary wide" data-act="sell">Récolter et vendre · ${fmt(sim.saleValue(s, p))} 🪙</button>
      <p class="sub center">Cours ${FAMILIES[sp.family].name.toLowerCase()} : <b class="${level(m.p)}">${mult(m.p)}</b>. ${this.marketHint(m.p)}</p>
      <div class="row"><button class="btn small" data-act="store" ${full ? 'disabled' : ''}>📦 Réserve (${s.stock.length}/${s.stockCap})</button><button class="btn small" data-act="move">✋ Déplacer</button><button class="btn small" data-act="fiche" data-arg="${sp.id}">📖 Fiche</button></div></div>`;
  }

  private packetsHtml(): string {
    const s = this.s;
    const wait = Math.max(0, Math.ceil(s.packetIn));
    const timer = `${Math.floor(wait / 60)} min ${String(wait % 60).padStart(2, '0')}`;
    const seeds = Object.keys(s.seeds).map((id) => {
      const sp = SPECIES_BY_ID[id];
      return `<button class="card" data-act="fiche" data-arg="${id}"><div class="ico">${EMOJI[id]}</div><div class="mid"><div class="nm">${esc(sp.name)} ${rarTag(sp)}</div>${needsChips(sp)}</div><div class="end">×${s.seeds[id]}</div></button>`;
    }).join('');
    return this.head('🎁 Sachets de graines') + `<div class="sh-body">
      <p class="sub">Un sachet gratuit toutes les ${Math.round(sim.PACKET_EVERY / 60)} minutes, même en ton absence. Ils se cumulent jusqu'à ${sim.MAX_PACKETS}.</p>
      <button class="btn gold wide" data-act="free" ${s.packets > 0 ? '' : 'disabled'}>${s.packets > 0 ? `Ouvrir un sachet gratuit (${s.packets})` : `Prochain sachet dans ${timer}`}</button>
      <button class="btn wide" data-act="buypacket" ${s.coins >= sim.PRICES.packet ? '' : 'disabled'}>Sachet mystère · ${sim.PRICES.packet} 🪙</button>
      <h3>Mes graines</h3>${seeds || '<p class="sub">Aucune graine en attente. Touche un pot vide dans la serre pour semer.</p>'}</div>`;
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
      return `<div class="card"><div class="ico">${EMOJI[sp.id]}</div><div class="mid"><div class="nm">${esc(sp.name)}</div><div class="ds">${sim.qualityWord(h.q)} · cours ${mult(s.market[sp.family].p)}</div></div><button class="btn primary small" data-act="sellstock" data-arg="${k}">Vendre ${fmt(sim.saleValue(s, h))} 🪙</button></div>`;
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
    return this.head('🛒 Boutique') + `<div class="sh-body">
      <p class="sub">Tout s'achète avec les pièces gagnées en vendant tes plantes.</p>
      <h3>Équipement</h3>
      ${item('🚿', 'Arrosage automatique', 'Plus jamais de pot à sec, même en ton absence.', sim.PRICES.water, 'upgrade', 'water', s.upgrades.water)}
      ${item('🐞', 'Lâcher de coccinelles', 'Elles mangent les pucerons à ta place.', sim.PRICES.bugs, 'upgrade', 'bugs', s.upgrades.bugs)}
      ${item('🌫️', 'Brumisateur', 'L\'ombre de l\'étagère devient humide : idéal pour les fougères.', sim.PRICES.mist, 'upgrade', 'mist', s.upgrades.mist)}
      ${s.stockCap < 10 ? item('📦', 'Réserve agrandie', `Deux places de plus (${s.stockCap} aujourd'hui).`, sim.PRICES.stock, 'upgrade', 'stock') : ''}
      <h3>Graines</h3>
      ${item('🎁', 'Sachet mystère', 'Trois graines de toutes familles.', sim.PRICES.packet, 'buypacket', '')}
      ${FAMILY_IDS.map((f) => item(FAMILIES[f].icon, `Sachet ${FAMILIES[f].name.toLowerCase()}`, 'Trois graines de cette famille.', sim.PRICES.familyPacket, 'buypacket', f)).join('')}
      <p class="sub">Pour un nouveau pot ou une nouvelle zone, touche un emplacement libre ou un cadenas dans la serre.</p></div>`;
  }

  private almanacHtml(): string {
    const s = this.s;
    const col = sim.collection(s);
    const cells = SPECIES.map((sp) => {
      const d = s.disc[sp.id];
      if (!d?.seen) return '<div class="sp locked"><span class="e">❔</span>???</div>';
      return `<button class="sp" data-act="fiche" data-arg="${sp.id}" style="border-color:${RARITIES[sp.rarity].color}55"><span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${d.bloomed ? `<span class="st">${stars(sim.starsOf(d))}</span>` : '<span class="chip">à faire fleurir</span>'}</button>`;
    }).join('');
    return this.head('📖 Almanach') + `<div class="sh-body">
      <div class="big">${col.bloomed} / ${SPECIES.length}</div>
      <p class="sub center">espèces fleuries · ⭐ ${col.stars} sur ${SPECIES.length * 3}</p>
      <p class="sub">Chaque floraison ajoute l'espèce à ta collection. Les plus beaux spécimens gagnent jusqu'à trois étoiles.</p>
      <div class="grid">${cells}</div>
      <div class="kv"><span>Plantes vendues</span><b>${fmt(s.stats.sold)}</b></div>
      <div class="kv"><span>Pièces gagnées</span><b>${fmt(s.stats.earned)} 🪙</b></div>
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
      <p class="sub">Idéal : ${ZONES.filter((z) => sim.fitOf(sp, sim.zoneClimate(this.s, z)) >= 1).map((z) => z.name).join(', ') || 'aucun coin parfait pour l\'instant, cherche le moins mauvais ou équipe la serre'}.</p>
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
