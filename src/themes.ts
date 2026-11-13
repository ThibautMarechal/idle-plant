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
  /** Vue à la première personne : hauteur des yeux et inclinaison de départ. Sans ce champ, vue de haut. */
  fp?: {
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

function tinted(w: number, h: number, d: number, color: number, opacity: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity }));
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

function water(r: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0x6fc7e0, roughness: 0.15, flatShading: true }));
  m.position.set(x, y, z);
  m.userData.water = true;
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

const rows = (xs: number[], pts: [number, number][]): V3[] => pts.flatMap(([y, z]) => xs.map((x): V3 => [x, y, z]));


// ---------------------------------------------------------------- Verrière

const V = { W: 2.6, D: 3.6, rowZ: [-2.6, -0.87, 0.87, 2.6], colX: [-1.45, 0, 1.45], hangX: [-0.72, 0.72, 0.72, -0.72], table: 0.62 };

const verriere: Theme = {
  id: 'verriere',
  all: 'Serre',
  zones: ['Sous l\'étagère', 'Près du bassin', 'Près de la porte', 'Table plein sud'],
  name: 'La verrière',
  desc: 'Une grande serre vitrée, vue de face, qui remplit tout l\'écran.',
  bg: 'linear-gradient(180deg, #a9dcd8 0%, #cfeadd 38%, #f6efd9 70%, #f3e6c4 100%)',
  yaw: 0,
  pitch: 0.85,
  // Les suspensions pendent entre deux colonnes, un peu en retrait : elles ne prennent pas de largeur.
  slots: [...rows(V.colX, [[0, V.rowZ[0]], [0, V.rowZ[1]], [0, V.rowZ[2]], [V.table, V.rowZ[3]]]),
    ...V.rowZ.map((z, k): V3 => [V.hangX[k], (k === 3 ? V.table : 0) + 1.15, z - (k ? 0.65 : 0.35)])],
  shows: [-1.8, -0.6, 0.6, 1.8].map((x): V3 => [x, 2.2, -V.D + 0.4]),
  bounds: [[-2.6, 0, -4], [2.6, 0, -4], [-2.6, 3.3, -4], [2.6, 3.3, -4], [-2.6, -0.2, 4.1], [2.6, -0.2, 4.1]],
  pot: [0xc9714a, 0xd9825a],
  showPot: [0xf4efe4, 0xffffff],
  hemi: [0xfff6e0, 0x8fae9a, 1.15],
  sun: [0xfff0d0, 2.1, [5, 9, 7]],
  mist: [2.1, 0.2, V.rowZ[1] - 0.87],
  mistDir: [-1.3, 0.45, 0],
  gear: { mist: [0, 1.95, -V.D + 0.25], lamp: [-0.55, 1.9, V.rowZ[2] - 0.85], heat: [-2.12, 0, V.rowZ[2] + 0.87], fan: [2.1, V.table, V.rowZ[3] - 0.35] },
  build(add) {
    const { W, D, rowZ } = V;
    // Le sol dépasse de l'écran sur les côtés et vers l'avant : on est dans la serre, pas devant une maquette.
    add(box(18, 0.2, 14, 0xa9d39a, 0, -0.16, 0.5, false), box(W * 2 + 0.4, 0.4, D + 6.2, 0xd8c3a0, 0, -0.2, 1.1, false));
    [0x6f7f8f, 0x6fae8a, 0x9fb4c4, 0xf2d68a].forEach((c, r) => add(tinted(W * 2 - 0.3, 0.02, 1.6, c, 0.55, 0, 0.011, rowZ[r])));
    const wx = W + 0.1, wz = -D - 0.1;
    add(box(W * 2 + 0.4, 0.6, 0.25, 0xe9dcc6, 0, 0.3, wz), glass(W * 2 + 0.2, 2.6, 0.05, 0, 1.9, wz));
    for (let k = 0; k <= 4; k++) add(box(0.1, 2.7, 0.1, 0xfdfaf2, -wx + (k * wx) / 2, 1.95, wz));
    add(box(W * 2 + 0.3, 0.1, 0.1, 0xfdfaf2, 0, 3.25, wz), box(W * 2 + 0.3, 0.07, 0.07, 0xfdfaf2, 0, 2.0, wz));
    for (const x of [-wx, wx]) add(box(0.25, 0.6, D + 6.2, 0xe9dcc6, x, 0.3, 1.1), glass(0.05, 2.6, D + 6, x, 1.9, 1.1), box(0.1, 0.1, D + 6.1, 0xfdfaf2, x, 3.25, 1.1));
    // Le jardin, derrière la vitre du fond.
    for (const [x, r, c] of [[-2.9, 0.75, 0x7fbf7a], [-1.5, 0.55, 0x93cc85], [0.9, 0.7, 0x86c47c], [2.5, 0.6, 0x9ad08c]] as const) add(blob(r, c, x, r * 0.6, wz - 1.5, 1));
    // Étagère du fond : elle porte la vitrine et fait de l'ombre aux pots du dessous.
    add(box(W * 2 - 0.2, 0.1, 0.9, 0xa9794f, 0, 2.15, wz + 0.5));
    for (const x of [-W + 0.3, 0, W - 0.3]) add(box(0.08, 0.5, 0.08, 0x8a5f3c, x, 1.9, wz + 0.15));
    // Bassin : une rigole d'eau qui traverse la serre, derrière la deuxième rangée.
    const bz = rowZ[1] - 0.87;
    add(box(W * 2 - 0.3, 0.14, 0.42, 0xb9b2a6, 0, 0.07, bz, false));
    const rill = new THREE.Mesh(new THREE.BoxGeometry(W * 2 - 0.5, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: 0x6fc7e0, roughness: 0.15, flatShading: true }));
    rill.position.set(0, 0.13, bz);
    rill.userData.water = true;
    add(rill);
    // Porte sur le mur de gauche.
    const dz = rowZ[2];
    add(box(0.12, 2.3, 1.15, 0x5f9f8a, -wx + 0.04, 1.15, dz));
    // Table plein sud.
    const tz = rowZ[3];
    add(box(W * 2 - 0.5, 0.12, 1.2, 0xc99a66, 0, V.table - 0.06, tz));
    for (const x of [-W + 0.45, W - 0.45]) for (const z of [tz - 0.45, tz + 0.45]) add(box(0.12, V.table - 0.12, 0.12, 0xa9794f, x, (V.table - 0.12) / 2, z));
  },
};

