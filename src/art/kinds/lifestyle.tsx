import type { ArtKind } from '../../engine/types';
import { glow, lin, mark, rad, sol, type Ctx, type KindFn } from '../kit';
import { ell, makeProj, mesh, mix, prismU, rr, smooth, tone, type Face3, type Pt, type Tone } from '../shading';

/** Closed outline from a right-hand profile (top → bottom), mirrored around x=200. */
function lathe(right: Pt[]): string {
  const left = right.slice().reverse().map(([x, y]) => [400 - x, y] as Pt);
  return smooth([...right, ...left]);
}

const warmOf = (c: Ctx) => mix(c.A.base, '#ffd49a', 0.72);

/** Candle flame with glow. */
function flame(c: Ctx, x: number, y: number, s = 1) {
  const warm = warmOf(c);
  return (
    <g>
      <ellipse cx={x} cy={y - 14 * s} rx={46 * s} ry={52 * s} fill={c.u('fglow')} />
      <path d={`M${x} ${y - 36 * s}C${x + 9 * s} ${y - 20 * s} ${x + 11 * s} ${y - 7 * s} ${x} ${y}C${x - 11 * s} ${y - 7 * s} ${x - 9 * s} ${y - 20 * s} ${x} ${y - 36 * s}Z`} fill={warm} opacity={0.9} />
      <path d={`M${x} ${y - 26 * s}C${x + 5 * s} ${y - 15 * s} ${x + 6 * s} ${y - 6 * s} ${x} ${y - 2 * s}C${x - 6 * s} ${y - 6 * s} ${x - 5 * s} ${y - 15 * s} ${x} ${y - 26 * s}Z`} fill="#fffbe8" />
      <path d={`M${x} ${y + 1}V${y + 6 * s}`} stroke="#222" strokeWidth={1.6 * s} />
    </g>
  );
}

function flameDefs(c: Ctx) {
  const warm = warmOf(c);
  return rad(c, 'fglow', [[0, warm, 0.55], [0.35, warm, 0.18], [1, warm, 0]]);
}

// ───────────────────────────── sofa ─────────────────────────────

const sofa: KindFn = (c) => {
  const v = c.v % 3;
  const legs = (xs: number[], y = 296) =>
    xs.map((x) => <g key={x}>{sol(c, `M${x - 5} ${y}H${x + 5}L${x + 2.5} 329H${x - 2.5}Z`, c.u('mv'), { rim: 0.6 })}</g>);
  if (v === 1) {
    const back = 'M64 296C44 230 58 150 124 138C160 132 180 148 200 148C220 148 240 132 276 138C342 150 356 230 336 296Z';
    return {
      shadow: [200, 150, 10],
      el: (
        <g>
          <defs>
            <pattern id={c.id('boucle')} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
              <circle cx={1.5} cy={1.5} r={1.3} fill="#fff" opacity={0.12} />
              <circle cx={4.5} cy={4.5} r={1.3} fill="#000" opacity={0.14} />
            </pattern>
          </defs>
          {sol(c, back, c.u('pv'), { occ: 0.4, rim: 1.2, sheen: 0.3, cb: true })}
          <path d={back} fill={c.u('boucle')} />
          {sol(c, rr(66, 270, 268, 58, 26), c.u('pv'), { occ: 0.45, rim: 0.9, cb: true })}
          <path d={rr(66, 270, 268, 58, 26)} fill={c.u('boucle')} />
          {sol(c, rr(82, 230, 236, 56, 28), c.u('pv'), { occ: 0.3, rim: 1.1, sheen: 0.4, cb: true })}
          <path d={rr(82, 230, 236, 56, 28)} fill={c.u('boucle')} />
          <path d="M200 236V284" stroke="#000" strokeOpacity={0.25} strokeWidth={2} />
          {sol(c, ell(256, 214, 30, 24), c.u('ss'), { rim: 0.8 })}
        </g>
      ),
    };
  }
  if (v === 2) {
    const tufts: Pt[] = [];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) tufts.push([96 + k * 35 + (r % 2) * 17.5, 160 + r * 28]);
    return {
      shadow: [200, 156, 10],
      el: (
        <g>
          {legs([74, 326, 112, 288], 300)}
          {sol(c, rr(70, 138, 260, 116, 12), c.u('pv'), { occ: 0.3, rim: 1.2, sheen: 0.5, cb: true })}
          <path
            d={tufts.map(([x, y]) => `M${x - 17} ${y}L${x} ${y - 14}L${x + 17} ${y}L${x} ${y + 14}Z`).join('')}
            fill="none"
            stroke="#000"
            strokeOpacity={0.35}
            strokeWidth={1.4}
          />
          {tufts.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={2.6} fill={c.P(-0.5)} />
              <circle cx={x - 0.8} cy={y - 0.8} r={1} fill="#fff" opacity={0.4} />
            </g>
          ))}
          {sol(c, rr(100, 236, 200, 52, 8), c.u('pv'), { occ: 0.35, rim: 1, sheen: 0.4, cb: true })}
          {sol(c, rr(52, 286, 296, 18, 4), c.P(-0.3), { rim: 0.4 })}
          {[0, 1].map((i) => {
            const x = i ? 296 : 44;
            return (
              <g key={i}>
                {sol(c, rr(x, 196, 60, 104, 10), c.u('pv'), { occ: 0.4, rim: 1, side: i ? 0.4 : 0, cb: true })}
                {sol(c, ell(x + 30, 196, 34, 22), c.u('pv'), { rim: 1.2, sheen: 0.6, cb: true })}
                <ellipse cx={x + 30 + (i ? 10 : -10)} cy={198} rx={10} ry={8} fill={c.P(-0.45)} />
              </g>
            );
          })}
        </g>
      ),
    };
  }
  return {
    shadow: [200, 156, 10],
    el: (
      <g>
        {legs([84, 316])}
        {sol(c, rr(68, 128, 264, 128, 22), c.u('pv'), { occ: 0.3, rim: 1.2, sheen: 0.3, cb: true })}
        {[0, 1, 2].map((i) => (
          <g key={i}>{sol(c, rr(104 + i * 64, 144, 62, 94, 16), c.u('pv'), { occ: 0.5, rim: 0.8, sheen: 0.4, cb: true })}</g>
        ))}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            {sol(c, `M${104 + i * 64} 236H${166 + i * 64}L${170 + i * 65} 254H${100 + i * 65}Z`, c.P(0.1 + c.lift), { rim: 1 })}
            {sol(c, rr(100 + i * 65.5, 252, 66, 36, 9), c.u('pv'), { occ: 0.4, rim: 0.6, sheen: 0.3, cb: true })}
          </g>
        ))}
        <g transform="rotate(-12 140 214)">{sol(c, rr(114, 188, 52, 48, 14), c.u('av'), { rim: 0.8, occ: 0.35, sheen: 0.3 })}</g>
        {sol(c, rr(52, 180, 56, 118, 20), c.u('pv'), { occ: 0.35, rim: 1.1, sheen: 0.5, cb: true })}
        {sol(c, rr(292, 180, 56, 118, 20), c.u('pv'), { occ: 0.35, rim: 1.1, sheen: 0.5, side: 0.4, cb: true })}
        {sol(c, rr(60, 286, 280, 14, 6), c.P(-0.4), { rim: 0.4 })}
      </g>
    ),
  };
};

