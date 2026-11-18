import * as THREE from 'three';
import { mat } from './plants3d';

export type V3 = [number, number, number];

/**
 * Un décor : où sont les douze emplacements, la vitrine, les équipements, et tout ce qui les entoure.
 * L'ordre des zones est celui de ZONES : ombre, bassin, porte, plein sud.
 */
export interface Theme {
  id: string;
  name: string;
  desc: string;
  /** Nom de la vue d'ensemble et des quatre coins, dans l'ordre de ZONES. */
  all: string;
  zones: [string, string, string, string];
  /** Fond de l'écran (CSS), derrière la scène 3D. */
  bg: string;
  yaw: number;
  pitch: number;
  /** Douze emplacements au sol puis quatre suspensions (une par zone). */
  slots: V3[];
  shows: V3[];
  /** Points extrêmes du décor, pour cadrer la vue d'ensemble. */
  bounds: V3[];
  pot: [number, number];
  showPot: [number, number];
  hemi: [number, number, number];
  sun: [number, number, V3];
  /** Source de la brume du bassin et direction de sa dérive. */
  mist: V3;
  mistDir: V3;
  /** Où poser brumisateur, lampe, radiateur et ventilateur. */
  gear: { mist: V3; lamp: V3; heat: V3; fan: V3 };
  /** Vue à la première personne : hauteur des yeux et inclinaison de départ. */
  fp: {
    eye: number; pitch: number;
    /** Endroits où l'on peut se tenir : le centre de la serre, puis le jardin. */
    spots: V3[];
    /** Objets du décor qui ouvrent un menu quand on les touche. `r` : demi-taille de la zone tactile. */
    hot: { act: string; label: string; at: V3; spot: number; r: number }[];
  };
  build(add: (...o: THREE.Object3D[]) => void): void;
}

export function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function cyl(rTop: number, rBot: number, h: number, color: number, x: number, y: number, z: number, seg = 14, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

function blob(r: number, color: number, x: number, y: number, z: number, detail = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function glass(w: number, h: number, d: number, x: number, y: number, z: number, color = 0xcfeef5, opacity = 0.32): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.2 }));
  m.position.set(x, y, z);
  return m;
}

function wateringCan(x: number, y: number, z: number, rot: number): THREE.Group {
  const can = new THREE.Group();
  const body = cyl(0.2, 0.22, 0.34, 0x5a9fd4, 0, 0.17, 0, 8);
  const spout = cyl(0.03, 0.045, 0.42, 0x5a9fd4, 0.28, 0.24, 0, 6);
  spout.rotation.z = -0.9;
  can.add(body, spout);
  can.position.set(x, y, z);
  can.rotation.y = rot;
  return can;
}
// ---------------------------------------------------------------- Le pavillon

/** Point du pavillon : `lx` le long du pan de mur qui regarde vers `deg`, à `dist` du centre. */
const at = (deg: number, lx: number, y: number, dist: number): V3 => {
  const a = (deg * Math.PI) / 180;
  return [lx * Math.cos(a) + dist * Math.sin(a), y, lx * Math.sin(a) - dist * Math.cos(a)];
};
const P = { A: 5.0, pots: 4.3, bench: 0.78, zoneDeg: [0, 90, 180, 270], showDeg: 315, out: 9.6, tier: 0.3, tierAt: 2.75 };

/** Un point repéré depuis le milieu du jardin, là où l'on se tient une fois la porte passée. */
const fromGarden = (deg: number, lx: number, y: number, dist: number): V3 => {
  const o = at(135, 0, 0, P.out), p = at(deg, lx, y, dist);
  return [o[0] + p[0], p[1], o[2] + p[2]];
};

