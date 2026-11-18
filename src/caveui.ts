import { MUSHROOMS, MUSH_BY_ID } from './data';
import type { MushId } from './data';
import { Cellar } from './cellar';
import * as sim from './sim';
import type { State } from './sim';
import { play } from './sound';
import { $, fmt, clock, esc, setText } from './uikit';

/** Ce que la cave demande au reste de l'interface. */
export interface CaveHost {
  state(): State;
  toast(text: string): void;
  buzz(ms: number): void;
  bumpCoins(): void;
  /** Ouvre la fiche d'achat de la cave, tant qu'elle n'est pas creusée. */
  openShop(): void;
  /** Ferme la fiche ouverte avant de descendre. */
  closeSheet(): void;
}

/** La cave à champignons : écran 3D, bandeau, étiquettes des bacs et panneau du bas. */
export class CaveUI {
  private cellar: Cellar;
  private labelsHtml = '';
  private tip = '';
  private tipAt = 0;
  /** Bac vide pour lequel on choisit un champignon (-1 : aucun). */
  private picking = -1;

  constructor(private host: CaveHost) {
    $('cave').innerHTML = '<canvas id="cvgl"></canvas><div class="tr-top"><div class="tr-row cv-row"><button class="btn small cv-up" data-act="cave-close">Remonter</button><span class="pill" id="cv-coins"></span><span class="pill" id="cv-time"></span></div></div><div id="cv-labels"></div><p id="cv-hint" class="on"></p><div id="cv-pick"></div>';
    const c = new Cellar($('cvgl') as HTMLCanvasElement);
    this.cellar = c;
    c.state = () => host.state();
    c.onChange = () => this.hud();
    c.onAsk = (i) => { this.picking = i; this.panel(); };
    c.onPick = (i) => {
      const s = host.state(), gain = sim.pickBed(s, i);
      if (gain) { play('coin'); host.buzz(25); this.say(`Cueilli : +${fmt(gain)} 🪙${sim.isNight(s) ? ' (prime de nuit)' : ''}`); host.bumpCoins(); }
    };
    c.onClear = (i) => { if (sim.clearBed(host.state(), i)) { play('tap'); host.buzz(15); this.say('Bac vidé : tu peux le réensemencer.'); } };
    c.onHint = (_i, k) => {
      if (k === 'buy') { const p = sim.caveBedPrice(host.state()); this.say(p === null ? 'La cave est pleine.' : `Un bac de plus : ${fmt(p)} 🪙. Touche « Bac en plus » en bas.`); return; }
      this.say(k === 'cut' ? 'Mûr ! Balaie le bac d\'un coup de doigt pour cueillir.' : 'Garde le doigt sur le bac pour le brumiser.');
    };
  }

  /** Accès pour le débogage et les tests. */
  get scene(): Cellar {
    return this.cellar;
  }

  /** Traite les actions `cave-…`. Rend faux pour une action qui n'est pas de la cave. */
  act(name: string, arg: string): boolean {
    const s = this.host.state(), h = this.host;
    switch (name) {
      case 'cave-go':
        if (!s.cave) { h.openShop(); break; }
        h.closeSheet();
        $('cave').className = 'on';
        this.picking = -1;
        this.labelsHtml = '';
        this.cellar.open();
        this.panel();
        break;
      case 'cave-buy':
        if (sim.buyCave(s)) { play('level'); h.buzz(30); this.act('cave-go', ''); }
        else h.toast('Pas assez de pièces.');
        break;
      case 'cave-close':
        this.cellar.close();
        $('cave').className = '';
        break;
      case 'cave-bed':
        if (sim.buyCaveBed(s)) { play('craft'); h.buzz(20); this.say('Nouveau bac installé sur l\'étagère.'); this.panel(); }
        else h.toast('Pas assez de pièces.');
        break;
      case 'cave-seed':
        if (sim.seedBed(s, this.picking, arg as MushId)) { play('plant'); h.buzz(15); this.say(`${MUSH_BY_ID[arg as MushId].name} : ensemencé. Garde le bac humide.`); this.picking = -1; this.panel(); }
        else h.toast('Pas assez de pièces.');
        break;
      case 'cave-cancel':
        this.picking = -1;
        this.panel();
        break;
      default:
        return false;
    }
    return true;
  }

  /** Une phrase en bas de la cave, qui s'efface d'elle-même. */
  private say(text: string): void {
    this.tip = text;
    this.tipAt = Date.now();
  }