// ───────────────────────────── lamp ─────────────────────────────

const lamp: KindFn = (c) => {
  const warm = warmOf(c);
  const defs = (
    <defs>
      {rad(c, 'lglow', [[0, warm, 0.75], [0.4, warm, 0.22], [1, warm, 0]])}
      {lin(c, 'shade', [[0, mix(c.S.base, warm, 0.3)], [1, mix(c.S.base, warm, 0.7)]])}
      {lin(c, 'beam', [[0, warm, 0.45], [1, warm, 0]])}
      {rad(c, 'globe', [[0, '#fffaf0'], [0.35, warm], [0.85, mix(warm, c.S.base, 0.5), 0.95], [1, mix(warm, c.S.base, 0.7)]], 0.45, 0.42, 0.6)}
    </defs>
  );
  const pool = <ellipse cx={200} cy={330} rx={150} ry={20} fill={c.u('lglow')} opacity={0.5} />;
  switch (c.v) {
    case 1: {
      // articulated desk lamp
      return {
        shadow: [170, 70, 9],
        el: (
          <g>
            {defs}
            <path d="M236 176L304 172L372 330H196Z" fill={c.u('beam')} opacity={0.7} />
            <ellipse cx={286} cy={330} rx={90} ry={14} fill={c.u('lglow')} opacity={0.6} />
            {sol(c, ell(150, 320, 56, 10), c.u('mv'), { rim: 1 })}
            {sol(c, rr(132, 300, 36, 20, 6), c.u('pc'), { rim: 1, cb: true })}
            <path d="M150 304L126 194L240 126" fill="none" stroke={c.P(-0.45)} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M150 304L126 194L240 126" fill="none" stroke={c.u('pv')} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M160 298L138 200L236 140" fill="none" stroke={c.u('mv')} strokeWidth={1.5} />
            {sol(c, ell(126, 194, 9), c.u('mc'), { rim: 0.8 })}
            {sol(c, ell(240, 126, 8), c.u('mc'), { rim: 0.8 })}
            {sol(c, 'M226 118L262 104L310 168Q276 186 234 180Z', c.u('pv'), { rim: 1.3, sheen: 0.7, cb: true })}
            <ellipse cx={272} cy={174} rx={38} ry={8} transform="rotate(-8 272 174)" fill={warm} />
            <ellipse cx={272} cy={174} rx={60} ry={30} fill={c.u('lglow')} />
          </g>
        ),
      };
    }
    case 2: {
      // mushroom lamp
      return {
        shadow: [200, 66, 9],
        el: (
          <g>
            {defs}
            {pool}
            {sol(c, rr(150, 302, 100, 26, 13), c.u('pc'), { rim: 1, sheen: 0.6, cb: true })}
            {sol(c, rr(188, 170, 24, 140, 10), c.u('pc'), { rim: 0.8, sheen: 0.6, cb: true })}
            <ellipse cx={200} cy={186} rx={30} ry={20} fill={c.u('lglow')} />
            <ellipse cx={200} cy={172} rx={96} ry={44} fill={c.u('lglow')} opacity={0.8} />
            {sol(c, 'M106 172A94 82 0 0 1 294 172Q200 186 106 172Z', c.u('pv'), { rim: 1.3, sheen: 0.8, cb: true })}
            <path d="M106 172Q200 186 294 172" stroke={warm} strokeWidth={3} fill="none" />
          </g>
        ),
      };
    }
    case 3: {
      // glass globe on a metal base
      return {
        shadow: [200, 56, 8],
        el: (
          <g>
            {defs}
            {pool}
            <circle cx={200} cy={196} r={130} fill={c.u('lglow')} opacity={0.6} />
            {sol(c, 'M166 262H234L246 328H154Z', c.u('mc'), { rim: 1, sheen: 0.6 })}
            {sol(c, ell(200, 262, 34, 7), c.u('mv'), { rim: 1 })}
            <circle cx={200} cy={190} r={74} fill={c.u('globe')} />
            <circle cx={200} cy={190} r={74} fill="none" stroke="#fff" strokeOpacity={0.35} />
            <ellipse cx={176} cy={156} rx={22} ry={12} transform="rotate(-35 176 156)" fill="#fff" opacity={0.45} />
          </g>
        ),
      };
    }
    default: {
      // table lamp with drum shade
      const base = lathe([[208, 184], [212, 196], [244, 236], [262, 270], [248, 304], [226, 322]]);
      return {
        shadow: [200, 70, 9],
        el: (
          <g>
            {defs}
            {pool}
            <ellipse cx={200} cy={140} rx={170} ry={130} fill={c.u('lglow')} opacity={0.45} />
            <path d="M198 120V186M202 120V186" stroke={c.u('mv')} strokeWidth={2} />
            {sol(c, base, c.u('pc'), { rim: 1.2, sheen: 0.8, cb: true, occ: 0.2 })}
            {sol(c, ell(200, 324, 30, 5), c.u('mv'), { rim: 0.8 })}
            <ellipse cx={200} cy={182} rx={82} ry={9} fill={warm} />
            {sol(c, 'M146 84H254L282 182Q200 192 118 182Z', c.u('shade'), { rim: 0.8 })}
            <path d="M146 84H254L282 182Q200 192 118 182Z" fill={c.u('occh')} opacity={0.25} />
            <ellipse cx={200} cy={84} rx={54} ry={5} fill={c.S(-0.3)} />
            <path d="M118 182Q200 192 282 182" stroke={warm} strokeWidth={2} fill="none" />
          </g>
        ),
      };
    }
  }
};