const pavillon: Theme = {
  id: 'pavillon',
  all: 'Serre',
  zones: ['Sous le store', 'Près du bassin', 'Près de la porte', 'Table plein sud'],
  name: 'Le pavillon',
  desc: 'Debout au milieu de la serre : on tourne sur soi pour passer d\'un coin à l\'autre.',
  bg: 'linear-gradient(180deg, #8fd0e8 0%, #c4e8ee 45%, #eaf5e4 70%, #bfe0b0 100%)',
  yaw: 0,
  pitch: 0,
  fp: {
    eye: 1.5, pitch: 0.11,
    spots: [[0, 0, 0], at(135, 0, 0, P.out)],
    hot: [
      { act: 'atelier', label: '🏺 Atelier', at: at(45, -0.5, 1.5, 4.4), spot: 0, r: 0.8 },
      { act: 'almanac', label: '📖 Almanach', at: at(45, 0.85, 1.3, 4.15), spot: 0, r: 0.45 },
      { act: 'shop', label: '🛒 Boutique', at: at(225, -0.75, 0.95, 4.3), spot: 0, r: 0.8 },
      { act: 'market', label: '📈 Marché', at: at(225, 1.05, 1.5, 4.5), spot: 0, r: 0.7 },
      { act: 'packets', label: '🎁 Sachets', at: at(135, 1.5, 1.35, 4.7), spot: 0, r: 0.5 },
      { act: 'trek', label: '🥾 Expédition', at: at(135, -1.3, 1.15, 4.6), spot: 0, r: 0.6 },
      { act: 'water', label: '💧 Arrosage', at: at(90, 0, 0.18, 3.2), spot: 0, r: 0.6 },
      { act: 'cave', label: '🍄 Cave', at: at(315, 0, 0.1, 3.0), spot: 0, r: 0.6 },
      { act: 'door', label: '🚪', at: at(135, 0, 1.7, 5.0), spot: -1, r: 0.9 },
      { act: 'gext1', label: '🔒 Potager', at: fromGarden(45, 0, 1.1, P.pots), spot: 1, r: 0.9 },
      { act: 'gext2', label: '🔒 Rocaille', at: fromGarden(225, 0, 1.1, P.pots), spot: 1, r: 0.9 },
    ],
  },
  slots: [...P.zoneDeg.flatMap((d) => [-1.15, 0, 1.15].map((lx): V3 => at(d, lx, P.bench, P.pots - (lx ? 0.12 : 0)))),
    ...P.zoneDeg.map((d): V3 => at(d, 0, 2.95, P.pots + 0.25)),
    ...[-1.15, 0, 1.15].map((lx): V3 => at(135, lx, 0.7, P.out + P.pots - (lx ? 0.12 : 0))),
    // Parcelles du jardin : à gauche puis à droite de là où l'on se tient.
    ...[45, 225].flatMap((d) => [-1.15, 0, 1.15].map((lx): V3 => fromGarden(d, lx, 0.7, P.pots - (lx ? 0.12 : 0)))),
    // Gradins, quand la verrière est agrandie : trois pots plus bas, devant chaque établi.
    ...P.zoneDeg.flatMap((d) => [-0.95, 0, 0.95].map((lx): V3 => at(d, lx, P.tier, P.tierAt)))],
  shows: [-1.14, -0.38, 0.38, 1.14].map((lx): V3 => at(P.showDeg, lx, 1.05, 4.45)),
  bounds: [[-5.5, 0, -5.5], [5.5, 4, 5.5]],
  pot: [0xc9714a, 0xd9825a],
  showPot: [0xf4efe4, 0xffffff],
  hemi: [0xfff6e0, 0x8fae9a, 1.25],
  sun: [0xfff0d0, 1.9, [1.5, 12, 5]],
  mist: at(90, 1.5, 1.0, 4.2),
  mistDir: [0.1, 0.9, -2.4],
  gear: { mist: at(90, -1.7, 2.7, 4.8), lamp: at(180, 1.75, 2.75, 4.5), heat: at(180, -0.58, 0.78, 4.78), fan: at(270, 0.58, P.bench, 4.7) },
  build(add) {
    const { A } = P;
    const side = 2 * A * Math.tan(Math.PI / 8) + 0.1;
    const wall = (deg: number, ...o: THREE.Object3D[]) => {
      const g = new THREE.Group();
      g.rotation.y = (-deg * Math.PI) / 180;
      g.add(...o);
      add(g);
    };
    // Jardin autour, puis dalle de la serre.
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(70, 70, 0.1, 40), mat(0xa9d39a));
    lawn.position.y = -0.1;
    lawn.receiveShadow = true;
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(A / Math.cos(Math.PI / 8) + 0.1, A / Math.cos(Math.PI / 8) + 0.1, 0.1, 8), mat(0xe2cfae));
    slab.rotation.y = Math.PI / 8;
    slab.position.y = -0.04;
    slab.receiveShadow = true;
    add(lawn, slab);
    // Huit pans vitrés, leurs montants, et la charpente qui monte vers le faîte.
    for (let k = 0; k < 8; k++) {
      const d = k * 45;
      wall(d, box(0.12, 3.8, 0.12, 0xfdfaf2, side / 2, 1.9, -A), box(side, 0.12, 0.12, 0xfdfaf2, 0, 3.8, -A));
      if (d === 135) {
        // Le pan de la porte : une ouverture au milieu, pour sortir au jardin.
        const w = (side - 1.6) / 2;
        for (const x of [-0.8 - w / 2, 0.8 + w / 2]) wall(d, box(w, 0.55, 0.2, 0xe9dcc6, x, 0.275, -A), glass(w, 3.2, 0.04, x, 2.15, -A, 0xcfeef5, 0.22));
        wall(d, glass(1.6, 0.8, 0.04, 0, 3.35, -A, 0xcfeef5, 0.22), box(0.1, 2.95, 0.14, 0xfdfaf2, -0.8, 1.475, -A), box(0.1, 2.95, 0.14, 0xfdfaf2, 0.8, 1.475, -A), box(1.7, 0.1, 0.14, 0xfdfaf2, 0, 2.95, -A));
      } else {
        wall(d, box(side, 0.55, 0.2, 0xe9dcc6, 0, 0.275, -A), glass(side, 3.2, 0.04, 0, 2.15, -A, 0xcfeef5, 0.22),
          box(0.07, 3.2, 0.07, 0xfdfaf2, 0, 2.15, -A, false), box(side, 0.07, 0.07, 0xfdfaf2, 0, 2.0, -A, false));
      }
      const rafter = box(0.09, 0.09, 5.9, 0xfdfaf2, 0, 4.85, -2.65, false);
      rafter.rotation.x = -0.37;
      wall(d + 22.5, rafter);
      // Buissons du jardin, derrière la vitre.
      const [x, , z] = at(d + 11, 0, 0, 7.2 + (k % 3) * 0.8);
      if (k !== 3) add(blob(0.9 + (k % 2) * 0.35, k % 2 ? 0x86c47c : 0x9ad08c, x, 0.5, z, 1));
    }
    const bench = (deg: number, color: number, leg: number, h = P.bench) => wall(deg, box(3.7, 0.12, 1.0, color, 0, h - 0.06, -P.pots - 0.05),
      ...[-1.7, 1.7].flatMap((x) => [-3.95, -4.65].map((z) => box(0.12, h - 0.12, 0.12, leg, x, (h - 0.12) / 2, z))));
    // Coin d'ombre : un store tendu au-dessus des pots.
    bench(0, 0x8a6f5a, 0x6a5242);
    // Un toit plein et une paroi de planches : les pots sont réellement à l'ombre, au frais.
    wall(0, box(4.5, 0.1, 3.3, 0x5a4a40, 0, 4.45, -3.45), box(side, 3.25, 0.08, 0x6a5242, 0, 2.2, -A + 0.12),
      ...[-1.6, -0.8, 0, 0.8, 1.6].map((x) => box(0.05, 3.25, 0.02, 0x4a3a32, x, 2.2, -A + 0.18, false)),
      // Le store est tenu par deux tirants fixés à la charpente : pas de poteau au milieu de la pièce.
      box(0.05, 0.05, 2.0, 0x5a4a40, -2.15, 4.75, -2.6, false), box(0.05, 0.05, 2.0, 0x5a4a40, 2.15, 4.75, -2.6, false),
      // Un pan de toile retombe sur le devant.
      box(4.5, 0.7, 0.04, 0x7f8fa6, 0, 4.1, -1.82));
    // Bassin : une auge de pierre pleine d'eau, les pots posés sur sa margelle.
    wall(90, box(3.9, P.bench, 1.1, 0xb9b2a6, 0, P.bench / 2, -P.pots - 0.05), box(3.9, 0.5, 0.7, 0xa7a096, 0, 0.25, -3.45));
    const pool = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x6fc7e0, roughness: 0.15, flatShading: true }));
    pool.position.set(...at(90, 0, 0.5, 3.45));
    pool.rotation.y = -Math.PI / 2;
    pool.userData.water = true;
    add(pool);
    // Chaleur humide : la vitre est couverte de buée et de grandes feuilles retombent.
    wall(90, glass(side - 0.2, 3.1, 0.03, 0, 2.15, -A + 0.06, 0xffffff, 0.5),
      // Une plante grimpante tropicale accrochée à la charpente : des feuilles en cœur qui pendent au bout de leur tige.
      ...[-1.9, 1.9].flatMap((x) => [0, 1, 2].map((k) => {
        const g = new THREE.Group();
        const y = 3.75 - k * 0.42, len = 0.35 + k * 0.12;
        const stem = box(0.03, len, 0.03, 0x3f6a3a, 0, -len / 2, 0, false);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(k % 2 ? 0x3f8552 : 0x4f9a5c));
        leaf.scale.set(0.22, 0.34, 0.025);
        leaf.position.set(0, -len - 0.3, 0);
        leaf.castShadow = true;
        const rib = box(0.015, 0.6, 0.03, 0x2f6a3e, 0, -len - 0.3, 0.02, false);
        g.add(stem, leaf, rib);
        g.position.set(x + (x > 0 ? -1 : 1) * k * 0.25, y, -4.55 + k * 0.08);
        g.rotation.set(0.15, (x > 0 ? -1 : 1) * (0.3 + k * 0.25), (x > 0 ? 1 : -1) * 0.12);
        return g;
      })));
    // Près de la porte : établi clair, et la porte sur le pan voisin.
    bench(180, 0xd9b98a, 0xb99667);
    // Courant d'air : un vantail entrouvert en haut de la vitre, et des rubans qui claquent au vent.
    const vent = box(1.9, 1.1, 0.06, 0xfdfaf2, 0.95, 3.1, -A - 0.25);
    vent.rotation.x = -0.5;
    wall(180, vent, box(1.7, 0.9, 0.02, 0xdff4fa, 0.95, 3.1, -A - 0.22, false));
    for (let k = 0; k < 5; k++) {
      const ribbon = new THREE.Group();
      ribbon.add(box(0.07, 0.7, 0.02, k % 2 ? 0xe2604f : 0xf2c94c, 0, -0.35, 0, false));
      ribbon.position.set(...at(180, -1.7 + k * 0.5, 3.7, 4.75));
      ribbon.userData.flutter = k;
      add(ribbon);
    }
    const door = new THREE.Group();
    door.add(box(1.5, 2.9, 0.14, 0x5f9f8a, 0, 1.45, -A), box(1.0, 1.3, 0.16, 0xcfeef5, 0, 2.0, -A, false),
      box(0.1, 0.1, 0.2, 0xf2c94c, 0.55, 1.3, -A, false));
    door.userData.door = true;
    wall(135, door, box(1.6, 0.03, 0.9, 0xb96f5a, 0, 0.02, -A + 0.7, false),
      // Sac à dos et bottes : le départ en expédition.
      box(0.7, 0.5, 0.5, 0xb98a5a, -1.35, 0.25, -4.6), box(0.55, 0.7, 0.34, 0x5f9a6a, -1.35, 0.85, -4.62), box(0.4, 0.22, 0.1, 0x4f8552, -1.35, 0.75, -4.42, false),
      box(0.14, 0.34, 0.28, 0x6b4a34, -1.42, 0.17, -4.15), box(0.14, 0.34, 0.28, 0x6b4a34, -1.22, 0.17, -4.15),
      // Boîte aux lettres : les sachets de graines y arrivent.
      box(0.08, 1.1, 0.08, 0x8a5f3c, 1.5, 0.55, -4.7), box(0.5, 0.36, 0.34, 0xe2604f, 1.5, 1.28, -4.7), box(0.3, 0.04, 0.02, 0x3a2a26, 1.5, 1.34, -4.52, false));
    // Le jardin : des dalles jusqu'à une jardinière en plein air, une clôture, un arbre.
    const g = P.out + P.pots;
    for (const dist of [6.1, 7.3, 8.5]) wall(135, box(0.9, 0.04, 0.7, 0xd9cdb8, dist % 2 > 1 ? 0.15 : -0.15, 0.0, -dist, false));
    wall(135, box(3.9, 0.7, 1.0, 0xa9794f, 0, 0.35, -g - 0.05), box(3.7, 0.06, 0.8, 0x6b4a34, 0, 0.69, -g - 0.05, false),
      ...Array.from({ length: 13 }, (_, k) => box(0.36, 1.3 + (k % 2) * 0.12, 0.08, 0xfdfaf2, -4.8 + k * 0.8, 0.65, -g - 2.6)),
      box(10, 0.1, 0.06, 0xfdfaf2, 0, 0.85, -g - 2.55, false),
      cyl(0.22, 0.3, 2.6, 0x8a5f3c, 3.4, 1.3, -g - 1.4, 8), cyl(0.07, 0.07, 1.5, 0x6b4a34, -3.1, 0.75, -g - 0.4, 6), box(0.9, 0.3, 0.04, 0xf2c94c, -3.1, 1.4, -g - 0.4));
    add(blob(1.7, 0x6fb56a, ...at(135, 3.4, 3.4, g + 1.4), 1), blob(1.1, 0x86c47c, ...at(135, 4.3, 2.7, g + 1.0), 1),
      blob(1.0, 0x9ad08c, ...at(135, -4.2, 0.6, g + 3.6), 1), blob(1.3, 0x86c47c, ...at(135, 1.2, 0.8, g + 4.2), 1));
    // Les deux parcelles à ajouter : un carré de terre piqueté tant qu'elles ne sont pas achetées, une jardinière ensuite.
    [45, 225].forEach((deg, n) => {
      const here = new THREE.Group();
      here.position.set(...at(135, 0, 0, P.out));
      here.rotation.y = (-deg * Math.PI) / 180;
      const bed = new THREE.Group();
      bed.userData.ext = n + 1;
      bed.add(box(3.9, 0.7, 1.0, 0xa9794f, 0, 0.35, -P.pots - 0.05), box(3.7, 0.06, 0.8, 0x6b4a34, 0, 0.69, -P.pots - 0.05, false));
      const plot = new THREE.Group();
      plot.userData.plot = n + 1;
      plot.add(box(3.9, 0.05, 1.1, 0x9a7350, 0, 0.025, -P.pots - 0.05, false),
        ...[-1.95, 1.95].flatMap((x) => [-0.55, 0.55].map((z) => cyl(0.04, 0.04, 0.5, 0x8a5f3c, x, 0.25, -P.pots - 0.05 + z, 6))),
        box(3.9, 0.02, 0.02, 0xfdfaf2, 0, 0.42, -P.pots + 0.5, false), box(3.9, 0.02, 0.02, 0xfdfaf2, 0, 0.42, -P.pots - 0.6, false),
        cyl(0.05, 0.05, 1.0, 0x6b4a34, 0, 0.5, -P.pots - 0.05, 6), box(0.9, 0.34, 0.04, 0xf2c94c, 0, 1.05, -P.pots - 0.02));
      here.add(bed, plot);
      add(here);
    });
    // Table plein sud.
    bench(270, 0xe6c28a, 0xc99a66);
    // Plein sud : le soleil est là, derrière la vitre, et ses rayons tombent sur la table.
    const disc = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 12), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true }));
    disc.position.set(...at(270, 1.3, 7.2, 16));
    disc.userData.raw = true;
    disc.userData.sunray = true;
    add(disc);
    for (let k = 0; k < 4; k++) {
      const ray = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.2, 0.02), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.2, depthWrite: false }));
      ray.position.set(-1.5 + k * 1.0, 2.6, -4.55);
      ray.rotation.z = -0.22;
      ray.userData.raw = true;
      ray.userData.sunray = true;
      wall(270, ray);
    }
    // La trappe de la cave, dans le dallage devant la vitrine.
    wall(315, box(1.3, 0.04, 0.95, 0x7a5236, 0, 0.02, -3.0), box(1.3, 0.05, 0.08, 0x5a3c28, 0, 0.03, -2.7, false), box(1.3, 0.05, 0.08, 0x5a3c28, 0, 0.03, -3.3, false),
      box(0.2, 0.05, 0.05, 0xc9a24a, 0, 0.06, -2.62, false));
    const patch = box(3.7, 0.02, 1.0, 0xfff1a8, 0, P.bench + 0.005, -P.pots - 0.05, false);
    patch.userData.sunray = true;
    wall(270, patch);
    // Coin atelier : tour, four et pots qui sèchent.
    wall(45, box(2.6, 0.12, 0.9, 0xb98a5a, 0, 0.9, -4.4), box(0.12, 0.84, 0.8, 0x8a5f3c, -1.2, 0.42, -4.4), box(0.12, 0.84, 0.8, 0x8a5f3c, 1.2, 0.42, -4.4),
      box(0.9, 1.1, 0.8, 0xb5654a, -0.75, 1.51, -4.45), box(0.4, 0.45, 0.06, 0x3a2a26, -0.75, 1.35, -4.03, false), box(0.3, 0.3, 0.02, 0xffb347, -0.75, 1.35, -3.99, false),
      cyl(0.2, 0.15, 0.3, 0xc9714a, 0.1, 1.11, -4.45, 10), cyl(0.3, 0.3, 0.06, 0x9a8f86, 0.1, 0.99, -4.45, 14));
    // Lutrin de l'almanach : un grand livre ouvert posé sur l'établi, là où rien ne le cache.
    const book = new THREE.Group();
    book.add(box(0.34, 0.03, 0.46, 0xfdfaf2, -0.175, 0.03, 0, false), box(0.34, 0.03, 0.46, 0xf4efe4, 0.175, 0.03, 0, false), box(0.76, 0.03, 0.52, 0x4f8a5b, 0, 0, 0, false),
      box(0.03, 0.035, 0.46, 0xe2574c, 0, 0.035, 0, false));
    book.position.set(0.85, 1.12, -4.15);
    book.rotation.x = 0.55;
    wall(45, box(0.6, 0.16, 0.3, 0x8a5f3c, 0.85, 1.04, -4.3), book);
    // Coin réserve : caisses, sacs de terreau, arrosoir.
    wall(225, box(0.9, 0.7, 0.9, 0xb98a5a, -0.8, 0.35, -4.3), box(0.75, 0.6, 0.75, 0xa9794f, -0.7, 1.0, -4.35), box(0.9, 0.7, 0.9, 0xa9794f, 0.25, 0.35, -4.35),
      // Ardoise des cours du marché, sur son chevalet.
      box(1.0, 0.75, 0.06, 0x3f5a4a, 1.05, 1.5, -4.55), box(0.06, 1.9, 0.06, 0x8a5f3c, 0.6, 0.95, -4.6), box(0.06, 1.9, 0.06, 0x8a5f3c, 1.5, 0.95, -4.6),
      box(0.6, 0.04, 0.02, 0xfdfaf2, 1.0, 1.65, -4.51, false), box(0.4, 0.04, 0.02, 0xf2c94c, 0.95, 1.45, -4.51, false));
    add(wateringCan(...at(225, 0.3, 0.7, 4.3), 0.8));
    // Vitrine : un présentoir à gradin, face aux visiteurs.
    wall(P.showDeg, box(3.3, 0.1, 0.8, 0xf4efe4, 0, 1.0, -4.45), box(3.3, 0.95, 0.7, 0xa9794f, 0, 0.475, -4.45), box(3.3, 0.06, 0.06, 0xf2c94c, 0, 0.9, -4.08, false));
  },
};

/**
 * Agrandit un décor à la première personne sans toucher aux pots : la pièce, ses meubles et la hauteur des yeux
 * grandissent ensemble, si bien que les pots paraissent plus petits et les établis plus dégagés.
 */
function grow(t: Theme, k: number): void {
  const up = (p: V3): V3 => [p[0] * k, p[1] * k, p[2] * k];
  t.slots = t.slots.map(up);
  t.shows = t.shows.map(up);
  t.mist = up(t.mist);
  t.gear = { mist: up(t.gear.mist), lamp: up(t.gear.lamp), heat: up(t.gear.heat), fan: up(t.gear.fan) };
  t.bounds = [up(t.bounds[0]), up(t.bounds[1])];
  t.fp.eye *= k;
  t.fp.spots = t.fp.spots.map(up);
  t.fp.hot = t.fp.hot.map((h) => ({ ...h, at: up(h.at), r: h.r * k }));
  const build = t.build.bind(t);
  t.build = (add) => {
    const room = new THREE.Group();
    room.scale.setScalar(k);
    build((...o) => { room.add(...o); });
    add(room);
  };
}
grow(pavillon, 1.4);

/** Le seul décor du jeu : la verrière octogonale, vue de l'intérieur. */
export const THEME = pavillon;
