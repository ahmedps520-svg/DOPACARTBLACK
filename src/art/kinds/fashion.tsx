import type { ArtKind } from '../../engine/types';
import { block, lin, mark, rad, sol, type Ctx, type KindFn } from '../kit';
import { ell, lerpPt, makeProj, mirrorX, poly, prism, quadAt, rr, rrPts, subQuad, type Pt } from '../shading';

const STITCH = { fill: 'none', stroke: '#fff', strokeOpacity: 0.32, strokeWidth: 1, strokeDasharray: '3 2.6' } as const;

/** Soft fabric overlay: light centre, darker edges (kind-local radial). */
function fabricDefs(c: Ctx) {
  return (
    <defs>
      {rad(c, 'fab', [[0, '#ffffff', 0.12], [0.55, '#000000', 0], [1, '#000000', 0.42]], 0.45, 0.32, 0.75)}
      {lin(c, 'fold', [[0, '#000000', 0], [0.5, '#000000', 0.28], [1, '#000000', 0]], 0, 0, 1, 0)}
    </defs>
  );
}

/** A garment panel: material + fabric falloff + rim. */
function panel(c: Ctx, d: string, fill = c.u('pv'), o: { occ?: number; rim?: number; sheen?: number } = {}) {
  return (
    <g>
      {sol(c, d, fill, { rim: o.rim ?? 1, sheen: o.sheen ?? 0.25, cb: true, occ: o.occ ?? 0.15 })}
      <path d={d} fill={c.u('fab')} />
    </g>
  );
}

/** Soft vertical fold streak. */
const fold = (c: Ctx, x: number, y0: number, y1: number, w = 14, op = 1) => (
  <path d={`M${x - w / 2} ${y0}Q${x - w * 0.2} ${(y0 + y1) / 2} ${x - w / 2} ${y1}H${x + w / 2}Q${x + w * 0.4} ${(y0 + y1) / 2} ${x + w / 2} ${y0}Z`} fill={c.u('fold')} opacity={op} />
);

// ───────────────────────────── sneaker ─────────────────────────────

interface ShoeGeo {
  upper: string;
  tongue: string;
  lining?: string;
  collar?: string;
  lace: [Pt, Pt, number];
  midsole: string;
  wave?: string;
  outsole: string;
  toe: string;
  heel: string;
  stripe: string;
  panel?: string;
}

const OUTSOLE = 'M60 312C68 325 86 330 104 330H314C330 330 342 324 346 310C300 324 120 324 60 312Z';
const TOE = 'M60 300C52 290 58 272 82 266C92 264 100 264 108 266C102 280 106 292 118 302C96 302 76 302 60 300Z';

const SHOES: ShoeGeo[] = [
  {
    // runner
    upper: 'M60 300C50 290 52 268 80 260C106 252 130 248 152 238L196 212C206 204 214 198 226 200C244 208 262 212 282 204C300 196 318 192 330 198C344 212 346 250 340 282C300 290 240 300 180 304C130 306 90 304 60 300Z',
    tongue: 'M192 218C194 200 206 186 220 184C231 183 235 193 230 205Z',
    lining: 'M224 203C244 212 264 214 284 206C298 199 316 196 329 201C314 206 300 211 286 215C264 221 240 216 224 203Z',
    lace: [[156, 240], [200, 214], 5],
    midsole: 'M58 300C90 304 130 306 180 304C240 300 300 290 340 280C350 292 350 314 338 322C330 328 322 330 312 330L104 330C82 330 62 322 58 308Z',
    outsole: OUTSOLE,
    toe: TOE,
    heel: 'M340 282C346 250 344 214 330 200C316 212 300 244 298 288C312 286 326 284 340 282Z',
    stripe: 'M112 293C180 290 250 276 336 252L337 259C252 284 182 299 114 299ZM146 281C196 278 246 266 300 250L301 255C248 272 198 284 148 286Z',
    panel: 'M206 302C216 272 244 246 290 234C310 229 326 229 338 232L340 282C300 290 252 298 206 302Z',
  },
  {
    // high-top
    upper: 'M60 300C50 290 54 268 80 262C106 256 128 250 148 238L196 186C202 168 206 152 210 138C244 128 292 128 324 138C334 180 346 232 340 282C300 290 240 300 180 304C130 306 90 304 60 300Z',
    tongue: 'M206 146C206 130 216 120 230 121C238 122 239 134 236 142Z',
    collar: 'M208 140C244 130 292 130 325 140L327 158C292 150 244 150 207 160Z',
    lace: [[154, 238], [206, 150], 7],
    midsole: 'M58 298C100 300 200 300 342 290C348 300 348 318 340 324C334 329 326 330 316 330H100C78 330 60 322 58 306Z',
    outsole: 'M60 314C68 326 84 330 100 330H316C330 330 342 324 346 312C300 322 120 322 60 314Z',
    toe: TOE,
    heel: 'M340 282C344 240 338 200 330 172C318 204 312 244 310 286Z',
    stripe: 'M112 293C180 290 250 276 336 252L337 259C252 284 182 299 114 299Z',
    panel: 'M226 300C236 262 262 232 300 220C318 214 330 214 336 216L340 282C300 290 260 296 226 300Z',
  },
  {
    // chunky
    upper: 'M64 288C54 276 60 258 86 252C112 246 132 238 154 226L198 200C208 192 216 186 228 188C246 196 264 200 284 192C302 184 320 180 332 186C346 200 348 236 342 272C300 280 240 286 180 290C130 292 92 292 64 288Z',
    tongue: 'M194 204C196 186 208 172 222 170C233 169 237 179 232 191Z',
    lining: 'M226 189C246 198 266 200 286 192C300 185 318 182 331 187C316 192 302 197 288 201C266 207 242 202 226 189Z',
    lace: [[160, 226], [202, 200], 5],
    midsole: 'M56 290C90 294 130 296 180 292C240 288 300 278 344 268C356 284 356 312 342 322C332 328 322 330 310 330H100C76 330 58 320 54 304Z',
    wave: 'M58 306C120 300 180 312 240 300C280 292 320 284 352 282L352 294C320 298 280 306 240 314C180 326 120 314 60 316Z',
    outsole: OUTSOLE,
    toe: 'M64 288C54 276 60 258 86 252C100 249 112 248 124 250C116 264 120 278 136 290C110 291 84 290 64 288Z',
    heel: 'M342 272C348 236 346 200 332 186C316 200 300 236 300 278Z',
    stripe: 'M150 270C200 266 250 252 320 230L321 236C252 260 202 274 152 276Z',
    panel: 'M118 280C150 252 190 238 230 238C226 256 236 270 262 280C200 288 150 288 118 280Z',
  },
  {
    // court
    upper: 'M60 302C54 292 60 276 84 270C110 264 132 258 154 250L200 228C210 222 218 218 230 220C248 226 266 228 286 222C302 216 318 214 330 220C342 234 344 262 340 292C300 296 240 302 180 304C130 306 90 306 60 302Z',
    tongue: 'M196 232C198 216 210 205 222 204C232 204 236 212 232 222Z',
    lining: 'M228 221C248 228 266 230 286 223C300 218 316 216 329 221C314 225 300 229 286 232C266 236 242 232 228 221Z',
    lace: [[160, 252], [204, 229], 5],
    midsole: 'M56 300C90 304 200 306 344 292C348 302 348 318 342 324C336 329 328 330 318 330H100C78 330 60 324 56 312Z',
    outsole: 'M60 318C68 327 84 330 100 330H318C332 330 342 326 346 318C300 326 120 326 60 318Z',
    toe: 'M60 302C54 292 60 276 84 270C94 268 104 268 112 270C106 282 110 294 122 304C100 304 78 304 60 302Z',
    heel: 'M340 292C344 262 342 234 330 220C324 236 322 262 324 294Z',
    stripe: 'M70 296C140 300 260 296 338 286L339 291C260 301 140 305 70 301Z',
  },
];