// ───────────────────────────── vase ─────────────────────────────

const vase: KindFn = (c) => {
  const v = c.v % 3;
  const clip = c.id('vclip');
  if (v === 1) {
    const body = 'M164 144H236Q240 144 240 150V316Q240 328 226 328H174Q160 328 160 316V150Q160 144 164 144Z';
    const plume = mix(c.S.base, '#e7d6b6', 0.65);
    const stems: [Pt, Pt][] = [
      [[190, 146], [124, 56]],
      [[200, 146], [212, 44]],
      [[210, 146], [286, 70]],
      [[196, 146], [160, 64]],
    ];
    return {
      shadow: [200, 54, 9],
      el: (
        <g>
          {stems.map(([[x0, y0], [x1, y1]], i) => (
            <g key={i}>
              <path d={`M${x0} ${y0}Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + 20} ${x1} ${y1}`} stroke={mix(plume, '#5c4a32', 0.5)} strokeWidth={1.6} fill="none" />
              <ellipse cx={x1} cy={y1 + 6} rx={9} ry={26} transform={`rotate(${(x1 - x0) * 0.35} ${x1} ${y1 + 6})`} fill={plume} opacity={0.9} />
              <ellipse cx={x1 - 2} cy={y1} rx={4} ry={16} transform={`rotate(${(x1 - x0) * 0.35} ${x1} ${y1 + 6})`} fill="#fff" opacity={0.25} />
            </g>
          ))}
          {sol(c, body, c.u('pc'), { rim: 1.2, sheen: 0.9, cb: true, occ: 0.2 })}
          <ellipse cx={200} cy={146} rx={40} ry={6} fill={c.P(-0.6)} />
          <path d="M160 276Q200 284 240 276" stroke={c.A(0)} strokeWidth={4} fill="none" />
        </g>
      ),
    };
  }
  const body =
    v === 2
      ? lathe([[220, 102], [222, 112], [262, 140], [292, 200], [286, 262], [250, 308], [224, 324]])
      : lathe([[226, 76], [220, 96], [220, 116], [252, 150], [278, 204], [272, 256], [250, 300], [234, 324]]);
  const top = v === 2 ? 102 : 76;
  const lip = v === 2 ? 20 : 26;
  return {
    shadow: [200, v === 2 ? 76 : 66, 9],
    el: (
      <g>
        <defs>
          <clipPath id={clip}>
            <path d={body} />
          </clipPath>
        </defs>
        {sol(c, body, c.u('pc'), { rim: 1.2, sheen: 0.9, cb: true, occ: 0.15 })}
        <g clipPath={`url(#${clip})`}>
          {v === 2 ? (
            <path d="M80 190Q200 214 320 190" stroke={c.A(0)} strokeWidth={3} fill="none" opacity={0.8} />
          ) : (
            <g>
              <path d="M100 196Q200 216 300 196V214Q200 234 100 214Z" fill={c.u('av')} opacity={0.9} />
              <path d="M100 226Q200 246 300 226" stroke={c.S(0.2)} strokeWidth={2} fill="none" />
              <path d="M100 186Q200 206 300 186" stroke={c.S(0.2)} strokeWidth={2} fill="none" />
            </g>
          )}
          <path d={body} fill={c.u('occh')} opacity={0.35} />
        </g>
        <ellipse cx={200} cy={top} rx={lip} ry={5} fill={c.P(-0.65)} />
        <ellipse cx={200} cy={top} rx={lip} ry={5} fill="none" stroke={c.P(0.4)} strokeOpacity={0.6} />
      </g>
    ),
  };
};

