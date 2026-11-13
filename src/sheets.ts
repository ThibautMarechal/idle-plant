/** Le contenu de chaque panneau, un par fonction. `ui` donne l'état et le panneau ouvert. */
import { BASKETS, BIOMES, GARDEN, GARDEN_FIRST, GARDEN_INDEX, SEASONS, FAMILIES, FAMILY_IDS, GLAZES, LEVEL_WORDS, POT_SIZES, RARITIES, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, STAGES, ZONES } from './data';
import type { Species } from './data';
import { THEMES } from './themes';
import * as sim from './sim';


import type { UI } from './ui';
import { EMOJI, fmt, mult, stars, vname, clock, potLabel, tile, esc, rarTag, needsChips, conditions, sparkline, level, trend } from './uikit';

export function head(ui: UI, title: string): string {
  return `<div class="sh-head"><h2>${title}</h2><button class="x" data-act="close">✕</button></div>`;
}

export function sheetHtml(ui: UI): string {
  const s = ui.s;
  switch (ui.kind) {
    case 'buypot': return buyPotHtml(ui);
    case 'seed': return seedHtml(ui);
    case 'plant': return plantHtml(ui);
    case 'harvest': return harvestHtml(ui);
    case 'packets': return packetsHtml(ui);
    case 'market': return marketHtml(ui);
    case 'shop': return shopHtml(ui);
    case 'almanac': return almanacHtml(ui);
    case 'fiche': return ficheHtml(ui, SPECIES_BY_ID[ui.argId]);
    case 'zone': return zoneHtml(ui);
    case 'vitrine': return vitrineHtml(ui);
    case 'atelier': return atelierHtml(ui);
    case 'trophies': return trophiesHtml(ui);
    case 'season': return seasonHtml(ui);
    case 'trek': return trekHtml(ui);
    default: return '';
  }
  void s;
}

export function zoneLine(ui: UI, i: number): string {
  const z = sim.zoneOfSlot(i);
  const c = sim.zoneClimate(ui.s, z);
  return `<p class="sub">${z.icon} <b>${ui.zname(ZONES.indexOf(z))}</b> : ${LEVEL_WORDS.light[c.light].toLowerCase()}, ${LEVEL_WORDS.temp[c.temp].toLowerCase()}, ${LEVEL_WORDS.hum[c.hum].toLowerCase()}.</p>`;
}

export function vitrineHtml(ui: UI): string {
  const s = ui.s;
  const tips = Math.floor(s.tips);
  const perMin = sim.showcaseRate(s) * 60;
  const free = s.showcase.filter((h) => !h).length;
  const rows = s.showcase.map((h, k) => {
    if (!h) return '';
    const sp = SPECIES_BY_ID[h.sp];
    const rate = sp.value * sim.qualityMult(h.q) * sim.VARIANT_MULT[h.vr] * sim.TIP_RATE * 60;
    return `<div class="card"><div class="ico">${EMOJI[sp.id]}</div><div class="mid"><div class="nm">${esc(vname(sp, h.vr))}</div><div class="ds">${sim.qualityWord(h.q)} · ${rate.toFixed(1).replace('.', ',')} 🪙 par minute</div></div><button class="btn small" data-act="unshow" data-arg="${k}">Vendre ${fmt(sim.saleValue(s, h))} 🪙</button></div>`;
  }).join('');
  return head(ui, '🏛️ Vitrine') + `<div class="sh-body">
    <p class="sub">Les plantes exposées attirent des visiteurs qui laissent des pourboires, même en ton absence.</p>
    <div class="facts"><span class="chip">👥 ${fmt(s.visitors)} visiteurs</span><span class="chip">🪙 ${perMin.toFixed(1).replace('.', ',')} par minute</span></div>
    <button class="btn gold wide" data-act="tips" ${tips > 0 ? '' : 'disabled'}>Ramasser les pourboires · ${fmt(tips)} 🪙</button>
    ${rows}
    ${free ? `<p class="sub center">${free} socle${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''} : touche une plante en fleur, puis « Exposer ».</p>` : ''}</div>`;
}

