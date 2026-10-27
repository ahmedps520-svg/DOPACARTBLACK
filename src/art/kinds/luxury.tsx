import type { ArtKind } from '../../engine/types';
import { glow, lin, mark, rad, sol, type Ctx, type KindFn } from '../kit';
import { ell, materialStops, mix, onEll, poly, rr, smooth, type Pt } from '../shading';

/** Four-point star glint. */
const glint = (x: number, y: number, s: number, op = 0.9) => (
  <path
    d={`M${x} ${y - s}L${x + s * 0.18} ${y - s * 0.18}L${x + s} ${y}L${x + s * 0.18} ${y + s * 0.18}L${x} ${y + s}L${x - s * 0.18} ${y + s * 0.18}L${x - s} ${y}L${x - s * 0.18} ${y - s * 0.18}Z`}
    fill="#fff"
    opacity={op}
  />
);

/** Metal used for "naturally metal" parts: gold/silver, or carbon-wrapped primary. */
const caseFill = (c: Ctx, dir: 'v' | 'c' = 'c') => (c.f === 'carbon' ? c.u(dir === 'c' ? 'pc' : 'pv') : c.u(dir === 'c' ? 'mc' : 'mv'));

// ───────────────────────────── watch ─────────────────────────────

const watch: KindFn = (c) => {
  const v = c.v;
  const square = v === 1;
  const bracelet = v >= 2;
  const diver = v === 2;
  const cx = 200, cy = 214;
  const dialR = square ? 0 : diver ? 52 : 60;
  const hands = (
    <g>
      <path d={`M${cx} ${cy}L${cx - 22} ${cy - 20}`} stroke={c.M(0.3)} strokeWidth={5.5} strokeLinecap="round" />
      <path d={`M${cx} ${cy}L${cx - 22} ${cy - 20}`} stroke="#000" strokeOpacity={0.25} strokeWidth={1.2} />
      <path d={`M${cx} ${cy}L${cx + 30} ${cy - 34}`} stroke={c.M(0.3)} strokeWidth={4} strokeLinecap="round" />
      <path d={`M${cx - 10} ${cy - 10}L${cx + 22} ${cy + 40}`} stroke={c.A(0)} strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4.5} fill={c.u('mv')} />
      <circle cx={cx} cy={cy} r={1.6} fill={c.A(0)} />
    </g>
  );
  const strapTop = 'M160 150H240L234 64Q234 56 226 56H174Q166 56 166 64Z';
  const strapBot = 'M160 276H240L246 324Q246 330 240 330H160Q154 330 154 324Z';
  const links = (y0: number, y1: number, wTop: number, wBot: number) => {
    const n = Math.floor((y1 - y0) / 13);
    return Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      const w = wTop + (wBot - wTop) * t;
      const y = y0 + i * 13;
      return (
        <g key={i}>
          {sol(c, rr(cx - w / 2, y, w * 0.3, 12, 3), caseFill(c), { rim: 0.4 })}
          {sol(c, rr(cx - w * 0.17, y, w * 0.34, 12, 3), c.u('mv'), { rim: 0.6, sheen: 0.8 })}
          {sol(c, rr(cx + w * 0.2, y, w * 0.3, 12, 3), caseFill(c), { rim: 0.4 })}
        </g>
      );
    });
  };
  const S = c.S;
  return {
    shadow: [200, 66, 9],
    el: (
      <g>
        <defs>
          {lin(c, 'wsT', [[0, S(-0.7)], [0.6, S(-0.15)], [1, S(0)]])}
          {lin(c, 'wsB', [[0, S(0.05)], [1, S(-0.4)]])}
          {rad(c, 'dial', [[0, c.P(0.28 + c.lift)], [0.6, c.P(0)], [1, c.P(-0.45)]], 0.42, 0.38, 0.7)}
        </defs>
        {bracelet ? (
          <g>
            <path d="M162 150H238L232 58H168Z" fill={c.M(-0.6)} />
            {links(58, 150, 64, 76)}
            <path d="M160 276H240L246 330H154Z" fill={c.M(-0.6)} />
            {links(276, 330, 80, 92)}
            <path d="M160 58H240V100H160Z" fill={c.u('occ')} opacity={0} />
          </g>
        ) : (
          <g>
            {sol(c, strapTop, c.u('wsT'), { rim: 0.8 })}
            <path d="M170 64H230M168 146H232" fill="none" stroke={S(0.4)} strokeOpacity={0.4} strokeDasharray="3 3" />
            <path d="M172 62L176 146M228 62L224 146" fill="none" stroke={S(0.4)} strokeOpacity={0.4} strokeDasharray="3 3" />
            {sol(c, strapBot, c.u('wsB'), { rim: 0.6, occ: 0.3 })}
            <path d="M166 280L162 326M234 280L238 326" fill="none" stroke={S(0.4)} strokeOpacity={0.4} strokeDasharray="3 3" />
          </g>
        )}
        {square ? (
          <g>
            {sol(c, rr(150, 120, 100, 34, 8), caseFill(c), { rim: 0.8 })}
            {sol(c, rr(150, 272, 100, 30, 8), caseFill(c), { rim: 0.4, occ: 0.4 })}
            <path d={rr(141, 134, 124, 162, 22)} fill={c.M(-0.6)} />
            {sol(c, rr(136, 132, 128, 164, 22), caseFill(c), { rim: 1.4, sheen: 0.8 })}
            <path d={rr(146, 142, 108, 144, 16)} fill={c.u('dial')} />
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const x = cx + Math.sin(a) * 42;
              const y = cy - Math.cos(a) * 58;
              return <rect key={i} x={x - 2} y={y - 5} width={4} height={i % 3 ? 7 : 11} rx={1} fill={c.u('mv')} transform={`rotate(${(i / 12) * 360} ${x} ${y})`} />;
            })}
            {hands}
            <path d={rr(146, 142, 108, 144, 16)} fill={c.u('sheen')} opacity={0.45} />
            {sol(c, rr(262, 204, 12, 20, 3), caseFill(c), { rim: 0.6 })}
          </g>
        ) : (
          <g>
            {sol(c, rr(158, 128, 84, 34, 10), caseFill(c), { rim: 0.8 })}
            {sol(c, rr(158, 266, 84, 34, 10), caseFill(c), { rim: 0.4, occ: 0.4 })}
            <circle cx={cx + 5} cy={cy + 3} r={76} fill={c.M(-0.6)} />
            {sol(c, ell(cx, cy, 76), caseFill(c), { rim: 1.4, sheen: 0.7, cb: true })}
            {diver ? (
              <g>
                <circle cx={cx} cy={cy} r={66} fill={c.u('dial')} />
                <circle cx={cx} cy={cy} r={66} fill="none" stroke={c.A(-0.1)} strokeWidth={10} strokeDasharray={`${2 * Math.PI * 66 * 0.25} 999`} transform={`rotate(-90 ${cx} ${cy})`} opacity={0.85} />
                <circle cx={cx} cy={cy} r={62} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={3} strokeDasharray="1 5.5" />
                <path d={`M${cx - 5} ${cy - 70}L${cx + 5} ${cy - 70}L${cx} ${cy - 62}Z`} fill="#fff" />
              </g>
            ) : (
              <circle cx={cx} cy={cy} r={66} fill={c.u('mv')} />
            )}
            <circle cx={cx} cy={cy} r={dialR} fill={c.u('dial')} />
            <circle cx={cx} cy={cy} r={dialR} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={1.5} />
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x={cx - 2} y={cy - dialR + 4} width={4} height={i % 3 ? 8 : 13} rx={1} fill={c.u('mv')} transform={`rotate(${i * 30} ${cx} ${cy})`} />
            ))}
            {diver || v === 3
              ? [[cx, cy + 24], [cx - 24, cy], [cx + 24, cy]].map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x} cy={y} r={11} fill={c.P(-0.35)} />
                    <circle cx={x} cy={y} r={11} fill="none" stroke={c.u('mv')} strokeWidth={1.4} />
                    <path d={`M${x} ${y}L${x + 5} ${y - 7}`} stroke={c.A(0.1)} strokeWidth={1.4} strokeLinecap="round" />
                  </g>
                ))
              : mark(cx, cy - 30, 10, c.M(0.2), 0.8)}
            {hands}
            <circle cx={cx} cy={cy} r={dialR} fill={c.u('sheen')} opacity={0.4} />
            <path d={`M${cx - dialR * 0.8} ${cy - dialR * 0.3}A${dialR} ${dialR} 0 0 1 ${cx + dialR * 0.2} ${cy - dialR * 0.95}`} stroke="#fff" strokeOpacity={0.35} strokeWidth={2} fill="none" />
            {sol(c, rr(274, 202, 14, 24, 3), caseFill(c), { rim: 0.7 })}
            <path d="M277 204V224M281 204V224M285 204V224" stroke="#000" strokeOpacity={0.3} />
          </g>
        )}
      </g>
    ),
  };
};

