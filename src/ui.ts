import { BASE_SLOTS, SEASONS, FAMILIES, FAMILY_IDS, GLAZES, LEVEL_WORDS, PAINTS, POT_SIZES, RARITIES, SLOTS_PER_ZONE, SPECIES, SPECIES_BY_ID, STAGES, ZONES } from './data';
import type { Family } from './data';
import type { Scene3D } from './scene';
import { buildPlant } from './plants3d';
import { Studio } from './studio';
import { finish, STYLES } from './styles';
import { themeOf } from './themes';
import * as sim from './sim';
import { play, setMuted, unlock } from './sound';
import type { State } from './sim';

import { EMOJI, ZONE_SHORT, SheetKind, $, fmt, stars, vname, hex, clock, potLabel, esc, rarTag } from './uikit';
import { sheetHtml, paintTarget } from './sheets';

export class UI {
  kind: SheetKind = 'none';
  arg = 0;
  argId = '';
  private lastSheet = '';
  private lastHud = '';
  private lastQuest = '';
  private lastNav = '';
  private lastOrder = '';
  /** Pot en cours de peinture : sur un emplacement ou sur l'étagère. */
  paintAt: { where: 'slot' | 'shelf'; k: number } = { where: 'slot', k: 0 };
  private studio!: Studio;
  /** Outil tenu au doigt : arrosoir ou gant, promené au-dessus des plantes. */
  private tool = '';
  private toolEl: HTMLElement | null = null;
  private toolAt: number[] = [];
  private toolUsed = false;
  private toolTarget = -1;
  private tipAt = 0;
  private seedsHtml = '';
  private viewSlot = -1;
  private pointerDown = false;
  private slotEls: HTMLButtonElement[] = [];
  private lockEls: HTMLButtonElement[] = [];
  private toastTimer = 0;
  private resetAskedAt = 0;
  /** Première plante choisie pour un croisement, ou -1. */
  private crossing = -1;
  private swipedAt = 0;
  private celebrate: string[] = [];
  private drag = -1;
  private dragTarget = -1;
  private holdAt: { x: number; y: number; i: number } | null = null;
  private edgeAt = 0;
  private showEl!: HTMLButtonElement;