export function zoneHtml(ui: UI): string {
  const s = ui.s;
  const garden = ui.arg === GARDEN_INDEX;
  const z = ZONES[ui.arg] ?? GARDEN;
  const price = sim.ZONE_PRICES[ui.arg];
  const can = s.coins >= price;
  const c = sim.zoneClimate(s, z);
  const fans = SPECIES.filter((sp) => sim.fitOf(sp, c) >= 1 && s.disc[sp.id]?.seen).map((sp) => `${EMOJI[sp.id]} ${sp.name}`);
  return head(ui, `${z.icon} ${ui.zname(ui.arg)}`) + `<div class="sh-body">
    <p class="sub">${garden ? 'Derrière la porte, un jardin en plein air : trois emplacements de plus. Son climat change à chaque saison.' : 'Ce coin est encore encombré. Aménage-le pour gagner trois emplacements.'}</p>
    ${zoneLine(ui, garden ? GARDEN_FIRST : ui.arg * SLOTS_PER_ZONE)}
    <p class="sub">${fans.length ? 'Parfaite pour : ' + fans.join(', ') + '.' : 'Aucune de tes espèces connues n\'y serait parfaitement à l\'aise pour l\'instant.'}</p>
    <button class="btn primary wide" data-act="openzone" ${can ? '' : 'disabled'}>Aménager · ${fmt(price)} 🪙</button>
    ${can ? '' : `<p class="sub center">Il te manque ${fmt(price - s.coins)} 🪙.</p>`}</div>`;
}

export function paintTarget(ui: UI): sim.PotDesign | undefined {
  const { where, k } = ui.paintAt;
  if (where === 'shelf') return ui.s.shelf[k];
  return ui.s.slots[k]?.pot ? ui.s.slots[k].pd ?? { size: 1, glaze: 0, pat: 0 } : undefined;
}

export function buyPotHtml(ui: UI): string {
  const s = ui.s;
  const price = sim.potPrice(s);
  const can = s.coins >= price;
  const shelf = s.shelf.map((pd, k) => `<button class="card" data-act="place" data-arg="${k}"><div class="ico">🏺</div><div class="mid"><div class="nm">${potLabel(pd)}</div><div class="ds">Façonné à l'atelier</div></div><div class="end">Poser</div></button>`).join('');
  return head(ui, 'Emplacement libre') + `<div class="sh-body">${zoneLine(ui, ui.arg)}
    ${shelf ? `<h3>Tes pots façonnés</h3>${shelf}` : ''}
    <h3>Pot tout fait</h3>
    <p class="sub">Un petit pot en terre cuite, tout de suite. Les pots moyens et grands, pour les arbustes et les grandes plantes, se façonnent à l'atelier.</p>
    <button class="btn primary wide" data-act="buypot" ${can ? '' : 'disabled'}>Acheter un petit pot · ${fmt(price)} 🪙</button>
    ${can ? '' : `<p class="sub center">Il te manque ${fmt(price - s.coins)} 🪙.</p>`}
    <button class="btn wide" data-act="nav" data-arg="atelier">🏺 Aller à l'atelier</button></div>`;
}

export function atelierHtml(ui: UI): string {
  const s = ui.s;
  const k = s.kiln;
  const kiln = !k ? '<p class="sub">Le four est vide. Choisis une taille et passe au tour.</p>'
    : k.left > 0
      ? `<div class="kv"><span>${POT_SIZES[k.size - 1].name} en cuisson</span><b>${clock(k.left)}</b></div><div class="kilnbar"><i style="width:${Math.round((1 - k.left / POT_SIZES[k.size - 1].fire) * 100)}%"></i></div>`
      : `<button class="btn gold wide" data-act="kiln">🔥 Défourner le ${POT_SIZES[k.size - 1].name.toLowerCase()}</button>`;
  const sizes = POT_SIZES.map((d, n) => {
    const ok = !k && s.clay >= d.clay;
    const what = n === 0 ? 'Pour la plupart des plantes.' : n === 1 ? 'Pour les grandes plantes et les petits arbustes.' : 'Pour les arbres : figuier, olivier, citronnier, érable.';
    return `<button class="card" data-act="wheel" data-arg="${n + 1}" ${ok ? '' : 'style="opacity:.6"'}><div class="ico" style="font-size:${18 + n * 7}px">🏺</div><div class="mid"><div class="nm">${d.name} · ${d.clay} 🧱</div><div class="ds">${what} Cuisson ${d.fire < 60 ? d.fire + ' s' : Math.round(d.fire / 60) + ' min'}.</div></div><div class="end">Tourner</div></button>`;
  }).join('');
  const shelf = s.shelf.map((pd, n) => `<div class="card"><div class="ico">🏺</div><div class="mid"><div class="nm">${potLabel(pd)}</div><div class="ds">Touche un emplacement libre de la serre pour le poser.</div></div><button class="btn small" data-act="paintshelf" data-arg="${n}">🎨 Peindre</button></div>`).join('');
  const next = sim.CLAY_EVERY - s.clayAcc;
  return head(ui, '🏺 Atelier de poterie') + `<div class="sh-body">
    <div class="kv"><span>🧱 Argile</span><b>${s.clay} / ${sim.clayCap(s)}${s.clay < sim.clayCap(s) ? ` · +1 dans ${clock(next)}` : ' · bac plein'}</b></div>
    <h3>Four</h3>${kiln}
    <h3>Tour de potier</h3>${sizes}
    <h3>Étagère (${s.shelf.length}/${sim.SHELF_CAP})</h3>${shelf || '<p class="sub">Aucun pot en attente.</p>'}
    <p class="sub">Un fond accordé à la famille de la plante la fait pousser ${Math.round((sim.HARMONY_SPEED - 1) * 100)} % plus vite.</p></div>`;
}

