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

const V = { W: 2.8, D: 3.9, rowZ: [-2.85, -0.95, 0.95, 2.85], colX: [-1.3, 0, 1.3], table: 0.62, basin: 2.25 };

const verriere: Theme = {
  id: 'verriere',
  all: 'Serre',
  zones: ['Sous l\'étagère', 'Près du bassin', 'Près de la porte', 'Table plein sud'],
  name: 'La verrière',
  desc: 'Une serre vitrée vue de haut, rangée par rangée.',
  bg: 'linear-gradient(180deg, #a9dcd8 0%, #cfeadd 38%, #f6efd9 70%, #f3e6c4 100%)',
  yaw: 0.2,
  pitch: 0.85,
  slots: [...rows(V.colX, [[0, V.rowZ[0]], [0, V.rowZ[1]], [0, V.rowZ[2]], [V.table, V.rowZ[3]]]),
    ...V.rowZ.map((z, k): V3 => [-2.3, (k === 3 ? V.table : 0) + 1.05, z - 0.35])],
  shows: [-1.95, -0.65, 0.65, 1.95].map((x): V3 => [x, 2.2, -V.D + 0.4]),
  bounds: [[-3.1, 0, -4], [3.1, 0, -4], [-3.1, 3.3, -4], [3.1, 3.3, -4], [-3.1, -0.6, 4.1], [3.1, -0.6, 4.1]],
  pot: [0xc9714a, 0xd9825a],
  showPot: [0xf4efe4, 0xffffff],
  hemi: [0xfff6e0, 0x8fae9a, 1.15],
  sun: [0xfff0d0, 2.1, [5, 9, 7]],
  mist: [V.basin, 0.4, V.rowZ[1]],
  mistDir: [-1.6, 1.1, 0],
  gear: { mist: [0, 1.95, -V.D + 0.25], lamp: [-V.W + 0.75, 1.9, V.rowZ[2] - 0.75], heat: [-V.W + 0.35, 0, V.rowZ[2] + 0.85], fan: [V.basin + 0.1, V.table, V.rowZ[3]] },
  build(add) {
    const { W, D, rowZ } = V;
    add(box(W * 2 + 0.4, 0.4, D * 2 + 0.4, 0xd8c3a0, 0, -0.2, 0, false), box(W * 2 + 0.7, 0.25, D * 2 + 0.7, 0x9a7b5a, 0, -0.5, 0, false));
    [0x6f7f8f, 0x6fae8a, 0x9fb4c4, 0xf2d68a].forEach((c, r) => add(tinted(W * 2 - 0.3, 0.02, 1.6, c, 0.55, 0, 0.011, rowZ[r])));
    const wx = -W - 0.1, wz = -D - 0.1;
    add(box(W * 2 + 0.4, 0.6, 0.25, 0xe9dcc6, 0, 0.3, wz), box(0.25, 0.6, D * 2 + 0.4, 0xe9dcc6, wx, 0.3, 0));
    add(glass(W * 2 + 0.2, 2.6, 0.05, 0, 1.9, wz), glass(0.05, 2.6, D * 2 + 0.2, wx, 1.9, 0));
    for (let k = 0; k <= 3; k++) add(box(0.1, 2.7, 0.1, 0xfdfaf2, wx + (k * (W * 2 + 0.2)) / 3, 1.95, wz));
    for (let k = 1; k <= 4; k++) add(box(0.1, 2.7, 0.1, 0xfdfaf2, wx, 1.95, wz + (k * (D * 2 + 0.2)) / 4));
    add(box(W * 2 + 0.3, 0.1, 0.1, 0xfdfaf2, 0, 3.25, wz), box(0.1, 0.1, D * 2 + 0.3, 0xfdfaf2, wx, 3.25, 0));
    add(box(W * 2 + 0.3, 0.07, 0.07, 0xfdfaf2, 0, 2.0, wz), box(0.07, 0.07, D * 2 + 0.3, 0xfdfaf2, wx, 2.0, 0));
    // Étagère du fond : elle porte la vitrine et fait de l'ombre aux pots du dessous.
    add(box(W * 2 - 0.2, 0.1, 0.9, 0xa9794f, 0, 2.15, wz + 0.5));
    for (const x of [-W + 0.3, 0, W - 0.3]) add(box(0.08, 0.5, 0.08, 0x8a5f3c, x, 1.9, wz + 0.15));
    // Bassin.
    add(cyl(0.44, 0.5, 0.28, 0xb9b2a6, V.basin, 0.14, rowZ[1], 12), water(0.36, V.basin, 0.27, rowZ[1]));
    // Porte sur le mur de gauche.
    const dz = rowZ[2];
    add(box(0.12, 2.3, 1.15, 0x5f9f8a, wx + 0.04, 1.15, dz), box(0.14, 0.9, 0.8, 0xcfeef5, wx + 0.06, 1.6, dz, false),
      box(0.1, 0.08, 0.08, 0xf2c94c, wx + 0.14, 1.05, dz + 0.4, false), box(0.6, 0.03, 1.0, 0xb96f5a, wx + 0.5, 0.02, dz, false));
    // Table plein sud.
    const tz = rowZ[3];
    add(box(W * 2 - 0.5, 0.12, 1.2, 0xc99a66, 0, V.table - 0.06, tz));
    for (const x of [-W + 0.45, W - 0.45]) for (const z of [tz - 0.45, tz + 0.45]) add(box(0.12, V.table - 0.12, 0.12, 0xa9794f, x, (V.table - 0.12) / 2, z));
    add(wateringCan(V.basin, 0, rowZ[2], 2.4));
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

export const THEMES: Theme[] = [verriere, appartement, balcon];
export function themeOf(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
