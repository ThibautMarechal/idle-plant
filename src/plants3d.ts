import * as THREE from 'three';
import type { Species } from './data';

const matCache = new Map<number, THREE.MeshStandardMaterial>();
export function mat(color: number): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0 });
    matCache.set(color, m);
  }
  return m;
}

const GEO = {
  blob: new THREE.IcosahedronGeometry(1, 1),
  rough: new THREE.IcosahedronGeometry(1, 0),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 6),
};
GEO.cone.translate(0, 0.5, 0);
GEO.cyl.translate(0, 0.5, 0);

function mesh(geo: THREE.BufferGeometry, color: number, sx: number, sy: number, sz: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function tint(color: number, health: number): number {
  const c = new THREE.Color(color);
  c.lerp(new THREE.Color(0xc9a94e), (1 - health) * 0.75);
  return c.getHex();
}

/** Petit générateur déterministe pour que chaque espèce garde la même silhouette. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function flower(color: number, center: number, size: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = mesh(GEO.blob, color, size * 0.62, size * 0.16, size * 0.42);
    p.position.set(Math.cos(a) * size * 0.55, 0, Math.sin(a) * size * 0.55);
    p.rotation.y = -a;
    g.add(p);
  }
  const c = mesh(GEO.rough, center, size * 0.3, size * 0.3, size * 0.3);
  c.position.y = size * 0.08;
  g.add(c);
  return g;
}

function stalk(color: number, h: number, r = 0.018): THREE.Mesh {
  return mesh(GEO.cyl, color, r, h, r);
}

function buildRosette(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group): void {
  if (sp.id === 'lithops') {
    const n = f > 0.9 ? 3 : f > 0.7 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const r = n === 1 ? 0 : 0.15;
      for (const s of [-1, 1]) {
        const half = mesh(GEO.blob, leaf, 0.075 * f + 0.03, 0.1 * f + 0.03, 0.11 * f + 0.03);
        half.position.set(Math.cos(a) * r + s * 0.07 * f * Math.cos(a + 1.57), 0.07, Math.sin(a) * r + s * 0.07 * f * Math.sin(a + 1.57));
        half.rotation.y = -a;
        g.add(half);
      }
      if (bloom || buds) {
        const fl = flower(sp.flower, 0xf6c343, bloom ? 0.13 : 0.05);
        fl.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
        g.add(fl);
      }
    }
    return;
  }
  const rings = f > 0.9 ? 3 : 2;
  for (let r = 0; r < rings; r++) {
    const n = 5 + r * 3;
    const rad = (0.05 + r * 0.1) * f;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r * 0.5;
      const l = mesh(GEO.blob, leaf, 0.13 * f * (0.7 + r * 0.25), 0.035 * f + 0.01, 0.075 * f * (0.8 + r * 0.2));
      l.position.set(Math.cos(a) * rad, 0.05 + (rings - r) * 0.035 * f, Math.sin(a) * rad);
      l.rotation.y = -a;
      l.rotation.z = 0.9 - r * 0.38;
      g.add(l);
    }
  }
  if (buds || bloom) {
    const st = stalk(0xd98c7a, bloom ? 0.42 : 0.22);
    st.rotation.z = 0.25;
    g.add(st);
    const tip = mesh(GEO.blob, sp.flower, bloom ? 0.07 : 0.035, bloom ? 0.07 : 0.045, bloom ? 0.07 : 0.035);
    tip.position.set(bloom ? -0.105 : -0.055, bloom ? 0.42 : 0.22, 0);
    g.add(tip);
  }
}

function buildAloe(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(5 + f * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
    const lean = 0.2 + (i % 3) * 0.28;
    const l = mesh(GEO.cone, leaf, 0.06 * f + 0.015, (0.62 - (i % 3) * 0.1) * f, 0.035 * f + 0.01);
    l.rotation.order = 'YXZ';
    l.rotation.y = a;
    l.rotation.z = -lean;
    g.add(l);
  }
  if (buds || bloom) {
    const st = stalk(0x9a8f5a, bloom ? 0.85 : 0.5);
    g.add(st);
    const tip = mesh(GEO.cone, sp.flower, bloom ? 0.06 : 0.03, bloom ? 0.22 : 0.1, bloom ? 0.06 : 0.03);
    tip.position.y = bloom ? 0.8 : 0.48;
    g.add(tip);
  }
}

function buildBush(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(4 + f * 5);
  const lav = sp.id === 'lavande';
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const r = (i === 0 ? 0 : 0.1 + rnd() * 0.14) * f;
    const y = (0.16 + rnd() * 0.26) * f + 0.04;
    const s = (0.13 + rnd() * 0.07) * f + 0.02;
    const st = stalk(tint(0x6b8f4a, 0.9), y, 0.014);
    st.position.set(Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6);
    g.add(st);
    const b = mesh(GEO.rough, leaf, s, s * 0.8, s);
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(b);
    tops.push(new THREE.Vector3(b.position.x, y + s * 0.75, b.position.z));
  }
  if (buds || bloom) {
    tops.forEach((t, i) => {
      if (!bloom && i % 2) return;
      if (lav) {
        const sk = stalk(0x8fa58b, bloom ? 0.3 : 0.16, 0.01);
        sk.position.copy(t).setY(t.y - 0.05);
        g.add(sk);
        const sp1 = mesh(GEO.cone, sp.flower, 0.035, bloom ? 0.2 : 0.09, 0.035);
        sp1.position.copy(t).setY(t.y + (bloom ? 0.2 : 0.08));
        g.add(sp1);
      } else if (bloom) {
        const fl = flower(sp.flower, 0xf6d04a, 0.1 + rnd() * 0.03);
        fl.position.copy(t);
        fl.rotation.set((rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7);
        g.add(fl);
      } else {
        const bud = mesh(GEO.blob, sp.flower, 0.035, 0.045, 0.035);
        bud.position.copy(t);
        g.add(bud);
      }
    });
  }
}

function buildFern(f: number, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(5 + f * 6);
  for (let i = 0; i < n; i++) {
    const frond = new THREE.Group();
    frond.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const len = (0.5 + rnd() * 0.35) * f + 0.1;
    const segs = 6;
    let x = 0, y = 0.02, ang = 1.25 - rnd() * 0.25;
    for (let k = 0; k < segs; k++) {
      const sl = len / segs;
      const w = (0.11 - Math.abs(k - 2) * 0.016) * (0.6 + f * 0.6);
      const l = mesh(GEO.blob, leaf, sl * 0.72, 0.014, w);
      l.position.set(x + (Math.cos(ang) * sl) / 2, y + (Math.sin(ang) * sl) / 2, 0);
      l.rotation.z = ang;
      frond.add(l);
      x += Math.cos(ang) * sl;
      y += Math.sin(ang) * sl;
      ang -= 0.32 + rnd() * 0.08;
    }
    g.add(frond);
  }
}

function buildOrchid(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const ghost = sp.id === 'fantome';
  const n = ghost ? 6 : Math.round(2 + f * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const l = ghost
      ? mesh(GEO.cyl, leaf, 0.016, 0.3 * f + 0.05, 0.016)
      : mesh(GEO.blob, leaf, 0.24 * f + 0.03, 0.028, 0.09 * f + 0.02);
    l.rotation.order = 'YXZ';
    l.rotation.y = -a;
    if (ghost) {
      l.rotation.z = -1.35;
    } else {
      l.position.set(Math.cos(a) * 0.17 * f, 0.07 + (i % 2) * 0.03, Math.sin(a) * 0.17 * f);
      l.rotation.z = 0.35;
    }
    g.add(l);
  }
  if (!(buds || bloom)) return;
  const h = bloom ? 0.95 : 0.6;
  const segs = 6;
  let x = 0, y = 0, ang = 1.5;
  const center = sp.id === 'paphiopedilum' ? 0x8a3f4f : sp.id === 'fantome' ? 0xdff5e0 : 0xd6408f;
  for (let k = 0; k < segs; k++) {
    const sl = h / segs;
    const s = stalk(0x6f8f4f, sl * 1.05, 0.014);
    s.position.set(x, y, 0);
    s.rotation.z = ang - Math.PI / 2;
    g.add(s);
    x += Math.cos(ang) * sl;
    y += Math.sin(ang) * sl;
    if (k >= 2) {
      if (bloom) {
        const fl = flower(sp.flower, center, 0.15);
        fl.position.set(x, y, (k % 2 ? 1 : -1) * 0.07);
        fl.rotation.set(1.1, 0, (k % 2 ? -1 : 1) * 0.5 + rnd() * 0.2);
        g.add(fl);
      } else {
        const b = mesh(GEO.blob, sp.flower, 0.035, 0.05, 0.035);
        b.position.set(x, y, (k % 2 ? 1 : -1) * 0.03);
        g.add(b);
      }
    }
    ang -= 0.22;
  }
}

function buildParadise(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(3 + f * 3);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.5;
    p.rotation.z = -(0.15 + rnd() * 0.3);
    const h = (0.55 + rnd() * 0.3) * f + 0.1;
    p.add(stalk(0x4f8f55, h, 0.018));
    const l = mesh(GEO.blob, leaf, 0.11 * f + 0.03, 0.26 * f + 0.05, 0.02);
    l.position.y = h + 0.2 * f;
    p.add(l);
    g.add(p);
  }
  if (buds || bloom) {
    const st = stalk(0x6f8f4f, bloom ? 0.95 : 0.6);
    g.add(st);
    const top = bloom ? 0.95 : 0.6;
    const k = bloom ? 4 : 1;
    for (let i = 0; i < k; i++) {
      const c = mesh(GEO.cone, i === 1 ? 0x3a55c8 : sp.flower, 0.03, bloom ? 0.26 : 0.1, 0.05);
      c.position.y = top;
      c.rotation.z = -0.3 - i * 0.38;
      g.add(c);
    }
  }
}

/** Construit le modèle d'une plante. `stage` de 0 (graine) à 4 (floraison), `health` de 0 à 1. */
export function buildPlant(sp: Species, stage: number, health: number): THREE.Group {
  const g = new THREE.Group();
  const leaf = tint(sp.leaf, health);
  const rnd = seeded(hash(sp.id) + stage * 7);
  if (stage === 0) {
    const s = mesh(GEO.blob, 0x9fd06a, 0.035, 0.05, 0.035);
    s.position.y = 0.03;
    g.add(s);
    return g;
  }
  if (stage === 1) {
    g.add(stalk(0x8fc46a, 0.14, 0.014));
    for (const s of [-1, 1]) {
      const l = mesh(GEO.blob, leaf, 0.075, 0.016, 0.045);
      l.position.set(s * 0.06, 0.15, 0);
      l.rotation.z = s * 0.5;
      g.add(l);
    }
    return g;
  }
  const f = [0.62, 0.84, 1][stage - 2];
  const buds = stage === 3;
  const bloom = stage === 4;
  switch (sp.shape) {
    case 'rosette': buildRosette(sp, f, buds, bloom, leaf, g); break;
    case 'aloe': buildAloe(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'bush': buildBush(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'fern': buildFern(f, leaf, g, rnd); break;
    case 'orchid': buildOrchid(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'paradise': buildParadise(sp, f, buds, bloom, leaf, g, rnd); break;
  }
  g.scale.setScalar(1.25);
  return g;
}

export function buildPot(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.42, 10), mat(0xc9714a));
  body.position.y = 0.21;
  body.castShadow = true;
  body.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 10), mat(0xd9825a));
  rim.position.y = 0.43;
  rim.castShadow = true;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), mat(0x4a3526));
  soil.position.y = 0.47;
  soil.receiveShadow = true;
  g.add(body, rim, soil);
  return g;
}
export const POT_TOP = 0.485;
