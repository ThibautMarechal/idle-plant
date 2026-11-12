import { FAMILY_IDS, NEWS, RARITIES, SLOT_COUNT, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, ZONES } from './data';
import type { Family, Rarity, Species, Zone } from './data';

/** `vr` : variante, 0 normale, 1 panachée, 2 dorée. */
export interface Plant { sp: string; prog: number; water: number; pests: number; q: number; vr: number }
export interface Slot { pot: boolean; plant: Plant | null }
export interface Harvest { sp: string; q: number; vr: number }
export interface MarketLine { p: number; hist: number[]; drift: number; driftLeft: number }
export interface NewsItem { t: number; family: Family; dir: 1 | -1; text: string }
export interface Upgrades { water: boolean; bugs: boolean; mist: boolean; lamp: boolean; heat: boolean; fan: boolean }
export type ClimateGear = 'mist' | 'lamp' | 'heat' | 'fan';
export interface Disc { seen: boolean; bloomed: boolean; sold: number; bestQ: number; vars: boolean[] }

export interface State {
  v: number;
  coins: number;
  slots: Slot[];
  seeds: Record<string, number>;
  stock: Harvest[];
  stockCap: number;
  packets: number;
  /** Secondes avant le prochain sachet gratuit. */
  packetIn: number;
  /** Zones aménagées, dans l'ordre de ZONES. */
  zonesOpen: boolean[];
  /** Espèces dont la fiche vient de progresser, en attente d'être fêtées par l'interface. */
  fresh: string[];
  moved: number;
  /** Vitrine : spécimens exposés aux visiteurs. */
  showcase: (Harvest | null)[];
  tips: number;
  visitors: number;
  /** Doses d'engrais, obtenues en compostant des graines. */
  fert: number;
  composted: number;
  /** Équipements climatiques éteints par le joueur. */
  off: Partial<Record<ClimateGear, boolean>>;
  /** Décor choisi pour l'espace de culture (purement visuel). */
  theme?: string;
  market: Record<Family, MarketLine>;
  marketAcc: number;
  news: NewsItem[];
  newsIn: number;
  bugAcc: number;
  upgrades: Upgrades;
  disc: Record<string, Disc>;
  quests: Record<string, boolean>;
  stats: { sold: number; earned: number; bestMult: number; planted: number; opened: number };
  lastTick: number;
}

export const SAVE_VERSION = 3;
export const VARIANTS = ['', 'panachée', 'dorée'];
export const VARIANT_MULT = [1, 2.5, 6];
export const VARIANT_ODDS = [0.08, 0.015];
export const SHOWCASE_SIZE = 4;
export const TIP_RATE = 0.0004;
export const TIP_CAP_SECONDS = 1800;
export const MARKET_TICK = 20; // secondes
export const NEWS_EVERY = 210;
export const WATER_DURATION = 160;
export const PRICE_MIN = 0.5;
export const PRICE_MAX = 2.0;
export const PACKET_SIZE = 3;
export const MAX_PACKETS = 3;
export const PACKET_EVERY = 300;
export const ZONE_PRICES = [150, 400, 0, 0];
export const MAX_OFFLINE = 12 * 3600;

export const PRICES = {
  packet: 60,
  familyPacket: 110,
  water: 300,
  bugs: 450,
  mist: 350,
  lamp: 500,
  heat: 450,
  fan: 400,
  stock: 250,
};

export type Rng = () => number;

export function newState(now: number): State {
  const slots: Slot[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) slots.push({ pot: i === 7 || i === 9 || i === 10, plant: null });
  const market = {} as Record<Family, MarketLine>;
  for (const f of FAMILY_IDS) market[f] = { p: 1, hist: [1, 1], drift: 0, driftLeft: 0 };
  return {
    v: SAVE_VERSION,
    coins: 50,
    slots,
    seeds: {},
    stock: [],
    stockCap: 4,
    packets: 2,
    packetIn: PACKET_EVERY,
    zonesOpen: ZONE_PRICES.map((p) => p === 0),
    fresh: [],
    moved: 0,
    market,
    marketAcc: 0,
    news: [],
    newsIn: 45,
    bugAcc: 0,
    upgrades: { water: false, bugs: false, mist: false, lamp: false, heat: false, fan: false },
    showcase: Array.from({ length: SHOWCASE_SIZE }, () => null),
    tips: 0,
    visitors: 0,
    fert: 1,
    composted: 0,
    off: {},
    disc: {},
    quests: {},
    stats: { sold: 0, earned: 0, bestMult: 0, planted: 0, opened: 0 },
    lastTick: now,
  };
}

