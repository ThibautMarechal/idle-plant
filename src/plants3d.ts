import * as THREE from 'three';
import type { Species } from './data';

import { mat } from './styles';
export { mat };

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

function buildCactus(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const tops: THREE.Vector3[] = [];
  if (sp.id === 'opuntia') {
    const pad = (x: number, y: number, rot: number, sc: number) => {
      const m = mesh(GEO.blob, leaf, 0.17 * sc, 0.22 * sc, 0.045 * sc);
      m.position.set(x, y, 0);
      m.rotation.z = rot;
      m.rotation.y = rnd() * 0.8 - 0.4;
      g.add(m);
      tops.push(new THREE.Vector3(x - Math.sin(rot) * 0.2 * sc, y + Math.cos(rot) * 0.2 * sc, 0));
    };
    pad(0, 0.2 * f, 0, f);
    pad(-0.13 * f, 0.5 * f, 0.5, f * 0.8);
    if (f > 0.7) pad(0.14 * f, 0.5 * f, -0.55, f * 0.75);
    if (f > 0.9) pad(-0.26 * f, 0.76 * f, 0.8, f * 0.55);
  } else {
    const r = 0.27 * f;
    const ball = mesh(GEO.blob, leaf, r, r * 0.92, r);
    ball.position.y = r * 0.8;
    g.add(ball);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const rib = mesh(GEO.blob, 0xf0e6a0, 0.02, r * 0.85, 0.02);
      rib.position.set(Math.cos(a) * r * 0.93, r * 0.8, Math.sin(a) * r * 0.93);
      rib.rotation.z = -Math.cos(a) * 0.5;
      rib.rotation.x = Math.sin(a) * 0.5;
      g.add(rib);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      tops.push(new THREE.Vector3(Math.cos(a) * r * 0.35, r * 1.68, Math.sin(a) * r * 0.35));
    }
  }
  if (buds || bloom) tops.forEach((t, i) => {
    if (bloom) {
      const fl = flower(sp.flower, 0xfff2a8, 0.1);
      fl.position.copy(t);
      g.add(fl);
    } else if (i % 2 === 0) {
      const b = mesh(GEO.blob, sp.flower, 0.03, 0.045, 0.03);
      b.position.copy(t);
      g.add(b);
    }
  });
}

function buildGrass(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const wide = sp.id === 'chlorophytum';
  const n = Math.round(9 + f * 9);
  for (let i = 0; i < n; i++) {
    const len = (0.35 + rnd() * 0.3) * f + 0.08;
    const blade = new THREE.Group();
    blade.rotation.order = 'YXZ';
    blade.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.5;
    blade.rotation.z = -(0.15 + rnd() * (wide ? 1.0 : 0.6));
    blade.add(mesh(GEO.cone, i % 3 === 0 && wide ? tint(0xe9f2c0, 1) : leaf, wide ? 0.035 : 0.018, len, 0.012));
    if (sp.id === 'drosera') {
      const dew = mesh(GEO.blob, 0xd0405a, 0.022, 0.05, 0.022);
      dew.position.y = len * 0.85;
      blade.add(dew);
    }
    g.add(blade);
  }
  if (buds || bloom) {
    const k = bloom ? 4 : 2;
    for (let i = 0; i < k; i++) {
      const st = new THREE.Group();
      st.rotation.order = 'YXZ';
      st.rotation.y = i * 1.7;
      st.rotation.z = -(wide ? 0.9 : 0.15 + i * 0.08);
      const h = (wide ? 0.6 : 0.55) * f;
      st.add(stalk(wide ? 0xd9d08a : 0x6f9f5a, h, 0.01));
      const head = bloom && sp.id !== 'ciboulette' ? flower(sp.flower, 0xf6d04a, 0.07) : mesh(GEO.blob, sp.flower, bloom ? 0.065 : 0.03, bloom ? 0.065 : 0.04, bloom ? 0.065 : 0.03);
      head.position.y = h;
      st.add(head);
      g.add(st);
    }
  }
}