// ───────────────────────────── ring ─────────────────────────────

function annulus(cx: number, cy: number, orx: number, ory: number, irx: number, iry: number) {
  return ell(cx, cy, orx, ory) + ell(cx, cy, irx, iry, true);
}

function diamond(c: Ctx, x: number, y: number, s: number) {
  const ice = ['#ffffff', '#d8ecff', '#9fbad8', '#eef7ff', mix(c.A.base, '#ffffff', 0.55), '#7f9cc0'];
  const T: Pt[] = [[x - 18 * s, y - 16 * s], [x + 18 * s, y - 16 * s]];
  const G: Pt[] = [[x - 36 * s, y], [x - 14 * s, y + 2 * s], [x + 14 * s, y + 2 * s], [x + 36 * s, y]];
  const culet: Pt = [x, y + 38 * s];
  return (
    <g>
      <path d={poly(G[0], T[0], [x - 8 * s, y + 1 * s])} fill={ice[1]} />
      <path d={poly(T[0], T[1], [x + 8 * s, y + 1 * s], [x - 8 * s, y + 1 * s])} fill={ice[3]} />
      <path d={poly(T[1], G[3], [x + 8 * s, y + 1 * s])} fill={ice[2]} />
      <path d={poly(G[0], G[1], culet)} fill={ice[2]} />
      <path d={poly(G[1], G[2], culet)} fill={ice[4]} />
      <path d={poly(G[2], G[3], culet)} fill={ice[5]} />
      <path d={poly(G[0], T[0], T[1], G[3], culet)} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={0.8} />
      <path d={`M${G[0][0]} ${G[0][1]}L${G[3][0]} ${G[3][1]}`} stroke="#fff" strokeOpacity={0.8} strokeWidth={1} />
      {glint(x - 10 * s, y - 12 * s, 12 * s)}
      {glint(x + 26 * s, y + 4 * s, 7 * s, 0.8)}
    </g>
  );
}