const sneaker: KindFn = (c) => {
  const g = SHOES[c.v];
  const [a, b, n] = g.lace;
  const laceCol = c.S.dark ? '#e9e7e2' : c.S(0.55);
  const laces = Array.from({ length: n }, (_, i) => {
    const [x, y] = lerpPt(a, b, (i + 0.5) / n);
    return `M${x - 7} ${y - 9}L${x + 9} ${y + 5}`;
  }).join('');
  const eyelets = Array.from({ length: n }, (_, i) => lerpPt(a, b, (i + 0.5) / n));
  return {
    shadow: [204, 150, 13],
    el: (
      <g>
        {sol(c, g.tongue, c.u('pv'), { rim: 1.2, occ: 0.2 })}
        <path d={g.tongue} fill={c.S(0)} opacity={0.35} />
        {sol(c, g.upper, c.u('pv'), { occ: 0.4, sheen: 0.45, cb: true, rim: 1.2 })}
        {g.lining ? <path d={g.lining} fill={c.P(-0.75)} /> : null}
        {g.panel ? sol(c, g.panel, c.u('sv'), { rim: 0.5, occ: 0.3 }) : null}
        {sol(c, g.toe, c.u('sv'), { rim: 0.9, occ: 0.25, sheen: 0.3 })}
        {sol(c, g.heel, c.u('sv'), { rim: 0.8, occ: 0.25, side: 0.3 })}
        {g.collar ? sol(c, g.collar, c.u('sv'), { rim: 1, occ: 0.2 }) : null}
        {sol(c, g.stripe, c.u('av'), { rim: 0.7, sheen: 0.4 })}
        <path d={g.stripe} {...STITCH} strokeOpacity={0.25} />
        {/* eyestay + laces */}
        {eyelets.map(([x, y], i) => (
          <circle key={i} cx={x + 7} cy={y + 10} r={2.4} fill={c.u('mv')} stroke="#000" strokeOpacity={0.4} strokeWidth={0.6} />
        ))}
        <path d={laces} stroke="#000" strokeOpacity={0.35} strokeWidth={5} strokeLinecap="round" transform="translate(0.8 1.6)" />
        <path d={laces} stroke={laceCol} strokeWidth={4} strokeLinecap="round" />
        {/* sole */}
        {sol(c, g.midsole, c.u('sv'), { rim: 1, occ: 0.25 })}
        {g.wave ? sol(c, g.wave, c.u('av'), { rim: 0.4 }) : null}
        <path d={g.midsole} fill={c.u('sheen')} opacity={0.18} />
        <path d={g.outsole} fill={c.S.dark ? c.S(0.2) : '#18181b'} />
        <path d={g.outsole} fill="none" stroke="#fff" strokeOpacity={0.12} />
        {c.v === 3 ? <path d="M64 312C120 316 220 316 340 304" {...STITCH} /> : null}
        {c.v === 3
          ? Array.from({ length: 12 }, (_, i) => <circle key={i} cx={74 + (i % 4) * 9} cy={278 + Math.floor(i / 4) * 7} r={1.2} fill="#000" opacity={0.4} />)
          : null}
        {c.v === 1 ? (
          <g>
            {sol(c, ell(292, 182, 15), c.u('sv'), { rim: 0.8 })}
            <circle cx={292} cy={182} r={11} {...STITCH} />
            {mark(292, 182, 12, c.A(0.1), 0.9)}
          </g>
        ) : (
          mark(318, 244, 9, c.A(0.2), 0.8)
        )}
      </g>
    ),
  };
};

