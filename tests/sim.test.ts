import { describe, expect, it } from 'vitest';
import { SPECIES_BY_ID, ZONES } from '../src/data';
import * as sim from '../src/sim';

function rngOf(seed: number): sim.Rng {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

describe('simulation', () => {
  it('la vitrine rapporte des pourboires plafonnés, et un équipement change le climat', () => {
    const s = sim.newState(0);
    s.slots[10].plant = { sp: 'phalaenopsis', prog: 1, water: 1, pests: 0, q: 90, vr: 1 };
    expect(sim.harvestShow(s, 10)).toBe(true);
    sim.advance(s, 600 * 1000, rngOf(7));
    expect(s.tips).toBeGreaterThan(15);
    sim.advance(s, 10 * 3600 * 1000, rngOf(7));
    expect(s.tips).toBeLessThanOrEqual(sim.showcaseRate(s) * sim.TIP_CAP_SECONDS + 1e-6);
    const got = sim.collectTips(s);
    expect(s.coins).toBe(50 + got);
    s.upgrades.fan = true;
    expect(sim.zoneClimate(s, ZONES[3]).temp).toBe(2);
    sim.toggleGear(s, 'fan');
    expect(sim.zoneClimate(s, ZONES[3]).temp).toBe(3);
  });

  it('composter donne de l\'engrais, qui accélère sans faire fleurir d\'un coup', () => {
    const s = sim.newState(0);
    s.seeds.basilic = 2;
    expect(sim.compost(s, 'basilic')).toBe(true);
    sim.plantSeed(s, 10, 'basilic', () => 0.5);
    for (let k = 0; k < 2; k++) sim.fertilize(s, 10);
    expect(s.fert).toBe(0);
    expect(s.slots[10].plant!.prog).toBeCloseTo(0.5);
    expect(s.slots[10].plant!.vr).toBe(0);
  });

  it('un pot se déplace avec sa plante, et seulement vers une zone aménagée', () => {
    const s = sim.newState(0);
    s.seeds.menthe = 1;
    sim.plantSeed(s, 10, 'menthe');
    expect(sim.movePot(s, 10, 0)).toBe(false);
    expect(sim.movePot(s, 10, 6)).toBe(true);
    expect(s.slots[6].plant!.sp).toBe('menthe');
    expect(s.slots[10].pot).toBe(false);
  });

  it('les sachets gratuits reviennent toutes les cinq minutes, jusqu\'à trois', () => {
    const s = sim.newState(0);
    s.packets = 0;
    sim.advance(s, 301 * 1000, rngOf(4));
    expect(s.packets).toBe(1);
    sim.advance(s, 3600 * 1000, rngOf(4));
    expect(s.packets).toBe(sim.MAX_PACKETS);
  });

  it('une zone s\'aménage contre des pièces', () => {
    const s = sim.newState(0);
    expect(sim.openZone(s, 0)).toBe(false);
    s.coins = 200;
    expect(sim.openZone(s, 0)).toBe(true);
    expect(s.coins).toBe(50);
    expect(sim.buyPot(s, 0)).toBe(true);
  });

  it('le premier sachet permet de démarrer', () => {
    const s = sim.newState(0);
    const got = sim.openFreePacket(s, rngOf(1))!;
    expect(got.map((g) => g.id)).toEqual(['basilic', 'menthe', 'pensee']);
    expect(s.packets).toBe(1);
  });

  it('une plante bien placée fleurit, bien notée, sans jamais mourir', () => {
    const s = sim.newState(0);
    s.seeds.menthe = 1;
    const porte = ZONES.findIndex((z) => z.id === 'porte') * 3 + 1;
    expect(sim.plantSeed(s, porte, 'menthe')).toBe(true);
    s.upgrades.water = true;
    s.upgrades.bugs = true;
    sim.advance(s, 20 * 1000, rngOf(2));
    sim.advance(s, 40 * 1000, rngOf(2));
    for (let t = 60; t <= 400; t += 20) sim.advance(s, t * 1000, rngOf(t));
    const p = s.slots[porte].plant!;
    expect(p.prog).toBe(1);
    expect(p.q).toBeGreaterThan(70);
    expect(s.disc.menthe.bloomed).toBe(true);
    expect(sim.starsOf(s.disc.menthe)).toBeGreaterThanOrEqual(2);
    expect(s.fresh.some((f) => f.startsWith('menthe:'))).toBe(true);
  });

  it('une plante mal placée pousse plus lentement', () => {
    expect(sim.fitOf(SPECIES_BY_ID.menthe, ZONES[3])).toBeLessThan(sim.fitOf(SPECIES_BY_ID.menthe, ZONES[2]));
  });

  it('une longue absence ne tue rien et le marché reste dans sa fourchette', () => {
    const s = sim.newState(0);
    s.seeds.echeveria = 1;
    sim.plantSeed(s, 10, 'echeveria');
    sim.advance(s, 10 * 3600 * 1000, rngOf(3));
    expect(s.slots[10].plant).not.toBeNull();
    expect(s.slots[10].plant!.prog).toBe(1);
    for (const m of Object.values(s.market)) {
      expect(m.p).toBeGreaterThanOrEqual(sim.PRICE_MIN);
      expect(m.p).toBeLessThanOrEqual(sim.PRICE_MAX);
    }
    expect(s.news.length).toBeGreaterThan(0);
  });

  it('vendre rapporte selon le cours et fait baisser ce cours', () => {
    const s = sim.newState(0);
    s.slots[10].plant = { sp: 'boston', prog: 1, water: 1, pests: 0, q: 100, vr: 0 };
    s.market.fougeres.p = 1.5;
    const gain = sim.harvestSell(s, 10);
    expect(gain).toBe(Math.round(14 * 1.5 * 1.5));
    expect(s.coins).toBe(50 + gain);
    expect(s.market.fougeres.p).toBeLessThan(1.5);
  });

  it('la réserve a une capacité limitée', () => {
    const s = sim.newState(0);
    for (let k = 0; k < 4; k++) s.stock.push({ sp: 'aloe', q: 50, vr: 0 });
    s.slots[10].plant = { sp: 'aloe', prog: 1, water: 1, pests: 0, q: 50, vr: 0 };
    expect(sim.harvestStore(s, 10)).toBe(false);
  });

  it('les sachets ciblés ne donnent que la famille demandée', () => {
    const s = sim.newState(0);
    s.coins = 1000;
    const got = sim.buyPacket(s, rngOf(5), 'orchidees')!;
    expect(got.every((g) => SPECIES_BY_ID[g.id].family === 'orchidees')).toBe(true);
  });

  it('taille : demandée à mi-croissance, elle accélère la suite', () => {
    const s = sim.newState(0);
    const i = s.slots.findIndex((sl) => sl.pot);
    s.slots[i].plant = { sp: 'thym', prog: 0.5, water: 1, pests: 0, q: 50, vr: 0 };
    expect(sim.prune(s, i)).toBe(false);
    sim.advance(s, 1000, () => 0.99);
    expect(s.slots[i].plant!.cut).toBe(1);
    expect(sim.prune(s, i)).toBe(true);
    expect(sim.prune(s, i)).toBe(false);
    expect(s.slots[i].plant!.cut).toBe(2);
  });

  it('tour et pinceau : la forme et le dessin suivent le pot', () => {
    const s = sim.newState(0);
    s.clay = 5;
    s.coins = 20;
    expect(sim.startPot(s, 1, [0.05, 0.2, 0.3, 0.4, 0.5, 0.9, 0.3])).toBe(true);
    expect(s.kiln!.prof).toEqual([0.15, 0.2, 0.3, 0.4, 0.48, 0.48, 0.3]);
    sim.advance(s, 60_000, () => 0.5);
    expect(sim.collectKiln(s)).toBe(true);
    expect(s.shelf[0].prof).toHaveLength(7);
    expect(sim.savePaint(s, 'shelf', 0, 8, 'a')).toBe(false); // émail verrouillé
    expect(sim.savePaint(s, 'shelf', 0, 1, '..b.')).toBe(true);
    expect(s.shelf[0]).toMatchObject({ glaze: 1, paint: '..b.', pv: 1 });
    expect(s.coins).toBe(5);
    expect(sim.savePaint(s, 'shelf', 0, 1, '....')).toBe(false); // plus assez de pièces
  });

  it('atelier : façonner, défourner, poser, peindre', () => {
    const s = sim.newState(0);
    s.clay = 9;
    expect(sim.startPot(s, 3)).toBe(true);
    expect(sim.startPot(s, 1)).toBe(false);
    expect(sim.collectKiln(s)).toBe(false);
    sim.advance(s, 301_000, () => 0.5);
    expect(sim.collectKiln(s)).toBe(true);
    expect(s.shelf).toEqual([{ size: 3, glaze: 0, pat: 0 }]);
    expect(sim.placePot(s, 0, 0)).toBe(false); // zone fermée
    expect(sim.placePot(s, 6, 0)).toBe(true);
    expect(sim.potSize(s.slots[6])).toBe(3);
    s.coins = 100;
    expect(sim.paintPot(s, 'slot', 6, 1, 2)).toBe(true);
    expect(sim.paintPot(s, 'slot', 6, 8, 0)).toBe(false); // émail verrouillé
    expect(s.coins).toBe(100 - sim.PAINT_PRICE);
  });

  it('un arbuste exige un pot à sa taille', () => {
    const s = sim.newState(0);
    s.seeds.figuier = 1;
    expect(sim.plantSeed(s, 7, 'figuier', () => 0.5)).toBe(false);
    s.slots[7].pd = { size: 3, glaze: 0, pat: 0 };
    expect(sim.plantSeed(s, 7, 'figuier', () => 0.5)).toBe(true);
  });

  it('boutures et commandes', () => {
    const s = sim.newState(0);
    s.slots[7].plant = { sp: 'basilic', prog: 1, water: 1, pests: 0, q: 90, vr: 0 };
    expect(sim.harvestCutting(s, 7)).toBe(true);
    expect(s.seeds.basilic).toBe(2);
    s.slots[7].plant = { sp: 'basilic', prog: 1, water: 1, pests: 0, q: 90, vr: 0 };
    s.order = { who: 'Test', family: 'aromatiques', minQ: 85, coins: 40, clay: 3, left: 100 };
    const coins = s.coins, clay = s.clay;
    expect(sim.deliver(s, 7)).toBeGreaterThan(40);
    expect(s.coins).toBeGreaterThan(coins + 40);
    expect(s.clay).toBe(clay + 3);
    expect(s.order).toBeNull();
  });

  it('croisement : deux communes de même famille donnent une rare', () => {
    const s = sim.newState(0);
    s.coins = 100;
    s.slots[7].plant = { sp: 'basilic', prog: 1, water: 1, pests: 0, q: 90, vr: 0 };
    s.slots[9].plant = { sp: 'menthe', prog: 1, water: 1, pests: 0, q: 90, vr: 0 };
    s.slots[10].plant = { sp: 'aloe', prog: 1, water: 1, pests: 0, q: 90, vr: 0 };
    expect(sim.crossBlock(s, 7, 10)).not.toBe('');
    const got = sim.cross(s, 7, 9, () => 0);
    expect(got?.id).toBe('lavande');
    expect(s.coins).toBe(100 - sim.CROSS_FEE.commun);
    expect(s.slots[7].plant).toBeNull();
    expect(s.seeds.lavande).toBe(1);
  });

  it('cadeau du jour : une fois par jour, la série grandit', () => {
    const s = sim.newState(0);
    s.stats.opened = 1;
    expect(sim.claimDaily(s, '2026-11-12', '2026-11-11')?.streak).toBe(1);
    expect(sim.claimDaily(s, '2026-11-12', '2026-11-11')).toBeNull();
    expect(sim.claimDaily(s, '2026-11-13', '2026-11-12')?.coins).toBe(40);
    expect(sim.claimDaily(s, '2026-11-20', '2026-11-19')?.streak).toBe(1);
  });

  it('niveau : l\'expérience fait monter de niveau et récompense', () => {
    const s = sim.newState(0);
    const coins = s.coins, packets = s.packets;
    sim.gainXp(s, sim.xpNeed(3));
    expect(s.level).toBe(3);
    expect(s.coins).toBe(coins + 50 + 75);
    expect(s.packets).toBe(packets + 2);
    expect(s.fresh).toEqual(['lvl:2', 'lvl:3']);
  });

  it('trophées : réclamés une seule fois, quand l\'objectif est atteint', () => {
    const s = sim.newState(0);
    expect(sim.claimTrophy(s, 'sold1')).toBe(0);
    s.stats.sold = 10;
    expect(sim.claimTrophy(s, 'sold1')).toBe(40);
    expect(sim.claimTrophy(s, 'sold1')).toBe(0);
  });

  it('saisons : les familles de saison poussent plus vite et comptent au concours', () => {
    const s = sim.newState(0);
    expect(sim.seasonOf(s).index).toBe(0);
    s.slots[9].plant = { sp: 'pensee', prog: 0.99, water: 1, pests: 0, q: 90, vr: 0 };
    sim.advance(s, 20_000, () => 0.99);
    expect(sim.contestOf(s).blooms).toBe(1);
    sim.contestOf(s).blooms = 3;
    expect(sim.claimContest(s)?.label).toBe('Bronze');
    expect(sim.claimContest(s)).toBeNull();
    sim.advance(s, 20_000 + 1200_000, () => 0.99);
    expect(sim.seasonOf(s).index).toBe(1);
    expect(sim.contestOf(s).blooms).toBe(0);
  });

  it('suspension : un emplacement de plus par zone aménagée', () => {
    const s = sim.newState(0);
    expect(s.slots.length).toBe(16);
    expect(sim.slotOpen(s, 14)).toBe(false);
    s.coins = 1000;
    expect(sim.buyExtra(s, 0)).toBe(false); // zone pas encore aménagée
    expect(sim.buyExtra(s, 2)).toBe(true);
    expect(sim.slotOpen(s, 14)).toBe(true);
    expect(sim.buyPot(s, 14)).toBe(true);
  });

  it('le jardin s\'achète, ouvre trois emplacements et suit le climat des saisons', () => {
    const s = sim.newState(0);
    expect(sim.slotOpen(s, 16)).toBe(false);
    s.coins = 1000;
    expect(sim.openZone(s, 4)).toBe(true);
    expect(s.coins).toBe(400);
    expect(sim.slotOpen(s, 18)).toBe(true);
    expect(sim.zoneOfSlot(17).id).toBe('jardin');
    const spring = sim.zoneClimate(s, sim.zoneOfSlot(16)).temp;
    s.seasonT = 3 * 20 * 60 + 1;
    expect(sim.zoneClimate(s, sim.zoneOfSlot(16)).temp).toBeLessThan(spring);
  });
});