  constructor(public s: State, readonly scene: Scene3D, private onReset: () => void) {
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
      // Glisser un pot : dès que le doigt bouge, le pot se soulève et suit.
      b.addEventListener('pointerdown', (e) => {
        this.holdAt = this.s.slots[i].pot ? { x: e.clientX, y: e.clientY, i } : null;
      });
      overlay.appendChild(b);
      this.slotEls.push(b);
    });
    this.showEl = document.createElement('button');
    this.showEl.className = 'showb';
    this.showEl.onclick = () => { if (Date.now() - this.swipedAt > 350) this.open('vitrine'); };
    overlay.appendChild(this.showEl);
    this.applyTheme();
    $('studio').innerHTML = '<div class="st-head"><h2 id="st-title"></h2><button class="x" data-act="st-close">✕</button></div><p id="st-hint"></p><canvas id="stgl"></canvas><div id="st-tools"></div>';
    this.studio = new Studio($('stgl') as HTMLCanvasElement);
    $('tools').innerHTML = '<button class="tool" data-tool="shears">✂️</button><button class="tool" data-tool="basket">🧺</button><button class="tool" data-tool="can">🚿</button><button class="tool" data-tool="glove">🧤</button>';
    const grab = (tool: string, label: string, el: HTMLElement, e: PointerEvent) => {
      this.tool = tool;
      this.toolUsed = false;
      this.toolTarget = -1;
      this.toolEl = document.createElement('div');
      this.toolEl.className = 'toolghost' + (tool.startsWith('seed:') ? ' seed' : '');
      this.toolEl.textContent = label;
      $('fx').appendChild(this.toolEl);
      el.classList.add('held');
      this.useTool(e.clientX, e.clientY);
    };
    $('tools').querySelectorAll<HTMLElement>('.tool').forEach((b) => b.addEventListener('pointerdown', (e) => grab(b.dataset.tool!, b.textContent!, b, e)));
    // Graines à glisser : on prend une graine dans la barquette et on la lâche sur un pot vide.
    $('seeds').addEventListener('pointerdown', (e) => {
      const chip = (e.target as HTMLElement).closest('.seedchip') as HTMLElement | null;
      if (chip) grab('seed:' + chip.dataset.id, EMOJI[chip.dataset.id!], chip, e);
    });
    const app = $('app');
    let sx = 0, sy = 0, st = 0, onScene = false;
    setMuted(!!this.s.mute);
    app.addEventListener('pointerdown', (e) => {
      unlock();
      this.pointerDown = true;
      sx = e.clientX; sy = e.clientY; st = Date.now();
      onScene = !(e.target as HTMLElement).closest('#sheet, #modal, #bottom, #hud, #backdrop, #studio');
    });
    app.addEventListener('pointermove', (e) => {
      if (this.tool) { this.useTool(e.clientX, e.clientY); return; }
      if (this.drag < 0) {
        if (!this.holdAt || Math.hypot(e.clientX - this.holdAt.x, e.clientY - this.holdAt.y) < 10) return;
        this.drag = this.holdAt.i;
        this.dragTarget = -1;
        this.scene.lift(this.drag);
        this.buzz(20);
        this.refresh(true);
      }
      this.moveGhost(e.clientX, e.clientY);
      // Près du bord haut ou bas, on change de zone sans lâcher le pot.
      const rect = app.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (this.scene.currentZone >= 0 && Date.now() - this.edgeAt > 800 && (y < 170 || y > rect.height - 200)) {
        this.edgeAt = Date.now();
        this.goZone(Math.max(0, Math.min(ZONES.length - 1, this.scene.currentZone + (y < 170 ? -1 : 1))));
      }
    });
    app.addEventListener('pointerup', (e) => {
      if (this.tool) { this.dropTool(); return; }
      this.pointerDown = false;
      const onPot = !!this.holdAt;
      this.holdAt = null;
      if (this.drag >= 0) {
        const from = this.drag, to = this.dragTarget;
        this.endDrag();
        this.swipedAt = Date.now();
        if (to >= 0 && to !== from && sim.movePot(this.s, from, to)) {
          this.scene.pop(to);
          this.buzz(15);
        }
        this.refresh(true);
        return;
      }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (onPot || !onScene || Date.now() - st > 900 || Math.max(Math.abs(dx), Math.abs(dy)) < 45) return;
      // Balayer vers la gauche ou vers le haut avance d'une zone ; l'inverse recule.
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : (dy < 0 ? 1 : -1);
      this.swipedAt = Date.now();
      this.goZone(Math.max(-1, Math.min(ZONES.length - 1, this.scene.currentZone + dir)));
    });
    for (const ev of ['pointercancel', 'pointerleave']) app.addEventListener(ev, () => { this.dropTool(); this.pointerDown = false; this.holdAt = null; if (this.drag >= 0) { this.endDrag(); this.refresh(true); } });
    app.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (t && !t.hasAttribute('disabled')) this.act(t.dataset.act!, t.dataset.arg ?? '');
    });
    $('backdrop').onclick = () => this.close();
  }

  private endDrag(): void {
    this.drag = -1;
    this.dragTarget = -1;
    this.scene.lift(-1);
  }

  private moveGhost(cx: number, cy: number): void {
    const rect = $('app').getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    // Le pot entier suit le doigt, centré dessous.
    this.scene.dragTo(x, y);
    let best = -1, bestD = Infinity;
    this.s.slots.forEach((_, i) => {
      if (!sim.slotOpen(this.s, i)) return;
      const r = this.scene.slotRect(i);
      const d = Math.hypot(r.x - x, r.bottom - r.unit * 0.45 - y);
      if (d < bestD && d < r.unit * 0.95) { bestD = d; best = i; }
    });
    if (best !== this.dragTarget) { this.dragTarget = best; this.refresh(true); }
  }

  /** L'outil suit le doigt et agit sur chaque plante qu'il survole. */
  private useTool(cx: number, cy: number): void {
    const rect = $('app').getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    if (this.toolEl) { this.toolEl.style.left = x + 'px'; this.toolEl.style.top = y + 'px'; }
    const s = this.s;
    const now = Date.now();
    const near = (i: number, lift: number, reach: number) => {
      if (!sim.slotOpen(s, i) || (this.scene.currentZone >= 0 && sim.zoneIndexOfSlot(i) !== this.scene.currentZone)) return Infinity;
      const r = this.scene.slotRect(i);
      const d = Math.hypot(r.x - x, r.bottom - r.unit * lift - y);
      return d < r.unit * reach ? d : Infinity;
    };
    if (this.tool.startsWith('seed:')) {
      // La graine vise le pot vide le plus proche du doigt ; elle sera semée au lâcher.
      const id = this.tool.slice(5);
      let best = -1, bestD = Infinity;
      s.slots.forEach((slot, i) => {
        if (!slot.pot || slot.plant || sim.potSize(slot) < sim.sizeOf(SPECIES_BY_ID[id])) return;
        const d = near(i, 0.45, 0.95);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== this.toolTarget) { this.toolTarget = best; this.refresh(true); }
      return;
    }
    s.slots.forEach((slot, i) => {
      if (!slot.plant || near(i, 0.7, 0.8) === Infinity || now - (this.toolAt[i] ?? 0) < 280) return;
      let fx = '';
      if (this.tool === 'can') { if (sim.water(s, i)) fx = '💧'; }
      else if (this.tool === 'glove') { if (sim.squash(s, i)) fx = slot.plant.pests > 0 ? '🐛' : '✨ Propre !'; }
      else if (this.tool === 'shears') { if (sim.prune(s, i)) fx = '✂️ Taillée !'; }
      else if (slot.plant.prog >= 1) {
        if (sim.harvestStore(s, i)) fx = '📦';
        else if (now - this.toolAt[99] > 2000 || !this.toolAt[99]) { this.toolAt[99] = now; this.toast('La réserve est pleine : vends au Marché ou agrandis-la.'); }
      }
      if (!fx) return;
      this.toolAt[i] = now;
      this.toolUsed = true;
      this.scene.pop(i);
      this.float(i, fx);
      play(this.tool === 'can' ? 'water' : 'tap');
      this.buzz(10);
      this.refresh(true);
    });
  }

  private dropTool(): void {
    if (!this.tool) return;
    const s = this.s;
    if (this.tool.startsWith('seed:')) {
      const i = this.toolTarget;
      this.toolTarget = -1;
      if (i >= 0 && sim.plantSeed(s, i, this.tool.slice(5))) { play('plant'); this.scene.pop(i); this.float(i, '🌱'); this.buzz(12); }
      else this.toast('Glisse la graine jusqu\'à un pot vide assez grand pour elle.');
    } else if (!this.toolUsed) {
      this.toast(this.tool === 'can' ? 'Garde le doigt sur l\'arrosoir et promène-le au-dessus des plantes assoiffées.'
        : this.tool === 'shears' ? 'Garde le doigt sur le sécateur et passe sur les plantes qui demandent une taille.'
        : this.tool === 'glove' ? 'Garde le doigt sur le gant et frotte les plantes envahies pour chasser les chenilles.'
        : 'Garde le doigt sur le panier et passe sur les plantes en fleur : elles partent en réserve, à vendre au bon moment.');
    }
    this.tool = '';
    this.toolEl?.remove();
    this.toolEl = null;
    document.querySelectorAll('#tools .held, #seeds .held').forEach((b) => b.classList.remove('held'));
    this.seedsHtml = '';
    this.refresh(true);
    this.swipedAt = Date.now();
  }

  private goZone(z: number): void {
    this.scene.setView(z);
    this.refresh(true);
  }

  zname(z: number): string {
    return themeOf(this.scene.themeId).zones[z];
  }

  private applyTheme(): void {
    $('app').style.background = themeOf(this.scene.themeId).bg;
    document.body.dataset.style = this.scene.styleId;
  }

  setState(s: State): void {
    this.s = s;
    this.close();
  }

  // ---------- interactions ----------

  private tapSlot(i: number): void {
    const s = this.s;
    const slot = s.slots[i];
    const p = slot.plant;
    const z = sim.zoneIndexOfSlot(i);
    if (!s.zonesOpen[z]) return this.open('zone', z);
    if (!sim.slotOpen(s, i)) return;
    if (this.crossing >= 0) {
      const from = this.crossing;
      if (from === i) { this.crossing = -1; this.refresh(true); return; }
      const why = sim.crossBlock(s, from, i);
      if (why) { this.toast(why); return; }
      this.crossing = -1;
      const got = sim.cross(s, from, i);
      if (got) { this.scene.pop(i); this.scene.pop(from); this.buzz(30); this.showPacket([got]); }
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
      play('water');
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
      case 'show':
        if (sim.harvestShow(s, this.arg)) { this.float(this.arg, '🏛️'); this.buzz(20); this.close(); }
        else this.toast('La vitrine est pleine.');
        break;
      case 'unshow': {
        const gain = sim.sellShowcase(s, n);
        if (gain) { this.toast(`Vendu ! +${fmt(gain)} 🪙`); this.bumpCoins(); }
        break;
      }
      case 'tips': {
        const got = sim.collectTips(s);
        if (got) { this.toast(`Les visiteurs ont laissé ${fmt(got)} 🪙`); this.bumpCoins(); this.buzz(20); }
        break;
      }
      case 'compost':
        if (sim.compost(s, arg)) { this.toast('Compostée : +1 dose d\'engrais 🧪'); this.buzz(10); }
        break;
      case 'fert':
        if (sim.fertilize(s, this.arg)) { this.scene.pop(this.arg); this.float(this.arg, '🧪'); this.buzz(15); }
        break;
      case 'gear': sim.toggleGear(s, arg as sim.ClimateGear); break;
      case 'flip': this.flipNext(); break;
      case 'trophy': {
        const r = sim.claimTrophy(s, arg);
        if (r) { this.toast(`Trophée obtenu ! +${fmt(r)} 🪙`); play('coin'); this.bumpCoins(); this.buzz(30); }
        break;
      }
      case 'mute':
        s.mute = !s.mute;
        setMuted(s.mute);
        if (!s.mute) play('tap');
        break;
      case 'extra':
        if (sim.buyExtra(s, n)) { this.toast(`Suspension installée : ${this.zname(n)} gagne un emplacement.`); play('craft'); this.buzz(25); this.close(); this.goZone(n); }
        else this.toast(s.zonesOpen[n] ? 'Pas assez de pièces.' : 'Aménage d\'abord cette zone.');
        break;
      case 'contest': {
        const r = sim.claimContest(s);
        if (r) { this.toast(`Palier ${r.label} : +${fmt(r.coins)} 🪙 et +${r.clay} argile !`); play('rare'); this.bumpCoins(); this.buzz(40); }
        break;
      }
      case 'cancelmove': this.crossing = -1; break;
      case 'cross':
        this.crossing = this.arg;
        this.close();
        this.toast('Touche une autre plante en fleur de la même famille et de la même rareté.');
        break;
      case 'prestige': {
        const got = sim.buyPrestige(s);
        if (got) this.showPacket(got);
        else this.toast('Pas assez de pièces.');
        break;
      }
      case 'openzone':
        if (sim.openZone(s, this.arg)) { this.toast(`${this.zname(this.arg)} : zone aménagée !`); this.buzz(30); this.close(); this.goZone(this.arg); }
        else this.toast('Pas assez de pièces.');
        break;
      case 'plant':
        if (sim.plantSeed(s, this.arg, arg)) { play('plant'); this.scene.pop(this.arg); this.float(this.arg, '🌱'); this.buzz(12); this.close(); }
        break;
      case 'craft':
        if (sim.startPot(s, n)) { play('craft'); this.toast('Au four ! La cuisson continue même en ton absence.'); this.buzz(15); }
        else this.toast(s.kiln ? 'Le four est déjà occupé.' : 'Pas assez d\'argile.');
        break;
      case 'kiln':
        if (sim.collectKiln(s)) { play('craft'); this.toast('Pot défourné : il t\'attend sur l\'étagère.'); this.buzz(25); }
        else if (s.shelf.length >= sim.SHELF_CAP) this.toast('L\'étagère est pleine : pose un pot dans la serre.');
        break;
      case 'place':
        if (sim.placePot(s, this.arg, n)) { this.scene.pop(this.arg); this.buzz(20); this.open('seed', this.arg); }
        break;
      case 'stow':
        if (sim.stowPot(s, this.arg)) { this.toast('Pot rangé sur l\'étagère de l\'atelier.'); this.close(); }
        else this.toast('L\'étagère est pleine.');
        break;
      case 'paintslot': this.paintAt = { where: 'slot', k: this.arg }; this.openStudio('paint'); break;
      case 'paintshelf': this.paintAt = { where: 'shelf', k: n }; this.openStudio('paint'); break;
      case 'wheel': this.studio.size = n; this.openStudio('wheel'); break;
      case 'admire': this.viewSlot = this.arg; this.openStudio('view'); break;
      case 'st-close': this.closeStudio(); break;
      case 'st-size': this.studio.size = n; this.studioTools(); break;
      case 'st-reset': this.studio.resetWheel(); break;
      case 'st-fire':
        if (sim.startPot(s, this.studio.size, this.studio.prof)) { play('craft'); this.closeStudio(); this.toast('Au four ! La cuisson continue même en ton absence.'); this.buzz(15); this.open('atelier'); }
        else this.toast(s.kiln ? 'Le four est déjà occupé.' : 'Pas assez d\'argile.');
        break;
      case 'st-color':
        if (n > 0 && sim.collection(s).stars < PAINTS[n - 1].stars) { this.toast(`Cette couleur se débloque à ${PAINTS[n - 1].stars} ⭐ dans l'almanach.`); break; }
        this.studio.color = n; this.studio.hand = false; this.studioTools(); break;
      case 'st-brush': this.studio.brush = n; this.studio.hand = false; this.studioTools(); break;
      case 'st-hand': this.studio.hand = !this.studio.hand; this.studioTools(); break;
      case 'st-spin': this.studio.spin = !this.studio.spin; this.studioTools(); break;
      case 'st-base':
        if (!sim.glazeOpen(s, n)) { this.toast(`Cet émail se débloque à ${GLAZES[n].stars} ⭐ dans l'almanach.`); break; }
        this.studio.setBase(n); this.studioTools(); break;
      case 'st-clear': this.studio.clearPaint(); break;
      case 'st-done': {
        if (!this.studio.touched) { this.closeStudio(); break; }
        const r = this.studio.paintResult();
        if (sim.savePaint(s, this.paintAt.where, this.paintAt.k, r.glaze, r.paint)) {
          play('craft'); this.buzz(20); this.closeStudio(); this.toast('Ton pot est peint !');
          if (this.paintAt.where === 'slot') this.scene.pop(this.paintAt.k);
        } else this.toast(s.coins < sim.PAINT_PRICE ? 'Pas assez de pièces.' : 'Ce pot n\'est plus là.');
        break;
      }
      case 'st-paint': this.paintAt = { where: 'slot', k: this.viewSlot }; this.openStudio('paint'); break;
      case 'prune':
        if (sim.prune(s, this.arg)) { this.scene.pop(this.arg); this.float(this.arg, '✂️ Taillée !'); this.buzz(12); }
        break;
      case 'cutting':
        if (sim.harvestCutting(s, this.arg)) { this.float(this.arg, '✂️ +2 graines'); this.buzz(15); this.close(); }
        break;
      case 'deliver': {
        const who = s.order?.who ?? '';
        const clay = s.order?.clay ?? 0;
        const gain = sim.deliver(s, this.arg);
        if (gain) { this.coinFx(this.arg, gain); this.toast(`${who} est ravi : +${fmt(gain)} 🪙 et +${clay} argile.`); this.close(); }
        break;
      }
      case 'orderinfo':
        if (s.order) this.toast(`Fais fleurir une plante de la famille ${FAMILIES[s.order.family].name.toLowerCase()}, qualité ${sim.qualityWord(s.order.minQ).toLowerCase()} ou mieux, puis choisis « Livrer » à la récolte.`);
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
        const chained = $('modal').classList.contains('on');
        const got = sim.openFreePacket(s);
        if (got) this.showPacket(got, chained);
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
      case 'style':
        s.style = arg;
        this.scene.setStyle(arg);
        this.applyTheme();
        this.close();
        this.toast(`Style : ${STYLES.find((x) => x.id === arg)?.name ?? ''}`);
        break;
      case 'theme':
        s.theme = arg;
        this.scene.setTheme(arg);
        this.applyTheme();
        this.close();
        this.toast(`Décor : ${themeOf(arg).name}`);
        break;
      case 'quest': {
        const r = sim.claimQuest(s);
        if (r) { play('coin'); this.toast(`Objectif atteint ! +${fmt(r)} 🪙`); this.bumpCoins(); this.buzz(30); }
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

  private openStudio(mode: 'wheel' | 'paint' | 'view'): void {
    const s = this.s;
    const st = this.studio;
    let title = '', hint = '';
    if (mode === 'paint') {
      const pd = paintTarget(this);
      if (!pd) return;
      title = '🎨 Peinture';
      hint = 'Peins au doigt, directement sur le pot. Glisse à côté du pot pour le tourner.';
    } else if (mode === 'wheel') {
      title = '🏺 Tour de potier';
      hint = 'Pose le doigt sur l\'argile : pousse vers le centre pour resserrer, tire vers l\'extérieur pour évaser.';
    } else {
      const slot = s.slots[this.viewSlot];
      if (!slot?.pot) return;
      const p = slot.plant;
      title = p ? `${EMOJI[p.sp]} ${esc(vname(SPECIES_BY_ID[p.sp], sim.stageOf(p.prog) >= 2 ? p.vr : 0))}` : '🏺 Ton pot';
      hint = 'Glisse pour faire tourner.';
    }
    this.close();
    $('st-title').innerHTML = title;
    $('st-hint').textContent = hint;
    $('studio').className = 'on ' + mode;
    // Le canevas doit avoir sa taille d'écran avant que la scène ne se cadre.
    if (mode === 'paint') st.openPaint(paintTarget(this)!);
    else if (mode === 'wheel') st.openWheel(st.size);
    else {
      const slot = s.slots[this.viewSlot];
      const p = slot.plant;
      let plant = null, scale = 1;
      if (p) {
        const sp = SPECIES_BY_ID[p.sp];
        const stage = sim.stageOf(p.prog);
        const fit = sim.fitOf(sp, sim.zoneClimate(s, sim.zoneOfSlot(this.viewSlot)));
        const health = Math.min(fit, p.water > 0 ? 1 : 0.75) * (p.pests > 0 ? 0.8 : 1);
        plant = finish(buildPlant(sp, stage, health, stage >= 2 ? p.vr : 0));
        scale = (0.82 + 0.18 * (stage >= 4 ? 1 : p.prog * 4 - stage)) * [1, 1.1, 1.2][(sp.size ?? 1) - 1];
      }
      st.openView(slot.pd, themeOf(s.theme).pot, plant, scale);
    }
    this.studioTools();
    st.resize();
  }

  private closeStudio(): void {
    this.studio.close();
    $('studio').className = '';
  }

  /** Les outils sous l'établi, selon ce qu'on y fait. */
  private studioTools(): void {
    const s = this.s;
    const st = this.studio;
    let html = '';
    if (st.mode === 'wheel') {
      const def = POT_SIZES[st.size - 1];
      const why = s.kiln ? 'Four occupé' : s.clay < def.clay ? `Il manque ${def.clay - s.clay} 🧱` : '';
      html = `<div class="row">${POT_SIZES.map((d, n) => `<button class="btn small ${st.size === n + 1 ? 'primary' : ''}" data-act="st-size" data-arg="${n + 1}">${d.name.replace(/ ?pot ?/i, '').replace(/^./, (c) => c.toUpperCase())} · ${d.clay} 🧱</button>`).join('')}</div>
        <p class="sub center">Tu as ${s.clay} 🧱. La taille décide de ce qui peut y pousser ; la forme, c'est toi.</p>
        <div class="row"><button class="btn" data-act="st-reset">↺ Recommencer</button><button class="btn gold" data-act="st-fire" ${why ? 'disabled' : ''}>${why || '🔥 Au four'}</button></div>`;
    } else if (st.mode === 'paint') {
      const stars = sim.collection(s).stars;
      const plant = this.paintAt.where === 'slot' ? s.slots[this.paintAt.k].plant : null;
      const fav = plant ? FAMILIES[SPECIES_BY_ID[plant.sp].family] : null;
      const cols = PAINTS.map((c, n) => [stars < c.stars ? 1 : 0, `<button class="pdot${st.color === n + 1 && !st.hand ? ' on' : ''}${stars < c.stars ? ' lock' : ''}" data-act="st-color" data-arg="${n + 1}" style="background:${hex(c.color)}">${stars < c.stars ? '🔒' : ''}</button>`] as [number, string]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
      const bases = GLAZES.map((g, n) => `<button class="pdot sq${st.base === n ? ' on' : ''}${stars < g.stars ? ' lock' : ''}" data-act="st-base" data-arg="${n}" style="background:${hex(g.color)}">${stars < g.stars ? '🔒' : fav && fav.glaze === n ? '💚' : ''}</button>`).join('');
      html = `<div class="dots"><button class="pdot gum${st.color === 0 && !st.hand ? ' on' : ''}" data-act="st-color" data-arg="0">🧽</button>${cols}</div>
        <div class="row tools">${[0, 1, 2].map((b) => `<button class="btn small ${st.brush === b && !st.hand ? 'primary' : ''}" data-act="st-brush" data-arg="${b}"><i class="tip" style="width:${6 + b * 6}px;height:${6 + b * 6}px"></i></button>`).join('')}<button class="btn small ${st.hand ? 'primary' : ''}" data-act="st-hand">🖐 Tourner</button><button class="btn small ${st.spin ? 'primary' : ''}" data-act="st-spin">🌀 Tour</button></div>
        <div class="dots"><span class="lbl">Fond</span>${bases}</div>
        ${fav ? `<p class="sub center">💚 Les ${fav.name.toLowerCase()} poussent plus vite sur un fond ${GLAZES[fav.glaze].name.toLowerCase()}.</p>` : ''}
        <div class="row"><button class="btn" data-act="st-clear">Tout effacer</button><button class="btn gold" data-act="st-done">✅ Terminer · ${sim.PAINT_PRICE} 🪙</button></div>`;
    } else if (st.mode === 'view') {
      const slot = s.slots[this.viewSlot];
      const p = slot.plant;
      html = `${p ? `<div class="kv"><span>${STAGES[sim.stageOf(p.prog)]}</span><b>${sim.qualityWord(p.q)}</b></div>` : ''}
        <div class="kv"><span>Pot</span><b>${potLabel(slot.pd)}${sim.harmony(slot) ? ' 💚' : ''}</b></div>
        <button class="btn primary wide" data-act="st-paint">🎨 Peindre ce pot</button>`;
    }
    $('st-tools').innerHTML = html;
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
    play('coin');
    this.bumpCoins();
    this.buzz(25);
  }

  private pack: { id: string; isNew: boolean }[] = [];
  private flipped = 0;

  /** Ouverture façon paquet de cartes : on déchire, puis on retourne les graines une à une. */
  private showPacket(got: { id: string; isNew: boolean }[], chained = false): void {
    this.close();
    this.pack = got;
    this.flipped = 0;
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">Ton sachet de graines</div><button class="packet" id="pk"><span>🌱</span>${chained ? '' : 'Touche pour ouvrir'}</button>`;
    m.classList.add('on');
    const tear = () => {
      if ($('pk').classList.contains('open')) return;
      $('pk').classList.add('open');
      this.buzz(40);
      setTimeout(() => this.renderPack(), 480);
    };
    $('pk').onclick = tear;
    if (chained) setTimeout(tear, 350);
  }

  private renderPack(): void {
    const s = this.s;
    const done = this.flipped >= this.pack.length;
    const cards = this.pack.map((g, k) => {
      const sp = SPECIES_BY_ID[g.id];
      const col = RARITIES[sp.rarity].color;
      if (k >= this.flipped) return `<button class="rc back${k === this.flipped ? ' next' : ''}" data-act="flip"><span class="e">🌱</span>?</button>`;
      return `<div class="rc${k === this.flipped - 1 ? ' pop' : ''}${sp.rarity !== 'commun' ? ' glow' : ''}" style="border-color:${col};--glow:${col}">${g.isNew ? '<span class="new">NOUVEAU</span>' : ''}<span class="e">${EMOJI[sp.id]}</span>${esc(sp.name)}${rarTag(sp)}</div>`;
    }).join('');
    const best = this.pack.slice(0, this.flipped).some((g) => SPECIES_BY_ID[g.id].rarity !== 'commun');
    $('modal').innerHTML = `<div class="mtitle">${done ? (best ? 'Belle trouvaille !' : 'Voilà tes graines') : 'Retourne tes graines'}</div><div class="reveal" data-act="flip">${cards}</div>${done
      ? `<div class="mrowb">${s.packets > 0 ? `<button class="btn gold" data-act="free">🎁 Sachet suivant (${s.packets})</button>` : ''}<button class="btn primary" data-act="closemodal">Au jardin !</button></div>`
      : '<p class="sub">Touche une graine pour la retourner.</p>'}`;
  }

  private flipNext(): void {
    if (this.flipped >= this.pack.length) return;
    const sp = SPECIES_BY_ID[this.pack[this.flipped].id];
    this.flipped++;
    this.buzz(sp.rarity === 'commun' ? 12 : 60);
    play(sp.rarity === 'commun' ? 'card' : 'rare');
    this.renderPack();
  }

  private showLevel(level: number): void {
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">Niveau ${level} !</div>
      <div class="rc solo" style="border-color:var(--gold)"><span class="e">🎓</span>Jardinier niveau ${level}<i>Ta serre prend de l'ampleur</i></div>
      <div class="fact">Récompense : +${25 * level} 🪙, +2 argile et un sachet de graines.</div>
      <button class="btn primary" data-act="closemodal">Continuer</button>`;
    m.classList.add('on');
    this.buzz(60);
    play('level');
  }

  private showBloom(key: string): void {
    const [id, v] = key.split(':');
    if (id === 'lvl') return this.showLevel(Number(v));
    const vr = Number(v) || 0;
    const sp = SPECIES_BY_ID[id];
    const d = this.s.disc[id];
    const n = sim.starsOf(d);
    const m = $('modal');
    m.innerHTML = `<div class="mtitle">${vr ? `Variante ${sim.VARIANTS[vr]} !` : n === 1 ? 'Nouvelle espèce dans l\'almanach !' : n === 3 ? 'Spécimen d\'exposition !' : 'Encore plus belle !'}</div>
      <div class="rc solo" style="border-color:${RARITIES[sp.rarity].color}"><span class="e">${EMOJI[id]}</span>${esc(vname(sp, vr))}<i>${esc(sp.latin)}</i><span class="st">${stars(n)}</span></div>
      <div class="fact">${vr ? (vr === 2 ? 'Une variante dorée, rarissime : elle vaut six fois plus et fera venir les visiteurs en vitrine.' : 'Une variante panachée : son feuillage marbré de crème vaut deux fois et demie le prix normal.') : esc(sp.fact)}</div>
      <button class="btn primary" data-act="closemodal">Continuer</button>`;
    m.classList.add('on');
    this.buzz(40);
    play('bloom');
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
    const sr = this.scene.showRect(1), sr2 = this.scene.showRect(2);
    this.showEl.style.left = (sr.x + sr2.x) / 2 + 'px';
    this.showEl.style.top = sr.y + 'px';
    this.lockEls.forEach((el, r) => {
      const c = this.scene.zoneCenter(r);
      el.style.left = c.x + 'px';
      el.style.top = c.y + 'px';
    });
  }

  private needsCare(i: number): boolean {
    const p = this.s.slots[i].plant;
    return !!p && (p.pests > 0 || p.prog >= 1 || (p.cut === 1 && p.prog < 1) || (p.water < 0.5 && !this.s.upgrades.water));
  }

  refresh(force = false): void {
    const s = this.s;
    this.layout();
    // Outils à promener : visibles seulement quand ils servent.
    const thirsty = !s.upgrades.water && s.slots.some((sl) => sl.plant && sl.plant.water < 0.5);
    const bugs = s.slots.some((sl) => sl.plant && sl.plant.pests > 0);
    const ripe = s.slots.filter((sl) => sl.plant && sl.plant.prog >= 1).length;
    const tools = $('tools').children;
    const shaggy = s.slots.some((sl) => sl.plant?.cut === 1 && sl.plant.prog < 1);
    tools[0].classList.toggle('off', !shaggy && this.tool !== 'shears');
    tools[1].classList.toggle('off', ripe < 2 && this.tool !== 'basket');
    tools[2].classList.toggle('off', !thirsty && this.tool !== 'can');
    tools[3].classList.toggle('off', !bugs && this.tool !== 'glove');
    // Barquette de graines : visible dans une zone où un pot vide attend.
    if (!this.tool) {
      const z = this.scene.currentZone;
      const free = z >= 0 && s.slots.some((sl, i) => sl.pot && !sl.plant && sim.zoneIndexOfSlot(i) === z && sim.slotOpen(s, i));
      const c = free ? sim.zoneClimate(s, sim.zoneOfSlot(z * SLOTS_PER_ZONE)) : null;
      const ids = c ? Object.keys(s.seeds).sort((a, b) => sim.fitOf(SPECIES_BY_ID[b], c) - sim.fitOf(SPECIES_BY_ID[a], c)).slice(0, 7 - [shaggy, ripe >= 2, thirsty, bugs].filter(Boolean).length - 1) : [];
      const html = ids.map((id) => `<button class="seedchip${c && sim.fitOf(SPECIES_BY_ID[id], c) >= 1 ? ' fit' : ''}" data-id="${id}">${EMOJI[id]}<small>×${s.seeds[id]}</small></button>`).join('');
      if (html !== this.seedsHtml) { this.seedsHtml = html; $('seeds').innerHTML = html; }
      // Chaque geste est expliqué une seule fois, au moment où il devient utile.
      const tip = (k: string, on: boolean, text: string) => {
        if (!on || s.hints?.[k] || this.kind !== 'none' || this.studio.mode || Date.now() - this.tipAt < 6000) return;
        (s.hints ??= {})[k] = true;
        this.tipAt = Date.now();
        this.toast(text);
      };
      tip('seeds', !!html, '🌱 Prends une graine dans la barquette et glisse-la sur un pot vide.');
      tip('can', thirsty, '🚿 Une plante a soif : prends l\'arrosoir et promène-le au-dessus d\'elle.');
      tip('glove', bugs, '🧤 Des chenilles ! Prends le gant et frotte la plante.');
      tip('shears', shaggy, '✂️ Une plante fait des pousses folles : passe le sécateur dessus, elle poussera plus vite et plus belle.');
      tip('basket', ripe >= 2, '🧺 Plusieurs plantes en fleur : le panier les range en réserve d\'un seul geste.');
      tip('drag', s.slots.filter((sl) => sl.pot).length >= 2 && s.stats.planted >= 2, '✋ Un pot se déplace en le faisant glisser du doigt vers un autre emplacement.');
    }
    // Emplacements
    s.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      const badge = el.firstElementChild as HTMLElement;
      const bar = el.lastElementChild as HTMLElement;
      const p = slot.plant;
      const open = sim.slotOpen(s, i);
      el.hidden = !open;
      let cls = 'badge', txt = '';
      if (this.tool.startsWith('seed:')) {
        if (i === this.toolTarget) { cls += ' ready'; txt = '⬇'; } else cls += ' hidden';
      } else if (this.drag >= 0) {
        if (i === this.drag) cls += ' hidden';
        else if (i === this.dragTarget) { cls += ' ready'; txt = slot.pot ? '⇄' : '⬇'; }
        else if (!slot.pot) { cls += ' ghost'; txt = '+'; }
        else cls += ' hidden';
      } else if (!slot.pot) { cls += ' ghost'; txt = '+'; }
      else if (!p) { cls += ' plus'; txt = '🌱'; }
      else if (p.pests > 0) { cls += ' alert'; txt = '🐛'.repeat(p.pests); }
      else if (p.cut === 1 && p.prog < 1) { cls += ' alert'; txt = '✂️'; }
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

    const tips = Math.floor(s.tips);
    const shown = s.showcase.filter(Boolean).length;
    const st = `🏛️ Vitrine ${shown}/${sim.SHOWCASE_SIZE}${tips > 0 ? ` · +${fmt(tips)} 🪙` : ''}`;
    if (this.showEl.textContent !== st) this.showEl.textContent = st;
    this.showEl.classList.toggle('can', tips >= 5);

    // Haut d'écran
    const col = sim.collection(s);
    const cur = this.scene.currentZone;
    const tabs = [`<button class="tab${cur < 0 ? ' on' : ''}" data-act="view" data-arg="-1">${themeOf(this.scene.themeId).all}</button>`].concat(ZONES.map((z, r) => {
      const care = s.zonesOpen[r] && [r * SLOTS_PER_ZONE, r * SLOTS_PER_ZONE + 1, r * SLOTS_PER_ZONE + 2, BASE_SLOTS + r].some((i) => this.needsCare(i));
      return `<button class="tab${cur === r ? ' on' : ''}${s.zonesOpen[r] ? '' : ' off'}" data-act="view" data-arg="${r}">${s.zonesOpen[r] ? z.icon : '🔒'} ${ZONE_SHORT[r]}${care ? '<i class="care"></i>' : ''}</button>`;
    })).join('');
    let info = '';
    if (this.crossing >= 0) info = `<div class="ticker"><span>🧬 Avec quelle plante la croiser ?</span><button class="btn small" data-act="cancelmove">Annuler</button></div>`;
    else if (cur >= 0) {
      const c = sim.zoneClimate(s, ZONES[cur]);
      info = `<div class="zinfo"><b>${this.zname(cur)}</b> ☀️ ${LEVEL_WORDS.light[c.light]} · 🌡️ ${LEVEL_WORDS.temp[c.temp]} · 💧 ${LEVEL_WORDS.hum[c.hum]}</div>`;
    }
    const lv = sim.levelOf(s);
    const se = sim.seasonOf(s);
    const ct = sim.contestOf(s);
    const prize = !!sim.CONTEST[ct.claimed] && ct.blooms >= sim.CONTEST[ct.claimed].need;
    const ready = sim.TROPHIES.filter((x) => sim.trophyReady(s, x)).length;
    const hud = `<div class="hudrow"><div class="pill coins">🪙 ${fmt(s.coins)}</div><button class="pill season" data-act="nav" data-arg="season">${SEASONS[se.index].icon}${prize ? '<i class="dot">!</i>' : ''}</button><button class="pill lvl" data-act="nav" data-arg="trophies">🎓 ${lv.level}<i class="xp"><i style="width:${Math.round(100 * lv.into / lv.span)}%"></i></i>${ready ? `<i class="dot">${ready}</i>` : ''}</button><button class="pill" data-act="nav" data-arg="almanac">📖 ${col.bloomed}/${SPECIES.length} <small>⭐ ${col.stars}</small></button></div><div class="tabs">${tabs}</div>${info}`;
    if (hud !== this.lastHud && (force || !this.pointerDown)) { $('hud').innerHTML = hud; this.lastHud = hud; }

    // Nouvelles fiches à fêter
    if (s.fresh.length) { this.celebrate.push(...s.fresh); s.fresh = []; }
    if (this.celebrate.length && !$('modal').classList.contains('on') && this.kind === 'none') this.showBloom(this.celebrate.shift()!);

    // Objectif
    const q = sim.currentQuest(s);
    const qh = q ? `<div class="qt">🎯 ${esc(q.text)}</div>${q.done(s)
      ? `<button class="btn gold small" data-act="quest">+${q.reward} 🪙</button>`
      : `<span class="chip">+${q.reward} 🪙</span>`}` : '';
    if (qh !== this.lastQuest && (force || !this.pointerDown)) { $('quest').innerHTML = qh; this.lastQuest = qh; }

    // Commande en cours
    const o = s.order;
    const oh = o ? `<div class="qt" data-act="orderinfo"><small>Commande · ${clock(o.left)}</small><b>${esc(o.who)}</b> cherche ${FAMILIES[o.family].icon} ${FAMILIES[o.family].name.toLowerCase()}, ${sim.qualityWord(o.minQ).toLowerCase()} ou mieux</div><span class="chip">+${o.coins} 🪙 · +${o.clay} 🧱</span>` : '';
    if (oh !== this.lastOrder && (force || !this.pointerDown)) { $('order').innerHTML = oh; this.lastOrder = oh; }

    // Navigation
    const seeds = Object.values(s.seeds).reduce((a, b) => a + b, 0);
    const wait = Math.max(0, Math.ceil(s.packetIn));
    const timer = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`;
    const hot = FAMILY_IDS.some((f) => s.market[f].p >= 1.25) && s.stock.length > 0;
    const nav = [
      ['packets', '🎁', s.packets > 0 ? 'Sachets' : timer, s.packets > 0 ? String(s.packets) : '', s.packets > 0 && seeds === 0],
      ['almanac', '📖', 'Almanach', '', false],
      ['atelier', '🏺', s.kiln && s.kiln.left > 0 ? clock(s.kiln.left) : 'Atelier', s.kiln && s.kiln.left <= 0 ? '!' : '', !!s.kiln && s.kiln.left <= 0],
      ['shop', '🛒', 'Boutique', '', false],
      ['market', '📈', 'Marché', hot ? '!' : '', false],
    ].map(([k, e, l, d, pulse]) => `<button class="navb${pulse ? ' pulse' : ''}" data-act="nav" data-arg="${k}"><span>${e}</span>${l}${d ? `<i class="dot">${d}</i>` : ''}</button>`).join('');
    if (nav !== this.lastNav && (force || !this.pointerDown)) { $('nav').innerHTML = nav; this.lastNav = nav; }

    // Panneau
    if (this.kind !== 'none') {
      const html = sheetHtml(this);
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

}
export { SLOTS_PER_ZONE };