// ───────────────────────────── garments ─────────────────────────────

const teeSleeveR = 'M286 98C312 108 334 130 350 158L318 192L288 170Z';
const teeTorso = 'M166 84C182 102 218 102 234 84L288 98L286 172L290 320Q200 328 110 320L114 172L112 98Z';
const longSleeveR = 'M288 102C316 112 334 140 340 180L356 290L320 298L304 196L292 150Z';
const torso = 'M168 92C184 106 216 106 232 92L290 104L296 196L294 316Q200 324 106 316L104 196L110 104Z';

const tee: KindFn = (c) => {
  const v = c.v;
  const vneck = v === 3;
  const neck = vneck ? 'M166 84L200 134L234 84L242 88L200 146L158 88Z' : 'M166 84C182 102 218 102 234 84L241 88C222 114 178 114 159 88Z';
  const inner = vneck ? 'M168 84L200 128L232 84C220 80 180 80 168 84Z' : 'M168 85C184 96 216 96 232 85C220 80 180 80 168 85Z';
  return {
    shadow: [200, 130, 11],
    el: (
      <g>
        {fabricDefs(c)}
        {panel(c, mirrorX(teeSleeveR))}
        {panel(c, teeSleeveR)}
        {panel(c, teeTorso, c.u('pv'), { occ: 0.2 })}
        <path d={inner} fill={c.P(-0.6)} />
        {sol(c, neck, c.P(-0.08), { rim: 0.8 })}
        {fold(c, 150, 200, 312, 16, 0.8)}
        {fold(c, 244, 190, 310, 20, 0.7)}
        <path d="M60 150L88 182M340 150L312 182" {...STITCH} />
        <path d="M116 308Q200 316 284 308" {...STITCH} />
        {v === 1 ? (
          <g>
            <circle cx={200} cy={186} r={40} fill={c.A(0)} opacity={0.9} />
            <path d="M160 186A40 40 0 0 0 240 186Z" fill={c.S(0.1)} opacity={0.85} />
            {mark(200, 186, 26, c.P(0), 0.9)}
          </g>
        ) : v === 2 ? (
          <g>
            {sol(c, rr(220, 128, 36, 40, 4), c.u('pv'), { rim: 0.6, occ: 0.35 })}
            <path d={rr(223, 131, 30, 34, 3)} {...STITCH} />
            <path d="M220 128H256" stroke={c.A(0)} strokeWidth={2} />
          </g>
        ) : (
          mark(234, 136, 14, c.A(0.1), 0.9)
        )}
      </g>
    ),
  };
};

const hoodie: KindFn = (c) => {
  const zip = c.v % 2 === 1;
  return {
    shadow: [200, 150, 11],
    el: (
      <g>
        {fabricDefs(c)}
        {panel(c, 'M146 108C138 66 166 40 200 40C234 40 262 66 254 108C236 98 164 98 146 108Z', c.u('pv'), { occ: 0.3 })}
        {panel(c, mirrorX(longSleeveR))}
        {panel(c, longSleeveR)}
        {panel(c, torso, c.u('pv'), { occ: 0.2 })}
        {fold(c, 140, 200, 300, 16, 0.7)}
        {fold(c, 262, 200, 300, 18, 0.6)}
        {/* cuffs + hem rib */}
        {[mirrorX('M320 296L356 288L358 310L322 318Z'), 'M320 296L356 288L358 310L322 318Z'].map((d, i) => (
          <g key={i}>{sol(c, d, c.P(-0.12), { rim: 0.5, occ: 0.3 })}</g>
        ))}
        {sol(c, 'M106 300Q200 308 294 300L294 320Q200 328 106 320Z', c.P(-0.12), { rim: 0.5, occ: 0.3 })}
        <path d={Array.from({ length: 30 }, (_, i) => `M${110 + i * 6.2} ${303 + Math.sin(i / 9) * 1.5}v16`).join('')} stroke="#000" strokeOpacity={0.18} />
        {/* pocket */}
        {zip ? null : (
          <g>
            {sol(c, 'M148 236H252L270 292Q200 298 130 292Z', c.u('pv'), { rim: 0.5, occ: 0.25 })}
            <path d="M148 236L130 292M252 236L270 292" stroke="#000" strokeOpacity={0.35} strokeWidth={2} />
            <path d="M152 240H248" {...STITCH} />
          </g>
        )}
        {zip ? (
          <g>
            <path d="M200 104V316" stroke={c.P(-0.5)} strokeWidth={5} />
            <path d="M200 104V316" stroke={c.u('mv')} strokeWidth={3} strokeDasharray="1.4 1.4" />
            {sol(c, rr(196, 112, 8, 18, 3), c.u('mv'), { rim: 0.6 })}
            <path d="M150 236L136 290M250 236L264 290" stroke="#000" strokeOpacity={0.35} strokeWidth={2} />
          </g>
        ) : null}
        {/* hood rim + opening */}
        {sol(c, 'M148 104C148 66 252 66 252 104C240 118 160 118 148 104Z', c.u('pv'), { rim: 1, occ: 0.2 })}
        <path d="M164 100C166 74 234 74 236 100C224 111 176 111 164 100Z" fill={c.P(-0.65)} />
        {/* drawstrings */}
        <path d="M186 112C184 138 182 156 184 178M214 112C216 138 218 156 216 180" fill="none" stroke={c.S.dark ? '#d9d6cf' : c.S(0.2)} strokeWidth={3.2} strokeLinecap="round" />
        {sol(c, rr(181, 176, 6, 13, 2), c.u('mv'), { rim: 0.4 })}
        {sol(c, rr(213, 178, 6, 13, 2), c.u('mv'), { rim: 0.4 })}
        {zip ? mark(244, 150, 12, c.A(0.1), 0.85) : mark(200, 172, 18, c.A(0.1), 0.85)}
      </g>
    ),
  };
};