// ---------------------------------------------------------------- Appartement

const appartement: Theme = {
  id: 'appartement',
  all: 'Salon',
  zones: ['La bibliothèque', 'Près de l\'aquarium', 'L\'entrée', 'Rebord de fenêtre'],
  name: 'L\'appartement',
  desc: 'Un coin de salon : rebord de fenêtre, bibliothèque, aquarium et entrée.',
  bg: 'linear-gradient(180deg, #f3d9c4 0%, #f7e7d6 45%, #efe2d0 100%)',
  yaw: 0.6,
  pitch: 0.7,
  slots: [
    [-2.75, 0.86, -1.5], [-2.75, 0.86, -0.4], [-2.75, 0.86, 0.7],
    [0.7, 0.36, -0.9], [1.7, 0.36, -0.9], [2.7, 0.36, -0.9],
    [-1.5, 0, 2.5], [-0.4, 0, 2.5], [0.7, 0, 2.5],
    [-1.1, 1.36, -2.95], [0.1, 1.36, -2.95], [1.3, 1.36, -2.95],
    [-2.75, 2.0, -2.45], [1.7, 1.5, -1.9], [1.9, 0, 2.5], [2.5, 1.36, -2.95],
  ],
  shows: [1.2, 1.78, 2.36, 2.94].map((x): V3 => [x, 0.82, 1.6]),
  bounds: [[-3.4, 0, -3.4], [3.4, 0, -3.4], [-3.4, 3.5, -3.4], [3.4, 3.5, -3.4], [-3.4, 3.5, 3.4], [3.4, -0.4, 3.4], [-3.4, -0.4, 3.4]],
  pot: [0xf1e8da, 0xffffff],
  showPot: [0x3f4a5a, 0xe8c26a],
  hemi: [0xfff1dc, 0xb99a7a, 1.2],
  sun: [0xffe2b8, 1.9, [3, 8, 6]],
  mist: [2.6, 1.5, -2.3],
  mistDir: [-1.2, 1.0, 0.6],
  gear: { mist: [-2.9, 1.95, -0.4], lamp: [-2.3, 1.7, 2.9], heat: [-3.0, 0, 1.75], fan: [2.25, 1.36, -2.95] },
  build(add) {
    // Parquet, tapis et deux murs.
    add(box(6.8, 0.3, 6.8, 0xc99a66, 0, -0.15, 0, false), box(7.1, 0.2, 7.1, 0x8a5f3c, 0, -0.38, 0, false));
    for (let k = -3; k <= 3; k++) add(box(0.03, 0.01, 6.8, 0xb5854f, k * 0.95, 0.006, 0, false));
    add(cyl(1.5, 1.5, 0.03, 0xe9cfc0, 0.4, 0.02, 0.9, 24, false), cyl(1.15, 1.15, 0.035, 0xd9a89a, 0.4, 0.022, 0.9, 24, false));
    add(box(6.9, 3.5, 0.2, 0xf4ead9, 0, 1.75, -3.45, false), box(0.2, 3.5, 6.9, 0xbfd3c2, -3.45, 1.75, 0, false));
    add(box(6.9, 0.25, 0.26, 0xfdfaf2, 0, 0.12, -3.42, false), box(0.26, 0.25, 6.9, 0xfdfaf2, -3.42, 0.12, 0, false));
    // Fenêtre et rebord plein sud.
    add(glass(3.6, 1.9, 0.08, 0.1, 2.35, -3.36, 0xbfe6f5, 0.75), box(3.9, 0.12, 0.12, 0xfdfaf2, 0.1, 3.33, -3.33), box(0.1, 1.9, 0.1, 0xfdfaf2, 0.1, 2.35, -3.33),
      box(0.12, 2.0, 0.12, 0xfdfaf2, -1.8, 2.35, -3.33), box(0.12, 2.0, 0.12, 0xfdfaf2, 2.0, 2.35, -3.33), box(4.3, 0.12, 0.8, 0xfdfaf2, 0.1, 1.3, -3.0));
    add(tinted(2.4, 0.01, 2.2, 0xffe9a6, 0.35, 0.3, 0.012, -1.9));
    // Bibliothèque à l'ombre, contre le mur de gauche.
    add(box(0.75, 0.08, 3.4, 0xa9794f, -2.9, 0.82, -0.4), box(0.75, 0.08, 3.4, 0xa9794f, -2.9, 2.05, -0.4), box(0.75, 2.1, 0.08, 0x8a5f3c, -2.9, 1.05, -2.1),
      box(0.75, 2.1, 0.08, 0x8a5f3c, -2.9, 1.05, 1.3), box(0.75, 0.08, 3.4, 0x8a5f3c, -2.9, 0.04, -0.4));
    [0xd9664f, 0x4f8fb0, 0xe8c26a, 0x5f9f8a, 0xb07ac0, 0xd9664f].forEach((c, k) => add(box(0.5, 0.5 + (k % 3) * 0.08, 0.16, c, -2.95, 0.33 + (k % 3) * 0.04, -1.8 + k * 0.2)));
    add(box(0.5, 0.2, 0.7, 0xe8c26a, -2.95, 2.19, -1.2), blob(0.28, 0x5aa64f, -2.95, 2.4, 0.5));
    // Aquarium et banc : l'air y est chaud et humide.
    add(box(1.5, 0.9, 0.7, 0xa9794f, 2.5, 0.45, -2.6), glass(1.3, 0.7, 0.55, 2.5, 1.27, -2.6, 0x7fd0e8, 0.55), box(1.36, 0.06, 0.6, 0x3f4a5a, 2.5, 1.65, -2.6),
      blob(0.1, 0xf08a3a, 2.3, 1.25, -2.6), blob(0.08, 0xf6d04a, 2.75, 1.4, -2.6), box(3.0, 0.1, 0.9, 0xc99a66, 1.7, 0.31, -0.9));
    for (const x of [0.4, 3.0]) add(box(0.12, 0.3, 0.8, 0xa9794f, x, 0.13, -0.9));
    // Entrée : la porte laisse passer l'air frais.
    add(box(0.14, 2.6, 1.3, 0x7a9fb5, -3.33, 1.3, 2.4), box(0.1, 0.1, 0.1, 0xf2c94c, -3.22, 1.2, 2.9, false), box(1.3, 0.04, 0.8, 0x8a7a6a, -2.4, 0.02, 2.4, false));
    // Console de la vitrine.
    add(box(2.5, 0.1, 0.75, 0x3f4a5a, 2.05, 0.77, 1.6));
    for (const x of [0.95, 3.15]) add(box(0.1, 0.75, 0.6, 0x3f4a5a, x, 0.37, 1.6));
    add(wateringCan(2.6, 0, 2.7, 0.8));
  },
};

