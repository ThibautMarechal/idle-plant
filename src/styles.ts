import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Une direction artistique : la façon de peindre les mêmes modèles (matière, palette, lumière,
 * contours, pixels) et l'habillage de l'interface (attribut `data-style` sur <body>).
 */
export interface ArtStyle {
  id: string;
  name: string;
  desc: string;
  swatch: string;
  kind: 'flat' | 'toon' | 'clay';
  /** Retouche de chaque couleur : [saturation ×, éclaircissement 0..1]. */
  tint: [number, number];
  hemi: number;
  sun: number;
  shadowRadius: number;
  /** Contour encré, en fraction de l'écran. */
  outline?: number;
  /** Taille des gros pixels. */
  pixel?: number;
}

export const STYLES: ArtStyle[] = [
  { id: 'maquette', name: 'Maquette', desc: 'Facettes low-poly et couleurs douces. Le style de départ.', swatch: 'linear-gradient(135deg,#cfeadd,#f3e6c4)', kind: 'flat', tint: [1, 0], hemi: 1, sun: 1, shadowRadius: 4 },
  { id: 'bd', name: 'Bande dessinée', desc: 'Contours encrés, aplats vifs, interface façon autocollants.', swatch: 'linear-gradient(135deg,#ffd84d,#ff7a59)', kind: 'toon', tint: [1.3, 0.04], hemi: 1.05, sun: 1.15, shadowRadius: 1, outline: 0.012 },
  { id: 'argile', name: 'Argile', desc: 'Formes lissées, pastels et ombres très douces, comme de la pâte à modeler.', swatch: 'linear-gradient(135deg,#f6d9d0,#cfe3d2)', kind: 'clay', tint: [0.72, 0.2], hemi: 1.25, sun: 0.8, shadowRadius: 9 },
  { id: 'pixel', name: 'Pixel', desc: 'Gros pixels rétro et interface carrée, comme un jeu de console portable.', swatch: 'repeating-conic-gradient(#6fbf73 0 25%,#f2d16b 0 50%) 0 0/16px 16px', kind: 'flat', tint: [1.2, 0], hemi: 1.05, sun: 1.1, shadowRadius: 1, pixel: 3 },
];
export function styleOf(id: string | undefined): ArtStyle {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

let current = STYLES[0];
const cache = new Map<number, THREE.Material>();
let ramp: THREE.DataTexture | null = null;

export function artStyle(): ArtStyle {
  return current;
}
export function setArtStyle(id: string | undefined): ArtStyle {
  current = styleOf(id);
  cache.clear();
  return current;
}

/** Matière d'une couleur, peinte selon le style courant. */
export function mat(color: number): THREE.Material {
  let m = cache.get(color);
  if (m) return m;
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * current.tint[0]), hsl.l + (1 - hsl.l) * current.tint[1]);
  if (current.kind === 'toon') {
    if (!ramp) {
      ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
      ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
      ramp.needsUpdate = true;
    }
    const t = new THREE.MeshToonMaterial({ color: c, gradientMap: ramp });
    (t as unknown as { flatShading: boolean }).flatShading = true;
    m = t;
  } else if (current.kind === 'clay') {
    m = new THREE.MeshStandardMaterial({ color: c, flatShading: false, roughness: 1, metalness: 0 });
  } else {
    m = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0 });
  }
  cache.set(color, m);
  return m;
}

const geoCache = new Map<string, WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>>();
const done = new WeakSet<THREE.BufferGeometry>();

/**
 * Adapte les normales d'un modèle au style : lissées pour l'argile, fusionnées pour que le contour
 * encré reste continu aux arêtes. Sans effet pour les styles à facettes simples.
 */
export function finish<T extends THREE.Object3D>(root: T): T {
  const mode = current.kind === 'clay' ? 'clay' : current.outline ? 'ink' : '';
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mm = mesh.material as THREE.Material;
    if (mm.transparent) mm.userData.outlineParameters = { visible: false };
    if (!mode || done.has(mesh.geometry)) return;
    let per = geoCache.get(mode);
    if (!per) { per = new WeakMap(); geoCache.set(mode, per); }
    let g = per.get(mesh.geometry);
    if (!g) {
      const src = mesh.geometry.clone();
      src.deleteAttribute('uv');
      if (mode === 'clay') {
        g = toCreasedNormals(src, 1.15);
      } else {
        src.deleteAttribute('normal');
        g = mergeVertices(src, 1e-4);
        g.computeVertexNormals();
      }
      done.add(g);
      per.set(mesh.geometry, g);
    }
    mesh.geometry = g;
  });
  return root;
}