function buildBigLeaf(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(3 + f * 3);
  const round = sp.id === 'calathea';
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.6;
    p.rotation.z = -(0.25 + rnd() * 0.45);
    const h = (0.3 + rnd() * 0.35) * f + 0.08;
    p.add(stalk(0x4f8f55, h, 0.016));
    const w = (round ? 0.19 : 0.17) * f + 0.03;
    const blade = mesh(GEO.blob, leaf, w, 0.018, w * (round ? 0.95 : 1.15));
    blade.position.set(-0.05, h + 0.02, 0);
    blade.rotation.z = 1.0;
    p.add(blade);
    if (round) {
      const stripe = mesh(GEO.blob, tint(0xcfe8c0, 1), w * 0.55, 0.02, w * 0.3);
      stripe.position.copy(blade.position).setY(h + 0.03);
      stripe.rotation.z = 1.0;
      p.add(stripe);
    } else if (sp.id === 'monstera' && f > 0.7) {
      for (const sgn of [-1, 1]) {
        const hole = mesh(GEO.rough, 0x1f5f3a, w * 0.16, 0.022, w * 0.3);
        hole.position.copy(blade.position).setZ(sgn * w * 0.55);
        hole.rotation.z = 1.0;
        p.add(hole);
      }
    }
    g.add(p);
  }
  if (buds || bloom) {
    const k = bloom ? (sp.id === 'anthurium' ? 3 : 1) : 1;
    for (let i = 0; i < k; i++) {
      const st = new THREE.Group();
      st.rotation.order = 'YXZ';
      st.rotation.y = 0.8 + i * 2.1;
      st.rotation.z = -0.2;
      const h = (bloom ? 0.62 : 0.4) * f;
      st.add(stalk(0x6f8f4f, h, 0.014));
      const spathe = mesh(GEO.blob, sp.flower, bloom ? 0.1 : 0.04, bloom ? 0.13 : 0.06, 0.018);
      spathe.position.y = h + 0.05;
      st.add(spathe);
      if (bloom) {
        const spadix = mesh(GEO.cyl, 0xf6d04a, 0.016, 0.12, 0.016);
        spadix.position.set(0, h + 0.02, 0.03);
        spadix.rotation.x = 0.4;
        st.add(spadix);
      }
      g.add(st);
    }
  }
}

function buildCoin(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  g.add(stalk(0x7a6a4a, 0.3 * f, 0.022));
  const n = Math.round(6 + f * 8);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = i * 2.4;
    p.rotation.z = -(0.5 + rnd() * 0.7);
    p.position.y = (0.08 + (i / n) * 0.22) * f;
    const h = (0.2 + rnd() * 0.16) * f + 0.04;
    p.add(stalk(0x8fb46a, h, 0.008));
    const disc = mesh(GEO.cyl, leaf, 0.085 * f + 0.02, 0.012, 0.085 * f + 0.02);
    disc.position.y = h;
    disc.rotation.z = 0.9;
    p.add(disc);
    g.add(p);
  }
  if (buds || bloom) {
    const b = mesh(GEO.blob, sp.flower, bloom ? 0.05 : 0.025, bloom ? 0.05 : 0.03, bloom ? 0.05 : 0.025);
    b.position.y = 0.34 * f;
    g.add(b);
  }
}

function buildTrap(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(4 + f * 4);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.4;
    p.rotation.z = -(0.7 + rnd() * 0.5);
    const h = (0.2 + rnd() * 0.14) * f + 0.05;
    const petiole = mesh(GEO.blob, leaf, 0.03, h * 0.55, 0.012);
    petiole.position.y = h * 0.5;
    p.add(petiole);
    for (const sgn of [-1, 1]) {
      const jaw = mesh(GEO.blob, sgn > 0 ? tint(0xd0607a, 1) : leaf, 0.07 * f + 0.015, 0.05 * f + 0.012, 0.014);
      jaw.position.set(0, h + 0.04, sgn * 0.028);
      jaw.rotation.x = sgn * 0.55;
      p.add(jaw);
    }
    g.add(p);
  }
  if (buds || bloom) {
    const h = bloom ? 0.55 : 0.32;
    g.add(stalk(0x6f8f4f, h, 0.01));
    const head = bloom ? flower(sp.flower, 0xf6d04a, 0.08) : mesh(GEO.blob, sp.flower, 0.03, 0.04, 0.03);
    head.position.y = h;
    g.add(head);
  }
}

