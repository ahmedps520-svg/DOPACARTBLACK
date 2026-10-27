/**
 * Colour + geometry helpers for the product illustrations.
 * Pure functions only (no JSX) so they can be unit-tested and reused.
 */
import type { ArtFinish } from '../engine/types';

type RGB = [number, number, number];

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function hexToRgb(hex: string): RGB {
  let h = (hex || '').trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((ch) => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}/.test(h)) return [128, 128, 128];
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

/** Linear mix of two colours, t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = clamp(t);
  return rgbToHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
}

/** amount > 0 mixes toward a warm white, amount < 0 toward a cool black. */
export function shade(hex: string, amount: number): string {
  if (amount === 0) return mix(hex, hex, 0);
  return amount > 0 ? mix(hex, '#fffdf8', amount) : mix(hex, '#020205', -amount);
}

/** Relative luminance 0..1 (sRGB approximation). */
export function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A colour with its shading ramp: tone(0) = base, tone(.3) lighter, tone(-.4) darker. */
export type Tone = ((amount?: number) => string) & { base: string; dark: boolean };

export function tone(hex: string): Tone {
  const base = mix(hex, hex, 0);
  const fn = ((a = 0) => shade(base, a)) as Tone;
  fn.base = base;
  fn.dark = luma(base) < 0.12;
  return fn;
}

export const GOLD = '#d2ab52';
export const SILVER = '#aeb3bb';
export const GUNMETAL = '#6b7079';

/** Per-finish tuning knobs used by the material helpers. */
export interface FinishKnobs {
  /** Opacity multiplier of specular sheen overlays. */
  sheen: number;
  /** Strength of rim light strokes. */
  rim: number;
}

export function finishKnobs(f: ArtFinish, darkPrimary: boolean): FinishKnobs {
  const sheen = { matte: 0.16, gloss: 0.85, metal: 0.55, gold: 0.7, carbon: 0.35 }[f];
  return { sheen, rim: darkPrimary ? 0.95 : 0.6 };
}

export type Stop = [offset: number, color: string, opacity?: number];

/**
 * Material ramp for a base tone.
 * dir: 'v' = lit from the top, 'c' = cylinder (left→right), 'h' = side face (left lit → right dark).
 */
export function materialStops(T: Tone, f: ArtFinish, dir: 'v' | 'c' | 'h', lift = 0): Stop[] {
  const L = (a: number) => T(a + (a > 0 ? lift : 0));
  if (f === 'metal') {
    if (dir === 'c')
      return [[0, T(-0.45)], [0.14, L(0.35)], [0.28, T(-0.05)], [0.4, L(0.6)], [0.52, L(0.12)], [0.74, T(-0.3)], [0.88, L(0.18)], [1, T(-0.5)]];
    if (dir === 'h') return [[0, L(0.3)], [0.3, T(-0.05)], [0.55, L(0.2)], [1, T(-0.4)]];
    return [[0, L(0.55)], [0.16, L(0.12)], [0.3, L(0.38)], [0.48, T(-0.1)], [0.64, L(0.18)], [0.82, T(-0.3)], [1, T(-0.12)]];
  }
  if (f === 'gloss' || f === 'gold') {
    if (dir === 'c')
      return [[0, T(-0.5)], [0.14, T(-0.05)], [0.24, L(0.45)], [0.3, L(0.12)], [0.58, T(0)], [0.84, T(-0.35)], [0.94, T(-0.12)], [1, T(-0.5)]];
    if (dir === 'h') return [[0, L(0.22)], [0.45, T(0)], [1, T(-0.42)]];
    return [[0, L(0.42)], [0.1, L(0.14)], [0.5, T(0)], [0.86, T(-0.32)], [1, T(-0.14)]];
  }
  // matte & carbon
  if (dir === 'c') return [[0, T(-0.48)], [0.24, L(0.14)], [0.45, T(0)], [0.8, T(-0.3)], [1, T(-0.55)]];
  if (dir === 'h') return [[0, L(0.12)], [1, T(-0.38)]];
  return [[0, L(0.2)], [0.45, T(0)], [1, T(-0.36)]];
}

// ───────────────────────── geometry (path strings) ─────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Rounded rectangle path. */
export function rr(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2);
  return `M${r2(x + k)} ${r2(y)}H${r2(x + w - k)}A${k} ${k} 0 0 1 ${r2(x + w)} ${r2(y + k)}V${r2(y + h - k)}A${k} ${k} 0 0 1 ${r2(
    x + w - k,
  )} ${r2(y + h)}H${r2(x + k)}A${k} ${k} 0 0 1 ${r2(x)} ${r2(y + h - k)}V${r2(y + k)}A${k} ${k} 0 0 1 ${r2(x + k)} ${r2(y)}Z`;
}