export function zoneOfSlot(i: number): Zone {
  return ZONES[Math.floor(i / SLOTS_PER_ZONE)];
}

export function gearOn(s: State, g: ClimateGear): boolean {
  return s.upgrades[g] && !s.off[g];
}

/** Climat d'une zone, équipements allumés compris. */
export function zoneClimate(s: State, z: Zone): { light: number; temp: number; hum: number } {
  const c = { light: z.light, temp: z.temp, hum: z.hum };
  if (z.id === 'ombre' && gearOn(s, 'mist')) c.hum = 3;
  if (z.id === 'porte' && gearOn(s, 'lamp')) c.light = 3;
  if (z.id === 'porte' && gearOn(s, 'heat')) c.temp = 2;
  if (z.id === 'sud' && gearOn(s, 'fan')) c.temp = 2;
  return c;
}

/** Adéquation 0..1 entre une espèce et un climat. */
export function fitOf(sp: Species, c: { light: number; temp: number; hum: number }): number {
  const miss = Math.abs(sp.light - c.light) + Math.abs(sp.temp - c.temp) + Math.abs(sp.hum - c.hum);
  return [1, 0.8, 0.6, 0.45, 0.35, 0.3, 0.3][miss];
}

export function stageOf(prog: number): number {
  return Math.min(4, Math.floor(prog * 4 + 1e-9));
}

export function qualityWord(q: number): string {
  if (q >= 90) return 'Spécimen d\'exposition';
  if (q >= 75) return 'Superbe';
  if (q >= 55) return 'Beau';
  if (q >= 35) return 'Correct';
  return 'Chétif';
}

export function qualityMult(q: number): number {
  return 0.5 + q / 100;
}

export function saleValue(s: State, h: Harvest): number {
  const sp = SPECIES_BY_ID[h.sp];
  return Math.max(1, Math.round(sp.value * qualityMult(h.q) * VARIANT_MULT[h.vr ?? 0] * s.market[sp.family].p));
}

export function potPrice(s: State): number {
  const n = s.slots.filter((x) => x.pot).length;
  return Math.round(25 * Math.pow(1.38, Math.max(0, n - 3)));
}

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function stepPlants(s: State, dt: number, rng: Rng, offline: boolean): void {
  s.bugAcc += dt;
  const bugKill = s.upgrades.bugs && s.bugAcc >= 8;
  if (s.bugAcc >= 8) s.bugAcc = 0;
  s.slots.forEach((slot, i) => {
    const p = slot.plant;
    if (!p) return;
    const sp = SPECIES_BY_ID[p.sp];
    const fit = fitOf(sp, zoneClimate(s, zoneOfSlot(i)));
    if (s.upgrades.water) p.water = 1;
    else p.water = Math.max(0, p.water - dt / WATER_DURATION);
    const wet = p.water > 0;
    if (p.prog < 1) {
      // Jamais de plante morte : sans eau ou infestée, elle tourne au ralenti.
      const speed = fit * (wet ? 1 : 0.25) * (p.pests > 0 ? 0.5 : 1);
      p.prog = Math.min(1, p.prog + (dt / sp.grow) * speed);
      const target = 100 * fit * (wet ? 1 : 0.6) * (p.pests > 0 ? 0.5 : 1);
      p.q += (target - p.q) * Math.min(1, (dt / sp.grow) * 2.2);
      if (p.prog >= 1) {
        const d = discOf(s, p.sp);
        const before = starsOf(d);
        d.bloomed = true;
        d.bestQ = Math.max(d.bestQ, p.q);
        const newVar = !d.vars[p.vr];
        d.vars[p.vr] = true;
        if (starsOf(d) > before || newVar) s.fresh.push(`${p.sp}:${p.vr}`);
      }
    } else if (p.pests > 0) {
      p.q = Math.max(10, p.q - dt * 0.05);
    }
    if (p.pests === 0 && p.prog > 0.15) {
      const rate = (offline ? 0.25 : 1) * (1.6 - fit) / 260;
      if (rng() < 1 - Math.exp(-rate * dt)) p.pests = 3;
    } else if (p.pests > 0 && bugKill) {
      p.pests--;
    }
  });
}

