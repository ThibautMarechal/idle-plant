import { BASKETS, BIOMES, TREK_GEAR, TREK_REST, TREK_TIME, GARDEN, GARDEN_CLIMATE, GARDEN_FIRST, GARDEN_INDEX, PROF_MAX, PROF_MIN, BASE_SLOTS, SEASONS, SEASON_LENGTH, CLIENTS, FAMILIES, FAMILY_IDS, GLAZES, NEWS, POT_SIZES, RARITIES, SLOT_COUNT, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, ZONES } from './data';
import type { Family, Rarity, Species, Zone } from './data';

/** `vr` : variante, 0 normale, 1 panachée, 2 dorée. */
/** `cut` : 1 = la plante demande une taille, 2 = taillée (elle pousse plus vite). */
export interface Plant { sp: string; prog: number; water: number; pests: number; q: number; vr: number; cut?: number }
/** Un pot façonné : taille 1..3, émail (index de GLAZES) et motif (index de PATTERNS). */
/**
 * `prof` : forme modelée au tour (rayons de bas en haut). `paint` : dessin au pinceau, une lettre par case
 * ('.' = fond, 'a' + index dans PAINTS). `pv` change à chaque coup de pinceau enregistré.
 */
export interface PotDesign { size: number; glaze: number; pat: number; prof?: number[]; paint?: string; pv?: number }
/** `pd` absent : petit pot de base en terre cuite. */
export interface Slot { pot: boolean; pd?: PotDesign; plant: Plant | null }
export interface Order { who: string; family: Family; minQ: number; coins: number; clay: number; left: number }
export interface Harvest { sp: string; q: number; vr: number }
export interface MarketLine { p: number; hist: number[]; drift: number; driftLeft: number }
export interface NewsItem { t: number; family: Family; dir: 1 | -1; text: string }
export interface Upgrades { water: boolean; bugs: boolean; mist: boolean; lamp: boolean; heat: boolean; fan: boolean; fastKiln?: boolean; bigClay?: boolean }
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
  /** Direction artistique choisie (purement visuel). */
  style?: string;
  /** Atelier de poterie. */
  clay: number;
  clayAcc: number;
  /** Pot en cours de cuisson ; `left` à 0 quand il est prêt à défourner. */
  kiln: { size: number; left: number; prof?: number[] } | null;
  /** Pots façonnés en attente d'être posés. */
  shelf: PotDesign[];
  /** Commande d'un visiteur. */
  order: Order | null;
  orderIn: number;
  /** Dernier jour (AAAA-MM-JJ) où le cadeau quotidien a été reçu, et jours d'affilée. */
  day?: string;
  streak?: number;
  /** Expérience et niveau de jardinier. */
  /** Suspensions achetées, une par zone. */
  extra?: boolean[];
  /** Temps de jeu écoulé, qui fait tourner les saisons. */
  seasonT?: number;
  /** Concours de la saison : numéro de la saison, floraisons comptées, paliers réclamés. */
  contest?: { n: number; blooms: number; claimed: number };
  xp?: number;
  level?: number;
  trophies?: Record<string, boolean>;
  mute?: boolean;
  market: Record<Family, MarketLine>;
  marketAcc: number;
  news: NewsItem[];
  newsIn: number;
  bugAcc: number;
  upgrades: Upgrades;
  disc: Record<string, Disc>;
  quests: Record<string, boolean>;
  /** Astuces déjà montrées une fois. */
  hints?: Record<string, boolean>;
  /** Expéditions : repos restant (s), taille du panier, milieux ouverts, sorties faites. */
  trek?: { rest: number; basket: number; open: boolean[]; done: number; boots?: boolean; lantern?: boolean };
  stats: { sold: number; earned: number; bestMult: number; planted: number; opened: number; crafted: number; painted: number; orders: number; cuttings: number; crossed?: number; contests?: number };
  lastTick: number;
}

export const SAVE_VERSION = 4;
export const SEASON_SPEED = 1.25;
export const EXTRA_PRICES = [250, 400, 600, 900];
export const CONTEST: { need: number; coins: number; clay: number; label: string }[] = [
  { need: 3, coins: 60, clay: 2, label: 'Bronze' },
  { need: 7, coins: 180, clay: 4, label: 'Argent' },
  { need: 12, coins: 450, clay: 6, label: 'Or' },
];
export const CLAY_EVERY = 40;
export const CLAY_CAP = 12;
export const SHELF_CAP = 6;
export const PAINT_PRICE = 15;
export const HARMONY_SPEED = 1.12;
export const ORDER_TIME = 600;
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
export const ZONE_PRICES = [150, 400, 0, 0, 600];
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
  fastKiln: 600,
  bigClay: 450,
  prestige: 380,
};
export const CROSS_FEE: Record<string, number> = { commun: 60, rare: 250, exotique: 900 };

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
    clay: 4,
    clayAcc: 0,
    kiln: null,
    shelf: [],
    order: null,
    orderIn: 150,
    disc: {},
    quests: {},
    stats: { sold: 0, earned: 0, bestMult: 0, planted: 0, opened: 0, crafted: 0, painted: 0, orders: 0, cuttings: 0 },
    lastTick: now,
  };
}

