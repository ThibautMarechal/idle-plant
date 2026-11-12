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
  it('le premier sachet permet de démarrer', () => {
    const s = sim.newState(0);
    const got = sim.openFreePacket(s, rngOf(1))!;
    expect(got.map((g) => g.id)).toEqual(['basilic', 'menthe', 'boston']);
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
    s.slots[1].plant = { sp: 'boston', prog: 1, water: 1, pests: 0, q: 100 };
    s.market.fougeres.p = 1.5;
    const gain = sim.harvestSell(s, 1);
    expect(gain).toBe(Math.round(14 * 1.5 * 1.5));
    expect(s.coins).toBe(30 + gain);
    expect(s.market.fougeres.p).toBeLessThan(1.5);
  });

  it('la réserve a une capacité limitée', () => {
    const s = sim.newState(0);
    for (let k = 0; k < 4; k++) s.stock.push({ sp: 'aloe', q: 50 });
    s.slots[1].plant = { sp: 'aloe', prog: 1, water: 1, pests: 0, q: 50 };
    expect(sim.harvestStore(s, 1)).toBe(false);
  });

  it('les sachets ciblés ne donnent que la famille demandée', () => {
    const s = sim.newState(0);
    s.coins = 1000;
    const got = sim.buyPacket(s, rngOf(5), 'orchidees')!;
    expect(got.every((g) => SPECIES_BY_ID[g.id].family === 'orchidees')).toBe(true);
  });
});
