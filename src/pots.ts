import * as THREE from 'three';
import { DEFAULT_PROF, GLAZES, PAINT_H, PAINT_W, PAINTS, POT_RINGS } from './data';
import { buildPot } from './plants3d';
import type { PotDesign } from './sim';
import { mat, matMap, styleCss } from './styles';

/** Hauteur du corps du pot ; le rebord monte jusqu'à POT_TOP. */
export const BODY_H = 0.42;
const RING_H = BODY_H / (POT_RINGS - 1);

/** Volume de révolution d'un pot : fond, anneaux modelés, puis un rebord épais. */
export function potGeometry(prof: number[]): THREE.LatheGeometry {
  const top = prof[POT_RINGS - 1];
  const pts = [new THREE.Vector2(0.001, 0)];
  prof.forEach((r, k) => pts.push(new THREE.Vector2(r, k * RING_H)));
  pts.push(new THREE.Vector2(top + 0.04, BODY_H), new THREE.Vector2(top + 0.04, 0.485), new THREE.Vector2(top - 0.02, 0.485));
  const g = new THREE.LatheGeometry(pts, 32);
  // La peinture suit la hauteur réelle : v = hauteur / hauteur totale, quel que soit le profil.
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, pts[i % pts.length].y / 0.485);
  return g;
}

/** Dessin au pinceau : une case = un octet, 0 pour le fond, sinon 1 + index dans PAINTS. */
export function decodePaint(paint?: string): Uint8Array {
  const g = new Uint8Array(PAINT_W * PAINT_H);
  if (paint) for (let i = 0; i < g.length && i < paint.length; i++) g[i] = paint[i] === '.' ? 0 : paint.charCodeAt(i) - 96;
  return g;
}
export function encodePaint(g: Uint8Array): string {
  let out = '';
  for (let i = 0; i < g.length; i++) out += g[i] ? String.fromCharCode(96 + g[i]) : '.';
  return out;
}

/** Peint la grille sur un canevas : fond dans la couleur de l'émail, puis chaque case peinte. */
export function drawPaint(canvas: HTMLCanvasElement, base: number, grid: Uint8Array): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = styleCss(base);
  ctx.fillRect(0, 0, PAINT_W, PAINT_H);
  for (let y = 0; y < PAINT_H; y++) for (let x = 0; x < PAINT_W; x++) {
    const v = grid[y * PAINT_W + x];
    if (!v || !PAINTS[v - 1]) continue;
    ctx.fillStyle = styleCss(PAINTS[v - 1].color);
    ctx.fillRect(x, y, 1, 1);
  }
}

export interface CraftPot { group: THREE.Group; body: THREE.Mesh; soil: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }

/** Pot façonné : forme modelée et dessin au pinceau. `base` remplace la couleur de fond (décor ou argile crue). */
export function craftPot(pd: PotDesign | undefined, base: number): CraftPot {
  const prof = pd?.prof?.length === POT_RINGS ? pd.prof : DEFAULT_PROF;
  const canvas = document.createElement('canvas');
  canvas.width = PAINT_W;
  canvas.height = PAINT_H;
  drawPaint(canvas, base, decodePaint(pd?.paint));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  const body = new THREE.Mesh(potGeometry(prof), matMap(tex));
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.raw = true;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 20), mat(0x4a3526));
  soil.position.y = 0.468;
  soil.scale.set(prof[POT_RINGS - 1] - 0.015, 1, prof[POT_RINGS - 1] - 0.015);
  soil.receiveShadow = true;
  const group = new THREE.Group();
  group.add(body, soil);
  return { group, body, soil, canvas, tex };
}

/** Le modèle d'un pot posé dans la serre, façonné à la main ou tout fait. `themePot` : couleurs du pot du décor. */
export function potModel(pd: PotDesign | undefined, themePot: [number, number]): THREE.Group {
  if (pd?.prof || pd?.paint || pd?.pv) return craftPot(pd, pd.glaze > 0 || pd.pv ? GLAZES[pd.glaze].color : themePot[0]).group;
  const gl = pd && (pd.glaze > 0 || pd.pat > 0) ? GLAZES[pd.glaze] : null;
  return buildPot(gl ? gl.color : themePot[0], gl ? gl.rim : themePot[1], pd?.pat ?? 0);
}
