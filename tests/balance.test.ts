import { describe, it } from 'vitest';
import { POT_SIZES, SPECIES, SPECIES_BY_ID, SLOTS_PER_ZONE } from '../src/data';
import * as sim from '../src/sim';

// Partie simulée d'un joueur actif, pour régler le rythme : BALANCE=1 npx vitest run tests/balance
function rngOf(seed: number): sim.Rng {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

describe.skipIf(!process.env.BALANCE)('rythme de jeu', () => {
  it('joueur actif pendant deux heures', () => {
    const rng = rngOf(Number(process.env.SEED ?? 11));
    const s = sim.newState(0);
    const marks = [2, 5, 10, 15, 20, 30, 45, 60, 90, 120];
    let idle = 0;
    for (let t = 5; t <= 120 * 60; t += 5) {
      sim.advance(s, t * 1000, rng);
      s.fresh = [];
      let acted = false;
      while (sim.claimQuest(s)) acted = true;
      while (sim.openFreePacket(s, rng)) acted = true;
      if (sim.collectTips(s) > 0) acted = true;
      s.slots.forEach((slot, i) => {
        const p = slot.plant;
        if (!p) return;
        if (p.pests > 0) { sim.squash(s, i); acted = true; }
        if (p.water < 0.5 && sim.water(s, i)) acted = true;
        if (p.prog >= 1) {
          const sp = SPECIES_BY_ID[p.sp];
          if (sim.deliver(s, i)) { /* commande livrée */ }
          else if (!(sp.rarity !== 'commun' && sim.harvestShow(s, i))) sim.harvestSell(s, i);
          acted = true;
        }
      });
      // Sème chaque graine dans le pot libre qui lui convient le mieux.
      for (const id of Object.keys(s.seeds)) {
        let best = -1, bestFit = 0;
        s.slots.forEach((slot, i) => {
          if (!slot.pot || slot.plant || sim.potSize(slot) < sim.sizeOf(SPECIES_BY_ID[id])) return;
          const f = sim.fitOf(SPECIES_BY_ID[id], sim.zoneClimate(s, sim.zoneOfSlot(i)));
          if (f > bestFit) { bestFit = f; best = i; }
        });
        if (best >= 0 && sim.plantSeed(s, best, id, rng)) acted = true;
      }
      // Atelier : on défourne, on pose, et on façonne la taille que réclament les graines en attente.
      if (sim.collectKiln(s)) acted = true;
      const spot = s.slots.findIndex((slot, i) => !slot.pot && s.zonesOpen[Math.floor(i / SLOTS_PER_ZONE)]);
      if (spot >= 0 && s.shelf.length && sim.placePot(s, spot, 0)) acted = true;
      const want = Math.max(1, ...Object.keys(s.seeds).map((id) => sim.sizeOf(SPECIES_BY_ID[id])));
      const have = Math.max(0, ...s.slots.filter((x) => !x.plant).map(sim.potSize), ...s.shelf.map((x) => x.size), s.kiln?.size ?? 0);
      if (want > have) {
        if (spot < 0 && !s.kiln && s.clay >= POT_SIZES[want - 1].clay) { const e = s.slots.findIndex((x) => x.pot && !x.plant && sim.potSize(x) < want); if (e >= 0) sim.stowPot(s, e); }
        if (sim.startPot(s, want)) acted = true;
      }
      // Croisements : deux communes en fleur de la même famille deviennent une rare.
      for (let i = 0; i < s.slots.length; i++) for (let j = i + 1; j < s.slots.length; j++) {
        const a = s.slots[i].plant, b = s.slots[j].plant;
        if (a && b && s.disc[a.sp]?.bestQ >= 90 && s.disc[b.sp]?.bestQ >= 90 && !sim.crossBlock(s, i, j) && sim.cross(s, i, j, rng)) acted = true;
      }
      if (s.coins > 1200) { for (const k of ['fastKiln', 'bigClay'] as const) if (!s.upgrades[k] && sim.buyUpgrade(s, k)) acted = true; if (sim.buyPrestige(s, rng)) acted = true; }
      const seedsWaiting = Object.values(s.seeds).reduce((a, b) => a + b, 0);
      const z = s.zonesOpen.findIndex((o) => !o);
      if (z >= 0 && sim.openZone(s, z)) acted = true;
      const free = s.slots.findIndex((slot, i) => !slot.pot && s.zonesOpen[Math.floor(i / SLOTS_PER_ZONE)]);
      if (free >= 0 && seedsWaiting > 0 && sim.buyPot(s, free)) acted = true;
      else if (free < 0 || s.coins > sim.potPrice(s) * 2) {
        for (const k of ['water', 'bugs', 'mist', 'fan', 'heat'] as const) if (!s.upgrades[k] && sim.buyUpgrade(s, k)) { acted = true; break; }
      }
      if (seedsWaiting === 0 && s.slots.some((x) => x.pot && !x.plant) && sim.buyPacket(s, rng)) acted = true;
      if (!acted) idle += 5;
      if (marks.includes(t / 60)) {
        const c = sim.collection(s);
        console.log(`${String(t / 60).padStart(3)} min | 🪙 ${String(Math.round(s.coins)).padStart(5)} | pots ${s.slots.filter((x) => x.pot).length} | zones ${s.zonesOpen.filter(Boolean).length} | fleuries ${c.bloomed}/${SPECIES.length} | arbustes ${SPECIES.filter((x) => x.family === 'arbustes' && s.disc[x.id]?.bloomed).length} | croisements ${s.stats.crossed ?? 0} | commandes ${s.stats.orders} | pots façonnés ${s.stats.crafted} | argile ${s.clay} | ⭐ ${c.stars} | variantes ${c.variants} | vitrine ${s.showcase.filter(Boolean).length} | équip. ${Object.values(s.upgrades).filter(Boolean).length} | graines en attente ${seedsWaiting} | sans rien à faire ${Math.round(idle / 60)} min`);
      }
    }
  });
});