// ───────────────────────────── candle ─────────────────────────────

const candle: KindFn = (c) => {
  const v = c.v % 3;
  if (v === 1) {
    const pillars: [number, number, number][] = [
      [140, 206, 30],
      [204, 146, 34],
      [264, 236, 28],
    ];
    return {
      shadow: [204, 120, 10],
      el: (
        <g>
          <defs>{flameDefs(c)}</defs>
          {pillars.map(([x, top, r], i) => (
            <g key={i}>
              {sol(c, `M${x - r} ${top}V${322 - i}A${r} ${r * 0.22} 0 0 0 ${x + r} ${322 - i}V${top}Z`, c.u('pc'), { rim: 1, cb: true, occ: 0.15 })}
              <ellipse cx={x} cy={top} rx={r} ry={r * 0.22} fill={c.P(0.18 + c.lift)} />
              <ellipse cx={x} cy={top + 1} rx={r * 0.7} ry={r * 0.14} fill={c.P(-0.15)} />
              <path d={`M${x - r * 0.6} ${top + 4}q3 18 0 26`} stroke={c.P(0.25)} strokeWidth={4} strokeLinecap="round" fill="none" />
              {flame(c, x, top - 2, 0.85)}
            </g>
          ))}
        </g>
      ),
    };
  }
  if (v === 2) {
    // tapers in metal holders
    const tapers: [number, number][] = [
      [164, 92],
      [236, 120],
    ];
    return {
      shadow: [200, 90, 9],
      el: (
        <g>
          <defs>{flameDefs(c)}</defs>
          {tapers.map(([x, top], i) => (
            <g key={i}>
              {sol(c, ell(x, 322, 34, 7), c.u('mv'), { rim: 1 })}
              {sol(c, `M${x - 5} 318H${x + 5}L${x + 3} 262H${x - 3}Z`, c.u('mc'), { rim: 0.6 })}
              {sol(c, ell(x, 262, 16, 5), c.u('mv'), { rim: 0.8 })}
              {sol(c, `M${x - 9} 262V${top + 8}Q${x} ${top - 4} ${x + 9} ${top + 8}V262Z`, c.u('pc'), { rim: 1, cb: true })}
              {flame(c, x, top - 1, 0.9)}
            </g>
          ))}
        </g>
      ),
    };
  }
  return {
    shadow: [206, 104, 10],
    el: (
      <g>
        <defs>
          {flameDefs(c)}
          {lin(c, 'jar', [[0, '#ffffff', 0.22], [0.2, '#ffffff', 0.04], [0.75, '#000000', 0.15], [1, '#ffffff', 0.18]], 0, 0, 1, 0)}
        </defs>
        {sol(c, ell(296, 322, 40, 9), c.u('mv'), { rim: 1 })}
        <ellipse cx={296} cy={319} rx={30} ry={6} fill={c.M(0.3)} opacity={0.6} />
        {sol(c, rr(136, 210, 128, 116, 14), c.u('pc'), { rim: 0, cb: true })}
        <ellipse cx={200} cy={210} rx={64} ry={10} fill={c.P(0.12 + c.lift)} />
        <ellipse cx={200} cy={211} rx={20} ry={4} fill={c.P(-0.2)} />
        <path d={rr(130, 172, 140, 156, 20)} fill={c.S(-0.2)} opacity={0.35} />
        <path d={rr(130, 172, 140, 156, 20)} fill={c.u('jar')} />
        <path d={rr(130, 172, 140, 156, 20)} fill="none" stroke={c.u('rim')} strokeWidth={2} />
        <ellipse cx={200} cy={174} rx={70} ry={8} fill="none" stroke="#fff" strokeOpacity={0.35} />
        <rect x={142} y={190} width={6} height={124} rx={3} fill="#fff" opacity={0.18} />
        {sol(c, rr(150, 252, 100, 50, 4), c.u('sv'), { rim: 0.5 })}
        {mark(200, 270, 16, c.S.dark ? c.S(0.6) : c.S(-0.6), 0.8)}
        <rect x={176} y={286} width={48} height={3} rx={1.5} fill={c.S.dark ? c.S(0.6) : c.S(-0.6)} opacity={0.5} />
        {flame(c, 200, 206, 1)}
      </g>
    ),
  };
};