function buildPitcher(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(3 + f * 4);
  const tube = new THREE.CylinderGeometry(1, 0.35, 1, 7);
  tube.translate(0, 0.5, 0);
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.4;
    p.rotation.z = -(0.2 + rnd() * 0.45);
    const h = (0.3 + rnd() * 0.2) * f + 0.06;
    p.add(mesh(tube, leaf, 0.06 * f + 0.015, h, 0.06 * f + 0.015));
    const hood = mesh(GEO.blob, sp.flower, 0.07 * f + 0.015, 0.06 * f + 0.012, 0.02);
    hood.position.set(0.04, h + 0.04, 0);
    hood.rotation.z = -0.4;
    p.add(hood);
    g.add(p);
  }
  if (buds || bloom) {
    const h = bloom ? 0.7 : 0.4;
    g.add(stalk(0x8a5a4a, h, 0.012));
    const head = mesh(GEO.blob, sp.flower, bloom ? 0.09 : 0.035, bloom ? 0.05 : 0.04, bloom ? 0.09 : 0.035);
    head.position.y = h;
    g.add(head);
  }
}

function buildStem(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const sun = sp.id === 'tournesol';
  const h = (sun ? 1.0 : 0.55) * f + 0.08;
  g.add(stalk(0x5f9f4f, h, sun ? 0.024 : 0.016));
  const n = sun ? Math.round(3 + f * 3) : 3;
  for (let i = 0; i < n; i++) {
    const l = mesh(GEO.blob, leaf, sun ? 0.13 * f : 0.05, sun ? 0.016 : 0.24 * f + 0.04, sun ? 0.08 * f : 0.022);
    const a = i * 2.3 + rnd();
    if (sun) {
      l.position.set(Math.cos(a) * 0.12 * f, h * (0.25 + (i / n) * 0.5), Math.sin(a) * 0.12 * f);
      l.rotation.y = -a;
      l.rotation.z = 0.4;
    } else {
      l.position.set(Math.cos(a) * 0.05, 0.2 * f + 0.03, Math.sin(a) * 0.05);
      l.rotation.order = 'YXZ';
      l.rotation.y = -a;
      l.rotation.z = -0.3;
    }
    g.add(l);
  }
  if (!(buds || bloom)) return;
  if (sun) {
    const head = bloom ? flower(sp.flower, 0x6a4326, 0.3) : mesh(GEO.blob, 0x7faf4a, 0.07, 0.07, 0.07);
    head.position.set(0, h, 0.03);
    head.rotation.x = bloom ? 1.0 : 0;
    g.add(head);
  } else {
    const k = bloom ? 5 : 3;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2;
      const flame = sp.id === 'semper' && i % 2 === 1;
      const petal = mesh(GEO.blob, bloom ? (flame ? 0xd0283a : sp.flower) : 0x8fbf6a, 0.045, bloom ? 0.1 : 0.06, 0.025);
      petal.position.set(Math.cos(a) * 0.04, h + (bloom ? 0.07 : 0.04), Math.sin(a) * 0.04);
      petal.rotation.order = 'YXZ';
      petal.rotation.y = -a;
      petal.rotation.z = bloom ? -0.25 : 0;
      g.add(petal);
    }
  }
}

function buildNest(f: number, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(6 + f * 6);
  for (let i = 0; i < n; i++) {
    const len = (0.3 + rnd() * 0.2) * f + 0.06;
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.3;
    p.rotation.z = -(0.25 + rnd() * 0.5);
    const blade = mesh(GEO.blob, leaf, 0.065 * f + 0.015, len, 0.016);
    blade.position.y = len;
    p.add(blade);
    const rib = mesh(GEO.cyl, 0x3f6f3a, 0.008, len * 1.8, 0.008);
    rib.position.z = 0.012;
    p.add(rib);
    g.add(p);
  }
}