// ---------------------------------------------------------------- Balcon

const BX = [-3.45, -1.15, 1.15, 3.45];
const balcon: Theme = {
  id: 'balcon',
  all: 'Balcon',
  zones: ['Sous le store', 'Près du tonneau', 'La porte-fenêtre', 'Le transat'],
  name: 'Le balcon',
  desc: 'Un long balcon en ville au coucher du soleil, à parcourir de gauche à droite.',
  bg: 'linear-gradient(180deg, #f6a57a 0%, #f9c79a 35%, #f7e0c0 70%, #e9d6c4 100%)',
  yaw: 0.12,
  pitch: 0.72,
  slots: [...BX.flatMap((cx): V3[] => [[cx - 0.62, 0, 0.45], [cx, 0, -0.5], [cx + 0.62, 0, 0.45]]),
    ...BX.map((cx): V3 => [cx + 0.95, 1.05, -1.0])],
  shows: [-2.0, -1.4, -0.8, -0.2].map((x): V3 => [x, 1.95, -1.05]),
  bounds: [[-4.8, 0, -1.5], [4.8, 0, -1.5], [-4.8, 3.3, -1.5], [4.8, 3.3, -1.5], [-4.8, -0.5, 1.5], [4.8, -0.5, 1.5]],
  pot: [0x4f7f9a, 0x6f9fba],
  showPot: [0xf4efe4, 0xe8c26a],
  hemi: [0xffd9b8, 0x9a8aa8, 1.15],
  sun: [0xffc48a, 2.0, [-6, 6, 7]],
  mist: [-1.9, 0.75, -0.9],
  mistDir: [0.9, 1.1, 0.5],
  gear: { mist: [-3.45, 1.9, -1.2], lamp: [2.35, 1.75, -1.15], heat: [0.05, 0, -1.05], fan: [4.35, 0, -0.9] },
  build(add) {
    // Dalle, carrelage et façade.
    add(box(9.6, 0.35, 3.0, 0xd8cfc4, 0, -0.18, 0, false), box(9.9, 0.3, 3.2, 0xa89a8c, 0, -0.5, 0, false));
    for (let k = -4; k <= 4; k++) add(box(0.03, 0.01, 2.9, 0xc4b8aa, k * 1.05, 0.006, 0, false));
    add(box(9.6, 3.4, 0.2, 0xe9b89a, 0, 1.7, -1.55, false), box(9.6, 0.3, 0.24, 0xd99a7a, 0, 0.15, -1.52, false));
    [0x6f7f8f, 0x6fae8a, 0x9fb4c4, 0xf2d68a].forEach((c, r) => add(tinted(2.0, 0.02, 2.5, c, 0.4, BX[r], 0.011, 0)));
    // Store rayé : la zone d'ombre.
    for (let k = 0; k < 6; k++) {
      const s = box(0.36, 0.06, 1.7, k % 2 ? 0xfdfaf2 : 0xd9664f, BX[0] - 0.9 + k * 0.36, 2.55, -0.65);
      s.rotation.x = 0.35;
      add(s);
    }
    // Tonneau de récupération d'eau : la zone humide.
    add(cyl(0.42, 0.36, 0.75, 0x7a6a5a, -1.9, 0.37, -0.95, 10), water(0.36, -1.9, 0.75, -0.95), box(0.06, 1.6, 0.06, 0x9aa4a8, -2.25, 1.5, -1.4));
    // Porte-fenêtre : la zone fraîche.
    add(box(1.5, 2.5, 0.1, 0xfdfaf2, BX[2], 1.25, -1.44), glass(1.26, 2.2, 0.06, BX[2], 1.27, -1.38, 0xbfdfe8, 0.7), box(0.05, 2.2, 0.08, 0xfdfaf2, BX[2], 1.27, -1.36),
      box(1.4, 0.04, 0.7, 0x8a7a6a, BX[2], 0.02, -0.95, false));
    // Fenêtre et étagère de la vitrine.
    add(glass(1.5, 1.0, 0.06, -1.1, 2.75, -1.42, 0xbfdfe8, 0.7), box(1.7, 0.1, 0.1, 0xfdfaf2, -1.1, 2.2, -1.42), box(2.5, 0.08, 0.6, 0xa9794f, -1.1, 1.9, -1.15));
    for (const x of [-2.2, 0]) add(box(0.06, 0.3, 0.4, 0x8a5f3c, x, 1.72, -1.25));
    // Plein sud : transat et guirlande.
    add(box(0.9, 0.08, 0.5, 0xf2c94c, 3.9, 0.35, -1.0), box(0.08, 0.35, 0.5, 0xa9794f, 3.5, 0.17, -1.0), box(0.08, 0.35, 0.5, 0xa9794f, 4.3, 0.17, -1.0));
    for (let k = 0; k < 9; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xfff2a8 : 0xffd0a0 }));
      b.position.set(-0.2 + k * 0.55, 3.05 - Math.sin((k / 8) * Math.PI) * 0.25, -1.4);
      add(b);
    }
    // Garde-corps bas : il ne cache pas les plantes.
    add(box(9.6, 0.22, 0.12, 0xa89a8c, 0, 0.11, 1.44), box(9.6, 0.05, 0.05, 0x5a5560, 0, 0.62, 1.44));
    for (let k = 0; k <= 8; k++) add(box(0.05, 0.42, 0.05, 0x5a5560, -4.75 + k * 1.1875, 0.41, 1.44));
    for (const x of [-4.78, 4.78]) add(box(0.05, 0.05, 2.9, 0x5a5560, x, 0.62, 0), box(0.05, 0.6, 0.05, 0x5a5560, x, 0.3, 0));
    // Toits de la ville au loin.
    [[-5.6, 1.4, 0.9], [5.5, 0.9, 1.2], [6.3, 1.8, 0.8]].forEach(([x, h, w]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h * 2, 0.6), new THREE.MeshBasicMaterial({ color: 0xc98a7a }));
      b.position.set(x, h - 2.2, -2.6);
      add(b);
    });
    add(wateringCan(0.15, 0, 0.9, 0.6));
  },
};