const jacket: KindFn = (c) => {
  const v = c.v % 3;
  const puffer = v === 1;
  const varsity = v === 2;
  const clip = c.id('jclip');
  const body = puffer ? 'M164 88C182 104 218 104 236 88L294 102C304 150 304 250 300 318Q200 330 100 318C96 250 96 150 106 102Z' : torso;
  const sleeveR = puffer ? 'M292 100C326 108 346 140 352 186L362 286L320 296L306 200L298 140Z' : longSleeveR;
  const sleeveFill = varsity ? c.u('sv') : c.u('pv');
  const rib = varsity || !puffer ? c.S(-0.05) : c.P(-0.15);
  return {
    shadow: [200, 152, 11],
    el: (
      <g>
        {fabricDefs(c)}
        <defs>
          <clipPath id={clip}>
            <path d={body} />
            <path d={sleeveR} />
            <path d={mirrorX(sleeveR)} />
          </clipPath>
          {lin(c, 'baffle', [[0, c.P(0.3 + c.lift)], [0.35, c.P(0.05)], [0.8, c.P(-0.3)], [1, c.P(-0.55)]])}
        </defs>
        {panel(c, mirrorX(sleeveR), sleeveFill, { sheen: puffer ? 0.6 : 0.35 })}
        {panel(c, sleeveR, sleeveFill, { sheen: puffer ? 0.6 : 0.35 })}
        {panel(c, body, c.u('pv'), { occ: 0.2, sheen: puffer ? 0.6 : 0.4 })}
        {puffer ? (
          <g clipPath={`url(#${clip})`}>
            {Array.from({ length: 10 }, (_, i) => (
              <path key={i} d={`M40 ${100 + i * 23}Q200 ${92 + i * 23} 360 ${100 + i * 23}V${124 + i * 23}Q200 ${116 + i * 23} 40 ${124 + i * 23}Z`} fill={c.u('baffle')} opacity={0.9} />
            ))}
            <path d={body} fill={c.u('fab')} />
            <path d={sleeveR} fill={c.u('fab')} />
            <path d={mirrorX(sleeveR)} fill={c.u('fab')} />
          </g>
        ) : (
          <g>
            {fold(c, 140, 200, 300, 16, 0.6)}
            {fold(c, 262, 200, 300, 18, 0.6)}
            {[mirrorX('M320 294L356 286L358 310L322 318Z'), 'M320 294L356 286L358 310L322 318Z'].map((d, i) => (
              <g key={i}>{sol(c, d, rib, { rim: 0.5, occ: 0.3 })}</g>
            ))}
            {sol(c, 'M106 296Q200 304 294 296L294 320Q200 328 106 320Z', rib, { rim: 0.5, occ: 0.3 })}
            <path d="M106 304Q200 312 294 304M106 310Q200 318 294 310" stroke={c.A(0)} strokeWidth={2.2} fill="none" />
          </g>
        )}
        {/* collar */}
        {sol(c, puffer ? 'M160 70C180 64 220 64 240 70L240 100C220 110 180 110 160 100Z' : 'M164 86C182 100 218 100 236 86L242 98C222 116 178 116 158 98Z', puffer ? c.u('pv') : rib, { rim: 1, occ: 0.2 })}
        {puffer ? <path d="M162 76C182 70 218 70 238 76" stroke="#000" strokeOpacity={0.25} fill="none" /> : null}
        {/* zip or snaps */}
        {varsity ? (
          Array.from({ length: 5 }, (_, i) => (
            <g key={i}>
              {sol(c, ell(200, 130 + i * 36, 5), c.u('mv'), { rim: 0.5 })}
            </g>
          ))
        ) : (
          <g>
            <path d={`M200 ${puffer ? 70 : 108}V${puffer ? 322 : 318}`} stroke={c.P(-0.55)} strokeWidth={5} />
            <path d={`M200 ${puffer ? 70 : 108}V${puffer ? 322 : 318}`} stroke={c.u('mv')} strokeWidth={3} strokeDasharray="1.4 1.4" />
            {sol(c, rr(196, puffer ? 80 : 114, 8, 20, 3), c.u('mv'), { rim: 0.6 })}
          </g>
        )}
        {!puffer ? (
          <g>
            <path d="M108 170L134 162" stroke={c.u('mv')} strokeWidth={2} />
            {sol(c, rr(78, 168, 22, 30, 3), varsity ? c.u('sv') : c.P(-0.1), { rim: 0.4 })}
            <path d="M80 172H98" stroke={c.u('mv')} strokeWidth={1.6} />
          </g>
        ) : null}
        {varsity ? (
          <g>
            {sol(c, ell(150, 150, 18), c.u('av'), { rim: 0.6 })}
            {mark(150, 150, 14, c.P(0), 0.9)}
          </g>
        ) : (
          mark(246, puffer ? 130 : 150, 12, c.A(0.1), 0.85)
        )}
      </g>
    ),
  };
};