const ring: KindFn = (c) => {
  const v = c.v;
  const band = c.f === 'metal' || c.f === 'gold' ? 'M' : 'P';
  const fillC = band === 'M' ? c.u('mc') : c.u('pc');
  const back = band === 'M' ? c.M(-0.45) : c.P(-0.5);
  const cx = 200, cy = 244;
  const ORX = 84, ORY = 86, IRX = 66, IRY = 68;
  const stones = v === 2;
  const gem = v === 3 ? c.A : c.S;
  return {
    shadow: [204, 84, 10],
    el: (
      <g>
        <defs>{lin(c, 'emer', [[0, gem(0.5)], [0.5, gem(0)], [1, gem(-0.5)]], 0, 0, 1, 1)}</defs>
        <path d={annulus(cx + 14, cy - 8, ORX, ORY, IRX, IRY)} fill={back} fillRule="evenodd" />
        <path d={annulus(cx + 14, cy - 8, ORX, ORY, IRX, IRY)} fill={c.u('occ')} fillRule="evenodd" opacity={0.6} />
        {sol(c, annulus(cx, cy, ORX, ORY, IRX, IRY), fillC, { rim: 1.4, sheen: 0.8, cb: true })}
        <ellipse cx={cx} cy={cy} rx={(ORX + IRX) / 2} ry={(ORY + IRY) / 2} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} />
        {stones
          ? Array.from({ length: 13 }, (_, i) => {
              const [x, y] = onEll(cx, cy, (ORX + IRX) / 2, (ORY + IRY) / 2, -90 + i * 27.7);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={6.5} fill={c.M(-0.3)} />
                  <circle cx={x} cy={y} r={5} fill={c.u('stone')} />
                  {i % 3 === 0 ? glint(x - 1, y - 1, 7, 0.9) : null}
                </g>
              );
            })
          : null}
        {stones ? <defs>{rad(c, 'stone', [[0, '#ffffff'], [0.5, '#cfe2f7'], [1, '#7d95b5']], 0.4, 0.35, 0.6)}</defs> : null}
        {v === 1 ? (
          <g>
            {sol(c, 'M152 176Q200 150 248 176L240 200Q200 182 160 200Z', fillC, { rim: 1 })}
            {sol(c, ell(cx, 164, 52, 22), fillC, { rim: 1.4, sheen: 1 })}
            <ellipse cx={cx} cy={164} rx={40} ry={15} fill="#000" opacity={0.18} />
            <g transform={`translate(${cx} 164) scale(1 0.45)`}>{mark(0, 0, 40, band === 'M' ? c.M(-0.5) : c.P(-0.5), 0.8)}</g>
          </g>
        ) : v === 3 ? (
          <g>
            <path d="M176 172L170 150M224 172L230 150M182 172L186 146M218 172L214 146" stroke={c.u('mv')} strokeWidth={4} strokeLinecap="round" />
            {sol(c, poly([160, 128], [240, 128], [254, 146], [246, 172], [154, 172], [146, 146]), c.u('emer'), { rim: 1.2 })}
            <path d={poly([172, 136], [228, 136], [236, 148], [230, 162], [170, 162], [164, 148])} fill={gem(0.25)} opacity={0.75} />
            <path d={poly([182, 142], [218, 142], [222, 150], [218, 156], [182, 156], [178, 150])} fill={gem(-0.2)} opacity={0.9} />
            <path d="M160 128L172 136M240 128L228 136M254 146L236 148M246 172L230 162M154 172L170 162M146 146L164 148" stroke="#fff" strokeOpacity={0.4} />
            {glint(176, 134, 12)}
            {glow(c, 200, 150, 60, 40, 0.35)}
          </g>
        ) : !stones ? (
          <g>
            <path d="M184 176L176 136M216 176L224 136" stroke={c.u('mv')} strokeWidth={4} strokeLinecap="round" />
            {sol(c, 'M182 176Q200 166 218 176L214 188Q200 182 186 188Z', fillC, { rim: 0.8 })}
            {diamond(c, 200, 134, 1)}
            <path d="M190 132L186 146M210 132L214 146" stroke={c.u('mv')} strokeWidth={3} strokeLinecap="round" />
          </g>
        ) : null}
      </g>
    ),
  };
};