// ───────────────────────────── dumbbell ─────────────────────────────

function shadeFace(f: Face3, T: Tone, gloss: boolean) {
  const col = T(-0.62 + f.lit * (gloss ? 0.95 : 0.75));
  return <path key={f.d} d={f.d} fill={col} stroke={col} strokeWidth={0.6} strokeLinejoin="round" />;
}

const dumbbell: KindFn = (c) => {
  const round = c.v % 2 === 1;
  const pr = makeProj(200, 274, 26, 0.5);
  const R = 52;
  const n = round ? 28 : 6;
  const zc = round ? R : R * Math.cos(Math.PI / 6);
  const faces = mesh(pr, [
    ...prismU(-132, -80, R, n, zc, round ? 0 : 0, 'h'),
    ...prismU(80, 132, R, n, zc, 0, 'h'),
    ...prismU(-80, -70, R * 0.42, 18, zc, 0, 'm'),
    ...prismU(70, 80, R * 0.42, 18, zc, 0, 'm'),
    ...prismU(-70, 70, 11, 16, zc, 0, 'g'),
  ]);
  const gloss = c.f !== 'matte' && c.f !== 'carbon';
  const capCentre = pr(132, 0, zc);
  return {
    shadow: [200, 150, 30, 276, (Math.atan2(Math.sin(pr.yaw) * pr.k, Math.cos(pr.yaw)) * 180) / Math.PI],
    floor: 318,
    el: (
      <g>
        {faces.map((f) =>
          f.tag?.startsWith('h') ? shadeFace(f, c.P, gloss) : shadeFace(f, c.M, true),
        )}
        {c.f === 'carbon' ? faces.filter((f) => f.tag?.startsWith('h')).map((f) => <path key={'c' + f.d} d={f.d} fill={c.u('carbon')} />) : null}
        <g transform={pr.uplane(132)}>
          <g transform={`translate(0 ${-zc})`}>
            {round ? (
              <g>
                <circle r={R * 0.8} fill="none" stroke={c.u('mv')} strokeWidth={4} />
                <circle r={R * 0.5} fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={2} />
              </g>
            ) : null}
            <circle r={R * 0.34} fill={c.u('mv')} />
            <circle r={R * 0.24} fill={c.A(0)} />
          </g>
        </g>
        <path
          d={`M${pr(-60, 0, zc + 11)[0]} ${pr(-60, 0, zc + 11)[1]}L${pr(60, 0, zc + 11)[0]} ${pr(60, 0, zc + 11)[1]}`}
          stroke="#000"
          strokeOpacity={0.35}
          strokeWidth={3}
          strokeDasharray="1.2 1.6"
        />
        {spark(c, capCentre[0] - 12, capCentre[1] - 26, 10, 4, 0.5)}
      </g>
    ),
  };
};

function spark(c: Ctx, x: number, y: number, rx: number, ry: number, op: number) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={c.u('spec')} opacity={op} />;
}

// ───────────────────────────── kettlebell ─────────────────────────────

const kettlebell: KindFn = (c) => {
  const comp = c.v % 2 === 1;
  const ball = 'M128 296A84 84 0 1 1 272 296Q250 327 200 327Q150 327 128 296Z';
  const handle = comp ? 'M150 196C146 110 154 92 200 92C246 92 254 110 250 196' : 'M146 204C136 128 150 92 200 92C250 92 264 128 254 204';
  const hT = comp ? c.P : c.P;
  return {
    shadow: [200, 82, 10],
    el: (
      <g>
        <path d={handle} fill="none" stroke={hT(-0.6)} strokeWidth={26} strokeLinecap="round" />
        <path d={handle} fill="none" stroke={c.u('pc')} strokeWidth={22} strokeLinecap="round" />
        <path d={handle} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1.2} transform="translate(0 -9)" />
        {sol(c, ball, c.u('ps'), { rim: 1.2, cb: true })}
        {comp ? (
          <g>
            {sol(c, ell(200, 262, 34), c.u('ps'), { rim: 0.6 })}
            <circle cx={200} cy={262} r={34} fill="none" stroke={c.A(0)} strokeWidth={3} />
            {mark(200, 262, 26, c.A(0.2), 0.9)}
          </g>
        ) : (
          <g>
            <path d="M118 252Q200 278 282 252" stroke={c.A(0)} strokeWidth={10} fill="none" />
            <path d="M118 247Q200 273 282 247" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} fill="none" />
            {mark(200, 296, 18, c.P(0.4), 0.6)}
          </g>
        )}
      </g>
    ),
  };
};