/** Arbuste sur tronc : figuier, olivier, citronnier, érable, bonsaï. */
function buildTree(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const bonsai = sp.id === 'bonsai';
  const bark = sp.id === 'olivier' ? 0x8a8272 : sp.id === 'erable' ? 0x5a3f36 : 0x7a5a3c;
  const h = (bonsai ? 0.42 : 0.86) * f + 0.1;
  const lean = bonsai ? 0.5 : 0.08;
  const trunk = mesh(GEO.cyl, bark, 0.05 * f + 0.02, h, 0.05 * f + 0.02);
  trunk.rotation.z = -lean;
  g.add(trunk);
  const top = new THREE.Vector3(Math.sin(lean) * h, Math.cos(lean) * h, 0);
  const n = Math.round((bonsai ? 3 : 5) + f * 4);
  const crowns: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const r = (i === 0 ? 0 : 0.13 + rnd() * 0.13) * f;
    const s = (bonsai ? 0.11 : 0.13) * f + rnd() * 0.04 * f + 0.03;
    const c = new THREE.Vector3(top.x + Math.cos(a) * r, top.y + (rnd() - 0.3) * 0.22 * f + (bonsai ? 0 : 0.08), top.z + Math.sin(a) * r);
    if (bonsai && i > 0) c.y -= 0.12 * (i % 2);
    const br = mesh(GEO.cyl, bark, 0.016, c.clone().sub(top).length(), 0.016);
    br.position.copy(top);
    br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(top).normalize());
    g.add(br);
    const b = mesh(bonsai ? GEO.blob : GEO.rough, leaf, s * 1.15, s * (bonsai ? 0.55 : 0.85), s * 1.15);
    b.position.copy(c);
    b.rotation.y = rnd() * 3;
    g.add(b);
    crowns.push(c.clone().setY(c.y + s * 0.5));
    crowns.push(new THREE.Vector3(c.x + Math.cos(a) * s * 0.9, c.y - s * 0.1, c.z + Math.sin(a) * s * 0.9));
  }
  if (!buds && !bloom) return;
  crowns.forEach((c, i) => {
    if (i % (bloom ? 2 : 4)) return;
    // En fleur : des fruits pour les arbres fruitiers, de jeunes pousses claires pour les autres.
    const size = sp.id === 'citronnier' ? 0.06 : sp.id === 'figuier' ? 0.05 : 0.04;
    const fr = mesh(GEO.blob, bloom ? sp.flower : tint(sp.flower, 0.5), size * (bloom ? 1 : 0.6), size * (bloom ? 1.25 : 0.7), size * (bloom ? 1 : 0.6));
    fr.position.copy(c);
    g.add(fr);
  });
}

/** Buisson rond couvert de grosses boules de fleurs : hortensia, camélia. */
function buildShrub(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(5 + f * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const r = (i === 0 ? 0 : 0.14 + rnd() * 0.14) * f;
    const y = (0.2 + rnd() * 0.22) * f + 0.05;
    const s = (0.17 + rnd() * 0.06) * f + 0.03;
    const st = stalk(0x6b5a3a, y, 0.02);
    st.position.set(Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5);
    g.add(st);
    const b = mesh(GEO.rough, leaf, s, s * 0.85, s);
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    g.add(b);
    if ((buds && i % 2 === 0) || bloom) {
      const k = bloom ? 0.1 + rnd() * 0.03 : 0.045;
      const ball = mesh(GEO.blob, bloom ? sp.flower : tint(sp.flower, 0.6), k, k * 0.85, k);
      ball.position.set(Math.cos(a) * (r + s * 0.45), y + s * 0.6, Math.sin(a) * (r + s * 0.45));
      g.add(ball);
      if (bloom && sp.id === 'camelia') {
        const heart = mesh(GEO.rough, 0xf6d04a, k * 0.35, k * 0.35, k * 0.35);
        heart.position.copy(ball.position).setY(ball.position.y + k * 0.7);
        g.add(heart);
      }
    }
  }
}