// ───────────────────────────── perfume ─────────────────────────────

const perfume: KindFn = (c) => {
  const v = c.v % 3;
  const capFill = c.f === 'gold' || c.f === 'metal' ? c.u('mc') : c.u('sc');
  const glassDefs = (
    <defs>
      {lin(c, 'pg', [[0, '#ffffff', 0.32], [0.1, '#ffffff', 0.06], [0.5, '#ffffff', 0.02], [0.88, '#ffffff', 0.05], [1, '#ffffff', 0.28]], 0, 0, 1, 0)}
      {lin(c, 'liq', [[0, c.P(0.35 + c.lift), 0.92], [0.6, c.P(0), 0.92], [1, c.P(-0.45), 0.95]])}
    </defs>
  );
  if (v === 1) {
    // round flask with tall cap
    return {
      shadow: [200, 82, 9],
      el: (
        <g>
          {glassDefs}
          {sol(c, rr(176, 70, 48, 70, 8), capFill, { rim: 1.2, sheen: 0.8 })}
          <path d="M176 84H224M176 126H224" stroke="#000" strokeOpacity={0.25} />
          {sol(c, rr(184, 136, 32, 22, 3), c.u('mc'), { rim: 0.8 })}
          <circle cx={200} cy={244} r={86} fill={c.P(-0.75)} opacity={0.35} />
          <circle cx={200} cy={250} r={72} fill={c.u('liq')} />
          <circle cx={200} cy={244} r={86} fill={c.u('pg')} />
          <circle cx={200} cy={244} r={86} fill="none" stroke={c.u('rim')} strokeWidth={2} />
          <circle cx={200} cy={244} r={78} fill="none" stroke="#fff" strokeOpacity={0.12} strokeWidth={6} />
          <ellipse cx={164} cy={204} rx={10} ry={30} transform="rotate(30 164 204)" fill="#fff" opacity={0.3} />
          {sol(c, rr(170, 266, 60, 26, 3), c.u('mv'), { rim: 0.5 })}
          {mark(200, 279, 12, c.M(-0.5), 0.8)}
        </g>
      ),
    };
  }
  if (v === 2) {
    // vintage atomiser
    const body = smooth([[200, 150], [236, 162], [252, 210], [248, 280], [226, 322], [174, 322], [152, 280], [148, 210], [164, 162]]);
    return {
      shadow: [196, 80, 9],
      el: (
        <g>
          {glassDefs}
          <path d="M214 120C250 110 270 130 276 168" fill="none" stroke={c.u('mc')} strokeWidth={3} />
          <path d="M276 168C278 186 282 196 290 204" fill="none" stroke={c.S(-0.2)} strokeWidth={4} />
          {sol(c, ell(298, 222, 22, 28), c.u('ss'), { rim: 1, cb: true })}
          <path d="M298 250L292 300M298 250L300 302M298 250L306 298" stroke={c.A(0)} strokeWidth={2} />
          {sol(c, rr(184, 106, 32, 46, 6), capFill, { rim: 1, sheen: 0.7 })}
          {sol(c, rr(206, 114, 14, 10, 3), c.u('mc'), { rim: 0.6 })}
          <path d={body} fill={c.P(-0.75)} opacity={0.35} />
          <path d="M156 236Q200 226 244 236L244 282Q234 316 200 316Q166 316 156 282Z" fill={c.u('liq')} />
          <path d={body} fill={c.u('pg')} />
          <path d={body} fill="none" stroke={c.u('rim')} strokeWidth={2} />
          <path d={`M168 180C160 210 160 260 170 296`} stroke="#fff" strokeOpacity={0.35} strokeWidth={5} fill="none" strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${172 + i * 18} 166V310`} stroke="#fff" strokeOpacity={0.08} strokeWidth={2} />
          ))}
        </g>
      ),
    };
  }
  // heavy rectangular flacon
  return {
    shadow: [200, 86, 9],
    el: (
      <g>
        {glassDefs}
        {sol(c, rr(158, 66, 84, 62, 8), capFill, { rim: 1.3, sheen: 0.9 })}
        <path d={rr(158, 66, 84, 62, 8)} fill={c.u('occh')} opacity={0.35} />
        {sol(c, rr(182, 124, 36, 24, 3), c.u('mc'), { rim: 0.8 })}
        <path d={rr(124, 146, 152, 182, 16)} fill={c.P(-0.75)} opacity={0.35} />
        <path d={rr(136, 176, 128, 124, 8)} fill={c.u('liq')} />
        <path d={rr(136, 176, 128, 6, 3)} fill={c.P(0.4)} opacity={0.6} />
        <path d={rr(124, 146, 152, 182, 16)} fill={c.u('pg')} />
        <path d={rr(124, 146, 152, 182, 16)} fill="none" stroke={c.u('rim')} strokeWidth={2.2} />
        <path d={rr(136, 158, 128, 158, 10)} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={1.2} />
        <rect x={130} y={154} width={6} height={166} rx={3} fill="#fff" opacity={0.35} />
        <rect x={264} y={154} width={4} height={166} rx={2} fill="#fff" opacity={0.2} />
        <rect x={136} y={302} width={128} height={14} rx={4} fill="#fff" opacity={0.12} />
        {sol(c, rr(166, 226, 68, 32, 3), c.u('mv'), { rim: 0.6, sheen: 0.8 })}
        {mark(200, 242, 14, c.M(-0.5), 0.85)}
      </g>
    ),
  };
};

// ───────────────────────────── trophy ─────────────────────────────

const trophy: KindFn = (c) => {
  const v = c.v % 3;
  const metal = c.f === 'gold' || c.f === 'metal' ? c.u('mc') : c.u('pc');
  const metalV = c.f === 'gold' || c.f === 'metal' ? c.u('mv') : c.u('pv');
  const base = (
    <g>
      {sol(c, rr(120, 290, 160, 38, 6), c.u('sv'), { rim: 1, sheen: 0.5, occ: 0.3 })}
      {sol(c, rr(136, 266, 128, 28, 5), c.u('sv'), { rim: 1, sheen: 0.5, occ: 0.2 })}
      {sol(c, rr(170, 300, 60, 18, 2), c.u('mv'), { rim: 0.6, sheen: 0.8 })}
      <rect x={180} y={307} width={40} height={3} rx={1.5} fill="#000" opacity={0.4} />
    </g>
  );
  if (v === 1) {
    // star on a column
    const star = Array.from({ length: 10 }, (_, i) => onEll(200, 118, i % 2 ? 26 : 62, i % 2 ? 26 : 62, -90 + i * 36));
    return {
      shadow: [200, 90, 10],
      el: (
        <g>
          {base}
          {sol(c, rr(184, 176, 32, 92, 4), metal, { rim: 1, sheen: 0.6 })}
          {sol(c, rr(172, 166, 56, 14, 4), metal, { rim: 1 })}
          {sol(c, poly(...star), metalV, { rim: 1.4, sheen: 1 })}
          {star.filter((_, i) => i % 2 === 0).map(([x, y], i) => (
            <path key={i} d={`M200 118L${x} ${y}`} stroke="#000" strokeOpacity={0.2} />
          ))}
          {glint(170, 92, 12)}
        </g>
      ),
    };
  }
  if (v === 2) {
    // crystal obelisk award
    return {
      shadow: [200, 90, 10],
      el: (
        <g>
          {base}
          <path d="M200 270L170 268L176 92L200 70Z" fill={c.A(-0.1)} opacity={0.35} />
          <path d="M200 270L230 268L224 92L200 70Z" fill={c.A(-0.4)} opacity={0.45} />
          <path d="M170 268L176 92L200 70L224 92L230 268Z" fill="none" stroke="#fff" strokeOpacity={0.6} strokeWidth={1.4} />
          <path d="M200 70V270" stroke="#fff" strokeOpacity={0.45} />
          {glow(c, 200, 230, 40, 60, 0.7)}
          <g transform="translate(200 170)">{mark(0, 0, 34, '#ffffff', 0.7)}</g>
          {glint(186, 100, 10)}
        </g>
      ),
    };
  }
  // classic cup
  const cup = 'M134 86H266C266 150 246 196 200 206C154 196 134 150 134 86Z';
  return {
    shadow: [200, 90, 10],
    el: (
      <g>
        {base}
        <path d="M136 104C96 100 92 160 152 170" fill="none" stroke={c.M(-0.5)} strokeWidth={10} />
        <path d="M136 104C96 100 92 160 152 170" fill="none" stroke={metal} strokeWidth={7} />
        <path d="M264 104C304 100 308 160 248 170" fill="none" stroke={c.M(-0.5)} strokeWidth={10} />
        <path d="M264 104C304 100 308 160 248 170" fill="none" stroke={metal} strokeWidth={7} />
        {sol(c, 'M190 204H210L214 252H186Z', metal, { rim: 0.8 })}
        {sol(c, ell(200, 226, 14, 8), metal, { rim: 1 })}
        {sol(c, 'M170 266Q200 246 230 266Z', metal, { rim: 1 })}
        {sol(c, cup, metal, { rim: 1.4, sheen: 1, cb: true })}
        <ellipse cx={200} cy={86} rx={66} ry={10} fill={c.f === 'gold' || c.f === 'metal' ? c.M(-0.45) : c.P(-0.5)} />
        <ellipse cx={200} cy={86} rx={66} ry={10} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.2} />
        <path d="M140 118Q200 134 260 118" stroke="#000" strokeOpacity={0.25} strokeWidth={2} fill="none" />
        {mark(200, 152, 22, c.A(0.1), 0.85)}
        {glint(156, 110, 10, 0.8)}
      </g>
    ),
  };
};

// ───────────────────────────── pen ─────────────────────────────

const pen: KindFn = (c) => {
  const v = c.v % 3;
  const ball = v === 1;
  const trim = c.u('mx');
  const body = c.u('px');
  const fountain = !ball;
  return {
    shadow: [204, 150, 12],
    el: (
      <g>
        <defs>
          {lin(c, 'px', materialStops(c.P, c.f === 'gold' ? 'gloss' : c.f, 'c', c.lift))}
          {lin(c, 'mx', materialStops(c.M, 'metal', 'c', 0.05))}
          {lin(c, 'sx', materialStops(c.S, 'gloss', 'c'))}
        </defs>
        <g transform="translate(206 210) rotate(-32) scale(1 1.22)">
          {/* posted cap / end */}
          {sol(c, rr(64, -15, 96, 30, 14), body, { rim: 1.2, sheen: 0.6, cb: true })}
          {sol(c, rr(66, -15, 10, 30, 2), trim, { rim: 0.6 })}
          {sol(c, rr(150, -12, 14, 24, 10), trim, { rim: 0.8 })}
          {sol(c, 'M84 -19H150Q156 -19 156 -13H90L84 -17Z', trim, { rim: 0.8 })}
          {sol(c, rr(140, -21, 18, 8, 3), trim, { rim: 0.6 })}
          {/* barrel */}
          {sol(c, rr(-112, -13, 180, 26, 10), body, { rim: 1.3, sheen: 0.8, cb: true })}
          {sol(c, rr(-116, -13.5, 8, 27, 2), trim, { rim: 0.6 })}
          {/* section */}
          {sol(c, 'M-112 -11L-146 -8.5Q-150 0 -146 8.5L-112 11Z', c.u('sx'), { rim: 0.8 })}
          {fountain ? (
            <g>
              {sol(c, 'M-146 -8L-196 -1Q-200 0 -196 1L-146 8Q-152 0 -146 -8Z', trim, { rim: 1, sheen: 1 })}
              <path d="M-196 0H-162" stroke="#000" strokeOpacity={0.55} strokeWidth={0.9} />
              <circle cx={-160} cy={0} r={2} fill="#000" opacity={0.6} />
              <path d="M-176 -3L-150 -6M-176 3L-150 6" stroke="#000" strokeOpacity={0.2} />
            </g>
          ) : (
            <g>
              {sol(c, 'M-146 -8L-178 -2L-178 2L-146 8Z', trim, { rim: 1, sheen: 1 })}
              <circle cx={-180} cy={0} r={2.2} fill={c.M(-0.4)} />
            </g>
          )}
          {mark(-20, 0, 12, c.M(0.2), 0.7)}
          <rect x={-104} y={-9} width={160} height={3} rx={1.5} fill="#fff" opacity={0.3} />
        </g>
      </g>
    ),
  };
};

export const luxury: Partial<Record<ArtKind, KindFn>> = {
  watch,
  ring,
  perfume,
  trophy,
  pen,
};