// ───────────────────────────── bag ─────────────────────────────

const hw = (c: Ctx) => (c.gold ? c.u('mv') : c.u('mc'));

const bag: KindFn = (c) => {
  const v = c.v;
  if (v === 1 || v === 3) {
    // crossbody with flap; chain strap on gold finish or v3
    const chain = c.gold || v === 3;
    const strap = 'M128 214C112 150 128 70 200 66C272 70 288 150 272 214';
    return {
      shadow: [200, 112, 11],
      el: (
        <g>
          {chain ? (
            <g>
              <path d={strap} fill="none" stroke={c.M(-0.5)} strokeWidth={7} />
              <path d={strap} fill="none" stroke={hw(c)} strokeWidth={6} strokeDasharray="7 2.2" strokeLinecap="round" />
              <path d={strap} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="4 5.2" />
            </g>
          ) : (
            <g>
              <path d={strap} fill="none" stroke={c.S(-0.4)} strokeWidth={9} />
              <path d={strap} fill="none" stroke={c.S(0.05)} strokeWidth={7} />
              <path d={strap} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 2.6" />
            </g>
          )}
          {sol(c, rr(122, 206, 12, 18, 4), hw(c), { rim: 0.7 })}
          {sol(c, rr(266, 206, 12, 18, 4), hw(c), { rim: 0.7 })}
          {sol(c, rr(110, 214, 180, 116, 16), c.u('pv'), { occ: 0.35, sheen: 0.4, cb: true, rim: 1.1 })}
          <path d={rr(116, 220, 168, 104, 12)} {...STITCH} />
          {sol(c, 'M110 230A16 16 0 0 1 126 214H274A16 16 0 0 1 290 230V270Q290 290 270 292H130Q110 290 110 270Z', c.u('pv'), { sheen: 0.7, cb: true, rim: 1.2 })}
          <path d="M116 232V268Q116 284 132 286H268Q284 284 284 268V232" {...STITCH} />
          <path d="M112 290Q200 300 288 290" stroke="#000" strokeOpacity={0.35} strokeWidth={3} fill="none" />
          {sol(c, rr(186, 270, 28, 30, 6), hw(c), { rim: 1, sheen: 0.8 })}
          <rect x={194} y={278} width={12} height={12} rx={3} fill="#000" opacity={0.35} />
          {mark(200, 254, 14, c.gold ? c.M(0) : c.S(0.3), 0.7)}
        </g>
      ),
    };
  }
  if (v === 2) {
    // structured top-handle with turn-lock
    return {
      shadow: [200, 126, 12],
      el: (
        <g>
          <path d="M150 182C150 118 250 118 250 182" fill="none" stroke={c.P(-0.45)} strokeWidth={13} strokeLinecap="round" />
          <path d="M150 182C150 118 250 118 250 182" fill="none" stroke={c.u('pv')} strokeWidth={10} strokeLinecap="round" />
          <path d="M156 180C158 128 242 128 244 180" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1} />
          {sol(c, 'M302 180L330 172L340 320L314 330Z', c.u('ph'), { side: 0.6, cb: true, rim: 0.6 })}
          {sol(c, 'M100 180H302L314 330H86Z', c.u('pv'), { occ: 0.35, sheen: 0.5, cb: true, rim: 1.1 })}
          <path d="M104 186H298L308 324H92Z" {...STITCH} />
          {sol(c, 'M100 180H302L306 236Q200 252 96 236Z', c.u('pv'), { sheen: 0.7, cb: true, rim: 1.1 })}
          <path d="M100 236Q200 252 306 236" fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={3} />
          {sol(c, 'M136 186H160L162 270H134Z', c.u('pv'), { rim: 0.8, occ: 0.25 })}
          {sol(c, 'M240 186H264L266 270H238Z', c.u('pv'), { rim: 0.8, occ: 0.25 })}
          {sol(c, rr(132, 250, 32, 10, 3), hw(c), { rim: 0.6 })}
          {sol(c, rr(236, 250, 32, 10, 3), hw(c), { rim: 0.6 })}
          {sol(c, rr(184, 238, 32, 22, 5), hw(c), { rim: 1, sheen: 0.8 })}
          {sol(c, ell(200, 249, 7), hw(c), { rim: 0.6 })}
          <rect x={198} y={243} width={4} height={12} rx={2} fill="#000" opacity={0.3} />
          {sol(c, rr(188, 278, 24, 26, 6), hw(c), { rim: 1, sheen: 0.8 })}
          <path d="M193 278V270A7 7 0 0 1 207 270V278" fill="none" stroke={hw(c)} strokeWidth={3} />
          <path d="M150 182V190M250 182V190" stroke={hw(c)} strokeWidth={5} />
        </g>
      ),
    };
  }
  // tote
  return {
    shadow: [204, 124, 12],
    el: (
      <g>
        <path d="M170 166C172 72 274 72 280 160" fill="none" stroke={c.S(-0.55)} strokeWidth={12} strokeLinecap="round" />
        <path d="M170 166C172 72 274 72 280 160" fill="none" stroke={c.S(-0.2)} strokeWidth={9} strokeLinecap="round" />
        {sol(c, 'M290 160L320 152L332 318L304 328Z', c.u('ph'), { side: 0.6, cb: true, rim: 0.6 })}
        <path d="M290 160L320 152L314 186Z" fill={c.P(-0.65)} />
        {sol(c, 'M110 160H290L304 328H96Z', c.u('pv'), { occ: 0.3, sheen: 0.5, cb: true, rim: 1.1 })}
        <path d="M112 172H288" {...STITCH} />
        <path d="M100 314H300" {...STITCH} />
        <path d="M110 160H290" stroke="#fff" strokeOpacity={0.35} />
        {mark(200, 244, 22, c.gold ? c.M(0) : c.S(0.25), 0.7)}
        <path d="M136 170C138 80 262 80 264 170" fill="none" stroke={c.S(-0.5)} strokeWidth={12} strokeLinecap="round" />
        <path d="M136 170C138 80 262 80 264 170" fill="none" stroke={c.u('sv')} strokeWidth={9} strokeLinecap="round" />
        <path d="M140 168C142 92 258 92 260 168" fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1} />
        {sol(c, rr(128, 162, 16, 16, 4), hw(c), { rim: 0.8 })}
        {sol(c, rr(256, 162, 16, 16, 4), hw(c), { rim: 0.8 })}
      </g>
    ),
  };
};