/** Tiges feuillues portant de grosses fleurs doubles : rosier, pivoine, dahlia. */
function buildRose(sp: Species, f: number, buds: boolean, bloom: boolean, leaf: number, g: THREE.Group, rnd: () => number): void {
  const n = Math.round(3 + f * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const h = (0.38 + rnd() * 0.3) * f + 0.08;
    const p = new THREE.Group();
    p.rotation.order = 'YXZ';
    p.rotation.y = a;
    p.rotation.z = -(i === 0 ? 0.05 : 0.22 + rnd() * 0.25);
    p.add(stalk(0x4f7a3f, h, 0.014));
    for (let k = 1; k <= 3; k++) {
      const l = mesh(GEO.blob, leaf, 0.075 * f + 0.015, 0.014, 0.045 * f + 0.01);
      l.position.set((k % 2 ? 1 : -1) * 0.07, h * (k / 4), 0);
      l.rotation.z = (k % 2 ? -1 : 1) * 0.5;
      p.add(l);
    }
    if (buds || bloom) {
      const k = bloom ? 0.085 + rnd() * 0.025 : 0.035;
      const head = new THREE.Group();
      head.position.y = h;
      if (bloom) {
        // Fleur double : deux couronnes de pétales et un cœur.
        const outer = flower(sp.flower, sp.flower, k * 1.5);
        const inner = flower(tint(sp.flower, 0.85), 0xf6d04a, k);
        inner.position.y = k * 0.3;
        inner.rotation.y = 0.6;
        head.add(outer, inner);
        head.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
      } else {
        head.add(mesh(GEO.blob, sp.flower, k, k * 1.4, k));
      }
      p.add(head);
    }
    g.add(p);
  }
}

/** Construit le modèle d'une plante. `stage` de 0 (graine) à 4 (floraison), `health` de 0 à 1. */
export function buildPlant(sp: Species, stage: number, health: number, variant = 0): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Color(sp.leaf);
  if (variant === 1) base.lerp(new THREE.Color(0xf4f2cf), 0.5);
  if (variant === 2) base.lerp(new THREE.Color(0xf2b92e), 0.85);
  const leaf = tint(base.getHex(), health);
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
    case 'cactus': buildCactus(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'grass': buildGrass(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'bigleaf': buildBigLeaf(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'coin': buildCoin(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'trap': buildTrap(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'pitcher': buildPitcher(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'stem': buildStem(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'nest': buildNest(f, leaf, g, rnd); break;
    case 'tree': buildTree(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'shrub': buildShrub(sp, f, buds, bloom, leaf, g, rnd); break;
    case 'rose': buildRose(sp, f, buds, bloom, leaf, g, rnd); break;
  }
  g.scale.setScalar(1.25);
  return g;
}

/** `pat` : 0 uni, 1 bandes, 2 pois (dans la couleur du rebord). */
export function buildPot(color = 0xc9714a, rimColor = 0xd9825a, pat = 0): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.42, 10), mat(color));
  body.position.y = 0.21;
  body.castShadow = true;
  body.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.09, 10), mat(rimColor));
  rim.position.y = 0.43;
  rim.castShadow = true;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), mat(0x4a3526));
  soil.position.y = 0.47;
  soil.receiveShadow = true;
  g.add(body, rim, soil);
  if (pat === 1) {
    for (const [y, r] of [[0.14, 0.305], [0.27, 0.338]]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.012, r - 0.005, 0.05, 10), mat(rimColor));
      band.position.y = y;
      g.add(band);
    }
  } else if (pat === 2) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const y = k % 2 ? 0.15 : 0.29;
      const r = 0.26 + (y / 0.42) * 0.1 + 0.005;
      const dot = new THREE.Mesh(GEO.blob, mat(rimColor));
      dot.scale.set(0.035, 0.035, 0.035);
      dot.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      g.add(dot);
    }
  }
  return g;
}
export const POT_TOP = 0.485;
