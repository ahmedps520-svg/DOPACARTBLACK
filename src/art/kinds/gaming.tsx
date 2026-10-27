import type { ArtKind } from '../../engine/types';
import { glow, lin, mark, rad, sol, spark, type Ctx, type KindFn } from '../kit';
import { ell, makeProj, mirrorX, mix, onEll, poly, prism, rr, rrPts, smooth, type Pt } from '../shading';

const mirrorPts = (pts: Pt[]): Pt[] => pts.concat(pts.slice(1, -1).reverse().map(([x, y]) => [400 - x, y] as Pt));

// ───────────────────────────── controller ─────────────────────────────

function stick(c: Ctx, x: number, y: number, r = 19) {
  return (
    <g>
      <circle cx={x} cy={y + 2} r={r + 3} fill="#000" opacity={0.5} />
      <circle cx={x} cy={y} r={r + 2} fill={c.P(-0.6)} />
      <circle cx={x} cy={y} r={r} fill={c.u('stk')} />
      <circle cx={x} cy={y} r={r * 0.7} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={2} />
      <ellipse cx={x - r * 0.3} cy={y - r * 0.4} rx={r * 0.4} ry={r * 0.18} fill="#fff" opacity={0.22} />
    </g>
  );
}

function dpad(c: Ctx, x: number, y: number) {
  const d = `M${x - 6} ${y - 18}H${x + 6}V${y - 6}H${x + 18}V${y + 6}H${x + 6}V${y + 18}H${x - 6}V${y + 6}H${x - 18}V${y - 6}H${x - 6}Z`;
  return (
    <g>
      <path d={d} fill="#000" opacity={0.5} transform="translate(0 2)" />
      {sol(c, d, c.u('stk'), { rim: 0.6 })}
    </g>
  );
}

function faceButtons(c: Ctx, x: number, y: number) {
  const cols = [c.A(0.05), mix(c.A.base, '#ff4d6d', 0.6), mix(c.A.base, '#4dd2ff', 0.6), mix(c.A.base, '#ffd34d', 0.6)];
  const offs: Pt[] = [[0, 15], [15, 0], [-15, 0], [0, -15]];
  return offs.map(([dx, dy], i) => (
    <g key={i}>
      <circle cx={x + dx} cy={y + dy + 1.5} r={8.5} fill="#000" opacity={0.5} />
      <circle cx={x + dx} cy={y + dy} r={8} fill={c.u('stk')} />
      <circle cx={x + dx} cy={y + dy} r={3.4} fill={cols[i]} />
      <ellipse cx={x + dx - 2.5} cy={y + dy - 3.5} rx={3.5} ry={1.6} fill="#fff" opacity={0.3} />
    </g>
  ));
}

const controller: KindFn = (c) => {
  const sym = c.v % 2 === 1;
  const right: Pt[] = [[200, 172], [262, 166], [298, 176], [322, 200], [338, 250], [346, 296], [334, 324], [312, 330], [292, 318], [272, 292], [246, 274], [200, 270]];
  const body = smooth(mirrorPts(right));
  const bumper = 'M104 188C110 168 140 158 172 160L174 174C146 174 124 182 112 194Z';
  return {
    shadow: [200, 140, 10],
    el: (
      <g>
        <defs>{rad(c, 'stk', [[0, '#3a3b41'], [0.7, '#141417'], [1, '#0b0b0d']], 0.4, 0.35, 0.65)}</defs>
        {sol(c, bumper, c.u('sv'), { rim: 1 })}
        {sol(c, mirrorX(bumper), c.u('sv'), { rim: 1 })}
        <path d={body} fill={c.P(-0.6)} transform="translate(0 6)" />
        {sol(c, body, c.u('pv'), { sheen: 0.7, cb: true, occ: 0.35, rim: 1.2 })}
        <path d="M86 290C80 270 82 240 92 220M314 290C320 270 318 240 308 220" stroke="#000" strokeOpacity={0.25} strokeWidth={10} strokeLinecap="round" fill="none" />
        {sym ? (
          <g>
            {sol(c, rr(162, 182, 76, 44, 8), c.u('pv'), { rim: 0.8, occ: 0.3 })}
            <path d="M166 184H234" stroke={c.A(0.3)} strokeWidth={2.5} strokeLinecap="round" />
            {glow(c, 200, 184, 44, 6, 0.9)}
            {dpad(c, 122, 214)}
            {faceButtons(c, 278, 214)}
            {stick(c, 164, 258, 18)}
            {stick(c, 236, 258, 18)}
            <circle cx={200} cy={246} r={5} fill="#141417" />
          </g>
        ) : (
          <g>
            {stick(c, 128, 212)}
            {dpad(c, 160, 256)}
            {stick(c, 242, 256)}
            {faceButtons(c, 278, 212)}
            <circle cx={200} cy={196} r={11} fill="#0c0c0e" />
            <circle cx={200} cy={196} r={8} fill={c.A(0.1)} opacity={0.9} />
            {glow(c, 200, 196, 18, 18, 0.7)}
            {mark(200, 196, 8, '#000', 0.6)}
            <circle cx={180} cy={224} r={4} fill="#141417" />
            <circle cx={220} cy={224} r={4} fill="#141417" />
          </g>
        )}
      </g>
    ),
  };
};