// ───────────────────────────── backpack ─────────────────────────────

const backpack: KindFn = (c) => {
  const roll = c.v % 2 === 1;
  const body = roll
    ? 'M124 104H276Q284 104 284 112V316Q284 330 270 330H130Q116 330 116 316V112Q116 104 124 104Z'
    : 'M116 316V150C116 96 156 72 200 72C244 72 284 96 284 150V316Q284 330 270 330H130Q116 330 116 316Z';
  const strap = 'M118 112C96 130 92 220 102 300L114 304C108 230 110 150 126 120Z';
  return {
    shadow: [200, 118, 12],
    el: (
      <g>
        {sol(c, strap, c.u('sv'), { rim: 0.8, occ: 0.3 })}
        {sol(c, mirrorX(strap), c.u('sv'), { rim: 0.6, occ: 0.3 })}
        {roll ? null : (
          <path d="M184 76C184 52 216 52 216 76" fill="none" stroke={c.S(-0.1)} strokeWidth={7} strokeLinecap="round" />
        )}
        {sol(c, body, c.u('pc'), { sheen: 0.45, cb: true, rim: 1.2, occ: 0.2 })}
        {roll ? (
          <g>
            {sol(c, 'M118 60H282Q290 60 290 70V104Q290 112 282 112H118Q110 112 110 104V70Q110 60 118 60Z', c.u('pc'), { rim: 1.2, sheen: 0.5, cb: true })}
            <path d="M114 80H286M114 94H286" stroke="#000" strokeOpacity={0.25} strokeWidth={2} />
            {sol(c, rr(188, 52, 24, 150, 6), c.u('sv'), { rim: 0.8 })}
            {sol(c, rr(184, 196, 32, 18, 4), hw(c), { rim: 0.8, sheen: 0.6 })}
          </g>
        ) : (
          <g>
            <path d="M126 150C126 104 160 84 200 84C240 84 274 104 274 150" fill="none" stroke={c.P(-0.55)} strokeWidth={4} />
            <path d="M126 150C126 104 160 84 200 84C240 84 274 104 274 150" fill="none" stroke={c.u('mv')} strokeWidth={2} strokeDasharray="1.4 1.2" />
            {sol(c, rr(262, 146, 8, 22, 3), hw(c), { rim: 0.6 })}
            <rect x={263} y={166} width={6} height={12} rx={2} fill={c.A(0)} />
          </g>
        )}
        {/* front pocket */}
        {sol(c, rr(140, 214, 120, 104, 20), c.u('pc'), { rim: 1, sheen: 0.4, occ: 0.25, cb: true })}
        <path d={rr(146, 220, 108, 92, 16)} {...STITCH} />
        <path d="M146 232Q200 222 254 232" stroke={c.P(-0.55)} strokeWidth={3.5} fill="none" />
        <path d="M146 232Q200 222 254 232" stroke={c.u('mv')} strokeWidth={1.8} strokeDasharray="1.4 1.2" fill="none" />
        {sol(c, rr(232, 226, 7, 18, 2.5), hw(c), { rim: 0.5 })}
        <rect x={232.5} y={242} width={6} height={10} rx={2} fill={c.A(0)} />
        {sol(c, rr(180, 262, 40, 26, 6), c.u('sv'), { rim: 0.6 })}
        {mark(200, 275, 12, c.A(0.15), 0.85)}
      </g>
    ),
  };
};

// ───────────────────────────── sunglasses ─────────────────────────────

const LENSES = [
  // wayfarer (left lens)
  'M80 238C110 232 160 230 188 236C192 262 186 290 172 302C150 312 116 312 100 300C88 284 82 262 80 238Z',
  // aviator
  'M86 240C118 228 162 228 188 240C192 268 180 300 156 312C126 322 98 304 90 280C86 266 85 252 86 240Z',
  // round
  'M146 222A46 46 0 1 0 146.1 222Z',
  // shield (single lens drawn twice for symmetry)
  'M70 236C120 226 170 226 200 228V258C192 262 188 270 186 282C170 300 120 306 90 296C78 284 72 262 70 236Z',
];