/** Ellipse path. `rev` reverses the winding so it punches a hole when combined with another ellipse. */
export function ell(cx: number, cy: number, rx: number, ry = rx, rev = false): string {
  const f = rev ? 1 : 0;
  return `M${r2(cx - rx)} ${r2(cy)}A${rx} ${ry} 0 1 ${f} ${r2(cx + rx)} ${r2(cy)}A${rx} ${ry} 0 1 ${f} ${r2(cx - rx)} ${r2(cy)}Z`;
}

export type Pt = [number, number];

/** Closed polygon path. */
export function poly(...pts: Pt[]): string {
  return 'M' + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L') + 'Z';
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** Bilinear interpolation inside a quad (tl, tr, br, bl) — handy for perspective grids. */
export function quadAt(q: [Pt, Pt, Pt, Pt], u: number, v: number): Pt {
  return lerpPt(lerpPt(q[0], q[1], u), lerpPt(q[3], q[2], u), v);
}

/** Sub-quad of a quad in (u,v) space, as a polygon path. */
export function subQuad(q: [Pt, Pt, Pt, Pt], u0: number, v0: number, u1: number, v1: number): string {
  return poly(quadAt(q, u0, v0), quadAt(q, u1, v0), quadAt(q, u1, v1), quadAt(q, u0, v1));
}

/**
 * Grid of cells inside a perspective quad as one compound path (keyboards, grills).
 * `inset` shrinks each cell in uv units; rows may pass a per-row column count.
 */
export function quadGrid(
  q: [Pt, Pt, Pt, Pt],
  cols: number | number[],
  rows: number,
  inset = 0.12,
  area: [number, number, number, number] = [0, 0, 1, 1],
): string {
  const [ua, va, ub, vb] = area;
  let d = '';
  for (let r = 0; r < rows; r++) {
    const n = Array.isArray(cols) ? cols[r % cols.length] : cols;
    const ch = (vb - va) / rows;
    for (let k = 0; k < n; k++) {
      const cw = (ub - ua) / n;
      const u0 = ua + k * cw + cw * inset * 0.5;
      const u1 = ua + (k + 1) * cw - cw * inset * 0.5;
      const v0 = va + r * ch + ch * inset * 0.5;
      const v1 = va + (r + 1) * ch - ch * inset * 0.5;
      d += subQuad(q, u0, v0, u1, v1);
    }
  }
  return d;
}

/** Point on an ellipse at angle (degrees, 0 = right, 90 = down). */
export function onEll(cx: number, cy: number, rx: number, ry: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
}

/** Regular polygon (e.g. hexagon) path. */
export function ngon(cx: number, cy: number, rx: number, ry: number, n: number, rot = 0): string {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) pts.push(onEll(cx, cy, rx, ry, rot + (360 / n) * i));
  return poly(...pts);
}

/** Smooth closed path through points (Catmull-Rom → cubic Bézier). */
export function smooth(pts: Pt[], closed = true): string {
  const n = pts.length;
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

// ───────────────────────── tiny orthographic projection ─────────────────────────

/** Projects (u, v, z) — u right, v toward the viewer, z up — to screen space. */
export interface Proj {
  (u: number, v: number, z?: number): Pt;
  /** SVG transform that maps a flat (u, v) drawing onto the horizontal plane at height z. */
  plane: (z?: number) => string;
  /** Vertical face at constant v (front faces). Local x = u, local y = -z. */
  vplane: (v: number) => string;
  /** Vertical face at constant u (side faces). Local x = -v (front → back), local y = -z. */
  uplane: (u: number) => string;
  yaw: number;
  k: number;
}

export function makeProj(cx: number, cy: number, yawDeg: number, k = 0.5): Proj {
  const t = (yawDeg * Math.PI) / 180;
  const cs = Math.cos(t);
  const sn = Math.sin(t);
  const f = ((u: number, v: number, z = 0) => [cx + u * cs - v * sn, cy + (u * sn + v * cs) * k - z]) as Proj;
  const q = (n: number) => Math.round(n * 10000) / 10000;
  f.plane = (z = 0) => `matrix(${q(cs)} ${q(sn * k)} ${q(-sn)} ${q(cs * k)} ${r2(cx)} ${r2(cy - z)})`;
  f.vplane = (v) => `matrix(${q(cs)} ${q(sn * k)} 0 1 ${r2(cx - v * sn)} ${r2(cy + v * cs * k)})`;
  f.uplane = (u) => `matrix(${q(sn)} ${q(-cs * k)} 0 1 ${r2(cx + u * cs)} ${r2(cy + u * sn * k)})`;
  f.yaw = t;
  f.k = k;
  return f;
}

export type V3 = [number, number, number];
export interface Face3In {
  pts: V3[];
  n: V3;
  tag?: string;
}
export interface Face3 {
  d: string;
  /** Diffuse light 0..1 (key light from top-left-front). */
  lit: number;
  depth: number;
  tag?: string;
}

const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const LIGHT: V3 = (() => {
  const l: V3 = [-0.45, 0.4, 0.8];
  const m = Math.hypot(...l);
  return [l[0] / m, l[1] / m, l[2] / m];
})();

/** Back-face cull, light and depth-sort a list of planar 3D faces. */
export function mesh(pr: Proj, faces: Face3In[]): Face3[] {
  const w: V3 = [Math.sin(pr.yaw), Math.cos(pr.yaw), pr.k];
  return faces
    .filter((f) => dot3(f.n, w) > 0.001)
    .map((f) => ({
      d: poly(...f.pts.map(([u, v, z]) => pr(u, v, z))),
      lit: Math.max(0, dot3(f.n, LIGHT)),
      depth: f.pts.reduce((a, p) => a + dot3(p, w), 0) / f.pts.length,
      tag: f.tag,
    }))
    .sort((a, b) => a.depth - b.depth);
}

/** n-gon prism along the u axis (hex dumbbell heads, handles, plates). */
export function prismU(u0: number, u1: number, R: number, n: number, zc: number, rot = 0, tag?: string): Face3In[] {
  const vs = Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return [R * Math.cos(a), zc + R * Math.sin(a), a] as const;
  });
  const faces: Face3In[] = vs.map(([v, z, a], i) => {
    const [v2, z2, a2] = vs[(i + 1) % n];
    const m = (a + a2 + (i === n - 1 ? Math.PI * 2 : 0)) / 2;
    return { pts: [[u0, v, z], [u1, v, z], [u1, v2, z2], [u0, v2, z2]], n: [0, Math.cos(m), Math.sin(m)], tag: tag ? tag + 's' : undefined };
  });
  faces.push({ pts: vs.map(([v, z]) => [u0, v, z] as V3), n: [-1, 0, 0], tag: tag ? tag + 'a' : undefined });
  faces.push({ pts: vs.map(([v, z]) => [u1, v, z] as V3), n: [1, 0, 0], tag: tag ? tag + 'b' : undefined });
  return faces;
}