// ───────────────────────────── bottle ─────────────────────────────

const bottle: KindFn = (c) => {
  const v = c.v % 3;
  if (v === 1) {
    // spirits bottle: glass, liquid, cork, label
    const glass = 'M150 162Q150 142 170 138L188 130V84H212V130L230 138Q250 142 250 162V316Q250 328 238 328H162Q150 328 150 316Z';
    const liquid = 'M157 176H243V314Q243 322 235 322H165Q157 322 157 314Z';
    return {
      shadow: [200, 64, 9],
      el: (
        <g>
          <defs>
            {lin(c, 'gls', [[0, '#ffffff', 0.25], [0.12, '#ffffff', 0.05], [0.8, '#ffffff', 0.02], [1, '#ffffff', 0.2]], 0, 0, 1, 0)}
          </defs>
          <path d={glass} fill={c.P(-0.75)} opacity={0.55} />
          {sol(c, liquid, c.u('pc'), { rim: 0, sheen: 0.4 })}
          <ellipse cx={200} cy={176} rx={43} ry={4} fill={c.P(0.3)} opacity={0.7} />
          <path d={glass} fill={c.u('gls')} />
          <path d={glass} fill="none" stroke={c.u('rim')} strokeWidth={1.8} />
          <rect x={158} y={160} width={5} height={150} rx={2.5} fill="#fff" opacity={0.3} />
          <rect x={194} y={92} width={3} height={36} rx={1.5} fill="#fff" opacity={0.3} />
          {sol(c, rr(160, 214, 80, 72, 4), c.u('sv'), { rim: 0.5 })}
          <path d={rr(164, 218, 72, 64, 3)} fill="none" stroke={c.M(0)} strokeWidth={1} opacity={0.8} />
          {mark(200, 242, 18, c.M(0), 0.9)}
          <rect x={176} y={266} width={48} height={3} rx={1.5} fill={c.M(0)} opacity={0.7} />
          {sol(c, rr(186, 112, 28, 12, 2), c.u('sv'), { rim: 0.4 })}
          {sol(c, rr(184, 62, 32, 28, 5), c.u('mc'), { rim: 1, sheen: 0.6 })}
        </g>
      ),
    };
  }
  if (v === 2) {
    // sports squeeze bottle
    const body = lathe([[236, 120], [242, 150], [236, 200], [228, 226], [240, 262], [244, 310], [232, 328]]);
    return {
      shadow: [200, 52, 8],
      el: (
        <g>
          {sol(c, body, c.u('pc'), { rim: 1.2, sheen: 0.7, cb: true, occ: 0.15 })}
          <path d="M168 226Q200 232 232 226" stroke="#000" strokeOpacity={0.25} strokeWidth={2} fill="none" />
          <path d="M162 280Q200 288 238 280" stroke={c.A(0)} strokeWidth={6} fill="none" />
          {mark(200, 176, 22, c.P(0.45), 0.6)}
          {sol(c, rr(168, 98, 64, 26, 6), c.u('sc'), { rim: 1, sheen: 0.4 })}
          {sol(c, 'M190 98L194 64H206L210 98Z', c.u('av'), { rim: 0.8 })}
          {sol(c, rr(192, 58, 16, 8, 3), c.u('av'), { rim: 0.6 })}
        </g>
      ),
    };
  }
  // insulated steel bottle
  const body = 'M164 116H236C242 124 246 136 246 152V306Q246 328 224 328H176Q154 328 154 306V152C154 136 158 124 164 116Z';
  return {
    shadow: [200, 56, 8],
    el: (
      <g>
        <path d="M184 76C184 46 216 46 216 76" fill="none" stroke={c.S(-0.4)} strokeWidth={9} />
        <path d="M184 76C184 46 216 46 216 76" fill="none" stroke={c.u('sc')} strokeWidth={6} />
        {sol(c, rr(166, 72, 68, 46, 12), c.u('sc'), { rim: 1.1, sheen: 0.6 })}
        <path d="M168 112H232" stroke="#000" strokeOpacity={0.3} strokeWidth={2} />
        {sol(c, body, c.u('pc'), { rim: 1.2, sheen: 0.9, cb: true, occ: 0.15 })}
        <path d="M154 290Q200 298 246 290" stroke={c.A(0)} strokeWidth={5} fill="none" />
        {mark(200, 200, 22, c.P.dark ? c.P(0.5) : c.P(-0.45), 0.7)}
      </g>
    ),
  };
};

// ───────────────────────────── figure ─────────────────────────────