// ───────────────────────────── headset ─────────────────────────────

const headset: KindFn = (c) => {
  const cy = 262;
  const cupPts = (x: number): Pt[] => [[x - 34, cy - 60], [x + 34, cy - 60], [x + 46, cy - 8], [x + 36, cy + 60], [x - 36, cy + 60], [x - 46, cy - 8]];
  const cup = (x: number, side: -1 | 1) => {
    const inward = -side;
    const shell = smooth(cupPts(x));
    const plate = smooth(cupPts(x).map(([px, py]) => [x + (px - x) * 0.68, cy + (py - cy) * 0.66] as Pt));
    return (
      <g>
        {sol(c, ell(x + inward * 20, cy, 36, 54), c.u('sc'), { rim: 0.6, occ: 0.4 })}
        <path d={shell} fill={c.P(-0.6)} transform={`translate(${side * 7} 2)`} />
        {sol(c, shell, c.u('pc'), { sheen: 0.7, cb: true, rim: 1.2, occ: 0.2 })}
        <path d={plate} fill="none" stroke={c.A(0.3)} strokeWidth={4} />
        <path d={plate} fill="none" stroke={c.u('glow')} strokeWidth={14} opacity={0.5} />
        {sol(c, plate, c.u('pv'), { rim: 0.5, sheen: 0.5 })}
        <path d={plate} fill={c.u('grille')} opacity={0.7} />
        {mark(x, cy, 16, c.A(0.2), 0.9)}
      </g>
    );
  };
  const boom = 'M120 312C132 340 168 344 196 330';
  return {
    shadow: [200, 140, 11],
    el: (
      <g>
        <defs>
          <pattern id={c.id('grille')} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <rect width={5} height={5} fill="#000" opacity={0.25} />
            <circle cx={2.5} cy={2.5} r={1.3} fill="#000" opacity={0.6} />
          </pattern>
        </defs>
        {/* suspension band */}
        <path d="M110 206C104 96 296 96 290 206" fill="none" stroke={c.M(-0.5)} strokeWidth={10} />
        <path d="M110 206C104 96 296 96 290 206" fill="none" stroke={c.u('mc')} strokeWidth={7} />
        <path d="M108 200C100 82 300 82 292 200" fill="none" stroke={c.u('pv')} strokeWidth={9} />
        <path d="M122 214C120 128 280 128 278 214" fill="none" stroke={c.S(-0.35)} strokeWidth={14} strokeLinecap="round" />
        <path d="M122 214C120 128 280 128 278 214" fill="none" stroke={c.u('sv')} strokeWidth={11} strokeLinecap="round" />
        {sol(c, rr(108, 190, 14, 22, 4), c.u('mc'), { rim: 0.8 })}
        {sol(c, rr(278, 190, 14, 22, 4), c.u('mc'), { rim: 0.8 })}
        {cup(116, -1)}
        {cup(284, 1)}
        {/* mic boom */}
        <path d={boom} fill="none" stroke="#08080a" strokeWidth={8} strokeLinecap="round" />
        <path d={boom} fill="none" stroke={c.P(-0.35)} strokeWidth={5} strokeLinecap="round" />
        <path d={boom} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} transform="translate(0 -1.5)" />
        {sol(c, rr(190, 320, 26, 15, 7), c.u('pv'), { rim: 1 })}
        <circle cx={213} cy={327} r={2.6} fill={c.A(0.4)} />
        {glow(c, 213, 327, 10, 10, 0.9)}
      </g>
    ),
  };
};