export function seedHtml(ui: UI): string {
  const s = ui.s;
  const c = sim.zoneClimate(s, sim.zoneOfSlot(ui.arg));
  const ids = Object.keys(s.seeds).sort((a, b) => sim.fitOf(SPECIES_BY_ID[b], c) - sim.fitOf(SPECIES_BY_ID[a], c));
  const size = sim.potSize(s.slots[ui.arg]);
  const list = ids.map((id) => {
    const sp = SPECIES_BY_ID[id];
    const small = sim.sizeOf(sp) > size;
    return `<button class="card" data-act="plant" data-arg="${id}" ${small ? 'disabled style="opacity:.55"' : ''}><div class="ico">${EMOJI[id]}</div><div class="mid"><div class="nm">${esc(sp.name)} ${rarTag(sp)}</div>${sim.inSeason(s, sp) ? `<div class="ds">${SEASONS[sim.seasonOf(s).index].icon} De saison : pousse plus vite</div>` : ''}${small ? `<div class="ds">🏺 Il lui faut un ${POT_SIZES[sim.sizeOf(sp) - 1].name.toLowerCase()} : façonne-le à l'atelier.</div>` : needsChips(sp, c)}</div><div class="end">×${s.seeds[id]}</div></button>`;
  }).join('');
  const empty = `<p class="sub">Tu n'as plus de graines.</p>${s.packets > 0
    ? '<button class="btn gold wide" data-act="free">🎁 Ouvrir un sachet gratuit</button>'
    : `<button class="btn primary wide" data-act="buypacket" ${s.coins >= sim.PRICES.packet ? '' : 'disabled'}>Sachet mystère · ${sim.PRICES.packet} 🪙</button>`}`;
  return head(ui, 'Que semer ici ?') + `<div class="sh-body">${zoneLine(ui, ui.arg)}${ids.length ? list : empty}<div class="kv"><span>Ce pot</span><b>${potLabel(s.slots[ui.arg].pd)}</b></div><div class="tiles">${tile('paintslot', '🎨', 'Peindre')}${tile('admire', '🔍', 'Admirer')}${tile('stow', '📥', 'Ranger')}</div></div>`;
}

