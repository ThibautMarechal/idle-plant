import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * La direction artistique du jeu : la bande dessinée. Contours encrés, aplats vifs et ombrage en trois tons.
 * L'interface prend le même habillage (attribut `data-style="bd"` sur <body>).
 */
export interface ArtStyle {
  id: string;
  /** Retouche de chaque couleur : [saturation ×, éclaircissement 0..1]. */
  tint: [number, number];
  hemi: number;
  sun: number;
  shadowRadius: number;
  /** Contour encré, en fraction de l'écran. */
  outline: number;
}

const BD: ArtStyle = { id: 'bd', tint: [1.3, 0.04], hemi: 1.05, sun: 1.15, shadowRadius: 1, outline: 0.012 };
const cache = new Map<number, THREE.Material>();
let ramp: THREE.DataTexture | null = null;

export function artStyle(): ArtStyle {
  return BD;
}

function tinted(color: number): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, Math.min(1, hsl.s * BD.tint[0]), hsl.l + (1 - hsl.l) * BD.tint[1]);
}
/** Couleur CSS d'une teinte passée par la palette du style : pour peindre une texture assortie aux matières. */
export function styleCss(color: number): string {
  return '#' + tinted(color).getHexString();
}
function toonRamp(): THREE.DataTexture {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}
function toon(params: THREE.MeshToonMaterialParameters): THREE.Material {
  const t = new THREE.MeshToonMaterial({ ...params, gradientMap: toonRamp() });
  (t as unknown as { flatShading: boolean }).flatShading = true;
  return t;
}
/** Matière portant une texture (pot peint au pinceau). */
export function matMap(map: THREE.Texture): THREE.Material {
  return toon({ map });
}

/**
 * Matière d'une couleur. Elle est partagée par tous les objets de cette couleur :
 * la cloner avant de la teinter pour un seul objet.
 */
export function mat(color: number): THREE.Material {
  let m = cache.get(color);
  if (!m) { m = toon({ color: tinted(color) }); cache.set(color, m); }
  return m;
}

const merged = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const done = new WeakSet<THREE.BufferGeometry>();

/** Fusionne les sommets d'un modèle pour que le contour encré reste continu aux arêtes. */
export function finish<T extends THREE.Object3D>(root: T): T {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mm = mesh.material as THREE.Material;
    if (mm.transparent) mm.userData.outlineParameters = { visible: false };
    if (mesh.userData.raw || done.has(mesh.geometry)) return;
    let g = merged.get(mesh.geometry);
    if (!g) {
      const src = mesh.geometry.clone();
      src.deleteAttribute('uv');
      src.deleteAttribute('normal');
      g = mergeVertices(src, 1e-4);
      g.computeVertexNormals();
      done.add(g);
      merged.set(mesh.geometry, g);
    }
    mesh.geometry = g;
  });
  return root;
}