export interface PrismFace {
  d: string;
  /** -1 (faces the light, left) … 1 (faces away, right). */
  lit: number;
}

/** Extrude a uv polygon from z0 to z1: top face path + visible side faces. */
export function prism(pr: Proj, pts: Pt[], z0: number, z1: number): { top: string; sides: PrismFace[] } {
  let area = 0;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  });
  const sgn = area > 0 ? 1 : -1;
  const cs = Math.cos(pr.yaw);
  const sn = Math.sin(pr.yaw);
  const sides: PrismFace[] = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nu = (sgn * dy) / len;
    const nv = (-sgn * dx) / len;
    if (nu * sn + nv * cs <= 0.01) return;
    sides.push({ d: poly(pr(a[0], a[1], z0), pr(b[0], b[1], z0), pr(b[0], b[1], z1), pr(a[0], a[1], z1)), lit: nu * cs - nv * sn });
  });
  return { top: poly(...pts.map(([u, v]) => pr(u, v, z1))), sides };
}

/** Rounded-rectangle outline as points (centred on 0,0) for extrusion. */
export function rrPts(w: number, h: number, r: number, seg = 4): Pt[] {
  const pts: Pt[] = [];
  const k = Math.min(r, w / 2, h / 2);
  const corners: [number, number, number][] = [
    [w / 2 - k, h / 2 - k, 0],
    [-w / 2 + k, h / 2 - k, 90],
    [-w / 2 + k, -h / 2 + k, 180],
    [w / 2 - k, -h / 2 + k, 270],
  ];
  corners.forEach(([cx, cy, a0]) => {
    for (let i = 0; i <= seg; i++) {
      const a = ((a0 + (90 * i) / seg) * Math.PI) / 180;
      pts.push([cx + k * Math.cos(a), cy + k * Math.sin(a)]);
    }
  });
  return pts;
}

/** Mirror an absolute-command path horizontally around x = axis (for symmetric products). */
export function mirrorX(d: string, axis = 200): string {
  const arity: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, S: 4, T: 2, H: 1, V: 1, A: 7, Z: 0 };
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  let out = '';
  let cmd = '';
  let idx = 0;
  for (const t of toks) {
    if (/[a-zA-Z]/.test(t)) {
      cmd = t.toUpperCase();
      out += t;
      idx = 0;
      continue;
    }
    let n = parseFloat(t);
    const k = arity[cmd] ? idx % arity[cmd] : 0;
    if (cmd === 'H') n = 2 * axis - n;
    else if (cmd === 'A') {
      if (k === 4) n = 1 - n;
      else if (k === 5) n = 2 * axis - n;
    } else if (cmd !== 'V' && k % 2 === 0) n = 2 * axis - n;
    out += (/[a-zA-Z]$/.test(out) ? '' : ' ') + r2(n);
    idx++;
  }
  return out;
}

/** Make a string safe to use inside url(#…) references. */
export function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}