export function plantHtml(ui: UI): string {
  const s = ui.s;
  const p = s.slots[ui.arg].plant;
  if (!p) return head(ui, 'Pot vide') + '<div class="sh-body"></div>';
  const sp = SPECIES_BY_ID[p.sp];
  const c = sim.zoneClimate(s, sim.zoneOfSlot(ui.arg));
  const fit = sim.fitOf(sp, c);
  const left = ((1 - p.prog) * sp.grow) / (fit * (p.water > 0 ? 1 : 0.25) * (p.pests > 0 ? 0.5 : 1));
  const eta = left < 60 ? `${Math.ceil(left)} s` : `${Math.ceil(left / 60)} min`;
  const vr = sim.stageOf(p.prog) >= 2 ? p.vr : 0;
  const slot = s.slots[ui.arg];
  return head(ui, `${EMOJI[sp.id]} ${esc(vname(sp, vr))}`) + `<div class="sh-body">
    <div class="kv"><span>${STAGES[sim.stageOf(p.prog)]}</span><b>${p.prog >= 1 ? 'Prête' : 'encore ' + eta}</b></div>
    <div class="prog"><i style="width:${Math.round(p.prog * 100)}%"></i></div>
    <div class="facts"><span class="chip">⭐ ${sim.qualityWord(p.q)}</span><span class="chip ${p.water > 0 ? '' : 'ko'}">💧 ${s.upgrades.water ? 'auto' : p.water > 0 ? Math.round(p.water * 100) + ' %' : 'à sec'}</span>${p.pests > 0 ? '<span class="chip ko">🐛 chenilles</span>' : ''}${sim.harmony(slot) ? '<span class="chip ok">💚 pot accordé</span>' : ''}${sim.inSeason(s, sp) ? '<span class="chip ok">de saison</span>' : ''}</div>
    ${conditions(sp, c)}
    <div class="tiles">${s.upgrades.water ? '' : tile('water', '💧', 'Arroser', { off: p.water > 0.95, hot: p.water < 0.5 })}${tile('fert', '🧪', 'Engrais', { off: !(s.fert > 0 && p.prog < 1), note: '×' + s.fert })}${p.cut === 1 && p.prog < 1 ? tile('prune', '✂️', 'Tailler', { hot: true }) : ''}${tile('paintslot', '🎨', 'Peindre')}${tile('admire', '🔍', 'Admirer')}${tile('fiche', '📖', 'Fiche', { arg: sp.id })}</div></div>`;
}

export function marketHint(ui: UI, p: number): string {
  if (p >= 1.2) return '<span class="up">Cours haut : c\'est le moment de vendre.</span>';
  if (p <= 0.85) return '<span class="down">Cours bas : mieux vaut attendre en réserve.</span>';
  return 'Cours proche de la normale.';
}

export function harvestHtml(ui: UI): string {
  const s = ui.s;
  const p = s.slots[ui.arg].plant;
  if (!p) return head(ui, 'Récolte') + '<div class="sh-body"></div>';
  const sp = SPECIES_BY_ID[p.sp];
  const m = s.market[sp.family];
  const full = s.stock.length >= s.stockCap;
  const d = s.disc[sp.id];
  const n = sim.starsOf(d);
  const freeShow = s.showcase.some((h) => !h);
  return head(ui, `${EMOJI[sp.id]} ${esc(vname(sp, p.vr))} en fleur`) + `<div class="sh-body">
    <div class="big">${stars(n)}</div>
    <p class="sub center">Spécimen ${sim.qualityWord(p.q).toLowerCase()}.${n >= 3 ? '' : ' Un emplacement parfait et de bons soins donnent plus d\'étoiles.'}</p>
    ${s.order && sim.orderFits(s, p) ? `<button class="btn gold wide" data-act="deliver">📦 Livrer à ${esc(s.order.who)} · ${fmt(sim.saleValue(s, p) + s.order.coins)} 🪙 +${s.order.clay} 🧱</button>` : ''}
    <div class="row"><button class="btn primary" data-act="sell">Vendre · ${fmt(sim.saleValue(s, p))} 🪙</button><button class="btn gold" data-act="show" ${freeShow ? '' : 'disabled'}>🏛️ ${freeShow ? 'Exposer' : 'Vitrine pleine'}</button></div>
    <p class="sub center">Cours ${FAMILIES[sp.family].name.toLowerCase()} <b class="${level(m.p)}">${mult(m.p)}</b>. ${marketHint(ui, m.p)}</p>
    <div class="tiles">${tile('store', '📦', 'Réserve', { off: full, note: `${s.stock.length}/${s.stockCap}` })}${tile('cutting', '✂️', 'Bouturer', { note: '+2 graines' })}${sim.CROSS_FEE[sp.rarity] ? tile('cross', '🧬', 'Croiser', { note: `${sim.CROSS_FEE[sp.rarity]} 🪙` }) : ''}${tile('admire', '🔍', 'Admirer')}${tile('fiche', '📖', 'Fiche', { arg: sp.id })}</div></div>`;
}