// ---------------------------------------------------------------- Pavillon (première personne)

/** Point du pavillon : `lx` le long du pan de mur qui regarde vers `deg`, à `dist` du centre. */
const at = (deg: number, lx: number, y: number, dist: number): V3 => {
  const a = (deg * Math.PI) / 180;
  return [lx * Math.cos(a) + dist * Math.sin(a), y, lx * Math.sin(a) - dist * Math.cos(a)];
};
const P = { A: 5.0, pots: 4.3, bench: 0.78, zoneDeg: [0, 90, 180, 270], showDeg: 315, out: 9.6 };

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
      { act: 'atelier', label: '🏺 Atelier', at: at(45, 0, 1.45, 4.4), spot: 0, r: 1.0 },
      { act: 'shop', label: '🛒 Boutique', at: at(225, -0.75, 0.95, 4.3), spot: 0, r: 0.8 },
      { act: 'market', label: '📈 Marché', at: at(225, 1.05, 1.5, 4.5), spot: 0, r: 0.7 },
      { act: 'packets', label: '🎁 Sachets', at: at(135, 1.5, 1.35, 4.7), spot: 0, r: 0.5 },
      { act: 'trek', label: '🥾 Expédition', at: at(135, -1.3, 1.15, 4.6), spot: 0, r: 0.6 },
      { act: 'door', label: '🚪', at: at(135, 0, 1.7, 5.0), spot: -1, r: 0.9 },
    ],
  },
  slots: [...P.zoneDeg.flatMap((d) => [-1.15, 0, 1.15].map((lx): V3 => at(d, lx, P.bench, P.pots - (lx ? 0.12 : 0)))),
    ...P.zoneDeg.map((d): V3 => at(d, 0, 2.95, P.pots + 0.25)),
    ...[-1.15, 0, 1.15].map((lx): V3 => at(135, lx, 0.7, P.out + P.pots - (lx ? 0.12 : 0)))],
  shows: [-1.14, -0.38, 0.38, 1.14].map((lx): V3 => at(P.showDeg, lx, 1.05, 4.45)),
  bounds: [[-5.5, 0, -5.5], [5.5, 4, 5.5]],
  pot: [0xc9714a, 0xd9825a],
  showPot: [0xf4efe4, 0xffffff],
  hemi: [0xfff6e0, 0x8fae9a, 1.25],
  sun: [0xfff0d0, 1.9, [4, 10, 6]],
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
    const awning = box(3.9, 0.06, 1.7, 0x7f8fa6, 0, 4.25, -4.2);
    awning.rotation.x = 0.22;
    wall(0, awning);
    // Bassin : une auge de pierre pleine d'eau, les pots posés sur sa margelle.
    wall(90, box(3.9, P.bench, 1.1, 0xb9b2a6, 0, P.bench / 2, -P.pots - 0.05), box(3.9, 0.5, 0.7, 0xa7a096, 0, 0.25, -3.45));
    const pool = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0x6fc7e0, roughness: 0.15, flatShading: true }));
    pool.position.set(...at(90, 0, 0.5, 3.45));
    pool.rotation.y = -Math.PI / 2;
    pool.userData.water = true;
    add(pool);
    // Près de la porte : établi clair, et la porte sur le pan voisin.
    bench(180, 0xd9b98a, 0xb99667);
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
    // Table plein sud.
    bench(270, 0xc99a66, 0xa9794f);
    // Coin atelier : tour, four et pots qui sèchent.
    wall(45, box(2.6, 0.12, 0.9, 0xb98a5a, 0, 0.9, -4.4), box(0.12, 0.84, 0.8, 0x8a5f3c, -1.2, 0.42, -4.4), box(0.12, 0.84, 0.8, 0x8a5f3c, 1.2, 0.42, -4.4),
      box(0.9, 1.1, 0.8, 0xb5654a, -0.75, 1.51, -4.45), box(0.4, 0.45, 0.06, 0x3a2a26, -0.75, 1.35, -4.03, false), box(0.3, 0.3, 0.02, 0xffb347, -0.75, 1.35, -3.99, false),
      cyl(0.2, 0.15, 0.3, 0xc9714a, 0.35, 1.11, -4.35, 10), cyl(0.15, 0.11, 0.24, 0xd9825a, 0.8, 1.08, -4.3, 10), cyl(0.3, 0.3, 0.06, 0x9a8f86, 0.45, 0.99, -4.35, 14));
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

export const THEMES: Theme[] = [pavillon, verriere, appartement, balcon];
export function themeOf(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