  /** Le bas de la cave : choisir un champignon pour un bac vide, ou acheter un bac de plus. */
  private panel(): void {
    const s = this.host.state(), c = s.cave, box = $('cv-pick');
    if (!c) { box.innerHTML = ''; return; }
    if (this.picking >= 0 && !c.beds[this.picking]) {
      const rows = MUSHROOMS.map((m) => {
        const open = sim.mushOpen(s, m.id), can = open && s.coins >= m.price;
        const ds = open ? `${m.glow ? 'Seulement la nuit · ' : ''}${Math.round(m.grow / 60)} min de nuit par volée · ${sim.MUSH_FLUSHES_N} volées de ~${fmt(m.value)} 🪙` : `Après ${m.need} cueillettes (tu en as ${c.total})`;
        return `<button class="card${open ? '' : ' dim'}" data-act="cave-seed" data-arg="${m.id}" ${can ? '' : 'disabled'}><div class="ico">🍄</div><div class="mid"><div class="nm">${esc(m.name)}</div><div class="ds">${ds}</div></div><div class="end">${open ? `${fmt(m.price)} 🪙` : '🔒'}</div></button>`;
      }).join('');
      box.innerHTML = `<div class="cv-panel"><div class="cv-head"><b>Que faire pousser ?</b><button class="btn small" data-act="cave-cancel">Fermer</button></div><div class="cv-list">${rows}</div></div>`;
      box.className = 'on';
      return;
    }
    const p = sim.caveBedPrice(s);
    box.innerHTML = p !== null ? `<button class="btn small cv-more" data-act="cave-bed" ${s.coins >= p ? '' : 'disabled'}>Bac en plus · ${fmt(p)} 🪙</button>` : '';
    box.className = '';
  }

  /** Bandeau de la cave et une étiquette au-dessus de chaque bac. */
  private hud(): void {
    const t = this.cellar, s = this.host.state(), c = s.cave;
    if (!t.active || !c) return;
    setText('cv-coins', `🪙 ${fmt(s.coins)}`);
    setText('cv-time', sim.isNight(s) ? `🌑 Nuit` : `☀️ Nuit dans ${clock(Math.max(0, sim.untilNight(s)))}`);
    const labels = c.beds.map((b, i) => {
      if (!b) return `<div class="cvl empty" data-i="${i}"><small>Bac vide</small><small>Touche pour semer</small></div>`;
      const m = MUSH_BY_ID[b.m], nm = m.name.replace(/^Champignon de /, '');
      if (sim.mushRotten(b)) return `<div class="cvl rot" data-i="${i}"><small>${esc(nm)}</small><small>Pourri · touche pour vider</small></div>`;
      const ripe = b.prog >= 1;
      return `<div class="cvl${ripe ? ' ripe' : ''}${b.wet < 0.2 ? ' dry' : ''}" data-i="${i}"><small>${esc(nm)} · ${b.flush + 1}/${sim.MUSH_FLUSHES_N}</small>${ripe ? `<small>Mûr · ${fmt(sim.mushValue(s, b))} 🪙</small>` : '<i class="pg"><u></u></i>'}<i class="wt"><u></u></i></div>`;
    }).join('');
    const box = $('cv-labels');
    if (labels !== this.labelsHtml) { this.labelsHtml = labels; box.innerHTML = labels; }
    c.beds.forEach((b, i) => {
      const el = box.children[i] as HTMLElement | undefined;
      if (!el) return;
      const r = t.bedScreen(i);
      el.style.left = r.x + 'px';
      el.style.top = r.y + 'px';
      if (!b) return;
      const pg = el.querySelector('.pg u') as HTMLElement | null, wt = el.querySelector('.wt u') as HTMLElement | null;
      if (pg) pg.style.width = Math.round(b.prog * 100) + '%';
      if (wt) wt.style.width = Math.round(b.wet * 100) + '%';
    });
    const ripe = c.beds.some((b) => b && b.prog >= 1 && !sim.mushRotten(b)), dry = c.beds.some((b) => b && b.wet < 0.2 && b.prog < 1);
    const fresh = Date.now() - this.tipAt < 2600;
    const hint = fresh ? this.tip : t.mode === 'mist' ? '💦 Brumisation…' : ripe ? 'Balaie un bac mûr du doigt pour cueillir.' : dry ? 'Un bac a soif : garde le doigt dessus pour le brumiser.' : c.beds.every((b) => !b) ? 'Touche un bac vide pour y semer du blanc de champignon.' : sim.isNight(s) ? 'La nuit, les champignons poussent trois fois plus vite.' : '';
    setText('cv-hint', hint);
    $('cv-hint').className = hint ? 'on' : '';
  }
}
