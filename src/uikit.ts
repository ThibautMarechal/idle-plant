/** Petites briques d'interface partagées : formats, pastilles, tuiles. */
import { GLAZES, LEVEL_WORDS, PATTERNS, POT_SIZES, RARITIES } from './data';
import type { Species } from './data';


import * as sim from './sim';


export const EMOJI: Record<string, string> = {
  echeveria: '🪴', aloe: '🌵', lithops: '🪨', basilic: '🌿', menthe: '🍃', lavande: '🪻', boston: '☘️', capillaire: '🍀',
  pensee: '🌼', pelargonium: '🌺', strelitzia: '🦜', phalaenopsis: '🌸', paphiopedilum: '🥿', fantome: '👻',
  haworthia: '🦓', echinocactus: '🌵', opuntia: '🌵', thym: '🌿', romarin: '🌿', ciboulette: '🧅', platycerium: '🦌', asplenium: '🪺',
  cattleya: '💮', dendrobium: '🌸', tournesol: '🌻', tulipe: '🌷', hibiscus: '🌺', semper: '🌷', monstera: '🌴', calathea: '🍃',
  pilea: '🪙', chlorophytum: '🕷️', anthurium: '❤️', dionee: '🪤', drosera: '💧', sarracenia: '🏺',
  figuier: '🌳', hortensia: '💠', olivier: '🫒', citronnier: '🍋', camelia: '🏵️', erable: '🍁', bonsai: '🎍',
  dahlia: '🌺', muguet: '🔔', rose: '🌹', pivoine: '🌸',
};
export const ZONE_SHORT = ['Ombre', 'Bassin', 'Porte', 'Plein sud'];

export type SheetKind = 'trek' | 'season' | 'trophies' | 'atelier' | 'paint' | 'vitrine' | 'none' | 'seed' | 'buypot' | 'plant' | 'harvest' | 'packets' | 'market' | 'shop' | 'almanac' | 'fiche' | 'zone';

export const $ = (id: string) => document.getElementById(id)!;
export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const mult = (p: number) => '×' + p.toFixed(2).replace('.', ',');
export const stars = (n: number) => '⭐'.repeat(n) + '☆'.repeat(3 - n);
export const vname = (sp: Species, vr: number) => sp.name + (vr ? ' ' + sim.VARIANTS[vr] : '');
export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const clock = (sec: number) => { const w = Math.max(0, Math.ceil(sec)); return `${Math.floor(w / 60)}:${String(w % 60).padStart(2, '0')}`; };
/** Pastille de couleur et nom d'un pot. */
export function potLabel(pd: sim.PotDesign | undefined): string {
  const g = GLAZES[pd?.glaze ?? 0];
  const size = POT_SIZES[(pd?.size ?? 1) - 1];
  return `<span class="potdot" style="background:${hex(g.color)};border-color:${hex(g.rim)}"></span>${size.name} · ${g.name.toLowerCase()}${pd?.paint ? ', peint à la main' : pd?.pat ? ' à ' + PATTERNS[pd.pat].toLowerCase() : ''}${pd?.prof ? ', tourné main' : ''}`;
}
/** Tuile d'action : une icône, un mot. Toutes les actions secondaires d'un panneau ont la même forme. */
export const tile = (act: string, ico: string, label: string, opt: { arg?: string; off?: boolean; hot?: boolean; note?: string } = {}) =>
  `<button class="tile${opt.hot ? ' hot' : ''}" data-act="${act}"${opt.arg ? ` data-arg="${opt.arg}"` : ''}${opt.off ? ' disabled' : ''}><span>${ico}</span>${label}${opt.note ? `<small>${opt.note}</small>` : ''}</button>`;
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function rarTag(sp: Species): string {
  const r = RARITIES[sp.rarity];
  return `<span class="rar" style="background:${r.color}">${r.name}</span>`;
}

export function needsChips(sp: Species, c?: { light: number; temp: number; hum: number }): string {
  const one = (icon: string, k: 'light' | 'temp' | 'hum') => {
    const cls = c ? (c[k] === sp[k] ? 'ok' : 'ko') : '';
    return `<span class="chip ${cls}">${icon} ${LEVEL_WORDS[k][sp[k]]}</span>`;
  };
  return `<div class="chips">${one('☀️', 'light')}${one('🌡️', 'temp')}${one('💧', 'hum')}</div>`;
}

/** Diagnostic en langage de jardinier : dit toujours pourquoi ça va bien ou mal. */
export function conditions(sp: Species, c: { light: number; temp: number; hum: number }): string {
  const line = (k: 'light' | 'temp' | 'hum', label: string, hi: string, lo: string) => {
    const d = c[k] - sp[k];
    if (d === 0) return `<div>✅ ${label} : ${LEVEL_WORDS[k][c[k]].toLowerCase()}, parfait</div>`;
    return `<div>⚠️ ${d > 0 ? hi : lo}</div>`;
  };
  if (c.light === sp.light && c.temp === sp.temp && c.hum === sp.hum) return '<div class="cond ok">✅ Cet emplacement lui convient parfaitement.</div>';
  return `<div class="cond">${
    line('light', 'Lumière', 'Trop de soleil : ses feuilles frisent et jaunissent.', 'Pas assez de lumière : elle s\'étiole.')
  }${line('temp', 'Température', 'Trop chaud ici : elle flétrit.', 'Trop frais ici : elle pousse au ralenti.')
  }${line('hum', 'Humidité', 'Air trop humide : gare à la moisissure.', 'Air trop sec : le bout des feuilles brunit.')}</div>`;
}

export function sparkline(hist: number[], color: string): string {
  const w = 86, h = 30;
  const lo = Math.min(0.8, ...hist) - 0.05, hi = Math.max(1.2, ...hist) + 0.05;
  const yOf = (p: number) => h - 3 - ((p - lo) / (hi - lo)) * (h - 6);
  const pts = hist.map((p, i) => `${((i / Math.max(1, hist.length - 1)) * w).toFixed(1)},${yOf(p).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}"><line x1="0" x2="${w}" y1="${yOf(1)}" y2="${yOf(1)}" stroke="#d9cdb0" stroke-dasharray="3 3"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Couleur selon le niveau du cours : vert quand il est bon pour vendre, rouge quand il est bas. */
export function level(p: number): string {
  return p >= 1.1 ? 'up' : p <= 0.9 ? 'down' : '';
}

export function trend(hist: number[]): { cls: string; arrow: string } {
  const a = hist[hist.length - 1], b = hist[Math.max(0, hist.length - 4)];
  if (a - b > 0.03) return { cls: 'up', arrow: '▲' };
  if (b - a > 0.03) return { cls: 'down', arrow: '▼' };
  return { cls: '', arrow: '•' };
}