export function packetsHtml(ui: UI): string {
  const s = ui.s;
  const wait = Math.max(0, Math.ceil(s.packetIn));
  const timer = `${Math.floor(wait / 60)} min ${String(wait % 60).padStart(2, '0')}`;
  const seeds = Object.keys(s.seeds).map((id) => {
    const sp = SPECIES_BY_ID[id];
    return `<div class="card"><button class="ico" data-act="fiche" data-arg="${id}">${EMOJI[id]}</button><div class="mid"><div class="nm">${esc(sp.name)} ×${s.seeds[id]}</div><div class="ds">${rarTag(sp)}</div></div><button class="btn small" data-act="compost" data-arg="${id}">En engrais</button></div>`;
  }).join('');
  return head(ui, '🎁 Sachets de graines') + `<div class="sh-body">
    <p class="sub">Un sachet gratuit toutes les ${Math.round(sim.PACKET_EVERY / 60)} minutes, jusqu'à ${sim.MAX_PACKETS} en attente.</p>
    <button class="btn gold wide" data-act="free" ${s.packets > 0 ? '' : 'disabled'}>${s.packets > 0 ? `Ouvrir un sachet gratuit (${s.packets})` : `Prochain sachet dans ${timer}`}</button>
    <button class="btn wide" data-act="buypacket" ${s.coins >= sim.PRICES.packet ? '' : 'disabled'}>Sachet mystère · ${sim.PRICES.packet} 🪙</button>
    <h3>Mes graines</h3><p class="sub">Une graine en trop devient une dose d'engrais 🧪 (tu en as ${s.fert}).</p>${seeds || '<p class="sub">Aucune graine en attente. Touche un pot vide dans la serre pour semer.</p>'}</div>`;
}

export function marketHtml(ui: UI): string {
  const s = ui.s;
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
  return head(ui, '📈 Marché') + `<div class="sh-body">
    <p class="sub">Le prix de vente suit le cours de chaque famille.</p>${rows}
    <h3>Réserve (${s.stock.length}/${s.stockCap})</h3>${stock || '<p class="sub">Vide. Quand un cours est bas, garde tes plantes en fleur ici et vends au prochain pic.</p>'}
    <h3>Dernières nouvelles</h3>${news || '<p class="sub">Le marché est calme pour l\'instant.</p>'}</div>`;
}