const sunglasses: KindFn = (c) => {
  const v = c.v;
  const L = LENSES[v];
  const R = mirrorX(L);
  const thick = v === 0 || v === 3;
  const frame = v === 0 ? c.u('pv') : hw(c);
  const fw = thick ? 9 : 3.2;
  return {
    shadow: [200, 150, 10],
    el: (
      <g transform="translate(200 318) scale(1.14) translate(-200 -318)">
        <defs>
          {lin(c, 'tint', [[0, c.S(-0.25), 0.95], [0.55, c.S(-0.6), 0.92], [1, c.S(-0.4), 0.95]])}
          {lin(c, 'irid', [[0, c.A(0.2), 0.55], [0.5, '#ffffff', 0], [1, c.A(-0.1), 0.35]], 0, 0, 1, 1)}
        </defs>
        {/* temples, going back */}
        {[0, 1].map((i) => {
          const d = i ? 'M334 246L306 212C302 206 296 206 292 210L288 226' : 'M66 246L94 212C98 206 104 206 108 210L112 226';
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={thick ? c.P(-0.35) : c.M(-0.3)} strokeWidth={thick ? 8 : 3.5} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} />
            </g>
          );
        })}
        {[L, R].map((d, i) => (
          <g key={i}>
            <path d={d} fill={c.u('tint')} />
            <path d={d} fill={c.u('irid')} opacity={c.f === 'gloss' || c.f === 'gold' ? 1 : 0.5} />
            <path d={d} fill={c.u('sheen')} opacity={0.5} />
            <path d={d} fill="none" stroke={frame} strokeWidth={fw} strokeLinejoin="round" />
            <path d={d} fill="none" stroke={c.u('rim')} strokeWidth={1.2} opacity={c.k.rim} />
          </g>
        ))}
        {thick ? (
          <path d="M180 240Q200 230 220 240" fill="none" stroke={frame} strokeWidth={9} />
        ) : (
          <g>
            <path d="M186 246Q200 238 214 246" fill="none" stroke={frame} strokeWidth={3} />
            {v === 1 ? <path d="M174 234Q200 226 226 234" fill="none" stroke={frame} strokeWidth={2.5} /> : null}
            <circle cx={186} cy={268} r={3} fill="#fff" opacity={0.35} />
            <circle cx={214} cy={268} r={3} fill="#fff" opacity={0.35} />
          </g>
        )}
        {v === 0 ? <path d="M80 238C110 232 160 230 188 236M212 236C240 230 290 232 320 238" fill="none" stroke={c.P(0.2 + c.lift)} strokeOpacity={0.6} strokeWidth={2} /> : null}
        {[[72, 244], [328, 244]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} fill={hw(c)} />
        ))}
      </g>
    ),
  };
};

// ───────────────────────────── cap ─────────────────────────────

const cap: KindFn = (c) => {
  const flat = c.v % 2 === 1;
  const crown = flat
    ? 'M118 318C112 230 160 166 236 164C300 164 336 216 338 300C300 316 170 326 118 318Z'
    : 'M126 318C118 240 168 176 232 174C292 172 334 222 338 300C300 316 170 326 126 318Z';
  const brim = flat
    ? 'M128 300C100 298 60 300 38 308C40 316 46 322 60 322C110 324 170 318 214 314C190 304 160 300 128 300Z'
    : 'M136 300C102 296 64 304 46 320C44 328 58 332 78 330C118 328 170 322 210 318C190 306 162 300 136 300Z';
  const under = flat ? 'M38 308C40 316 46 322 60 322C110 324 170 318 214 314L214 318C170 324 110 330 60 328C48 328 40 322 38 308Z' : 'M46 320C44 328 58 332 78 330C118 328 170 322 210 318L210 322C170 328 118 334 78 334C60 334 46 330 46 320Z';
  const top: Pt = flat ? [238, 165] : [232, 175];
  return {
    shadow: [196, 150, 12],
    el: (
      <g>
        {sol(c, crown, c.u('pv'), { occ: 0.35, sheen: 0.4, cb: true, rim: 1.2 })}
        <path d={crown} fill={c.u('occh')} opacity={0.4} />
        {/* panel seams */}
        <path
          d={`M${top[0]} ${top[1]}C${top[0] - 50} ${top[1] + 20} ${flat ? 160 : 168} 250 ${flat ? 172 : 178} 322M${top[0]} ${top[1]}C${top[0] + 16} ${top[1] + 40} 270 250 268 318M${top[0]} ${top[1]}C${top[0] + 50} ${top[1] + 26} 320 230 330 304`}
          fill="none"
          stroke="#000"
          strokeOpacity={0.3}
          strokeWidth={1.6}
        />
        <path d={`M${top[0] - 4} ${top[1] + 4}C${top[0] - 50} ${top[1] + 26} ${flat ? 166 : 172} 250 ${flat ? 178 : 184} 320`} {...STITCH} />
        {[[206, 200], [282, 206]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.6} fill={c.P(-0.55)} stroke={c.P(0.2)} strokeOpacity={0.5} />
        ))}
        {sol(c, ell(top[0], top[1] + 1, 9, 4), c.u('pv'), { rim: 1 })}
        {/* front logo */}
        {mark(flat ? 180 : 184, 254, 26, c.A(0.1), 0.9)}
        {flat ? <path d="M300 262L334 254L336 290L304 296Z" fill="#000" opacity={0.45} /> : null}
        {/* brim */}
        <path d={under} fill={c.S(-0.15)} />
        {sol(c, brim, c.u('pv'), { rim: 1.3, sheen: 0.7, cb: true })}
        <path d={brim} fill={c.u('occh')} opacity={0.3} />
        <path d={flat ? 'M60 314C110 316 160 312 200 310' : 'M70 324C110 322 160 316 198 312'} {...STITCH} />
        {flat ? (
          <g>
            <ellipse cx={92} cy={311} rx={11} ry={4} fill={c.gold ? c.u('mv') : '#c9a34b'} />
            <ellipse cx={90} cy={310} rx={4} ry={1.4} fill="#fff" opacity={0.6} />
          </g>
        ) : null}
      </g>
    ),
  };
};

