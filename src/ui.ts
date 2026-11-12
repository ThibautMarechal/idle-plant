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

type SheetKind = 'none' | 'seed' | 'buypot' | 'plant' | 'harvest' | 'packets' | 'market' | 'shop' | 'almanac' | 'fiche';

const $ = (id: string) => document.getElementById(id)!;
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
const mult = (p: number) => '×' + p.toFixed(2).replace('.', ',');
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
  private zoneEls: HTMLElement[] = [];
  private toastTimer = 0;
  private resetAskedAt = 0;

  constructor(private s: State, private scene: Scene3D, private onReset: () => void) {
    const overlay = $('overlay');
    ZONES.forEach((z, r) => {
      const el = document.createElement('div');
      el.className = 'zlabel';
      el.textContent = `${z.icon} ${ZONE_SHORT[r]}`;
      el.onclick = () => this.toast(`${z.name} : ${z.desc.toLowerCase()}.`);
      overlay.appendChild(el);
      this.zoneEls.push(el);
    });
    this.s.slots.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'slot';
      b.innerHTML = '<div class="badge hidden"></div><div class="bar"><i></i></div>';
      b.onclick = () => this.tapSlot(i);
      overlay.appendChild(b);
      this.slotEls.push(b);
    });
    const app = $('app');
    app.addEventListener('pointerdown', () => { this.pointerDown = true; });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) app.addEventListener(ev, () => { this.pointerDown = false; });
    app.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (t && !t.hasAttribute('disabled')) this.act(t.dataset.act!, t.dataset.arg ?? '');
    });
    $('backdrop').onclick = () => this.close();
    this.lastNewsT = this.s.news[0]?.t ?? 0;
  }

  setState(s: State): void {
    this.s = s;
    this.close();
  }

  // ---------- interactions ----------

  private tapSlot(i: number): void {
    const slot = this.s.slots[i];
    const p = slot.plant;
    if (!slot.pot) return this.open('buypot', i);
    if (!p) return this.open('seed', i);
    if (p.pests > 0) {
      sim.squash(this.s, i);
      this.scene.pop(i);
      this.float(i, p.pests > 0 ? '🐛' : '✨ Propre !');
      this.buzz(15);
      return;
    }
    if (p.prog >= 1) return this.open('harvest', i);
    if (p.water < 0.5 && !this.s.upgrades.water) {
      sim.water(this.s, i);
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

  // ---------- rendu ----------

  refresh(force = false): void {
    const s = this.s;
    // Emplacements
    s.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      const r = this.scene.slotRect(i);
      const hgt = r.bottom - r.top;
      el.style.left = r.x + 'px';
      el.style.top = r.top + 'px';
      el.style.width = r.unit * 1.5 + 'px';
      el.style.height = hgt + 'px';
      const badge = el.firstElementChild as HTMLElement;
      const bar = el.lastElementChild as HTMLElement;
      const p = slot.plant;
      let cls = 'badge', txt = '';
      if (!slot.pot) {
        const price = sim.potPrice(s);
        cls += ' price' + (s.coins >= price ? ' can' : '');
        txt = `+ ${fmt(price)}🪙`;
        badge.style.marginTop = hgt * 0.52 + 'px';
      } else {
        badge.style.marginTop = '0px';
        if (!p) { cls += ' plus'; txt = '+'; badge.style.marginTop = hgt * 0.25 + 'px'; }
        else if (p.pests > 0) { cls += ' alert'; txt = '🐛'.repeat(p.pests); }
        else if (p.prog >= 1) { cls += ' ready'; txt = '🪙'; }
        else if (p.water < 0.5 && !s.upgrades.water) { cls += ' alert'; txt = '💧'; }
        else cls += ' hidden';
      }
      if (badge.className !== cls) badge.className = cls;
      if (badge.textContent !== txt) badge.textContent = txt;
      const showBar = !!p && p.prog < 1;
      bar.style.display = showBar ? 'block' : 'none';
      if (showBar) {
        bar.className = 'bar' + (p!.water <= 0 ? ' dry' : '');
        (bar.firstElementChild as HTMLElement).style.width = Math.round(p!.prog * 100) + '%';
      }
    });
    this.zoneEls.forEach((el, r) => { el.style.top = this.scene.zoneLabelY(r) + 'px'; });

    // Haut d'écran
    const news = s.news[0];
    const hud = `<div class="hudrow"><div class="pill coins">🪙 ${fmt(s.coins)}</div><div class="title">LE GRAINIER</div></div>` +
      (news ? `<button class="ticker" data-act="nav" data-arg="market"><b class="${news.dir > 0 ? 'up' : 'down'}">${FAMILIES[news.family].icon}${news.dir > 0 ? '▲' : '▼'}</b><span>${esc(news.text)}</span></button>` : '');
    if (hud !== this.lastHud) { $('hud').innerHTML = hud; this.lastHud = hud; }
    if (news && news.t !== this.lastNewsT) {
      this.lastNewsT = news.t;
      document.querySelector('.ticker')?.classList.add('flash');
      this.buzz(15);
    }

    // Objectif
    const q = sim.currentQuest(s);
    const qh = q ? `<div class="qt"><small>Objectif</small>${esc(q.text)}</div>${q.done(s)
      ? `<button class="btn gold small" data-act="quest">+${q.reward} 🪙</button>`
      : `<span class="chip">+${q.reward} 🪙</span>`}` : '';
    if (qh !== this.lastQuest && (force || !this.pointerDown)) { $('quest').innerHTML = qh; this.lastQuest = qh; }

    // Navigation
    const seeds = Object.values(s.seeds).reduce((a, b) => a + b, 0);
    const ripe = s.stock.length;
    const nav = [
      ['packets', '🎁', 'Sachets', s.packets > 0 ? String(s.packets) : seeds > 0 ? '' : '', s.packets > 0 && seeds === 0],
      ['market', '📈', 'Marché', ripe > 0 ? String(ripe) : '', false],
      ['shop', '🛒', 'Boutique', '', false],
      ['almanac', '📖', 'Almanach', '', false],
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
      default: return '';
    }
    void s;
  }

  private zoneLine(i: number): string {
    const z = sim.zoneOfSlot(i);
    const c = sim.zoneClimate(this.s, z);
    return `<p class="sub">${z.icon} <b>${z.name}</b> : ${LEVEL_WORDS.light[c.light].toLowerCase()}, ${LEVEL_WORDS.temp[c.temp].toLowerCase()}, ${LEVEL_WORDS.hum[c.hum].toLowerCase()}.</p>`;
  }

  private buyPotHtml(): string {
    const price = sim.potPrice(this.s);
    const can = this.s.coins >= price;
    return this.head('Nouveau pot') + `<div class="sh-body">${this.zoneLine(this.arg)}
      <p class="sub">Chaque coin de la serre a son climat. Choisis l'emplacement selon les plantes que tu veux y cultiver.</p>
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
    return this.head('Que semer ici ?') + `<div class="sh-body">${this.zoneLine(this.arg)}${ids.length ? `<p class="sub">En vert : ce qui convient à cet emplacement.</p>${list}` : empty}</div>`;
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
      <div class="row">${s.upgrades.water ? '' : `<button class="btn primary" data-act="water" ${p.water > 0.95 ? 'disabled' : ''}>💧 Arroser</button>`}<button class="btn" data-act="fiche" data-arg="${sp.id}">📖 Fiche</button></div></div>`;
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
    return this.head(`${EMOJI[sp.id]} ${esc(sp.name)} en fleur`) + `<div class="sh-body">
      <div class="big">${fmt(sim.saleValue(s, p))} 🪙</div>
      <div class="kv"><span>Qualité</span><b>${sim.qualityWord(p.q)} (${mult(sim.qualityMult(p.q))})</b></div>
      <div class="kv"><span>Cours ${FAMILIES[sp.family].name.toLowerCase()}</span><b class="${level(m.p)}">${mult(m.p)} ${trend(m.hist).arrow}</b></div>
      <p class="sub center">${this.marketHint(m.p)}</p>
      <button class="btn primary wide" data-act="sell">Vendre maintenant</button>
      <button class="btn wide" data-act="store" ${full ? 'disabled' : ''}>📦 Garder en réserve (${s.stock.length}/${s.stockCap})</button></div>`;
  }

  private packetsHtml(): string {
    const s = this.s;
    const now = new Date();
    const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const hh = Math.floor(mid / 3600000), mm = Math.floor((mid % 3600000) / 60000);
    const seeds = Object.keys(s.seeds).map((id) => {
      const sp = SPECIES_BY_ID[id];
      return `<button class="card" data-act="fiche" data-arg="${id}"><div class="ico">${EMOJI[id]}</div><div class="mid"><div class="nm">${esc(sp.name)} ${rarTag(sp)}</div>${needsChips(sp)}</div><div class="end">×${s.seeds[id]}</div></button>`;
    }).join('');
    return this.head('🎁 Sachets de graines') + `<div class="sh-body">
      <p class="sub">Un sachet gratuit chaque jour. Ils se cumulent jusqu'à ${sim.MAX_PACKETS} si tu rates un jour.</p>
      <button class="btn gold wide" data-act="free" ${s.packets > 0 ? '' : 'disabled'}>${s.packets > 0 ? `Ouvrir un sachet gratuit (${s.packets})` : `Prochain sachet dans ${hh} h ${String(mm).padStart(2, '0')}`}</button>
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
      <p class="sub">Le prix de vente suit le cours de la famille. ×1,00 est le prix normal.</p>${rows}
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
      <p class="sub">Pour un nouveau pot, touche un emplacement libre dans la serre.</p></div>`;
  }

  private almanacHtml(): string {
    const s = this.s;
    const seen = SPECIES.filter((sp) => s.disc[sp.id]?.seen).length;
    const cells = SPECIES.map((sp) => {
      const d = s.disc[sp.id];
      if (!d?.seen) return '<div class="sp locked"><span class="e">❔</span>???</div>';
      return `<button class="sp" data-act="fiche" data-arg="${sp.id}" style="border-color:${RARITIES[sp.rarity].color}55"><span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${d.bloomed ? '' : '<span class="chip">à faire fleurir</span>'}</button>`;
    }).join('');
    return this.head('📖 Almanach') + `<div class="sh-body">
      <p class="sub">${seen} espèces découvertes sur ${SPECIES.length}. Fais fleurir une plante pour compléter sa fiche.</p>
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
      <div>${rarTag(sp)}</div>
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