// ───────────────────────────── keyboard ─────────────────────────────

const ROWS = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
  [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
  [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
  [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
];

const keyboard: KindFn = (c) => {
  const full = c.v % 2 === 0;
  const pr = makeProj(200, 248, -6, 0.8);
  const u = full ? 14.6 : 18.4;
  const cols = full ? 19.5 : 15;
  const rows = full ? 6 : 5;
  const m = 9;
  const W = (cols * u) / 2 + m;
  const D = (rows * u + (full ? 4 : 0)) / 2 + m;
  const zc = 14;
  const zk = 23;
  const caseP = prism(pr, rrPts(2 * W, 2 * D, 10, 3), 0, zc);
  let skirts = '';
  let tops = '';
  let accent = '';
  const key = (u0: number, v0: number, u1: number, v1: number, acc = false) => {
    const a = 0.7;
    const b = 2.2;
    const p = (uu: number, vv: number, z: number) => pr(uu, vv, z);
    const front = poly(p(u0 + a, v1 - a, zc), p(u1 - a, v1 - a, zc), p(u1 - b, v1 - b, zk), p(u0 + b, v1 - b, zk));
    const left = poly(p(u0 + a, v0 + a, zc), p(u0 + a, v1 - a, zc), p(u0 + b, v1 - b, zk), p(u0 + b, v0 + b, zk));
    const top = poly(p(u0 + b, v0 + b, zk), p(u1 - b, v0 + b, zk), p(u1 - b, v1 - b, zk), p(u0 + b, v1 - b, zk));
    skirts += front + left;
    if (acc) accent += top;
    else tops += top;
  };
  const x0 = -W + m;
  let y = -D + m;
  if (full) {
    // function row with gaps
    [0, 1.5, 2.5, 3.5, 4.5, 6, 7, 8, 9, 10.5, 11.5, 12.5, 13.5].forEach((k, i) => key(x0 + k * u, y, x0 + (k + 1) * u, y + u, i === 0));
    y += u + 4;
  }
  ROWS.forEach((row, r) => {
    let x = x0;
    row.forEach((w, i) => {
      key(x, y + r * u, x + w * u, y + (r + 1) * u, (r === 4 && i === 3 && !full) || (r === 2 && i === row.length - 1));
      x += w * u;
    });
    if (full) for (let k = 0; k < 4; k++) key(x0 + (15.5 + k) * u, y + r * u, x0 + (16.5 + k) * u, y + (r + 1) * u, false);
  });
  return {
    shadow: [200, 160, 30, 256],
    floor: 318,
    el: (
      <g>
        {caseP.sides.map((s, i) => (
          <path key={i} d={s.d} fill={c.P(-0.25 - s.lit * 0.25)} stroke={c.P(-0.25 - s.lit * 0.25)} strokeWidth={0.6} />
        ))}
        {sol(c, caseP.top, c.u('pv'), { rim: 1.2, cb: true })}
        <g transform={pr.plane(zc)}>
          <rect x={-W + 5} y={-D + 5} width={2 * W - 10} height={2 * D - 10} rx={5} fill="#060607" opacity={0.8} />
          <rect x={-W + 5} y={-D + 5} width={2 * W - 10} height={2 * D - 10} rx={5} fill={c.u('glow')} opacity={0.75} />
        </g>
        <path d={skirts} fill={c.S(-0.45)} stroke={c.S(-0.45)} strokeWidth={0.3} />
        <path d={tops} fill={c.u('kcap')} />
        <path d={accent} fill={c.A(0.05)} />
        <path d={tops} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={0.6} />
        {full ? null : (
          <g>
            {sol(c, ell(pr(W - 6, -D - 2, zc + 8)[0], pr(W - 6, -D - 2, zc + 8)[1], 11, 6), c.u('mc'), { rim: 1 })}
          </g>
        )}
        <defs>{lin(c, 'kcap', [[0, c.S(0.18)], [1, c.S(-0.12)]])}</defs>
      </g>
    ),
  };
};

// ───────────────────────────── mouse ─────────────────────────────

const mouse: KindFn = (c) => {
  const pr = makeProj(200, 236, 28, 0.56);
  const W = 74, D = 136;
  const outline = (s: number, sv = s): Pt[] =>
    Array.from({ length: 48 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2;
      const back = Math.sin(t) > 0 ? 1 : 1 - 0.2 * -Math.sin(t);
      const waist = 1 - 0.06 * Math.max(0, Math.cos(t * 2 + 0.2));
      return [W * s * Math.cos(t) * back * waist, D * sv * Math.sin(t)] as Pt;
    });
  const skirt = prism(pr, outline(1), 0, 16);
  const shell = prism(pr, outline(0.9, 0.95), 16, 34);
  const wire = c.v % 2 === 1;
  return {
    shadow: [200, 104, 40, 248, 28],
    floor: 300,
    el: (
      <g>
        {skirt.sides.map((s, i) => (
          <path key={i} d={s.d} fill={c.S(-0.35 - s.lit * 0.25)} stroke={c.S(-0.35 - s.lit * 0.25)} strokeWidth={0.6} />
        ))}
        <path d={skirt.top} fill={c.S(-0.2)} />
        <path d={skirt.top} fill="none" stroke={c.A(0.3)} strokeWidth={2.2} opacity={0.9} />
        <path d={skirt.top} fill="none" stroke={c.u('glow')} strokeWidth={10} opacity={0.5} />
        {shell.sides.map((s, i) => (
          <path key={i} d={s.d} fill={c.P(-0.15 - s.lit * 0.3)} stroke={c.P(-0.15 - s.lit * 0.3)} strokeWidth={0.6} />
        ))}
        {c.f === 'carbon' ? shell.sides.map((s, i) => <path key={'c' + i} d={s.d} fill={c.u('carbon')} />) : null}
        {sol(c, shell.top, c.u('mtop'), { rim: 1.3, sheen: 0.8, cb: true })}
        <g transform={pr.plane(34)}>
          <path d={`M0 ${-D * 0.95}V${-D * 0.18}`} stroke="#000" strokeOpacity={0.6} strokeWidth={2} />
          <path d={`M${-W * 0.9} ${-D * 0.2}Q0 ${-D * 0.1} ${W * 0.9} ${-D * 0.2}`} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={1.6} />
          <rect x={-5} y={-D * 0.72} width={10} height={26} rx={5} fill="#0b0b0d" />
          <rect x={-3} y={-D * 0.7} width={6} height={22} rx={3} fill={c.A(0.1)} />
          <rect x={-4} y={-D * 0.4} width={8} height={10} rx={2} fill="#0b0b0d" />
          <g transform={`translate(0 ${D * 0.45})`}>
            {glow(c, 0, 0, 22, 22, 0.8)}
            {mark(0, 0, 18, c.A(0.4), 1)}
          </g>
        </g>
        <g transform={pr.uplane(-W * 0.86)} opacity={0.9}>
          <rect x={-20} y={-28} width={22} height={6} rx={3} fill={c.P(-0.6)} />
          <rect x={6} y={-28} width={22} height={6} rx={3} fill={c.P(-0.6)} />
        </g>
        {wire ? (
          <path d={`M${pr(0, -D, 10)[0]} ${pr(0, -D, 10)[1]}C${pr(0, -D - 30, 6)[0]} ${pr(0, -D - 30, 6)[1]} ${pr(-30, -D - 60, 0)[0]} ${pr(-30, -D - 60, 0)[1]} ${pr(-20, -D - 110, 0)[0]} ${pr(-20, -D - 110, 0)[1]}`} fill="none" stroke={c.S(-0.5)} strokeWidth={3.5} strokeLinecap="round" />
        ) : null}
        <defs>{rad(c, 'mtop', [[0, c.P(0.35 + c.lift)], [0.45, c.P(0)], [1, c.P(-0.45)]], 0.38, 0.32, 0.75)}</defs>
      </g>
    ),
  };
};

// ───────────────────────────── monitor ─────────────────────────────

const monitor: KindFn = (c) => {
  const curved = c.v % 2 === 1;
  const clip = c.id('mscr');
  const panel = curved ? 'M34 84Q200 64 366 84V236Q200 252 34 236Z' : rr(44, 72, 312, 182, 8);
  const screen = curved ? 'M40 90Q200 71 360 90V228Q200 244 40 228Z' : rr(50, 78, 300, 168, 3);
  return {
    shadow: [200, curved ? 110 : 96, 10],
    el: (
      <g>
        <defs>
          <clipPath id={clip}>
            <path d={screen} />
          </clipPath>
        </defs>
        {/* stand */}
        {curved ? (
          <g>
            {sol(c, 'M196 300L120 326L128 330L200 310L272 330L280 326L204 300Z', c.u('mv'), { rim: 1 })}
            {sol(c, rr(190, 220, 20, 92, 4), c.u('mc'), { rim: 0.8 })}
          </g>
        ) : (
          <g>
            {sol(c, 'M184 236H216L222 316H178Z', c.u('mc'), { rim: 0.8, side: 0.3 })}
            {sol(c, 'M134 316Q200 306 266 316L270 326Q200 334 130 326Z', c.u('mv'), { rim: 1.2 })}
          </g>
        )}
        <path d={panel} fill={c.P(-0.6)} transform="translate(5 3)" />
        {sol(c, panel, c.u('pv'), { rim: 1.3, cb: true })}
        <path d={panel} fill="#060607" transform="translate(200 160) scale(0.985 0.97) translate(-200 -160)" />
        <g clipPath={`url(#${clip})`}>
          <rect x={30} y={60} width={340} height={200} fill={c.u('scr')} />
          <ellipse cx={250} cy={130} rx={170} ry={100} fill={c.u('glow')} opacity={0.7} />
          <path d="M30 200C110 160 200 250 370 180V260H30Z" fill={c.S(0.15)} opacity={0.35} />
          <path d="M30 222C120 196 220 262 370 214V260H30Z" fill={c.A(-0.45)} opacity={0.5} />
          <rect x={70} y={100} width={110} height={70} rx={6} fill="#fff" opacity={0.08} />
          <rect x={78} y={110} width={60} height={5} rx={2.5} fill="#fff" opacity={0.45} />
          <rect x={150} y={222} width={100} height={10} rx={5} fill="#fff" opacity={0.15} />
        </g>
        <path d={screen} fill={c.u('sheen')} opacity={0.22} />
        {curved ? (
          <g>
            <path d="M70 244Q200 256 330 244" stroke={c.A(0.3)} strokeWidth={2} fill="none" />
            {glow(c, 200, 250, 150, 10, 0.6)}
          </g>
        ) : (
          <circle cx={340} cy={250} r={1.8} fill={c.A(0.4)} />
        )}
      </g>
    ),
  };
};

// ───────────────────────────── chair ─────────────────────────────

/** Five-star base with casters. */
function starBase(c: Ctx, cx: number, cy: number) {
  const legs: [number, number, number][] = [
    [cx, 326, 1],
    [cx - 82, 318, 0.95],
    [cx + 82, 318, 0.95],
    [cx - 58, 298, 0.8],
    [cx + 58, 298, 0.8],
  ];
  return (
    <g>
      {legs
        .slice()
        .sort((a, b) => a[1] - b[1])
        .map(([x, y, s], i) => (
          <g key={i}>
            <path d={`M${cx - 6} ${cy}L${x - 5 * s} ${y - 12 * s}L${x + 5 * s} ${y - 12 * s}L${cx + 6} ${cy + 6}Z`} fill={c.P(-0.45)} />
            <path d={`M${cx} ${cy - 2}L${x} ${y - 13 * s}`} stroke="#fff" strokeOpacity={0.2} />
            <ellipse cx={x} cy={y - 4 * s} rx={8 * s} ry={6 * s} fill="#111114" />
            <ellipse cx={x - 2} cy={y - 6 * s} rx={3 * s} ry={2 * s} fill="#fff" opacity={0.2} />
          </g>
        ))}
    </g>
  );
}

const chair: KindFn = (c) => {
  const v = c.v % 3;
  if (v === 2) {
    // molded shell chair on wire legs
    const shell = 'M104 154C100 118 140 100 200 100C260 100 300 118 296 154L290 212C300 232 300 252 284 262Q200 280 116 262C100 252 100 232 110 212Z';
    return {
      shadow: [200, 124, 12],
      el: (
        <g>
          <path d="M130 262L112 328M270 262L288 328M150 266L170 316M250 266L230 316" stroke={c.u('mv')} strokeWidth={4} strokeLinecap="round" />
          <path d="M116 306L176 280L224 280L284 306M150 300L200 284L250 300" stroke={c.u('mc')} strokeWidth={1.6} fill="none" />
          {sol(c, ell(200, 268, 36, 6), '#121214', { rim: 0.4 })}
          {sol(c, shell, c.u('pv'), { sheen: 0.9, cb: true, occ: 0.25, rim: 1.2 })}
          {sol(c, 'M120 214Q200 196 280 214L284 252Q200 268 116 252Z', c.u('pv'), { rim: 0.8, sheen: 0.6 })}
          <path d="M120 214Q200 196 280 214" fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={3} />
          <path d={shell} fill={c.u('occh')} opacity={0.3} />
        </g>
      ),
    };
  }
  const mesh = v === 1;
  const back = mesh
    ? 'M128 98C128 62 272 62 272 98L262 214C258 232 240 240 200 240C160 240 142 232 138 214Z'
    : smooth([[200, 50], [244, 54], [268, 76], [262, 130], [252, 176], [262, 222], [244, 246], [200, 250], [156, 246], [138, 222], [148, 176], [138, 130], [132, 76], [156, 54]]);
  return {
    shadow: [200, 104, 12],
    el: (
      <g>
        <defs>
          <pattern id={c.id('mesh')} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={5} height={5} fill={c.S(-0.4)} />
            <rect width={2.5} height={2.5} fill="#000" opacity={0.45} />
          </pattern>
        </defs>
        {starBase(c, 200, 300)}
        {sol(c, rr(193, 266, 14, 36, 4), c.u('mc'), { rim: 0.8 })}
        {/* back */}
        {sol(c, back, c.u('pv'), { sheen: 0.6, cb: true, rim: 1.3, occ: 0.2 })}
        {mesh ? (
          <g>
            <path d="M138 104C140 78 260 78 262 104L254 208C250 222 236 228 200 228C164 228 150 222 146 208Z" fill={c.u('mesh')} />
            <path d="M146 196Q200 178 254 196" stroke={c.P(0.1)} strokeWidth={6} fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            {sol(c, smooth([[200, 62], [232, 66], [244, 86], [236, 150], [232, 200], [236, 232], [200, 238], [164, 232], [168, 200], [164, 150], [156, 86], [168, 66]]), c.u('sv'), { rim: 0.6, occ: 0.25 })}
            <path d="M184 70L180 236M216 70L220 236" stroke={c.A(0)} strokeWidth={3} opacity={0.9} />
            <path d="M170 110Q200 118 230 110" stroke="#000" strokeOpacity={0.3} strokeWidth={2} fill="none" />
            {sol(c, rr(170, 74, 60, 26, 10), c.u('pv'), { rim: 0.8, occ: 0.2 })}
            {sol(c, rr(166, 192, 68, 26, 10), c.u('pv'), { rim: 0.6, occ: 0.25 })}
            {mark(200, 87, 12, c.A(0.1), 0.85)}
            <path d="M138 130L120 100M262 130L280 100" stroke={c.P(-0.4)} strokeWidth={0} />
          </g>
        )}
        {/* seat */}
        {sol(c, 'M124 244Q200 232 276 244L292 266Q200 280 108 266Z', c.u('pv'), { rim: 1.1, sheen: 0.5, cb: true })}
        {sol(c, 'M108 266Q200 280 292 266L290 278Q200 292 110 278Z', c.P(-0.4), { rim: 0.3 })}
        {mesh ? null : <path d="M150 248Q200 240 250 248" stroke={c.A(0)} strokeWidth={2.5} opacity={0.8} fill="none" />}
        {/* armrests */}
        {[0, 1].map((i) => {
          const x = i ? 284 : 116;
          return (
            <g key={i}>
              {sol(c, rr(x - 5, 222, 10, 46, 3), c.u('mc'), { rim: 0.6 })}
              {sol(c, rr(x - 20, 214, 40, 12, 6), c.P(-0.35), { rim: 1 })}
            </g>
          );
        })}
      </g>
    ),
  };
};

export const gaming: Partial<Record<ArtKind, KindFn>> = {
  controller,
  headset,
  keyboard,
  mouse,
  monitor,
  chair,
};

void spark;
void onEll;