const figure: KindFn = (c) => {
  const v = c.v;
  const plinth = (
    <g>
      {sol(c, rr(122, 304, 156, 24, 8), c.u('sv'), { rim: 1, occ: 0.3 })}
      {sol(c, ell(200, 304, 78, 10), c.S(0.12), { rim: 1 })}
    </g>
  );
  if (v === 1) {
    // mecha robot
    return {
      shadow: [200, 96, 10],
      el: (
        <g>
          {plinth}
          {sol(c, rr(166, 232, 26, 74, 6), c.u('pc'), { rim: 1, cb: true })}
          {sol(c, rr(208, 232, 26, 74, 6), c.u('pc'), { rim: 1, cb: true })}
          {sol(c, rr(160, 290, 38, 16, 4), c.u('sv'), { rim: 0.6 })}
          {sol(c, rr(202, 290, 38, 16, 4), c.u('sv'), { rim: 0.6 })}
          {sol(c, rr(124, 150, 22, 86, 8), c.u('pc'), { rim: 1, cb: true })}
          {sol(c, rr(254, 150, 22, 86, 8), c.u('pc'), { rim: 1, cb: true })}
          {sol(c, 'M150 140H250L238 236H162Z', c.u('pv'), { rim: 1.2, sheen: 0.7, cb: true, occ: 0.2 })}
          {sol(c, ell(136, 148, 22), c.u('ss'), { rim: 1 })}
          {sol(c, ell(264, 148, 22), c.u('ss'), { rim: 1 })}
          <circle cx={200} cy={180} r={13} fill="#060607" />
          <circle cx={200} cy={180} r={8} fill={c.A(0.3)} />
          {glow(c, 200, 180, 30, 30, 0.9)}
          <path d="M170 214H230" stroke="#000" strokeOpacity={0.3} strokeWidth={3} />
          {sol(c, rr(172, 84, 56, 54, 12), c.u('pv'), { rim: 1.3, sheen: 0.7, cb: true })}
          <path d={rr(178, 102, 44, 14, 7)} fill="#060607" />
          <path d={rr(181, 105, 38, 8, 4)} fill={c.A(0.25)} />
          {glow(c, 200, 109, 34, 12, 0.8)}
          <path d="M214 84L222 60" stroke={c.u('mv')} strokeWidth={3} strokeLinecap="round" />
          <circle cx={222} cy={58} r={4} fill={c.A(0.3)} />
        </g>
      ),
    };
  }
  if (v === 3) {
    // hooded collectible figure
    return {
      shadow: [200, 90, 10],
      el: (
        <g>
          {plinth}
          {sol(c, 'M200 70C238 70 254 104 254 140C276 200 290 260 296 306H104C110 260 124 200 146 140C146 104 162 70 200 70Z', c.u('pv'), { rim: 1.3, sheen: 0.5, cb: true, occ: 0.3 })}
          <path d="M200 160V300" stroke="#000" strokeOpacity={0.35} strokeWidth={3} />
          <path d="M170 170C150 220 140 260 136 300M230 170C250 220 260 260 264 300" stroke="#000" strokeOpacity={0.2} strokeWidth={6} fill="none" />
          <path d="M166 138C166 100 234 100 234 138C234 160 220 172 200 172C180 172 166 160 166 138Z" fill="#050506" />
          <circle cx={186} cy={140} r={4} fill={c.A(0.35)} />
          <circle cx={214} cy={140} r={4} fill={c.A(0.35)} />
          {glow(c, 200, 140, 40, 18, 0.7)}
          {sol(c, rr(184, 196, 32, 32, 6), c.u('av'), { rim: 0.6 })}
          {mark(200, 212, 18, c.P(-0.2), 0.9)}
        </g>
      ),
    };
  }
  // designer bear (v0 arms down, v2 waving)
  const wave = v === 2;
  return {
    shadow: [200, 90, 10],
    el: (
      <g>
        {plinth}
        {sol(c, rr(164, 244, 32, 62, 14), c.u('pc'), { rim: 1, cb: true, occ: 0.2 })}
        {sol(c, rr(204, 244, 32, 62, 14), c.u('pc'), { rim: 1, cb: true, occ: 0.2 })}
        <g transform="rotate(12 138 182)">{sol(c, rr(124, 176, 28, 74, 14), c.u('pc'), { rim: 1, cb: true })}</g>
        <g transform={wave ? 'rotate(-150 262 184)' : 'rotate(-12 262 182)'}>{sol(c, rr(248, 176, 28, 74, 14), c.u('pc'), { rim: 1, cb: true })}</g>
        {sol(c, rr(148, 166, 104, 94, 30), c.u('pv'), { rim: 1.2, sheen: 0.8, cb: true, occ: 0.2 })}
        {sol(c, ell(200, 216, 24), c.u('av'), { rim: 0.5 })}
        {mark(200, 216, 22, c.P(0), 0.85)}
        {sol(c, ell(154, 92, 20), c.u('ps'), { rim: 1.2 })}
        {sol(c, ell(246, 92, 20), c.u('ps'), { rim: 1.2 })}
        <circle cx={154} cy={92} r={10} fill={c.S(0)} opacity={0.7} />
        <circle cx={246} cy={92} r={10} fill={c.S(0)} opacity={0.7} />
        {sol(c, ell(200, 128, 56, 48), c.u('ps'), { rim: 1.3, cb: true })}
        <ellipse cx={200} cy={146} rx={22} ry={14} fill={c.P(0.25 + c.lift)} opacity={0.8} />
        <ellipse cx={200} cy={140} rx={6} ry={4} fill="#0a0a0c" />
        <circle cx={180} cy={124} r={4.5} fill="#0a0a0c" />
        <circle cx={220} cy={124} r={4.5} fill="#0a0a0c" />
        <circle cx={181.5} cy={122.5} r={1.4} fill="#fff" opacity={0.8} />
        <circle cx={221.5} cy={122.5} r={1.4} fill="#fff" opacity={0.8} />
      </g>
    ),
  };
};

