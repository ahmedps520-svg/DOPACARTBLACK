/**
 * Rendering kit shared by every product illustration: per-instance context,
 * gradient builders, shared material definitions and the `sol` shape helper
 * (fill + carbon weave + occlusion + rim light in one call).
 */
import type { ReactNode } from 'react';
import type { ArtFinish, ArtSpec } from '../engine/types';
import { finishKnobs, GOLD, materialStops, mix, SILVER, tone, type FinishKnobs, type PrismFace, type Stop, type Tone } from './shading';

export const FLOOR = 330;

export interface Ctx {
  /** Unique id for a def name within this instance. */
  id: (name: string) => string;
  /** `url(#…)` reference to a def name (shared defs are emitted on demand). */
  u: (name: string) => string;
  /** Variant 0..3. */
  v: number;
  f: ArtFinish;
  P: Tone;
  S: Tone;
  A: Tone;
  /** Trim metal: gold for the gold finish, silver otherwise. */
  M: Tone;
  gold: boolean;
  k: FinishKnobs;
  /** Extra highlight lift for very dark primaries. */
  lift: number;
}

export interface Art {
  el: ReactNode;
  /** Contact shadow: centre x, half width, half height, centre y (default FLOOR), rotation (deg). */
  shadow?: [cx: number, rx: number, ry?: number, cy?: number, rot?: number];
  /** Mirror line for the floor reflection (default FLOOR); `false` disables the reflection. */
  floor?: number | false;
}

export type KindFn = (c: Ctx) => Art;

export interface CtxInternal extends Ctx {
  used: Set<string>;
  spec: ArtSpec;
}

export function makeCtx(uid: string, spec: ArtSpec): CtxInternal {
  const f: ArtFinish = spec.finish ?? 'matte';
  const used = new Set<string>();
  const basePrimary = f === 'carbon' ? mix(spec.primary, '#141518', 0.55) : spec.primary;
  const P = tone(basePrimary);
  const v = Math.abs(Math.floor(spec.variant ?? 0)) % 4;
  return {
    id: (n) => `${uid}-${n}`,
    u: (n) => {
      used.add(n);
      return `url(#${uid}-${n})`;
    },
    v,
    f,
    P,
    S: tone(spec.secondary),
    A: tone(spec.accent),
    M: tone(f === 'gold' ? GOLD : SILVER),
    gold: f === 'gold',
    k: finishKnobs(f, P.dark),
    lift: P.dark ? 0.12 : 0,
    used,
    spec,
  };
}

// ───────────────────────────── gradient builders ─────────────────────────────

const stopEls = (stops: Stop[]) =>
  stops.map(([o, col, op], i) => <stop key={i} offset={o} stopColor={col} stopOpacity={op ?? 1} />);

/** Linear gradient. Coordinates are objectBoundingBox unless `user` is set. */
export function lin(c: Ctx, name: string, stops: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1, user = false) {
  return (
    <linearGradient key={name} id={c.id(name)} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits={user ? 'userSpaceOnUse' : undefined}>
      {stopEls(stops)}
    </linearGradient>
  );
}

/** Radial gradient. Coordinates are objectBoundingBox unless `user` is set. */
export function rad(c: Ctx, name: string, stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx = cx, fy = cy, user = false) {
  return (
    <radialGradient key={name} id={c.id(name)} cx={cx} cy={cy} r={r} fx={fx} fy={fy} gradientUnits={user ? 'userSpaceOnUse' : undefined}>
      {stopEls(stops)}
    </radialGradient>
  );
}

const W = '#ffffff';

function sphereStops(T: Tone, f: ArtFinish, lift: number): Stop[] {
  if (f === 'metal') return [[0, T(0.7)], [0.22, T(0.15)], [0.42, T(0.4)], [0.68, T(-0.2)], [0.9, T(-0.55)], [1, T(-0.25)]];
  if (f === 'gloss' || f === 'gold') return [[0, T(0.7 + lift)], [0.14, T(0.25 + lift)], [0.5, T(0)], [0.88, T(-0.5)], [1, T(-0.28)]];
  return [[0, T(0.32 + lift)], [0.5, T(0)], [0.9, T(-0.45)], [1, T(-0.32)]];
}
const K = '#000000';