export function zoneOfSlot(i: number): Zone {
  return ZONES[zoneIndexOfSlot(i)] ?? GARDEN;
}

export function gearOn(s: State, g: ClimateGear): boolean {
  return s.upgrades[g] && !s.off[g];
}

/** Climat d'une zone, équipements allumés compris. */
export function zoneClimate(s: State, z: Zone): { light: number; temp: number; hum: number } {
  if (z.id === 'jardin') return { ...GARDEN_CLIMATE[seasonOf(s).index] };
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
      const speed = fit * (wet ? 1 : 0.25) * (p.pests > 0 ? 0.5 : 1) * (harmony(slot) ? HARMONY_SPEED : 1) * (inSeason(s, sp) ? SEASON_SPEED : 1) * (p.cut === 2 ? PRUNE_SPEED : 1);
      p.prog = Math.min(1, p.prog + (dt / sp.grow) * speed);
      // À mi-croissance, la plante fait des pousses folles : une taille la relance.
      if (!p.cut && p.prog >= 0.45 && p.prog < 1) p.cut = 1;
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
        gainXp(s, XP_BLOOM[sp.rarity] * (p.vr > 0 ? 2 : 1));
        if (inSeason(s, sp)) contestOf(s).blooms++;
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
  s.seasonT = (s.seasonT ?? 0) + Math.min(total, SEASON_LENGTH);
  if (s.trek) s.trek.rest = Math.max(0, s.trek.rest - total);
  // Atelier : l'argile se dépose toute seule, le four cuit, les commandes passent.
  if (s.clay < clayCap(s)) {
    s.clayAcc += total;
    const n = Math.floor(s.clayAcc / CLAY_EVERY);
    s.clayAcc -= n * CLAY_EVERY;
    s.clay = Math.min(clayCap(s), s.clay + n);
  } else s.clayAcc = 0;
  if (s.kiln) s.kiln.left = Math.max(0, s.kiln.left - total * (s.upgrades.fastKiln ? 2 : 1));
  if (s.order) {
    s.order.left -= total;
    if (s.order.left <= 0) { s.order = null; s.orderIn = 120; }
  } else {
    s.orderIn -= Math.min(total, 300);
    if (s.orderIn <= 0) s.order = makeOrder(s, rng);
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

function makeOrder(s: State, rng: Rng): Order | null {
  // On ne demande que des familles que le joueur sait déjà faire fleurir.
  const fams = FAMILY_IDS.filter((f) => SPECIES.some((sp) => sp.family === f && s.disc[sp.id]?.bloomed));
  if (fams.length === 0) { s.orderIn = 60; return null; }
  const family = fams[Math.floor(rng() * fams.length)];
  const hard = rng() < 0.35;
  const n = collection(s).bloomed;
  return {
    who: CLIENTS[Math.floor(rng() * CLIENTS.length)],
    family,
    minQ: hard ? 85 : 60,
    coins: Math.round((30 + n * 6) * (hard ? 2 : 1)),
    clay: hard ? 5 : 3,
    left: ORDER_TIME,
  };
}

export const XP_BLOOM: Record<string, number> = { commun: 10, rare: 25, exotique: 60, legendaire: 200 };
/** Expérience totale nécessaire pour atteindre un niveau. */
export function xpNeed(level: number): number {
  return Math.round(35 * Math.pow(Math.max(0, level - 1), 1.8));
}
export function levelOf(s: State): { level: number; into: number; span: number } {
  const level = s.level ?? 1;
  const base = xpNeed(level), next = xpNeed(level + 1);
  return { level, into: (s.xp ?? 0) - base, span: next - base };
}
/** Ajoute de l'expérience. Chaque niveau gagné offre des pièces, de l'argile et un sachet, et sera fêté par l'interface. */
export function gainXp(s: State, n: number): void {
  s.xp = (s.xp ?? 0) + n;
  s.level = s.level ?? 1;
  while (s.xp >= xpNeed(s.level + 1)) {
    s.level++;
    s.coins += 25 * s.level;
    s.clay += 2;
    s.packets += 1;
    s.fresh.push(`lvl:${s.level}`);
  }
}

export interface Trophy { id: string; icon: string; name: string; text: string; reward: number; at: (s: State) => [number, number] }
const tier = (id: string, icon: string, name: string, text: (n: number) => string, steps: [number, number][], cur: (s: State) => number): Trophy[] =>
  steps.map(([goal, reward], k) => ({ id: `${id}${k + 1}`, icon, name: `${name} ${'I'.repeat(k + 1)}`, text: text(goal), reward, at: (s: State) => [Math.min(goal, cur(s)), goal] as [number, number] }));
export const TROPHIES: Trophy[] = [
  ...tier('bloom', '🌼', 'Botaniste', (n) => `Fais fleurir ${n} espèces différentes`, [[10, 80], [25, 300], [SPECIES.length, 1500]], (s) => collection(s).bloomed),
  ...tier('stars', '⭐', 'Perfectionniste', (n) => `Cumule ${n} étoiles`, [[30, 120], [75, 400], [SPECIES.length * 3, 2000]], (s) => collection(s).stars),
  ...tier('vars', '✨', 'Chasseur de variantes', (n) => `Obtiens ${n} variantes panachées ou dorées`, [[3, 100], [12, 400], [40, 1500]], (s) => collection(s).variants),
  ...tier('sold', '🧺', 'Pépiniériste', (n) => `Vends ${n} plantes`, [[10, 40], [60, 200], [250, 800]], (s) => s.stats.sold),
  ...tier('rich', '🪙', 'Bonne affaire', (n) => `Gagne ${n.toLocaleString('fr-FR')} pièces au total`, [[1000, 80], [10000, 400], [100000, 2000]], (s) => s.stats.earned),
  ...tier('pots', '🏺', 'Potier', (n) => `Façonne ${n} pots`, [[3, 60], [12, 250], [40, 900]], (s) => s.stats.crafted),
  ...tier('paint', '🎨', 'Céramiste', (n) => `Peins ${n} fois un pot`, [[3, 50], [15, 250]], (s) => s.stats.painted),
  ...tier('orders', '📦', 'Fournisseur', (n) => `Livre ${n} commandes`, [[3, 80], [15, 350], [50, 1200]], (s) => s.stats.orders),
  ...tier('cross', '🧬', 'Hybrideur', (n) => `Réussis ${n} croisements`, [[2, 100], [10, 400], [30, 1200]], (s) => s.stats.crossed ?? 0),
  ...tier('cut', '✂️', 'Boutureur', (n) => `Prélève des boutures ${n} fois`, [[3, 50], [20, 300]], (s) => s.stats.cuttings),
  ...tier('visit', '🏛️', 'Conservateur', (n) => `Accueille ${n.toLocaleString('fr-FR')} visiteurs en vitrine`, [[100, 80], [1000, 400], [10000, 1500]], (s) => Math.floor(s.visitors)),
  ...tier('streak', '📅', 'Fidèle', (n) => `Joue ${n} jours d'affilée`, [[3, 100], [7, 400], [30, 2000]], (s) => s.streak ?? 0),
  ...tier('level', '🎓', 'Jardinier', (n) => `Atteins le niveau ${n}`, [[5, 100], [10, 400], [20, 1500]], (s) => s.level ?? 1),
  ...FAMILY_IDS.map((f): Trophy => ({ id: `fam-${f}`, icon: FAMILIES[f].icon, name: `Tout sur les ${FAMILIES[f].name.toLowerCase()}`, text: 'Fais fleurir toutes les espèces de cette famille', reward: 250,
    at: (s) => { const all = SPECIES.filter((sp) => sp.family === f); return [all.filter((sp) => s.disc[sp.id]?.bloomed).length, all.length]; } })),
];
export function trophyReady(s: State, t: Trophy): boolean {
  const [a, b] = t.at(s);
  return a >= b && !s.trophies?.[t.id];
}
export function claimTrophy(s: State, id: string): number {
  const t = TROPHIES.find((x) => x.id === id);
  if (!t || !trophyReady(s, t)) return 0;
  (s.trophies ??= {})[id] = true;
  s.coins += t.reward;
  gainXp(s, 20);
  return t.reward;
}

export function clayCap(s: State): number {
  return s.upgrades.bigClay ? CLAY_CAP * 2 : CLAY_CAP;
}

const NEXT_RARITY: Record<string, Rarity> = { commun: 'rare', rare: 'exotique', exotique: 'legendaire' };
/** Deux plantes en fleur de même famille et de même rareté peuvent être croisées. Renvoie la raison du refus, ou ''. */
export function crossBlock(s: State, i: number, j: number): string {
  const a = s.slots[i]?.plant, b = s.slots[j]?.plant;
  if (i === j || !a || !b || a.prog < 1 || b.prog < 1) return 'Il faut deux plantes en fleur.';
  const x = SPECIES_BY_ID[a.sp], y = SPECIES_BY_ID[b.sp];
  if (x.family !== y.family) return 'Les deux plantes doivent être de la même famille.';
  if (x.rarity !== y.rarity) return 'Les deux plantes doivent être de la même rareté.';
  if (!NEXT_RARITY[x.rarity]) return 'Rien n\'est plus rare qu\'une légendaire.';
  if (s.coins < CROSS_FEE[x.rarity]) return `Il faut ${CROSS_FEE[x.rarity]} pièces pour ce croisement.`;
  return '';
}
/** Croise deux plantes : elles partent, une graine de la rareté supérieure arrive (même famille si possible). */
export function cross(s: State, i: number, j: number, rng: Rng = Math.random): { id: string; isNew: boolean } | null {
  if (crossBlock(s, i, j)) return null;
  const x = SPECIES_BY_ID[s.slots[i].plant!.sp];
  const rar = NEXT_RARITY[x.rarity];
  let pool = SPECIES.filter((sp) => sp.rarity === rar && sp.family === x.family);
  if (pool.length === 0) pool = SPECIES.filter((sp) => sp.rarity === rar);
  // On favorise les espèces encore absentes de l'almanach.
  const fresh = pool.filter((sp) => !s.disc[sp.id]?.bloomed);
  if (fresh.length) pool = fresh;
  const pick = pool[Math.floor(rng() * pool.length)];
  s.coins -= CROSS_FEE[x.rarity];
  s.slots[i].plant = null;
  s.slots[j].plant = null;
  s.stats.crossed = (s.stats.crossed ?? 0) + 1;
  gainXp(s, 20);
  return grant(s, [pick.id])[0];
}

/** Cadeau du jour : une fois par jour calendaire, plus généreux quand les jours s'enchaînent. */
export function claimDaily(s: State, today: string, yesterday: string): { streak: number; coins: number; clay: number; fert: number } | null {
  if (s.day === today) return null;
  const streak = s.day === yesterday ? (s.streak ?? 0) + 1 : 1;
  const first = s.day === undefined && s.stats.opened === 0;
  s.day = today;
  s.streak = streak;
  if (first) return null; // toute première partie : on laisse le tutoriel tranquille
  const gift = { streak, coins: 20 * Math.min(streak, 7), clay: 2, fert: streak % 3 === 0 ? 1 : 0 };
  s.coins += gift.coins;
  s.clay += gift.clay;
  s.fert += gift.fert;
  s.packets += 1;
  return gift;
}

export function potSize(slot: Slot): number {
  return slot.pot ? slot.pd?.size ?? 1 : 0;
}
export function sizeOf(sp: Species): number {
  return sp.size ?? 1;
}
/** Un pot émaillé à la couleur préférée de la famille : la plante pousse plus vite. */
export function harmony(slot: Slot): boolean {
  return !!slot.plant && !!slot.pd && (slot.pd.glaze > 0 || !!slot.pd.pv) && FAMILIES[SPECIES_BY_ID[slot.plant.sp].family].glaze === slot.pd.glaze;
}
export function glazeOpen(s: State, g: number): boolean {
  return collection(s).stars >= GLAZES[g].stars;
}

/** Lance la cuisson d'un pot de la taille demandée (1..3). */
export function startPot(s: State, size: number, prof?: number[]): boolean {
  const def = POT_SIZES[size - 1];
  if (!def || s.kiln || s.clay < def.clay) return false;
  s.clay -= def.clay;
  s.kiln = { size, left: def.fire };
  if (prof) s.kiln.prof = prof.map((r) => Math.round(clamp(r, PROF_MIN, PROF_MAX) * 1000) / 1000);
  return true;
}
/** Sort le pot cuit du four et le range sur l'étagère de l'atelier. */
export function collectKiln(s: State): boolean {
  if (!s.kiln || s.kiln.left > 0 || s.shelf.length >= SHELF_CAP) return false;
  s.shelf.push({ size: s.kiln.size, glaze: 0, pat: 0, ...(s.kiln.prof ? { prof: s.kiln.prof } : {}) });
  s.kiln = null;
  s.stats.crafted++;
  gainXp(s, 5);
  return true;
}
/** Pose un pot de l'étagère sur un emplacement libre. */
export function placePot(s: State, i: number, k: number): boolean {
  const slot = s.slots[i];
  if (slot.pot || !s.shelf[k] || !slotOpen(s, i)) return false;
  slot.pot = true;
  slot.pd = s.shelf.splice(k, 1)[0];
  return true;
}
/** Range un pot vide sur l'étagère, pour le remplacer par un autre. */
export function stowPot(s: State, i: number): boolean {
  const slot = s.slots[i];
  if (!slot.pot || slot.plant || s.shelf.length >= SHELF_CAP) return false;
  s.shelf.push(slot.pd ?? { size: 1, glaze: 0, pat: 0 });
  slot.pot = false;
  delete slot.pd;
  return true;
}
/** Peint un pot posé (`slot`) ou rangé sur l'étagère (`shelf`). */
export function paintPot(s: State, where: 'slot' | 'shelf', k: number, glaze: number, pat: number): boolean {
  if (!GLAZES[glaze] || !glazeOpen(s, glaze) || s.coins < PAINT_PRICE) return false;
  let pd: PotDesign | undefined;
  if (where === 'shelf') pd = s.shelf[k];
  else if (s.slots[k]?.pot) pd = s.slots[k].pd ?? (s.slots[k].pd = { size: 1, glaze: 0, pat: 0 });
  if (!pd || (pd.glaze === glaze && pd.pat === pat)) return false;
  pd.glaze = glaze;
  pd.pat = pat;
  s.coins -= PAINT_PRICE;
  s.stats.painted++;
  return true;
}

/** Enregistre le dessin au pinceau d'un pot, et son émail de fond. */
export function savePaint(s: State, where: 'slot' | 'shelf', k: number, glaze: number, paint: string): boolean {
  if (!GLAZES[glaze] || !glazeOpen(s, glaze) || s.coins < PAINT_PRICE) return false;
  let pd: PotDesign | undefined;
  if (where === 'shelf') pd = s.shelf[k];
  else if (s.slots[k]?.pot) pd = s.slots[k].pd ?? (s.slots[k].pd = { size: 1, glaze: 0, pat: 0 });
  if (!pd) return false;
  pd.glaze = glaze;
  pd.pat = 0;
  if (/[^.]/.test(paint)) pd.paint = paint; else delete pd.paint;
  pd.pv = (pd.pv ?? 0) + 1;
  s.coins -= PAINT_PRICE;
  s.stats.painted++;
  return true;
}

/** Prélève des boutures : la plante part, deux graines de la même espèce reviennent. */
export function harvestCutting(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  if (!p || p.prog < 1) return false;
  s.slots[i].plant = null;
  s.seeds[p.sp] = (s.seeds[p.sp] ?? 0) + 2;
  s.stats.cuttings++;
  return true;
}
export function orderFits(s: State, p: Plant | null): boolean {
  return !!s.order && !!p && p.prog >= 1 && SPECIES_BY_ID[p.sp].family === s.order.family && p.q >= s.order.minQ;
}
/** Livre la plante en fleur au client : prix de vente, prime et argile. */
export function deliver(s: State, i: number): number {
  const p = s.slots[i].plant;
  if (!s.order || !orderFits(s, p) || !p) return 0;
  const o = s.order;
  s.slots[i].plant = null;
  const gain = sell(s, { sp: p.sp, q: p.q, vr: p.vr }) + o.coins;
  s.coins += o.coins;
  s.stats.earned += o.coins;
  s.clay = Math.min(clayCap(s) + 6, s.clay + o.clay);
  s.stats.orders++;
  gainXp(s, 30);
  s.order = null;
  s.orderIn = 90;
  return gain;
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
export function rollSeeds(s: State, rng: Rng, family?: Family, prestige = false): string[] {
  const out: string[] = [];
  for (let i = 0; i < PACKET_SIZE; i++) {
    let pool: Species[] = [];
    let rar = rollRarity(rng);
    if (prestige && rar === 'commun') rar = rng() < 0.82 ? 'rare' : 'exotique';
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

// ---------- expéditions ----------

export function trekOf(s: State): NonNullable<State['trek']> {
  return (s.trek ??= { rest: 0, basket: 0, open: BIOMES.map((b) => b.price === 0), done: 0 });
}
export function basketCap(s: State): number {
  return BASKETS[trekOf(s).basket].cap;
}
export function openBiome(s: State, b: number): boolean {
  const t = trekOf(s);
  if (t.open[b] || s.coins < BIOMES[b].price) return false;
  s.coins -= BIOMES[b].price;
  t.open[b] = true;
  return true;
}
export function buyTrekGear(s: State, k: 'boots' | 'lantern'): boolean {
  const t = trekOf(s);
  if (t[k] || s.coins < TREK_GEAR[k].price) return false;
  s.coins -= TREK_GEAR[k].price;
  t[k] = true;
  return true;
}
/** Durée d'une sortie et vitesse de marche, équipement compris. */
export function trekSetup(s: State): { time: number; speed: number; cap: number } {
  const t = trekOf(s);
  return { time: TREK_TIME + (t.lantern ? TREK_GEAR.lantern.time : 0), speed: t.boots ? TREK_GEAR.boots.speed : 1, cap: basketCap(s) };
}
export function buyBasket(s: State): boolean {
  const t = trekOf(s), next = BASKETS[t.basket + 1];
  if (!next || s.coins < next.price) return false;
  s.coins -= next.price;
  t.basket++;
  return true;
}
/**
 * Ce qui pousse aujourd'hui dans un milieu, du camp vers le lointain :
 * huit plantes proches (`tier` 0), six fourrés à mi-chemin qui cachent au moins du rare (1),
 * quatre trouvailles lointaines, exotiques le plus souvent, parfois légendaires (2).
 */
export function trekFinds(s: State, b: number, rng: Rng): { id: string; hidden: boolean; tier: number }[] {
  if (!trekOf(s).open[b] || trekOf(s).rest > 0) return [];
  const fams = BIOMES[b].fams;
  const out: { id: string; hidden: boolean; tier: number }[] = [];
  for (let i = 0; i < 18; i++) {
    const tier = i < 8 ? 0 : i < 14 ? 1 : 2;
    let rar = rollRarity(rng);
    if (tier === 1 && rar === 'commun') rar = rng() < 0.75 ? 'rare' : 'exotique';
    if (tier === 2) { const r = rng(); rar = r < 0.1 ? 'legendaire' : r < 0.6 ? 'exotique' : 'rare'; }
    let pool = SPECIES.filter((sp) => fams.includes(sp.family) && sp.rarity === rar);
    if (!pool.length) pool = SPECIES.filter((sp) => fams.includes(sp.family) && sp.rarity === (tier ? 'rare' : 'commun'));
    if (!pool.length) pool = SPECIES.filter((sp) => fams.includes(sp.family));
    out.push({ id: pool[Math.floor(rng() * pool.length)].id, hidden: tier === 1 || (tier === 2 && i % 2 === 1), tier });
  }
  return out;
}
/**
 * Retour d'expédition : le panier (limité à sa taille) devient des graines, plus une graine
 * par coupe parfaite (`bonus`), et il faut se reposer avant de repartir.
 */
export function trekEnd(s: State, ids: string[], bonus: string[] = [], loot: { clay: number; coins: number } = { clay: 0, coins: 0 }): { id: string; isNew: boolean }[] {
  const t = trekOf(s);
  if (t.rest > 0) return [];
  // Ce qu'on a ramassé en chemin : de l'argile pour l'atelier, quelques pièces.
  s.clay = Math.max(s.clay, Math.min(clayCap(s), s.clay + loot.clay));
  s.coins += loot.coins;
  t.rest = TREK_REST;
  t.done++;
  const kept = ids.slice(0, basketCap(s));
  gainXp(s, kept.length * 2);
  return grant(s, [...kept, ...bonus.filter((id) => kept.includes(id)).slice(0, kept.length)]);
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

/** Sachet prestige : trois graines, toutes rares ou mieux. Payé en pièces gagnées en jeu uniquement. */
export function buyPrestige(s: State, rng: Rng = Math.random) {
  if (s.coins < PRICES.prestige) return null;
  s.coins -= PRICES.prestige;
  s.stats.opened++;
  return grant(s, rollSeeds(s, rng, undefined, true));
}

export function plantSeed(s: State, i: number, id: string, rng: Rng = Math.random): boolean {
  const slot = s.slots[i];
  if (!slot.pot || slot.plant || !(s.seeds[id] > 0) || potSize(slot) < sizeOf(SPECIES_BY_ID[id])) return false;
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

export const PRUNE_SPEED = 1.2;
/** Taille au sécateur : la plante gagne en qualité et finit sa croissance plus vite. */
export function prune(s: State, i: number): boolean {
  const p = s.slots[i].plant;
  if (!p || p.cut !== 1 || p.prog >= 1) return false;
  p.cut = 2;
  p.q = Math.min(100, p.q + 6);
  gainXp(s, 2);
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
  return i >= GARDEN_FIRST ? GARDEN_INDEX : i < BASE_SLOTS ? Math.floor(i / SLOTS_PER_ZONE) : i - BASE_SLOTS;
}
/** Un emplacement est utilisable si sa zone est aménagée et, pour une suspension, si elle est achetée. */
export function slotOpen(s: State, i: number): boolean {
  const z = zoneIndexOfSlot(i);
  return !!s.zonesOpen[z] && (i < BASE_SLOTS || i >= GARDEN_FIRST || !!s.extra?.[z]);
}
export function buyExtra(s: State, z: number): boolean {
  if (!s.zonesOpen[z] || s.extra?.[z] || s.coins < EXTRA_PRICES[z]) return false;
  s.coins -= EXTRA_PRICES[z];
  (s.extra ??= ZONES.map(() => false))[z] = true;
  return true;
}

export function seasonOf(s: State): { n: number; index: number; left: number } {
  const t = s.seasonT ?? 0;
  const n = Math.floor(t / SEASON_LENGTH);
  return { n, index: n % SEASONS.length, left: SEASON_LENGTH - (t % SEASON_LENGTH) };
}
export function inSeason(s: State, sp: Species): boolean {
  return SEASONS[seasonOf(s).index].fams.includes(sp.family);
}
export function contestOf(s: State): { n: number; blooms: number; claimed: number } {
  const n = seasonOf(s).n;
  if (!s.contest || s.contest.n !== n) s.contest = { n, blooms: 0, claimed: 0 };
  return s.contest;
}
/** Réclame le prochain palier du concours de saison, s'il est atteint. */
export function claimContest(s: State): { coins: number; clay: number; label: string } | null {
  const c = contestOf(s);
  const tier = CONTEST[c.claimed];
  if (!tier || c.blooms < tier.need) return null;
  c.claimed++;
  s.stats.contests = (s.stats.contests ?? 0) + 1;
  s.coins += tier.coins;
  s.clay += tier.clay;
  if (c.claimed === CONTEST.length) s.packets += 2;
  gainXp(s, 25);
  return tier;
}

/** Déplace un pot (et sa plante) vers un autre emplacement ; échange si la cible est occupée. */
export function movePot(s: State, from: number, to: number): boolean {
  if (from === to || !s.slots[from].pot || !slotOpen(s, to)) return false;
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
  if (s.slots[i].pot || s.coins < price || !slotOpen(s, i)) return false;
  s.coins -= price;
  s.slots[i].pot = true;
  delete s.slots[i].pd;
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
  { id: 'craft', text: 'Tourne un pot au tour de l\'atelier, puis défourne-le', reward: 30, done: (s) => s.stats.crafted >= 1 },
  { id: 'bloom3', text: 'Ajoute 3 espèces à l\'almanach', reward: 50, done: (s) => collection(s).bloomed >= 3 },
  { id: 'zone1', text: 'Aménage une nouvelle zone de la serre', reward: 60, done: (s) => s.zonesOpen.filter(Boolean).length >= 3 },
  { id: 'show', text: 'Expose une plante en fleur dans la vitrine', reward: 60, done: (s) => s.showcase.some(Boolean) },
  { id: 'paint', text: 'Peins un pot au pinceau (touche un pot, puis Peindre)', reward: 40, done: (s) => s.stats.painted >= 1 },
  { id: 'order', text: 'Livre la commande d\'un client', reward: 80, done: (s) => s.stats.orders >= 1 },
  { id: 'star3', text: 'Obtiens un spécimen d\'exposition ⭐⭐⭐', reward: 80, done: (s) => Object.values(s.disc).some((d) => starsOf(d) >= 3) },
  { id: 'bloom6', text: 'Ajoute 6 espèces à l\'almanach', reward: 100, done: (s) => collection(s).bloomed >= 6 },
  { id: 'rare', text: 'Fais fleurir une plante rare', reward: 120,
    done: (s) => Object.entries(s.disc).some(([id, d]) => d.bloomed && SPECIES_BY_ID[id].rarity !== 'commun') },
  { id: 'cutting', text: 'Prélève des boutures sur une plante en fleur', reward: 60, done: (s) => s.stats.cuttings >= 1 },
  { id: 'shrub', text: 'Fais fleurir un arbuste dans un pot moyen ou grand', reward: 200,
    done: (s) => Object.entries(s.disc).some(([id, d]) => d.bloomed && SPECIES_BY_ID[id].family === 'arbustes') },
  { id: 'cross', text: 'Croise deux plantes en fleur de même famille et de même rareté', reward: 120, done: (s) => (s.stats.crossed ?? 0) >= 1 },
  { id: 'gear', text: 'Installe un équipement dans la serre', reward: 100, done: (s) => Object.values(s.upgrades).some(Boolean) },
  { id: 'variant', text: 'Fais fleurir une variante panachée ou dorée', reward: 150, done: (s) => collection(s).variants >= 1 },
  { id: 'zone2', text: 'Aménage toute la serre', reward: 150, done: (s) => s.zonesOpen.slice(0, ZONES.length).every(Boolean) },
  { id: 'stars20', text: 'Cumule 20 étoiles dans l\'almanach', reward: 250, done: (s) => collection(s).stars >= 20 },
  { id: 'bloom10', text: 'Ajoute 10 espèces à l\'almanach', reward: 300, done: (s) => collection(s).bloomed >= 10 },
  { id: 'show4', text: 'Remplis la vitrine', reward: 300, done: (s) => s.showcase.every(Boolean) },
  { id: 'bloom20', text: 'Ajoute 20 espèces à l\'almanach', reward: 600, done: (s) => collection(s).bloomed >= 20 },
  { id: 'harmony', text: 'Accorde l\'émail d\'un pot à la famille de sa plante', reward: 150, done: (s) => s.slots.some(harmony) },
  { id: 'bloom30', text: 'Ajoute 30 espèces à l\'almanach', reward: 700, done: (s) => collection(s).bloomed >= 30 },
  { id: 'extra', text: 'Installe une suspension pour gagner un emplacement', reward: 150, done: (s) => !!s.extra?.some(Boolean) },
  { id: 'contest', text: 'Remporte un palier du concours de saison', reward: 120, done: (s) => (s.contest?.claimed ?? 0) >= 1 || (s.stats.contests ?? 0) >= 1 },
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
  gainXp(s, 15);
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
      if (s.v === 1 && Array.isArray(s.slots) && s.slots.length >= BASE_SLOTS) {
        // Sauvegarde de la première version : on garde tout et on ouvre les zones déjà utilisées.
        s.v = 2;
        s.packetIn = PACKET_EVERY;
        s.fresh = [];
        s.moved = 0;
        s.quests = {};
        s.zonesOpen = ZONE_PRICES.map((p, z) => p === 0 || s.slots.slice(z * SLOTS_PER_ZONE, (z + 1) * SLOTS_PER_ZONE).some((x) => x.pot));
        for (const d of Object.values(s.disc)) d.bestQ = d.bloomed ? 60 : 0;
      }
      if (s.v === 2 && Array.isArray(s.slots) && s.slots.length >= BASE_SLOTS) {
        // Sauvegarde de la deuxième version : on complète avec les nouveautés.
        const base = newState(now);
        Object.assign(s, { ...base, ...s, v: SAVE_VERSION, market: { ...base.market, ...s.market }, upgrades: { ...base.upgrades, ...s.upgrades } });
        s.v = 3;
        for (const sl of s.slots) if (sl.plant) sl.plant.vr = 0;
        for (const h of s.stock) h.vr = 0;
        for (const d of Object.values(s.disc)) d.vars = [d.bloomed, false, false];
      }
      if (s.v === 3 && Array.isArray(s.slots) && s.slots.length >= BASE_SLOTS) {
        // Troisième version : atelier, commandes, nouvelle famille. Les pots s'adaptent aux plantes en place.
        const base = newState(now);
        Object.assign(s, { ...base, ...s, v: SAVE_VERSION, market: { ...base.market, ...s.market }, stats: { ...base.stats, ...s.stats } });
        for (const sl of s.slots) {
          const need = sl.plant ? sizeOf(SPECIES_BY_ID[sl.plant.sp]) : 1;
          if (need > 1) sl.pd = { size: need, glaze: 0, pat: 0 };
        }
      }
      if (s.v === SAVE_VERSION && Array.isArray(s.slots) && s.slots.length >= BASE_SLOTS) {
        // Les suspensions sont arrivées après : on complète sans rien toucher d'autre.
        while (s.slots.length < SLOT_COUNT) s.slots.push({ pot: false, plant: null });
        return s;
      }
    }
  } catch { /* sauvegarde illisible : on repart de zéro */ }
  return newState(now);
}
export function wipe(): void {
  try { localStorage.removeItem(KEY); } catch { /* rien */ }
}