function marketTick(s: State, rng: Rng): void {
  for (const f of FAMILY_IDS) {
    const m = s.market[f];
    let d = (1 - m.p) * 0.05 + (rng() - 0.5) * 0.08;
    if (m.driftLeft > 0) {
      d += m.drift;
      m.driftLeft--;
    }
    m.p = clamp(m.p + d, PRICE_MIN, PRICE_MAX);
    m.hist.push(m.p);
    if (m.hist.length > 48) m.hist.shift();
  }
}

function fireNews(s: State, now: number, rng: Rng): void {
  const last = s.news[0];
  let tpl = NEWS[Math.floor(rng() * NEWS.length)];
  for (let k = 0; k < 6 && last && tpl.text === last.text; k++) tpl = NEWS[Math.floor(rng() * NEWS.length)];
  const m = s.market[tpl.family];
  const strength = 0.35 + rng() * 0.3;
  const ticks = 5;
  m.drift = (tpl.dir * strength) / ticks;
  m.driftLeft = ticks;
  s.news.unshift({ t: now, family: tpl.family, dir: tpl.dir, text: tpl.text });
  if (s.news.length > 12) s.news.pop();
}

/** Avance la simulation jusqu'à `now`. Renvoie les secondes simulées. */
export function advance(s: State, now: number, rng: Rng = Math.random): number {
  let dt = (now - s.lastTick) / 1000;
  s.lastTick = now;
  if (dt <= 0) return 0;
  dt = Math.min(dt, MAX_OFFLINE);
  const total = dt;
  const offline = dt > 30;
  const step = Math.max(1, dt / 1500);
  while (dt > 0) {
    const h = Math.min(step, dt);
    dt -= h;
    stepPlants(s, h, rng, offline);
    s.marketAcc += h;
    while (s.marketAcc >= MARKET_TICK) {
      s.marketAcc -= MARKET_TICK;
      marketTick(s, rng);
    }
    s.newsIn -= h;
    if (s.newsIn <= 0) {
      s.newsIn += NEWS_EVERY * (0.8 + rng() * 0.4);
      fireNews(s, now - dt * 1000, rng);
    }
  }
  // Vitrine : les visiteurs laissent des pourboires, plafonnés pour donner une raison de repasser.
  const rate = showcaseRate(s);
  if (rate > 0) {
    s.tips = Math.min(rate * TIP_CAP_SECONDS, s.tips + rate * total);
    s.visitors += (total / 20) * s.showcase.filter(Boolean).length * (0.5 + rng());
  }
  if (s.packets >= MAX_PACKETS) {
    s.packetIn = PACKET_EVERY;
  } else {
    s.packetIn -= total;
    while (s.packetIn <= 0 && s.packets < MAX_PACKETS) {
      s.packets++;
      s.packetIn += PACKET_EVERY;
    }
    if (s.packets >= MAX_PACKETS) s.packetIn = PACKET_EVERY;
  }
  return total;
}

export function discOf(s: State, id: string): Disc {
  return (s.disc[id] ??= { seen: false, bloomed: false, sold: 0, bestQ: 0, vars: [false, false, false] });
}

/** Étoiles d'une fiche : 1 à la première floraison, 2 pour un beau spécimen, 3 pour un spécimen d'exposition. */
export function starsOf(d: Disc | undefined): number {
  if (!d || !d.bloomed) return 0;
  return d.bestQ >= 88 ? 3 : d.bestQ >= 70 ? 2 : 1;
}

/** Pourboires par seconde rapportés par la vitrine. */
export function showcaseRate(s: State): number {
  return s.showcase.reduce((a, h) => a + (h ? SPECIES_BY_ID[h.sp].value * qualityMult(h.q) * VARIANT_MULT[h.vr] * TIP_RATE : 0), 0);
}

export function collection(s: State): { seen: number; bloomed: number; stars: number; variants: number } {
  const all = Object.values(s.disc);
  return {
    variants: all.reduce((a, d) => a + (d.vars[1] ? 1 : 0) + (d.vars[2] ? 1 : 0), 0),
    seen: all.filter((d) => d.seen).length,
    bloomed: all.filter((d) => d.bloomed).length,
    stars: all.reduce((a, d) => a + starsOf(d), 0),
  };
}