/** Every shared def, keyed by name; only the ones a kind references are emitted. */
function sharedDef(c: CtxInternal, name: string): ReactNode {
  const { P, S, A, M, f, lift } = c;
  const metalFinish: ArtFinish = 'metal';
  switch (name) {
    case 'pv': return lin(c, name, materialStops(P, f, 'v', lift));
    case 'pc': return lin(c, name, materialStops(P, f, 'c', lift), 0, 0, 1, 0);
    case 'ph': return lin(c, name, materialStops(P, f, 'h', lift), 0, 0, 1, 0.35);
    case 'sv': return lin(c, name, materialStops(S, f === 'carbon' ? 'matte' : f, 'v'));
    case 'sc': return lin(c, name, materialStops(S, f === 'carbon' ? 'matte' : f, 'c'), 0, 0, 1, 0);
    case 'sh': return lin(c, name, materialStops(S, 'matte', 'h'), 0, 0, 1, 0.35);
    case 'av': return lin(c, name, [[0, A(0.45)], [0.5, A(0)], [1, A(-0.3)]]);
    case 'mv': return lin(c, name, materialStops(M, metalFinish, 'v', 0.05));
    case 'mc': return lin(c, name, materialStops(M, metalFinish, 'c', 0.05), 0, 0, 1, 0);
    case 'mh': return lin(c, name, materialStops(M, metalFinish, 'h'), 0, 0, 1, 0.35);
    case 'gl':
      return lin(c, name, [[0, '#262a33'], [0.45, '#0e1015'], [1, '#040406']], 0, 0, 0.3, 1);
    case 'scr':
      return lin(c, name, [[0, mix(A.base, '#05060a', 0.15)], [0.45, mix(S.base, '#06070c', 0.55)], [1, '#05060a']], 0, 0, 0.75, 1);
    case 'rim':
      return lin(c, name, [[0, W, 0.95], [0.28, W, 0.28], [0.6, W, 0], [1, W, 0.16]], 0.25, 0, 0.75, 1);
    case 'occ': return lin(c, name, [[0.3, K, 0], [1, K, 0.6]]);
    case 'occh': return lin(c, name, [[0, W, 0.1], [0.4, K, 0], [1, K, 0.55]], 0, 0, 1, 0);
    case 'sheen':
      return lin(c, name, [[0.12, W, 0], [0.26, W, 0.7], [0.36, W, 0.12], [0.5, W, 0], [0.78, W, 0], [0.86, W, 0.2], [0.92, W, 0]], 0, 0, 1, 1);
    case 'spec': return rad(c, name, [[0, W, 0.95], [0.4, W, 0.35], [1, W, 0]]);
    case 'ps': return rad(c, name, sphereStops(P, f, lift), 0.42, 0.38, 0.62, 0.36, 0.3);
    case 'ss': return rad(c, name, sphereStops(S, f === 'carbon' ? 'matte' : f, 0), 0.42, 0.38, 0.62, 0.36, 0.3);
    case 'ms': return rad(c, name, sphereStops(M, metalFinish, 0), 0.42, 0.38, 0.62, 0.36, 0.3);
    case 'lens':
      return rad(c, name, [[0, '#4a5680'], [0.3, '#18203c'], [0.75, '#05060d'], [1, '#000000']], 0.42, 0.38, 0.6, 0.38, 0.32);
    case 'glow': return rad(c, name, [[0, A(0.5), 1], [0.3, A.base, 0.55], [1, A.base, 0]]);
    case 'cs': return rad(c, name, [[0, K, 0.85], [0.45, K, 0.45], [1, K, 0]]);
    case 'carbon':
      return (
        <pattern key={name} id={c.id(name)} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={8} height={8} fill={K} opacity={0.18} />
          <rect width={4} height={4} fill={W} opacity={0.07} />
          <rect x={4} y={4} width={4} height={4} fill={W} opacity={0.07} />
          <rect y={3} width={4} height={1} fill={K} opacity={0.35} />
          <rect x={4} y={7} width={4} height={1} fill={K} opacity={0.35} />
          <rect x={7} y={0} width={1} height={4} fill={K} opacity={0.35} />
          <rect x={3} y={4} width={1} height={4} fill={K} opacity={0.35} />
        </pattern>
      );
    default:
      return null;
  }
}

export function sharedDefs(c: CtxInternal): ReactNode[] {
  // Iterate until stable: no shared def references another, so one pass suffices.
  return Array.from(c.used).map((n) => sharedDef(c, n));
}

// ───────────────────────────── shape helpers ─────────────────────────────