// ───────────────────────────── wallet ─────────────────────────────

const wallet: KindFn = (c) => {
  const v = c.v % 3;
  if (v === 1) {
    // upright card holder with cards peeking out
    const cards = [c.A(0), c.S(0.2), '#e8e4da'];
    return {
      shadow: [200, 104, 11],
      el: (
        <g>
          {cards.map((col, i) => (
            <g key={i} transform={`rotate(${-4 + i * 4} 200 300)`}>
              {sol(c, rr(132 + i * 6, 120 + i * 14, 136, 90, 8), col, { rim: 0.8, sheen: 0.5 })}
              <rect x={146 + i * 6} y={140 + i * 14} width={20} height={15} rx={3} fill={c.u('mv')} opacity={i === 0 ? 1 : 0} />
            </g>
          ))}
          <path d="M118 190H282L292 330H108Z" fill={c.P(-0.6)} />
          {sol(c, 'M112 196Q200 186 288 196L296 330H104Z', c.u('pv'), { occ: 0.35, sheen: 0.5, cb: true, rim: 1.2 })}
          <path d="M118 204Q200 194 282 204L290 322H110Z" {...STITCH} />
          <path d="M120 232Q200 222 280 232" stroke="#000" strokeOpacity={0.35} strokeWidth={2} fill="none" />
          {mark(200, 282, 20, c.gold ? c.M(0) : c.P(0.35), 0.7)}
        </g>
      ),
    };
  }
  if (v === 0) {
    // bifold opened like a book, standing on its edges: card slots + cards
    const panels: [Pt, Pt, Pt, Pt][] = [
      [[200, 156], [88, 178], [88, 326], [200, 302]],
      [[200, 156], [312, 178], [312, 326], [200, 302]],
    ];
    const cards = [c.A(0), c.S(0.25), '#e6e1d6'];
    return {
      shadow: [200, 124, 10],
      el: (
        <g>
          {panels.map((q, k) => {
            const dx = k ? 6 : -6;
            return (
              <g key={k}>
                <path d={poly(q[1], [q[1][0] + dx, q[1][1] + 3], [q[2][0] + dx, q[2][1] - 1], q[2])} fill={c.P(-0.5)} />
                {sol(c, poly(...q), c.u('pv'), { rim: 1.1, cb: true, side: k ? 0.25 : 0 })}
                {[0, 1, 2].map((i) => {
                  const vt = 0.12 + i * 0.2;
                  return (
                    <g key={i}>
                      <path d={subQuad(q, 0.1, vt - 0.08, 0.9, vt + 0.04)} fill={cards[i]} />
                      {sol(c, subQuad(q, 0.04, vt, 0.97, 0.95), c.P(0.04 + i * 0.05 + c.lift), { rim: 0.4, occ: 0.25 })}
                      <path d={`M${quadAt(q, 0.04, vt).join(' ')}L${quadAt(q, 0.97, vt).join(' ')}`} stroke="#fff" strokeOpacity={0.3} />
                    </g>
                  );
                })}
                <path d={poly(quadAt(q, 0.03, 0.03), quadAt(q, 0.97, 0.03), quadAt(q, 0.97, 0.97), quadAt(q, 0.03, 0.97))} {...STITCH} strokeOpacity={0.22} />
              </g>
            );
          })}
          <path d="M200 156V302" stroke={c.P(-0.6)} strokeWidth={3} />
          {mark(quadAt(panels[1], 0.5, 0.8)[0], quadAt(panels[1], 0.5, 0.8)[1], 12, c.gold ? c.M(0) : c.P(-0.35), 0.8)}
        </g>
      ),
    };
  }
  // zip-around wallet lying flat
  const pr = makeProj(200, 262, -10, 0.55);
  const W = 136, D = 84;
  const slab = prism(pr, rrPts(2 * W, 2 * D, 10, 3), 0, 14);
  return {
    shadow: [200, 150, 30, 262, -3],
    floor: 316,
    el: (
      <g>
        {block(c, slab.sides, slab.top, c.S, c.u('pv'), { rim: 1.2, sheen: 0.5, cb: true, dark: -0.05 })}
        <g transform={pr.plane(14)}>
          <path d={rr(-W + 10, -D + 10, 2 * W - 20, 2 * D - 20, 6)} {...STITCH} />
          <path d={rr(-W + 2, -D + 2, 2 * W - 4, 2 * D - 4, 8)} fill="none" stroke={c.S(-0.5)} strokeWidth={6} />
          <path d={rr(-W + 2, -D + 2, 2 * W - 4, 2 * D - 4, 8)} fill="none" stroke={hw(c)} strokeWidth={3.4} strokeDasharray="1.6 1.3" />
          {sol(c, rr(W - 6, -26, 12, 14, 3), hw(c), { rim: 0.7 })}
          {sol(c, rr(W + 4, -24, 30, 10, 5), c.u('sv'), { rim: 0.7 })}
          {mark(0, 0, 30, c.gold ? c.M(0) : c.P(0.35), 0.7)}
        </g>
      </g>
    ),
  };
};

export const fashion: Partial<Record<ArtKind, KindFn>> = {
  sneaker,
  hoodie,
  jacket,
  tee,
  bag,
  backpack,
  sunglasses,
  cap,
  wallet,
};