// ───────────────────────────── card ─────────────────────────────

const card: KindFn = (c) => {
  const metal = c.v % 2 === 1;
  if (metal) {
    const chipGold = '#d6b260';
    return {
      shadow: [200, 132, 10],
      el: (
        <g transform="rotate(-9 200 230)">
          <path d={rr(78, 152, 250, 158, 14)} fill={c.P(-0.6)} />
          {sol(c, rr(72, 148, 250, 158, 14), c.u('pv'), { rim: 1.4, sheen: 0.9, cb: true })}
          <path d={rr(72, 148, 250, 158, 14)} fill={c.u('occh')} opacity={0.25} />
          {sol(c, rr(100, 192, 38, 30, 5), chipGold, { rim: 0.8, sheen: 1 })}
          <path d="M100 207H138M119 192V222M108 192V200M130 214V222" stroke="#7a5c22" strokeWidth={1} opacity={0.8} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${152 + i * 6} ${200 - i * 2}q6 7 0 14`} stroke={c.P(0.45 + c.lift)} strokeWidth={1.6} fill="none" opacity={0.6} />
          ))}
          {[0, 1, 2, 3].map((g) => (
            <g key={g}>
              {[0, 1, 2, 3].map((d) => (
                <rect key={d} x={100 + g * 50 + d * 9} y={244} width={6} height={10} rx={1.5} fill={c.P(0.35 + c.lift)} opacity={0.55} />
              ))}
            </g>
          ))}
          <rect x={100} y={270} width={70} height={5} rx={2.5} fill={c.P(0.35 + c.lift)} opacity={0.4} />
          {mark(292, 278, 22, c.gold ? c.M(0.1) : c.A(0.1), 0.95)}
        </g>
      ),
    };
  }
  // graded slab with holo card
  return {
    shadow: [200, 90, 9],
    el: (
      <g>
        <defs>
          {lin(c, 'holo', [[0, c.A(0.3)], [0.3, mix(c.A.base, '#ff5fd2', 0.55)], [0.55, mix(c.A.base, '#5fe0ff', 0.55)], [0.8, mix(c.A.base, '#ffe45f', 0.5)], [1, c.A(-0.2)]], 0, 0, 1, 1)}
        </defs>
        <path d={rr(126, 70, 156, 260, 12)} fill={c.P(-0.6)} opacity={0.6} />
        {sol(c, rr(120, 66, 156, 262, 12), '#0f1013', { rim: 1.6 })}
        <path d={rr(120, 66, 156, 262, 12)} fill="#ffffff" opacity={0.05} />
        <path d={rr(126, 72, 144, 250, 8)} fill="none" stroke="#fff" strokeOpacity={0.2} />
        {sol(c, rr(132, 78, 132, 38, 4), c.gold ? c.u('mv') : c.u('pv'), { rim: 0.6 })}
        <path d={Array.from({ length: 14 }, (_, i) => `M${140 + i * 3.4} 88v${i % 3 ? 12 : 18}`).join('')} stroke="#000" strokeOpacity={0.6} strokeWidth={1.4} />
        <rect x={192} y={88} width={40} height={4} rx={2} fill="#000" opacity={0.45} />
        <rect x={192} y={98} width={26} height={4} rx={2} fill="#000" opacity={0.3} />
        <circle cx={250} cy={97} r={11} fill="#0a0a0c" />
        <circle cx={250} cy={97} r={8} fill={c.A(0.1)} />
        {sol(c, rr(136, 126, 124, 184, 7), c.u('holo'), { rim: 0.6 })}
        <path d={rr(142, 132, 112, 172, 5)} fill="none" stroke={c.gold ? c.M(0.2) : c.S(0.5)} strokeWidth={2} />
        <rect x={148} y={146} width={100} height={88} rx={4} fill="#0b0c12" />
        <circle cx={198} cy={190} r={36} fill={c.u('glow')} />
        {mark(198, 190, 44, c.A(0.5), 0.95)}
        <rect x={150} y={244} width={70} height={6} rx={3} fill="#000" opacity={0.45} />
        <rect x={150} y={256} width={92} height={4} rx={2} fill="#000" opacity={0.3} />
        <rect x={150} y={265} width={80} height={4} rx={2} fill="#000" opacity={0.3} />
        <path d={rr(120, 66, 156, 262, 12)} fill={c.u('sheen')} opacity={0.45} />
      </g>
    ),
  };
};

export const lifestyle: Partial<Record<ArtKind, KindFn>> = {
  sofa,
  lamp,
  vase,
  candle,
  dumbbell,
  kettlebell,
  bottle,
  figure,
  card,
};

void tone;