function rollRarity(rng: Rng): Rarity {
  let r = rng() * 100;
  for (const k of Object.keys(RARITIES) as Rarity[]) {
    r -= RARITIES[k].weight;
    if (r < 0) return k;
  }
  return 'commun';
}

/** Tire les graines d'un sachet. Le contenu penche vers les familles dont le cours est haut. */
export function rollSeeds(s: State, rng: Rng, family?: Family): string[] {
  const out: string[] = [];
  for (let i = 0; i < PACKET_SIZE; i++) {
    let pool: Species[] = [];
    let rar = rollRarity(rng);
    for (let k = 0; k < 4 && pool.length === 0; k++) {
      pool = SPECIES.filter((sp) => sp.rarity === rar && (!family || sp.family === family));
      if (pool.length === 0) rar = 'commun';
    }
    if (pool.length === 0) pool = SPECIES.filter((sp) => sp.family === family);
    const w = pool.map((sp) => Math.pow(s.market[sp.family].p, 1.5));
    let r = rng() * w.reduce((a, b) => a + b, 0);
    let pick = pool[0];
    for (let j = 0; j < pool.length; j++) {
      r -= w[j];
      if (r < 0) { pick = pool[j]; break; }
    }
    out.push(pick.id);
  }
  return out;
}

function grant(s: State, ids: string[]): { id: string; isNew: boolean }[] {
  return ids.map((id) => {
    const d = discOf(s, id);
    const isNew = !d.seen;
    d.seen = true;
    s.seeds[id] = (s.seeds[id] ?? 0) + 1;
    return { id, isNew };
  });
}

export function openFreePacket(s: State, rng: Rng = Math.random) {
  if (s.packets <= 0) return null;
  s.packets--;
  s.stats.opened++;
  // Le tout premier sachet garantit de quoi démarrer dans de bonnes conditions.
  const ids = s.stats.opened === 1 ? ['basilic', 'menthe', 'pensee'] : rollSeeds(s, rng);
  return grant(s, ids);
}

export function buyPacket(s: State, rng: Rng = Math.random, family?: Family) {
  const price = family ? PRICES.familyPacket : PRICES.packet;
  if (s.coins < price) return null;
  s.coins -= price;
  s.stats.opened++;
  return grant(s, rollSeeds(s, rng, family));
}

export function plantSeed(s: State, i: number, id: string, rng: Rng = Math.random): boolean {
  const slot = s.slots[i];
  if (!slot.pot || slot.plant || !(s.seeds[id] > 0)) return false;
  discOf(s, id).seen = true;
  s.seeds[id]--;
  if (s.seeds[id] === 0) delete s.seeds[id];
  const r = rng();
  const vr = r < VARIANT_ODDS[1] ? 2 : r < VARIANT_ODDS[1] + VARIANT_ODDS[0] ? 1 : 0;
  slot.plant = { sp: id, prog: 0, water: 1, pests: 0, q: 50, vr };
  s.stats.planted++;
  return true;
}

export function water(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  if (!p || p.water > 0.95) return false;
  p.water = 1;
  return true;
}

export function squash(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  if (!p || p.pests <= 0) return false;
  p.pests--;
  return true;
}

function sell(s: State, h: Harvest): number {
  const sp = SPECIES_BY_ID[h.sp];
  const m = s.market[sp.family];
  const gain = saleValue(s, h);
  s.coins += gain;
  s.stats.sold++;
  s.stats.earned += gain;
  s.stats.bestMult = Math.max(s.stats.bestMult, m.p);
  discOf(s, h.sp).sold++;
  // L'offre du joueur pèse (légèrement) sur le cours de la famille.
  m.p = clamp(m.p - 0.025, PRICE_MIN, PRICE_MAX);
  return gain;
}

export function harvestSell(s: State, i: number): number {
  const p = s.slots[i].plant;
  if (!p || p.prog < 1) return 0;
  s.slots[i].plant = null;
  return sell(s, { sp: p.sp, q: p.q, vr: p.vr });
}

export function harvestStore(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  if (!p || p.prog < 1 || s.stock.length >= s.stockCap) return false;
  s.slots[i].plant = null;
  s.stock.push({ sp: p.sp, q: p.q, vr: p.vr });
  return true;
}