export function shopHtml(ui: UI): string {
  const s = ui.s;
  const item = (ico: string, nm: string, ds: string, price: number, act: string, arg: string, owned = false) =>
    `<div class="card"><div class="ico">${ico}</div><div class="mid"><div class="nm">${nm}</div><div class="ds">${ds}</div></div>${owned
      ? '<span class="chip ok">Installé</span>'
      : `<button class="btn ${s.coins >= price ? 'primary' : ''} small" data-act="${act}" data-arg="${arg}" ${s.coins >= price ? '' : 'disabled'}>${fmt(price)} 🪙</button>`}</div>`;
  const gear = (ico: string, nm: string, ds: string, k: sim.ClimateGear) => !s.upgrades[k] ? item(ico, nm, ds, sim.PRICES[k], 'upgrade', k)
    : `<div class="card"><div class="ico">${ico}</div><div class="mid"><div class="nm">${nm}</div><div class="ds">${ds}</div></div><button class="btn small ${s.off[k] ? '' : 'primary'}" data-act="gear" data-arg="${k}">${s.off[k] ? 'Éteint' : 'Allumé'}</button></div>`;
  return head(ui, '🛒 Boutique') + `<div class="sh-body">
    <h3>Graines</h3>
    ${item('💎', 'Sachet prestige', 'Trois graines, toutes rares ou mieux.', sim.PRICES.prestige, 'prestige', '')}
    ${item('🎁', 'Sachet mystère', 'Trois graines de toutes familles.', sim.PRICES.packet, 'buypacket', '')}
    <p class="sub">Sachet d'une seule famille, trois graines · ${sim.PRICES.familyPacket} 🪙</p>
    <div class="tiles four">${FAMILY_IDS.map((f) => tile('buypacket', FAMILIES[f].icon, FAMILIES[f].name, { arg: f, off: s.coins < sim.PRICES.familyPacket })).join('')}</div>
    <h3>Équipement</h3>
    ${item('🚿', 'Arrosage automatique', 'Plus jamais de pot à sec, même en ton absence.', sim.PRICES.water, 'upgrade', 'water', s.upgrades.water)}
    ${item('🐞', 'Lâcher de coccinelles', 'Elles mangent les pucerons à ta place.', sim.PRICES.bugs, 'upgrade', 'bugs', s.upgrades.bugs)}
    <h3>Climat</h3>
    ${gear('🌫️', 'Brumisateur', 'Zone d\'ombre : l\'air devient humide. Pour les fougères.', 'mist')}
    ${gear('💡', 'Lampe horticole', 'Zone fraîche : plein soleil. Pour les tulipes.', 'lamp')}
    ${gear('♨️', 'Radiateur', 'Zone fraîche : tempéré au lieu de frais.', 'heat')}
    ${gear('🌀', 'Ventilateur', 'Zone plein sud : tempéré au lieu de chaud. Pour lavande, thym et romarin.', 'fan')}
    ${s.stockCap < 10 ? item('📦', 'Réserve agrandie', `Deux places de plus (${s.stockCap} aujourd'hui).`, sim.PRICES.stock, 'upgrade', 'stock') : ''}
    <h3>Agrandir la serre</h3>
    ${ZONES.map((z, r) => item(z.icon, `Suspension · ${ui.zname(r)}`, s.zonesOpen[r] ? 'Un emplacement de plus, en hauteur.' : 'Aménage d\'abord cette zone.', sim.EXTRA_PRICES[r], 'extra', String(r), !!s.extra?.[r])).join('')}
    <h3>Atelier</h3>
    ${item('🔥', 'Four à double foyer', 'Les pots cuisent deux fois plus vite.', sim.PRICES.fastKiln, 'upgrade', 'fastKiln', !!s.upgrades.fastKiln)}
    ${item('🧱', 'Grand bac d\'argile', 'Le bac contient deux fois plus d\'argile.', sim.PRICES.bigClay, 'upgrade', 'bigClay', !!s.upgrades.bigClay)}
    <h3>Décor</h3>
    <div class="themes">${THEMES.map((t) => `<button class="theme ${t.id === ui.scene.themeId ? 'on' : ''}" data-act="theme" data-arg="${t.id}"><span class="sw" style="background:${t.bg}"></span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>
    </div>`;
}

export function trekHtml(ui: UI): string {
  const s = ui.s;
  const t = sim.trekOf(s);
  const next = BASKETS[t.basket + 1];
  const rows = BIOMES.map((b, k) => {
    const fams = b.fams.map((f) => FAMILIES[f].icon).join(' ');
    const end = !t.open[k] ? `<button class="btn ${s.coins >= b.price ? 'primary' : ''} small" data-act="trek-biome" data-arg="${k}" ${s.coins >= b.price ? '' : 'disabled'}>${fmt(b.price)} 🪙</button>`
      : t.rest > 0 ? `<span class="chip">${clock(t.rest)}</span>`
        : `<button class="btn gold small" data-act="trek-go" data-arg="${k}">Partir</button>`;
    return `<div class="card"><div class="ico">${b.icon}</div><div class="mid"><div class="nm">${b.name} ${fams}</div><div class="ds">${b.text}</div></div>${end}</div>`;
  }).join('');
  return head(ui, '🥾 Expédition') + `<div class="sh-body">
    <p class="sub">${t.rest > 0 ? `Tu te reposes encore ${clock(t.rest)} avant de repartir.` : 'Pars du camp à pied et cueille graines et boutures sauvages. Plus tu t\'éloignes, plus elles sont rares, mais sois rentré au camp avant la nuit ou tu perdras la moitié du panier.'}</p>
    ${rows}
    <div class="card"><div class="ico">🧺</div><div class="mid"><div class="nm">Panier : ${sim.basketCap(s)} plantes</div><div class="ds">${next ? `Un plus grand panier en porte ${next.cap}.` : 'C\'est le plus grand panier.'}</div></div>${next
      ? `<button class="btn ${s.coins >= next.price ? 'primary' : ''} small" data-act="trek-basket" ${s.coins >= next.price ? '' : 'disabled'}>${fmt(next.price)} 🪙</button>` : '<span class="chip ok">Maximum</span>'}</div></div>`;
}

export function seasonHtml(ui: UI): string {
  const s = ui.s;
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
  return head(ui, `${season.icon} ${season.name}`) + `<div class="sh-body">
    <p class="sub">${season.text}</p>
    <div class="kv"><span>Familles de saison</span><b>${fams}</b></div>
    <div class="kv"><span>Bonus</span><b>Croissance +${Math.round((sim.SEASON_SPEED - 1) * 100)} %</b></div>
    <div class="kv"><span>Saison suivante</span><b>${next.icon} ${next.name} dans ${clock(se.left)}</b></div>
    <h3>Concours de la saison</h3>
    <p class="sub">Fais fleurir les familles de saison avant qu'elle ne se termine.</p>
    <div class="big">${ct.blooms} 🌼</div>
    ${tiers}</div>`;
}

export function trophiesHtml(ui: UI): string {
  const s = ui.s;
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
  return head(ui, '🎓 Jardinier') + `<div class="sh-body">
    <div class="big">Niveau ${lv.level}</div>
    <div class="prog"><i style="width:${Math.round(100 * lv.into / lv.span)}%"></i></div>
    <p class="sub center">${fmt(lv.into)} / ${fmt(lv.span)} points avant le niveau suivant, qui offre des pièces, de l'argile et un sachet.</p>
    <h3>Trophées (${got}/${sim.TROPHIES.length})</h3>${rows}</div>`;
}

export function almanacHtml(ui: UI): string {
  const s = ui.s;
  const col = sim.collection(s);
  const cell = (sp: Species) => {
    const d = s.disc[sp.id];
    if (!d?.seen) return '<div class="sp locked"><span class="e">❔</span>???</div>';
    return `<button class="sp" data-act="fiche" data-arg="${sp.id}" style="border-color:${RARITIES[sp.rarity].color}55"><span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${d.bloomed ? `<span class="st">${stars(sim.starsOf(d))}${d.vars[1] ? '🤍' : ''}${d.vars[2] ? '💛' : ''}</span>` : '<span class="chip">à faire fleurir</span>'}</button>`;
  };
  const cells = FAMILY_IDS.map((f) => {
    const list = SPECIES.filter((sp) => sp.family === f);
    return `<h3>${FAMILIES[f].icon} ${FAMILIES[f].name} · ${list.filter((sp) => s.disc[sp.id]?.bloomed).length}/${list.length}</h3><div class="grid">${list.map(cell).join('')}</div>`;
  }).join('');
  return head(ui, '📖 Almanach') + `<div class="sh-body">
    <div class="big">${col.bloomed} / ${SPECIES.length}</div>
    <p class="sub center">espèces fleuries · ⭐ ${col.stars} sur ${SPECIES.length * 3} · ✨ ${col.variants} variantes sur ${SPECIES.length * 2}</p>
    <div class="tiles">${tile('nav', '🏛️', 'Vitrine', { arg: 'vitrine' })}${tile('nav', '🎓', 'Trophées', { arg: 'trophies' })}${tile('mute', s.mute ? '🔇' : '🔊', s.mute ? 'Sons coupés' : 'Sons')}</div>
    ${cells}
    <p class="sub center">${fmt(s.stats.sold)} plantes vendues · ${fmt(s.stats.earned)} 🪙 gagnées</p>
    <button class="linkb" data-act="reset">Recommencer la partie</button></div>`;
}

export function ficheHtml(ui: UI, sp: Species): string {
  const d = ui.s.disc[sp.id];
  const bloomed = !!d?.bloomed;
  const mins = Math.round(sp.grow / 60 * 10) / 10;
  return head(ui, `${EMOJI[sp.id]} ${esc(sp.name)}`) + `<div class="sh-body">
    <p class="sub"><i>${esc(sp.latin)}</i> · ${FAMILIES[sp.family].name} · ${esc(sp.origin)}</p>
    <div>${rarTag(sp)} <span class="st">${stars(sim.starsOf(d))}</span></div>
    <h3>Ce qu'elle aime</h3>${needsChips(sp)}
    <p class="sub">Idéal : ${[...ZONES, ...(ui.s.zonesOpen[GARDEN_INDEX] ? [GARDEN] : [])].filter((z) => sim.fitOf(sp, sim.zoneClimate(ui.s, z)) >= 1).map((z) => ui.zname(ZONES.indexOf(z))).join(', ') || 'aucun coin parfait pour l\'instant, cherche le moins mauvais ou équipe la serre'}.</p>
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