export interface SolOpts {
  /** Rim-light stroke strength multiplier (0 disables). */
  rim?: number;
  /** Ambient occlusion overlay opacity (darkens toward the bottom). */
  occ?: number;
  /** Side shading overlay opacity (darkens toward the right). */
  side?: number;
  /** Specular sheen overlay multiplier (scaled by finish). */
  sheen?: number;
  /** Apply carbon weave when the finish is carbon. */
  cb?: boolean;
  sw?: number;
  /** Optional flat outline colour drawn under the rim light. */
  edge?: string;
  op?: number;
}

/** A shaded solid: base fill, optional carbon weave, occlusion, sheen and rim light. */
export function sol(c: Ctx, d: string, fill: string, o: SolOpts = {}) {
  const rim = (o.rim ?? 1) * c.k.rim;
  return (
    <g opacity={o.op}>
      <path d={d} fill={fill} stroke={o.edge} strokeWidth={o.edge ? 1 : undefined} />
      {o.cb && c.f === 'carbon' ? <path d={d} fill={c.u('carbon')} /> : null}
      {o.side ? <path d={d} fill={c.u('occh')} opacity={o.side} /> : null}
      {o.occ ? <path d={d} fill={c.u('occ')} opacity={o.occ} /> : null}
      {o.sheen ? <path d={d} fill={c.u('sheen')} opacity={Math.min(1, o.sheen * c.k.sheen)} /> : null}
      {rim > 0 ? <path d={d} fill="none" stroke={c.u('rim')} strokeWidth={o.sw ?? 1.4} opacity={Math.min(1, rim)} /> : null}
    </g>
  );
}

/** Soft accent glow blob (LEDs, screens, flames). */
export function glow(c: Ctx, cx: number, cy: number, rx: number, ry = rx, op = 1) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c.u('glow')} opacity={op} />;
}

/** Small round specular highlight. */
export function spark(c: Ctx, cx: number, cy: number, rx: number, ry = rx, op = 0.9) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={c.u('spec')} opacity={op} />;
}

/** Camera lens: metal ring, black bezel, coated glass with reflections. */
export function lensEl(c: Ctx, cx: number, cy: number, r: number, ring = c.u('mc')) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={ring} />
      <circle cx={cx} cy={cy} r={r * 0.86} fill="#040406" />
      <circle cx={cx} cy={cy} r={r * 0.7} fill={c.u('lens')} />
      <circle cx={cx} cy={cy} r={r * 0.32} fill="#000" opacity={0.65} />
      <ellipse cx={cx - r * 0.24} cy={cy - r * 0.28} rx={r * 0.2} ry={r * 0.11} fill="#fff" opacity={0.6} transform={`rotate(-40 ${cx - r * 0.24} ${cy - r * 0.28})`} />
      <circle cx={cx + r * 0.26} cy={cy + r * 0.22} r={r * 0.09} fill={c.A(0.35)} opacity={0.55} />
      <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.8} />
    </g>
  );
}

/** Tiny abstract logo mark (no real brands): a faceted diamond with a core. */
export function mark(cx: number, cy: number, s: number, color: string, op = 0.8) {
  const h = s * 0.5;
  return (
    <g opacity={op}>
      <path d={`M${cx} ${cy - h}L${cx + h * 0.8} ${cy}L${cx} ${cy + h}L${cx - h * 0.8} ${cy}Z`} fill="none" stroke={color} strokeWidth={s * 0.12} strokeLinejoin="round" />
      <path d={`M${cx} ${cy - h * 0.42}L${cx + h * 0.32} ${cy}L${cx} ${cy + h * 0.42}L${cx - h * 0.32} ${cy}Z`} fill={color} />
    </g>
  );
}

/**
 * Extruded solid from the projection helpers: shaded side facets + top face.
 * `T` shades the sides; `top` fills the top face.
 */
export function block(c: Ctx, sides: PrismFace[], top: string, T: Tone, topFill: string, o: SolOpts & { dark?: number } = {}) {
  const base = o.dark ?? -0.18;
  return (
    <g>
      {sides.map((s, i) => {
        const col = T(base - s.lit * 0.22);
        return <path key={i} d={s.d} fill={col} stroke={col} strokeWidth={0.6} strokeLinejoin="round" />;
      })}
      {o.cb && c.f === 'carbon' ? sides.map((s, i) => <path key={'c' + i} d={s.d} fill={c.u('carbon')} />) : null}
      {sol(c, top, topFill, o)}
    </g>
  );
}