/** Expose une plante en fleur dans la vitrine. */
export function harvestShow(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  const k = s.showcase.findIndex((h) => !h);
  if (!p || p.prog < 1 || k < 0) return false;
  s.slots[i].plant = null;
  s.showcase[k] = { sp: p.sp, q: p.q, vr: p.vr };
  return true;
}

/** Retire un spécimen de la vitrine et le vend. */
export function sellShowcase(s: State, k: number): number {
  const h = s.showcase[k];
  if (!h) return 0;
  s.showcase[k] = null;
  return sell(s, h);
}

export function collectTips(s: State): number {
  const n = Math.floor(s.tips);
  s.tips -= n;
  s.coins += n;
  s.stats.earned += n;
  return n;
}

/** Composte une graine en trop : elle devient une dose d'engrais. */
export function compost(s: State, id: string): boolean {
  if (!(s.seeds[id] > 0)) return false;
  s.seeds[id]--;
  if (s.seeds[id] === 0) delete s.seeds[id];
  s.fert++;
  s.composted++;
  return true;
}

/** Une dose d'engrais fait gagner un quart de la croissance. */
export function fertilize(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  if (!p || p.prog >= 1 || s.fert <= 0) return false;
  s.fert--;
  p.prog = Math.min(0.999, p.prog + 0.25);
  return true;
}

export function toggleGear(s: State, g: ClimateGear): void {
  if (s.upgrades[g]) s.off[g] = !s.off[g];
}

export function sellStock(s: State, k: number): number {
  const h = s.stock[k];
  if (!h) return 0;
  s.stock.splice(k, 1);
  return sell(s, h);
}

export function zoneIndexOfSlot(i: number): number {
  return Math.floor(i / SLOTS_PER_ZONE);
}

/** Déplace un pot (et sa plante) vers un autre emplacement ; échange si la cible est occupée. */
export function movePot(s: State, from: number, to: number): boolean {
  if (from === to || !s.slots[from].pot || !s.zonesOpen[zoneIndexOfSlot(to)]) return false;
  const tmp = s.slots[to];
  s.slots[to] = s.slots[from];
  s.slots[from] = tmp;
  s.moved++;
  return true;
}

/** Aménage une nouvelle zone de la serre. */
export function openZone(s: State, z: number): boolean {
  const price = ZONE_PRICES[z];
  if (s.zonesOpen[z] || s.coins < price) return false;
  s.coins -= price;
  s.zonesOpen[z] = true;
  return true;
}

export function buyPot(s: State, i: number): boolean {
  const price = potPrice(s);
  if (s.slots[i].pot || s.coins < price || !s.zonesOpen[zoneIndexOfSlot(i)]) return false;
  s.coins -= price;
  s.slots[i].pot = true;
  return true;
}

export function buyUpgrade(s: State, k: keyof Upgrades | 'stock'): boolean {
  if (!(k in PRICES)) return false;
  const price = PRICES[k];
  if (s.coins < price) return false;
  if (k === 'stock') {
    if (s.stockCap >= 10) return false;
    s.stockCap += 2;
  } else {
    if (s.upgrades[k]) return false;
    s.upgrades[k] = true;
  }
  s.coins -= price;
  return true;
}

export interface Quest { id: string; text: string; reward: number; done: (s: State) => boolean }
export const QUESTS: Quest[] = [
  { id: 'open', text: 'Ouvre ton premier sachet de graines', reward: 10, done: (s) => s.stats.opened >= 1 },
  { id: 'plant', text: 'Sème une graine dans un pot', reward: 10, done: (s) => s.stats.planted >= 1 },
  { id: 'bloom1', text: 'Fais fleurir ta première plante', reward: 20, done: (s) => collection(s).bloomed >= 1 },
  { id: 'move', text: 'Déplace un pot vers un meilleur emplacement', reward: 20, done: (s) => s.moved >= 1 },
  { id: 'compost', text: 'Composte une graine en trop pour obtenir de l\'engrais', reward: 20, done: (s) => s.composted >= 1 },
  { id: 'bloom3', text: 'Ajoute 3 espèces à l\'almanach', reward: 50, done: (s) => collection(s).bloomed >= 3 },
  { id: 'zone1', text: 'Aménage une nouvelle zone de la serre', reward: 60, done: (s) => s.zonesOpen.filter(Boolean).length >= 3 },
  { id: 'show', text: 'Expose une plante en fleur dans la vitrine', reward: 60, done: (s) => s.showcase.some(Boolean) },
  { id: 'star3', text: 'Obtiens un spécimen d\'exposition ⭐⭐⭐', reward: 80, done: (s) => Object.values(s.disc).some((d) => starsOf(d) >= 3) },
  { id: 'bloom6', text: 'Ajoute 6 espèces à l\'almanach', reward: 100, done: (s) => collection(s).bloomed >= 6 },
  { id: 'rare', text: 'Fais fleurir une plante rare', reward: 120,
    done: (s) => Object.entries(s.disc).some(([id, d]) => d.bloomed && SPECIES_BY_ID[id].rarity !== 'commun') },
  { id: 'gear', text: 'Installe un équipement dans la serre', reward: 100, done: (s) => Object.values(s.upgrades).some(Boolean) },
  { id: 'variant', text: 'Fais fleurir une variante panachée ou dorée', reward: 150, done: (s) => collection(s).variants >= 1 },
  { id: 'zone2', text: 'Aménage toute la serre', reward: 150, done: (s) => s.zonesOpen.every(Boolean) },
  { id: 'stars20', text: 'Cumule 20 étoiles dans l\'almanach', reward: 250, done: (s) => collection(s).stars >= 20 },
  { id: 'bloom10', text: 'Ajoute 10 espèces à l\'almanach', reward: 300, done: (s) => collection(s).bloomed >= 10 },
  { id: 'show4', text: 'Remplis la vitrine', reward: 300, done: (s) => s.showcase.every(Boolean) },
  { id: 'bloom20', text: 'Ajoute 20 espèces à l\'almanach', reward: 600, done: (s) => collection(s).bloomed >= 20 },
  { id: 'stars60', text: 'Cumule 60 étoiles dans l\'almanach', reward: 800, done: (s) => collection(s).stars >= 60 },
  { id: 'disc14', text: 'Complète l\'almanach', reward: 1000, done: (s) => collection(s).bloomed >= SPECIES.length },
];

export function currentQuest(s: State): Quest | null {
  return QUESTS.find((q) => !s.quests[q.id]) ?? null;
}

export function claimQuest(s: State): number {
  const q = currentQuest(s);
  if (!q || !q.done(s)) return 0;
  s.quests[q.id] = true;
  s.coins += q.reward;
  return q.reward;
}

const KEY = 'grainier-save-v1';
export function save(s: State): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
}
export function load(now: number): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.v === 1 && Array.isArray(s.slots) && s.slots.length === SLOT_COUNT) {
        // Sauvegarde de la première version : on garde tout et on ouvre les zones déjà utilisées.
        s.v = SAVE_VERSION;
        s.packetIn = PACKET_EVERY;
        s.fresh = [];
        s.moved = 0;
        s.quests = {};
        s.zonesOpen = ZONE_PRICES.map((p, z) => p === 0 || s.slots.slice(z * SLOTS_PER_ZONE, (z + 1) * SLOTS_PER_ZONE).some((x) => x.pot));
        for (const d of Object.values(s.disc)) d.bestQ = d.bloomed ? 60 : 0;
      }
      if (s.v === 2 && Array.isArray(s.slots) && s.slots.length === SLOT_COUNT) {
        // Sauvegarde de la deuxième version : on complète avec les nouveautés.
        const base = newState(now);
        Object.assign(s, { ...base, ...s, v: SAVE_VERSION, market: { ...base.market, ...s.market }, upgrades: { ...base.upgrades, ...s.upgrades } });
        for (const sl of s.slots) if (sl.plant) sl.plant.vr = 0;
        for (const h of s.stock) h.vr = 0;
        for (const d of Object.values(s.disc)) d.vars = [d.bloomed, false, false];
      }
      if (s.v === SAVE_VERSION && Array.isArray(s.slots) && s.slots.length === SLOT_COUNT) return s;
    }
  } catch { /* sauvegarde illisible : on repart de zéro */ }
  return newState(now);
}
export function wipe(): void {
  try { localStorage.removeItem(KEY); } catch { /* rien */ }
}
