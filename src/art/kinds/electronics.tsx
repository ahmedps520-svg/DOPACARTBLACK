import type { ArtKind } from '../../engine/types';
import { block, glow, lensEl, lin, mark, rad, sol, type Art, type Ctx, type KindFn } from '../kit';
import { ell, makeProj, mix, onEll, poly, prism, quadAt, quadGrid, rr, rrPts, smooth, subQuad, tone, type Pt } from '../shading';

type Quad = [Pt, Pt, Pt, Pt];
const qd = (q: Quad) => poly(...q);

/** Glowing abstract wallpaper used by screens. Expects to be clipped. */
function wallpaper(c: Ctx, x: number, y: number, w: number, h: number) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={c.u('scr')} />
      <ellipse cx={x + w * 0.62} cy={y + h * 0.3} rx={w * 0.62} ry={h * 0.42} fill={c.u('glow')} opacity={0.75} />
      <path
        d={`M${x} ${y + h * 0.72}C${x + w * 0.3} ${y + h * 0.5} ${x + w * 0.55} ${y + h * 0.95} ${x + w} ${y + h * 0.58}V${y + h}H${x}Z`}
        fill={c.S(0.15)}
        opacity={0.4}
      />
      <path
        d={`M${x} ${y + h * 0.82}C${x + w * 0.35} ${y + h * 0.66} ${x + w * 0.6} ${y + h * 1.02} ${x + w} ${y + h * 0.74}V${y + h}H${x}Z`}
        fill={c.A(-0.4)}
        opacity={0.5}
      />
    </g>
  );
}

// ───────────────────────────── phone ─────────────────────────────

const phone: KindFn = (c) => {
  const w = 122, h = 258, r = 26;
  const sx = 194, sy = 58; // screen phone (behind)
  const bx = 84, by = 72; // back phone (front)
  const clip = c.id('pscr');
  const glassD = rr(sx + 4, sy + 4, w - 8, h - 8, r - 3);
  const screenD = rr(sx + 8, sy + 8, w - 16, h - 16, r - 7);
  const lens = (x: number, y: number, rad = 11) => lensEl(c, bx + x, by + y, rad);
  const flash = (x: number, y: number) => (
    <g>
      <circle cx={bx + x} cy={by + y} r={4.5} fill={c.M(-0.2)} />
      <circle cx={bx + x} cy={by + y} r={3.2} fill="#fff6dc" opacity={0.9} />
    </g>
  );
  let cam;
  switch (c.v) {
    case 1:
      cam = (
        <g>
          {sol(c, rr(bx + 12, by + 12, 31, 68, 15.5), c.u('pv'), { rim: 1.3, sheen: 0.6 })}
          {lens(27.5, 29, 11)}
          {lens(27.5, 62, 11)}
          {flash(55, 22)}
        </g>
      );
      break;
    case 2:
      cam = (
        <g>
          {sol(c, rr(bx + 4, by + 34, w - 8, 36, 18), c.u('gl'), { rim: 1.4, sheen: 0.8 })}
          {lens(30, 52, 11)}
          {lens(58, 52, 11)}
          {flash(88, 52)}
        </g>
      );
      break;
    case 3:
      cam = (
        <g>
          <circle cx={bx + 50} cy={by + 54} r={40} fill={c.u('mc')} />
          {sol(c, ell(bx + 50, by + 54, 36), c.u('gl'), { rim: 1.2, sheen: 0.6 })}
          {lens(36, 40, 10.5)}
          {lens(64, 40, 10.5)}
          {lens(36, 68, 10.5)}
          {lens(64, 68, 10.5)}
        </g>
      );
      break;
    default:
      cam = (
        <g>
          {sol(c, rr(bx + 11, by + 11, 60, 60, 17), c.u('pv'), { rim: 1.3, sheen: 0.6 })}
          <path d={rr(bx + 11, by + 11, 60, 60, 17)} fill="#fff" opacity={0.05} />
          {lens(27, 27)}
          {lens(27, 55)}
          {lens(55, 41)}
          {flash(55, 20)}
        </g>
      );
  }
  return {
    shadow: [202, 126, 12],
    el: (
      <g>
        <defs>
          <clipPath id={clip}>
            <path d={screenD} />
          </clipPath>
        </defs>
        {/* front-facing phone, behind */}
        <path d={rr(sx + 5, sy + 3, w, h, r)} fill={c.M(-0.55)} />
        {sol(c, rr(sx, sy, w, h, r), c.u('mc'), { rim: 1.2 })}
        <path d={glassD} fill="#030304" />
        <g clipPath={`url(#${clip})`}>
          {wallpaper(c, sx, sy, w, h)}
          <rect x={sx + 22} y={sy + 46} width={50} height={14} rx={4} fill="#fff" opacity={0.9} />
          <rect x={sx + 22} y={sy + 66} width={32} height={5} rx={2.5} fill="#fff" opacity={0.45} />
          <rect x={sx + 18} y={sy + 150} width={40} height={40} rx={10} fill="#fff" opacity={0.1} />
          <rect x={sx + 64} y={sy + 150} width={40} height={40} rx={10} fill="#fff" opacity={0.1} />
          <rect x={sx + 15} y={sy + h - 46} width={w - 30} height={28} rx={13} fill="#fff" opacity={0.14} />
          {[c.A(0.15), c.S(0.35), '#f2f2f2', c.A(-0.25)].map((col, i) => (
            <rect key={i} x={sx + 21 + i * 21.5} y={sy + h - 41} width={17} height={17} rx={5} fill={col} opacity={0.9} />
          ))}
        </g>
        <rect x={sx + w / 2 - 17} y={sy + 15} width={34} height={10} rx={5} fill="#000" />
        <path d={glassD} fill={c.u('sheen')} opacity={0.3} />
        {/* back of phone, in front */}
        <path d={rr(bx + 5, by + 3, w, h, r)} fill={c.M(-0.6)} />
        {sol(c, rr(bx, by, w, h, r), c.u('mc'), { rim: 1.2 })}
        {sol(c, rr(bx + 4, by + 4, w - 8, h - 8, r - 3), c.u('pv'), { sheen: 0.9, cb: true, rim: 0.6, occ: 0.3 })}
        {cam}
        {mark(bx + w / 2, by + 160, 18, c.M(0.25), 0.75)}
      </g>
    ),
  };
};

// ───────────────────────────── laptop ─────────────────────────────

const laptop: KindFn = (c) => {
  const gaming = c.v % 2 === 1;
  const lid: Quad = [[100, 64], [300, 64], [306, 250], [94, 250]];
  const deck: Quad = [[94, 254], [306, 254], [352, 312], [48, 312]];
  const bz = gaming ? 0.045 : 0.03;
  const scr: Quad = [quadAt(lid, bz, bz * 1.3), quadAt(lid, 1 - bz, bz * 1.3), quadAt(lid, 1 - bz, 1 - bz * 1.6), quadAt(lid, bz, 1 - bz * 1.6)];
  const inner: Quad = [quadAt(lid, 0.012, 0.012), quadAt(lid, 0.988, 0.012), quadAt(lid, 0.988, 0.995), quadAt(lid, 0.012, 0.995)];
  const clip = c.id('lscr');
  const kb: [number, number, number, number] = [0.1, 0.08, 0.9, 0.56];
  const keys = quadGrid(deck, [14, 14, 13, 12, 10], 5, 0.2, kb);
  const keyTops = quadGrid(deck, [14, 14, 13, 12, 10], 5, 0.36, [kb[0], kb[1] - 0.006, kb[2], kb[3] - 0.006]);
  const [sx, sy] = scr[0];
  const sw = scr[2][0] - scr[3][0];
  const sh = scr[2][1] - scr[0][1];
  return {
    shadow: [200, 168, 12],
    el: (
      <g>
        <defs>
          <clipPath id={clip}>
            <path d={qd(scr)} />
          </clipPath>
        </defs>
        {sol(c, qd(lid), c.u('pv'), { rim: 1.3, cb: true })}
        <path d={qd(inner)} fill="#060607" />
        <g clipPath={`url(#${clip})`}>
          {wallpaper(c, sx - 8, sy, sw + 16, sh)}
          <rect x={sx + 14} y={sy + 14} width={sw * 0.42} height={sh * 0.42} rx={5} fill="#fff" opacity={0.1} />
          <rect x={sx + 20} y={sy + 22} width={sw * 0.22} height={5} rx={2.5} fill="#fff" opacity={0.5} />
          <rect x={sx + sw * 0.32} y={sh + sy - 18} width={sw * 0.36} height={11} rx={5.5} fill="#fff" opacity={0.18} />
        </g>
        <path d={qd(scr)} fill={c.u('sheen')} opacity={0.22} />
        <circle cx={200} cy={lid[0][1] + 4.5} r={1.6} fill="#222" />
        {/* hinge */}
        <path d={poly([96, 249], [304, 249], [306, 256], [94, 256])} fill={c.P(-0.65)} />
        {/* deck */}
        {sol(c, qd(deck), c.u('pv'), { sheen: 0.35, cb: true, rim: 1.1 })}
        <path d={subQuad(deck, kb[0] - 0.012, kb[1] - 0.025, kb[2] + 0.012, kb[3] + 0.02)} fill={c.P(-0.55)} opacity={0.85} />
        {gaming ? <path d={subQuad(deck, kb[0], kb[1], kb[2], kb[3])} fill={c.u('glow')} opacity={0.8} /> : null}
        <path d={keys} fill={gaming ? '#0b0b0e' : c.P(-0.72)} stroke={gaming ? c.A(0.2) : 'none'} strokeWidth={0.5} strokeOpacity={0.8} />
        <path d={keyTops} fill="#fff" opacity={0.06} />
        {sol(c, subQuad(deck, 0.37, 0.64, 0.63, 0.94), c.u('pv'), { rim: 0.6, edge: c.P(-0.25) })}
        {/* front lip */}
        <path d="M48 312H352Q352 322 343 322H57Q48 322 48 312Z" fill={c.P(-0.35)} />
        <path d="M48 312H352" stroke="#fff" strokeOpacity={0.35} strokeWidth={1} />
        <path d="M184 312h32q-2 4 -6 4h-20q-4 0 -6 -4z" fill={c.P(-0.6)} />
        {gaming ? (
          <g>
            <path d="M70 318H330" stroke={c.A(0.3)} strokeWidth={2} strokeLinecap="round" />
            {glow(c, 200, 318, 150, 8, 0.6)}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={subQuad(deck, 0.18 + i * 0.11, 0.015, 0.25 + i * 0.11, 0.045)} fill={c.P(-0.7)} />
            ))}
          </g>
        ) : null}
      </g>
    ),
  };
};

// ───────────────────────────── gpu ─────────────────────────────

function fan(c: Ctx, cx: number, cy: number, R: number, key: number) {
  const hub = R * 0.3;
  const blade = `M${hub} ${-hub * 0.35}C${R * 0.5} ${-R * 0.42} ${R * 0.86} ${-R * 0.28} ${R * 0.98} ${R * 0.06}C${R * 0.74} ${R * 0.02} ${R * 0.5} ${R * 0.1} ${hub} ${hub * 0.5}Z`;
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={R + 5} fill={c.S(-0.55)} />
      <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke={c.u('mv')} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={R} fill="#050506" />
      <g transform={`translate(${cx} ${cy})`}>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={blade} transform={`rotate(${i * 40 + key * 13})`} fill={c.P(-0.35)} stroke="#fff" strokeOpacity={0.13} strokeWidth={0.8} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={R} fill={c.u('occ')} opacity={0.5} />
      <circle cx={cx} cy={cy} r={hub + 1} fill={c.u('mv')} />
      <circle cx={cx} cy={cy} r={hub * 0.7} fill={c.P(-0.45)} />
      {mark(cx, cy, hub * 0.7, c.A(0.2), 0.8)}
    </g>
  );
}

const gpu: KindFn = (c) => {
  const x = 56, y = 184, w = 292, h = 130;
  const v = c.v % 3;
  const tx = 16, ty = -15;
  const top = poly([x + 6, y], [x + w - 6, y], [x + w - 6 + tx, y + ty], [x + 6 + tx, y + ty]);
  const side = poly([x + w - 6, y], [x + w - 6 + tx, y + ty], [x + w + tx - 4, y + h + ty - 4], [x + w - 4, y + h]);
  const cy = y + h / 2;
  const fans =
    v === 1
      ? [fan(c, 134, cy, 52, 0), fan(c, 270, cy, 52, 1)]
      : v === 2
        ? [fan(c, 284, cy, 48, 0)]
        : [fan(c, 108, cy, 40, 0), fan(c, 202, cy, 40, 1), fan(c, 296, cy, 40, 2)];
  return {
    shadow: [204, 156, 11],
    el: (
      <g>
        {/* bracket */}
        {sol(c, poly([x - 14, y - 10], [x - 2, y - 18], [x - 2, 322], [x - 14, 330]), c.u('mh'), { rim: 0.8 })}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={rr(x - 11, y + 4 + i * 18, 6, 12, 2)} fill="#050506" />
        ))}
        {/* pcb + fingers */}
        <path d={rr(x + 6, y + h - 6, w - 20, 14, 2)} fill={c.S(-0.6)} />
        <path d={rr(x + 70, y + h + 4, 130, 10, 1.5)} fill={c.u('mv')} />
        <path d={rr(x + 70, y + h + 4, 130, 10, 1.5)} fill="#d6a640" opacity={c.gold ? 0 : 0.85} />
        {sol(c, side, c.u('ph'), { side: 0.6, rim: 0.6 })}
        {sol(c, top, c.u('pv'), { rim: 1.3 })}
        <path d={poly([x + 30, y - 4], [x + w - 30, y - 4], [x + w - 26, y - 8], [x + 34, y - 8])} fill={c.A(0.35)} />
        {glow(c, x + w / 2, y - 6, w * 0.46, 12, 0.7)}
        {/* shroud */}
        {sol(c, rr(x, y, w, h, 8), c.u('pv'), { sheen: 0.6, cb: true, occ: 0.25, rim: 1.1 })}
        <path d={poly([x, y + 22], [x + 34, y], [x + 70, y], [x, y + 58])} fill={c.S(0)} opacity={0.75} />
        <path d={poly([x + w, y + h - 22], [x + w - 34, y + h], [x + w - 80, y + h], [x + w, y + h - 64])} fill={c.S(0)} opacity={0.75} />
        {v === 2 ? (
          <g>
            <path d={rr(x + 18, y + 18, 168, h - 36, 6)} fill="#060607" />
            <path
              d={Array.from({ length: 30 }, (_, i) => `M${x + 24 + i * 5.4} ${y + 22}V${y + h - 22}`).join('')}
              stroke={c.u('mv')}
              strokeWidth={2.4}
            />
            <path d={rr(x + 18, y + 18, 168, h - 36, 6)} fill={c.u('occ')} opacity={0.6} />
            <path d={rr(x + 18, y + 18, 168, h - 36, 6)} fill="none" stroke={c.u('mv')} strokeWidth={2} />
          </g>
        ) : null}
        <path d={`M${x + 12} ${y + h - 10}L${x + 60} ${y + h - 10}L${x + 72} ${y + h - 20}`} stroke={c.A(0.2)} strokeWidth={2} fill="none" />
        <path d={`M${x + w - 12} ${y + 10}L${x + w - 60} ${y + 10}L${x + w - 72} ${y + 20}`} stroke={c.A(0.2)} strokeWidth={2} fill="none" />
        {fans}
      </g>
    ),
  };
};


// ───────────────────────────── headphones ─────────────────────────────

/** Filled arch between two concentric half-ellipses, optionally only between two angles. */
function arch(cx: number, cy: number, orx: number, ory: number, irx: number, iry: number, a0 = 180, a1 = 360) {
  const [ox0, oy0] = onEll(cx, cy, orx, ory, a0);
  const [ox1, oy1] = onEll(cx, cy, orx, ory, a1);
  const [ix0, iy0] = onEll(cx, cy, irx, iry, a0);
  const [ix1, iy1] = onEll(cx, cy, irx, iry, a1);
  return `M${ox0} ${oy0}A${orx} ${ory} 0 0 1 ${ox1} ${oy1}L${ix1} ${iy1}A${irx} ${iry} 0 0 0 ${ix0} ${iy0}Z`;
}

const headphones: KindFn = (c) => {
  const v = c.v % 3;
  const L = 116, R = 284;
  const cy = v === 2 ? 280 : 272;
  const bandCy = 200;
  const cupRx = v === 2 ? 46 : 40;
  const cupRy = v === 2 ? 48 : 57;
  const cup = (x: number, side: -1 | 1) => {
    const inward = -side;
    if (v === 1) {
      return (
        <g>
          {sol(c, rr(x - 30 + inward * 15, cy - 54, 60, 112, 26), c.u('sv'), { rim: 0.6, occ: 0.45 })}
          <path d={rr(x - 36 + side * 5, cy - 57, 72, 116, 28)} fill={c.P(-0.55)} />
          {sol(c, rr(x - 36, cy - 59, 72, 118, 28), c.u('pc'), { sheen: 0.7, cb: true, rim: 1.2 })}
          <path d={rr(x - 30, cy - 53, 60, 106, 24)} fill="none" stroke="#fff" strokeOpacity={0.12} />
          {mark(x, cy, 12, c.P(0.45), 0.5)}
        </g>
      );
    }
    return (
      <g>
        {/* fork around the outer face */}
        <path
          d={`M${x - cupRx - 5} ${cy + 4}C${x - cupRx - 6} ${cy - cupRy - 22} ${x + cupRx + 6} ${cy - cupRy - 22} ${x + cupRx + 5} ${cy + 4}`}
          fill="none"
          stroke={c.u('mc')}
          strokeWidth={5}
          strokeLinecap="round"
        />
        {sol(c, ell(x + inward * 16, cy, cupRx - 6, cupRy - 3), c.u('sc'), { rim: 0.7, occ: 0.35 })}
        <path d={ell(x + side * 6, cy + 1, cupRx, cupRy)} fill={c.P(-0.6)} />
        {sol(c, ell(x, cy, cupRx, cupRy), c.u('pc'), { sheen: 0.8, cb: true, rim: 1.2, occ: 0.2 })}
        <ellipse cx={x} cy={cy} rx={cupRx * 0.66} ry={cupRy * 0.7} fill="none" stroke={c.u('mv')} strokeWidth={3} />
        {mark(x, cy, 13, c.M(0.3), 0.6)}
        <circle cx={x - cupRx - 4} cy={cy + 2} r={3.2} fill={c.u('mv')} />
        <circle cx={x + cupRx + 4} cy={cy + 2} r={3.2} fill={c.u('mv')} />
        <circle cx={x + side * cupRx * 0.62} cy={cy + cupRy * 0.48} r={2} fill={c.A(0.3)} />
      </g>
    );
  };
  const slider = (x: number) =>
    sol(c, rr(x - 4.5, bandCy - 6, 9, v === 1 ? cy - 59 - bandCy + 10 : cy - cupRy - bandCy - 8, 3), c.u('mc'), { rim: 0.8 });
  const bx = 200 - L; // band half-span at its ends
  const band =
    v === 1 ? (
      <g>
        {sol(c, arch(200, bandCy, bx + 4, 142, bx - 2, 136), c.u('mv'), { rim: 1 })}
        {sol(c, arch(200, bandCy + 16, bx - 6, 136, bx - 18, 124, 195, 345), c.u('sv'), { rim: 0.8, occ: 0.3 })}
      </g>
    ) : v === 2 ? (
      <g>
        {sol(c, arch(200, bandCy, bx + 4, 140, bx - 2, 134), c.u('mv'), { rim: 1 })}
        {sol(c, arch(200, bandCy, bx - 2, 134, bx - 16, 120, 200, 340), c.u('pv'), { rim: 1, sheen: 0.4 })}
      </g>
    ) : (
      <g>
        {sol(c, arch(200, bandCy, bx + 8, 146, bx - 8, 130), c.u('pv'), { rim: 1.2, sheen: 0.6, cb: true })}
        {sol(c, arch(200, bandCy, bx - 8, 130, bx - 16, 122, 200, 340), c.u('sv'), { rim: 0.5 })}
      </g>
    );
  return {
    shadow: [200, 132, 11],
    el: (
      <g>
        {slider(L)}
        {slider(R)}
        {band}
        {cup(L, -1)}
        {cup(R, 1)}
      </g>
    ),
  };
};

// ───────────────────────────── console ─────────────────────────────

const consoleTower = (c: Ctx): Art => {
  const pr = makeProj(200, 310, 26, 0.3);
  const W = 50, D = 50, H = 236;
  const fTL = pr(-W, D, H), fTR = pr(W, D, H), bTR = pr(W, -D, H), bTL = pr(-W, -D, H);
  return {
    shadow: [204, 92, 12],
    el: (
      <g>
        <g transform={pr.uplane(W)}>
          {sol(c, rr(-D, -H, 2 * D, H, 3), c.u('ph'), { side: 0.7, cb: true, rim: 0.7 })}
          <path d={Array.from({ length: 7 }, (_, i) => `M${-D + 14 + i * 12} ${-H + 16}v40`).join('')} stroke="#000" strokeOpacity={0.45} strokeWidth={4} strokeLinecap="round" />
        </g>
        <g transform={pr.vplane(D)}>
          {sol(c, rr(-W, -H, 2 * W, H, 3), c.u('pv'), { sheen: 0.7, cb: true, occ: 0.3, rim: 1.1 })}
          <rect x={-W + 12} y={-H + 46} width={2 * W - 24} height={3} rx={1.5} fill="#000" opacity={0.75} />
          <rect x={-W + 12} y={-H + 49} width={2 * W - 24} height={1} fill="#fff" opacity={0.15} />
          <circle cx={-W + 14} cy={-H + 18} r={3.2} fill={c.A(0.4)} />
          {glow(c, -W + 14, -H + 18, 12, 12, 0.8)}
          <rect x={-W + 10} y={-34} width={12} height={5} rx={1.5} fill="#000" opacity={0.7} />
          <rect x={-W + 26} y={-34} width={12} height={5} rx={1.5} fill="#000" opacity={0.7} />
          {mark(W - 16, -20, 9, c.P(0.4), 0.5)}
        </g>
        {sol(c, poly(fTL, fTR, bTR, bTL), c.u('pv'), { rim: 1.4 })}
        <g transform={pr.plane(H)}>
          <circle r={40} fill="#050506" />
          <circle r={40} fill={c.u('glow')} opacity={0.75} />
          {[12, 19, 26, 33, 40].map((r) => (
            <circle key={r} r={r} fill="none" stroke={c.P(-0.5)} strokeWidth={3.2} />
          ))}
          <circle r={41} fill="none" stroke="#fff" strokeOpacity={0.25} />
        </g>
      </g>
    ),
  };
};

const consoleSlab = (c: Ctx): Art => {
  const pr = makeProj(200, 276, 22, 0.45);
  const W = 120, D = 80, H = 60;
  const top = poly(pr(-W, D, H), pr(W, D, H), pr(W, -D, H), pr(-W, -D, H));
  return {
    shadow: [204, 150, 14],
    el: (
      <g>
        <g transform={pr.uplane(W)}>{sol(c, rr(-D, -H, 2 * D, H, 3), c.u('ph'), { side: 0.7, cb: true, rim: 0.7 })}</g>
        <g transform={pr.vplane(D)}>
          {sol(c, rr(-W, -H, 2 * W, H, 3), c.u('pv'), { sheen: 0.6, cb: true, occ: 0.35, rim: 1 })}
          <rect x={-W + 14} y={-H + 22} width={110} height={3} rx={1.5} fill="#000" opacity={0.7} />
          <circle cx={W - 18} cy={-H + 22} r={3} fill={c.A(0.4)} />
          {glow(c, W - 18, -H + 22, 12, 12, 0.8)}
          <rect x={-W + 14} y={-18} width={12} height={5} rx={1.5} fill="#000" opacity={0.7} />
        </g>
        {sol(c, top, c.u('pv'), { rim: 1.3, sheen: 0.4, cb: true })}
        <g transform={pr.plane(H)}>
          <circle cx={58} cy={-6} r={48} fill="#060607" />
          <circle cx={58} cy={-6} r={48} fill={c.u('glow')} opacity={0.35} />
          {[14, 22, 30, 38, 46].map((r) => (
            <circle key={r} cx={58} cy={-6} r={r} fill="none" stroke={c.P(-0.45)} strokeWidth={3} />
          ))}
          <circle cx={58} cy={-6} r={49} fill="none" stroke="#fff" strokeOpacity={0.3} />
          <g transform="translate(-70 30)">{mark(0, 0, 14, c.P(-0.3), 0.6)}</g>
        </g>
      </g>
    ),
  };
};

const consoleHandheld = (c: Ctx): Art => {
  const clip = c.id('hscr');
  const btn = (x: number, y: number, col: string, key: number) => (
    <g key={key}>
      <circle cx={x} cy={y} r={5.2} fill={col} />
      <circle cx={x - 1.2} cy={y - 1.5} r={2} fill="#fff" opacity={0.35} />
    </g>
  );
  const stick = (x: number, y: number) => (
    <g>
      <circle cx={x} cy={y + 2} r={12} fill="#000" opacity={0.5} />
      <circle cx={x} cy={y} r={11.5} fill="#16161a" />
      <circle cx={x} cy={y - 1} r={8.5} fill="#24242a" />
      <ellipse cx={x - 2} cy={y - 4} rx={5} ry={2.5} fill="#fff" opacity={0.15} />
    </g>
  );
  const jl = 'M124 146H100A26 26 0 0 0 74 172V246A26 26 0 0 0 100 272H124Z';
  const jr = 'M276 146H300A26 26 0 0 1 326 172V246A26 26 0 0 1 300 272H276Z';
  return {
    shadow: [200, 120, 11],
    el: (
      <g>
        <defs>
          <clipPath id={clip}>
            <rect x={130} y={154} width={140} height={100} rx={3} />
          </clipPath>
        </defs>
        {sol(c, rr(120, 146, 160, 124, 6), '#0d0d10', { rim: 1.2 })}
        <g clipPath={`url(#${clip})`}>{wallpaper(c, 130, 154, 140, 100)}</g>
        <rect x={130} y={154} width={140} height={100} rx={3} fill={c.u('sheen')} opacity={0.25} />
        {sol(c, jl, c.u('pc'), { sheen: 0.8, cb: true, rim: 1.2 })}
        {sol(c, jr, c.u('av'), { sheen: 0.8, rim: 1.2 })}
        <path d={jr} fill={c.u('occh')} opacity={0.35} />
        {stick(99, 178)}
        {[0, 1, 2, 3].map((i) => btn(99 + [0, 10, 0, -10][i], 226 + [-10, 0, 10, 0][i], '#1a1a1e', i))}
        {[0, 1, 2, 3].map((i) => btn(301 + [0, 10, 0, -10][i], 180 + [-10, 0, 10, 0][i], '#1a1a1e', i + 4))}
        {stick(301, 228)}
        <rect x={110} y={154} width={8} height={2.5} rx={1} fill="#111" />
        <circle cx={290} cy={258} r={4} fill="#202024" />
        {/* dock */}
        {sol(c, rr(128, 244, 144, 86, 10), c.u('sv'), { sheen: 0.4, occ: 0.4, rim: 1.1 })}
        <path d="M134 244H266" stroke="#fff" strokeOpacity={0.35} />
        {mark(150, 312, 10, c.S(0.5), 0.5)}
        <circle cx={256} cy={316} r={2.2} fill={c.A(0.3)} />
        {glow(c, 256, 316, 8, 8, 0.8)}
      </g>
    ),
  };
};

const consoleWinged = (c: Ctx): Art => {
  const wingL: Pt[] = [[187, 324], [160, 324], [155, 280], [148, 200], [138, 120], [134, 76], [146, 60], [172, 66], [185, 84]];
  const wingR = wingL.map(([x, y]) => [400 - x, y] as Pt).reverse();
  return {
    shadow: [200, 82, 10],
    el: (
      <g>
        <ellipse cx={200} cy={325} rx={44} ry={6} fill="#0c0c0f" />
        {sol(c, rr(183, 70, 34, 256, 8), '#0b0b0e', { rim: 1, sheen: 0.6 })}
        <path d={Array.from({ length: 22 }, (_, i) => `M192 ${92 + i * 10}h16`).join('')} stroke="#000" strokeWidth={4} opacity={0.6} />
        {sol(c, smooth(wingL), c.u('pc'), { sheen: 0.9, cb: true, rim: 1.2, occ: 0.15 })}
        {sol(c, smooth(wingR), c.u('pc'), { sheen: 0.5, cb: true, rim: 1, side: 0.5 })}
        <path d="M186 88L188 320M214 88L212 320" stroke={c.A(0.35)} strokeWidth={1.8} />
        {glow(c, 200, 200, 22, 130, 0.35)}
        <circle cx={200} cy={290} r={2.4} fill={c.A(0.5)} />
      </g>
    ),
  };
};

const consoleKind: KindFn = (c) => [consoleTower, consoleSlab, consoleHandheld, consoleWinged][c.v](c);

// ───────────────────────────── earbuds ─────────────────────────────

const earbuds: KindFn = (c) => {
  const round = c.v % 2 === 1;
  const squareCase = c.v >= 2;
  const caseD = squareCase ? rr(132, 212, 136, 116, 30) : rr(124, 210, 152, 118, 52);
  const x0 = squareCase ? 133 : 128;
  const x1 = 400 - x0;
  const stemBud = (x: number, side: -1 | 1) => (
    <g transform={`translate(${x} 250) rotate(${side * -12})`}>
      {sol(c, ell(-side * 15, -4, 11, 13), c.u('sc'), { rim: 0.6 })}
      {sol(c, rr(-8.5, 4, 17, 66, 8.5), c.u('pc'), { sheen: 0.8, cb: true, rim: 1 })}
      {sol(c, ell(0, 0, 23, 20), c.u('pv'), { sheen: 0.9, cb: true, rim: 1.2 })}
      <ellipse cx={side * 7} cy={-6} rx={6} ry={3} fill="#0a0a0c" opacity={0.85} />
      <circle cx={0} cy={64} r={3} fill={c.u('mv')} />
    </g>
  );
  const roundBud = (x: number, side: -1 | 1) => (
    <g>
      {sol(c, ell(x - side * 22, 270, 13, 15), c.u('sc'), { rim: 0.6 })}
      {sol(c, ell(x, 294, 32, 32), c.u('pv'), { sheen: 0.9, cb: true, rim: 1.2, occ: 0.25 })}
      {sol(c, ell(x + side * 5, 292, 21, 22), c.u('pc'), { sheen: 1, rim: 0.8 })}
      <ellipse cx={x + side * 5} cy={292} rx={21} ry={22} fill="none" stroke={c.u('mv')} strokeWidth={2} />
      <circle cx={x + side * 5} cy={292} r={3} fill={c.A(0.3)} />
    </g>
  );
  return {
    shadow: [200, 146, 12],
    el: (
      <g transform="translate(200 328) scale(1.14) translate(-200 -328)">
        {sol(c, caseD, c.u('pv'), { sheen: 1, cb: true, occ: 0.3, rim: 1.2 })}
        <path d={`M${x0} 252Q200 258 ${x1} 252`} fill="none" stroke={c.P(-0.45)} strokeWidth={1.6} />
        <path d={`M${x0 + 2} 254Q200 260 ${x1 - 2} 254`} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1} />
        <circle cx={200} cy={292} r={2.6} fill={c.A(0.45)} />
        {glow(c, 200, 292, 11, 11, 0.9)}
        {round ? roundBud(86, -1) : stemBud(92, -1)}
        {round ? roundBud(314, 1) : stemBud(308, 1)}
      </g>
    ),
  };
};

// ───────────────────────────── camera ─────────────────────────────

const camera: KindFn = (c) => {
  const ranger = c.v % 2 === 1;
  const dial = (x: number, y: number, w: number, h: number) => (
    <g>
      {sol(c, rr(x - w / 2, y, w, h, 2), c.u('mc'), { rim: 0.8 })}
      <path d={Array.from({ length: Math.floor(w / 3) }, (_, i) => `M${x - w / 2 + 2 + i * 3} ${y + 2}v${h - 4}`).join('')} stroke="#000" strokeOpacity={0.35} />
      <ellipse cx={x} cy={y} rx={w / 2} ry={3} fill={c.M(0.35)} />
    </g>
  );
  const ridges = (cx: number, cy: number, r: number, w: number) => (
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeOpacity={0.55} strokeWidth={w} strokeDasharray="1.6 2.2" />
  );
  if (ranger) {
    return {
      shadow: [200, 140, 12],
      el: (
        <g>
          {dial(102, 166, 26, 12)}
          {dial(268, 164, 34, 14)}
          {sol(c, rr(292, 166, 14, 8, 3), c.u('mc'), { rim: 0.6 })}
          {sol(c, rr(68, 176, 264, 150, 16), c.u('sv'), { occ: 0.35, rim: 1.1 })}
          <path d={rr(68, 176, 264, 150, 16)} fill={c.u('carbon')} opacity={0.6} />
          {sol(c, 'M84 176H316A16 16 0 0 1 332 192V222H68V192A16 16 0 0 1 84 176Z', c.u('mv'), { rim: 1.3, sheen: 0.5 })}
          {sol(c, 'M68 302H332V310A16 16 0 0 1 316 326H84A16 16 0 0 1 68 310Z', c.u('mv'), { rim: 0.4 })}
          {sol(c, rr(88, 188, 42, 24, 3), c.u('gl'), { rim: 0.8, sheen: 1 })}
          {sol(c, rr(248, 190, 22, 18, 3), c.u('gl'), { rim: 0.8, sheen: 1 })}
          <rect x={280} y={192} width={20} height={14} rx={2} fill="#fffaf0" opacity={0.18} />
          {sol(c, ell(198, 266, 60), c.u('mc'), { rim: 1 })}
          {sol(c, ell(198, 266, 52), c.u('pc'), { rim: 0.6, cb: true })}
          {ridges(198, 266, 49, 5)}
          {lensEl(c, 198, 266, 40, '#141416')}
          <circle cx={198} cy={266} r={43} fill="none" stroke={c.A(0.1)} strokeWidth={1.4} />
          {mark(198, 198, 10, c.M(-0.5), 0.7)}
        </g>
      ),
    };
  }
  const hump = 'M164 178L180 132Q182 126 188 126H236Q242 126 244 132L260 178Z';
  return {
    shadow: [200, 140, 12],
    el: (
      <g>
        {sol(c, rr(198, 118, 30, 9, 2), c.u('mc'), { rim: 0.6 })}
        {dial(282, 162, 36, 14)}
        {sol(c, rr(78, 174, 244, 152, 20), c.u('pv'), { occ: 0.3, sheen: 0.4, cb: true, rim: 1.1 })}
        {sol(c, hump, c.u('pv'), { rim: 1.3, sheen: 0.5, cb: true })}
        <path d="M164 178L260 178" stroke="#000" strokeOpacity={0.3} />
        {sol(c, rr(78, 174, 66, 152, 22), c.u('sc'), { rim: 0.9, side: 0.3 })}
        <path d={rr(78, 174, 66, 152, 22)} fill={c.u('carbon')} opacity={0.5} />
        {dial(112, 166, 22, 10)}
        <ellipse cx={112} cy={166} rx={9} ry={3} fill={c.A(-0.1)} />
        <circle cx={160} cy={196} r={4} fill="#120806" />
        <circle cx={160} cy={196} r={2} fill={c.A(0.2)} opacity={0.8} />
        {mark(212, 150, 12, c.P(0.45), 0.6)}
        {sol(c, ell(214, 252, 74), c.u('mc'), { rim: 1.1 })}
        {sol(c, ell(214, 252, 67), c.u('pc'), { rim: 0.5 })}
        <circle cx={214} cy={252} r={67} fill="#0c0c0e" opacity={0.65} />
        {ridges(214, 252, 61, 9)}
        <circle cx={214} cy={252} r={53} fill="#0a0a0c" />
        <circle cx={214} cy={252} r={52} fill="none" stroke={c.A(0)} strokeWidth={1.8} />
        {lensEl(c, 214, 252, 47, '#141416')}
      </g>
    ),
  };
};

// ───────────────────────────── cpu ─────────────────────────────

const cpu: KindFn = (c) => {
  const pr = makeProj(200, 250, 28, 0.56);
  const s = 104;
  const pcb = tone(mix(c.P.base, '#0f1d18', 0.6));
  const sub = prism(pr, [[-s, -s], [s, -s], [s, s], [-s, s]], 0, 10);
  const notch = (h: number, n: number, d: number): Pt[] => [
    [-h, -h], [-n, -h], [-n, -h + d], [n, -h + d], [n, -h], [h, -h], [h, -n], [h - d, -n], [h - d, n], [h, n],
    [h, h], [n, h], [n, h - d], [-n, h - d], [-n, h], [-h, h], [-h, n], [-h + d, n], [-h + d, -n], [-h, -n],
  ];
  const v = c.v % 3;
  const ihsPts: Pt[] = v === 1 ? notch(74, 24, 10) : v === 2 ? rrPts(94, 120, 4, 2) : rrPts(140, 162, 8, 3);
  const z1 = v === 2 ? 14 : 26;
  const ihs = prism(pr, ihsPts, 10, z1);
  const caps = Array.from({ length: 11 }, (_, i) => [-80 + i * 16, 92] as Pt).concat(Array.from({ length: 11 }, (_, i) => [92, -80 + i * 16] as Pt));
  return {
    shadow: [200, 140, 18],
    el: (
      <g>
        {block(c, sub.sides, sub.top, pcb, pcb.base, { rim: 1.2, dark: -0.25 })}
        <path d={sub.top} fill={c.u('occ')} opacity={0.3} />
        <g transform={pr.plane(10)}>
          {caps.map(([u, vv], i) => (
            <rect key={i} x={u - 2.5} y={vv - 1.5} width={5} height={3} fill={i % 3 ? '#b8915a' : '#3a3a3e'} />
          ))}
          <path d={`M${-s + 6} ${s - 6}l14 0l-14 -14z`} fill={c.u('mv')} />
          <path d={`M${-s + 6} ${s - 6}l14 0l-14 -14z`} fill="#d4a94c" opacity={0.8} />
        </g>
        {block(c, ihs.sides, ihs.top, v === 2 ? tone('#0b0c10') : c.M, v === 2 ? '#0c0d12' : c.u('mv'), { rim: 1.3, sheen: v === 2 ? 1.2 : 0.7 })}
        {v === 2 ? (
          <g transform={pr.plane(z1)} opacity={0.35}>
            <rect x={-47} y={-60} width={94} height={120} fill={c.u('glow')} />
          </g>
        ) : (
          <g transform={pr.plane(z1)}>
            <g transform="translate(-30 -26)">{mark(0, 0, 18, c.M(-0.45), 0.7)}</g>
            {[0, 1, 2].map((i) => (
              <rect key={i} x={-8} y={-32 + i * 9} width={i ? 30 : 44} height={3.5} rx={1} fill={c.M(-0.45)} opacity={0.5} />
            ))}
            <rect x={-40} y={14} width={78} height={4} rx={1} fill={c.M(-0.4)} opacity={0.4} />
            <rect x={-40} y={24} width={52} height={4} rx={1} fill={c.M(-0.4)} opacity={0.4} />
            <rect x={-40} y={36} width={20} height={6} rx={1} fill={c.A(0)} opacity={0.75} />
          </g>
        )}
      </g>
    ),
  };
};

// ───────────────────────────── smartwatch ─────────────────────────────

const smartwatch: KindFn = (c) => {
  const round = c.v % 2 === 1;
  const mesh = c.v === 2;
  const caseFill = c.f === 'metal' || c.f === 'gold' ? c.u('mc') : c.u('pc');
  const cx = 200, cy = 218;
  const S = c.S;
  const strapTop = 'M154 160H246L240 70Q240 60 230 60H170Q160 60 160 70Z';
  const strapBot = 'M154 276H246L252 324Q252 330 246 330H154Q148 330 148 324Z';
  const strapFillT = mesh ? c.u('mv') : c.u('wsT');
  const strapFillB = mesh ? c.u('mv') : c.u('wsB');
  const meshLines = (y0: number, y1: number) => (
    <path d={Array.from({ length: Math.floor((y1 - y0) / 2.4) }, (_, i) => `M140 ${y0 + i * 2.4}H260`).join('')} stroke="#000" strokeOpacity={0.28} strokeWidth={0.9} />
  );
  const rings = [c.A.base, mix(c.A.base, '#ff4d8d', 0.55), mix(c.A.base, '#4dd2ff', 0.55)];
  const face = round ? (
    <g>
      {[48, 38, 28].map((r, i) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={rings[i]} strokeOpacity={0.2} strokeWidth={7} />
      ))}
      {[48, 38, 28].map((r, i) => (
        <circle key={'a' + r} cx={cx} cy={cy} r={r} fill="none" stroke={rings[i]} strokeWidth={7} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * [0.72, 0.55, 0.85][i]} 999`} transform={`rotate(-90 ${cx} ${cy})`} />
      ))}
      <path d={`M${cx} ${cy}L${cx + 2} ${cy - 22}M${cx} ${cy}L${cx + 16} ${cy + 8}`} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={2.6} fill={c.A(0.3)} />
    </g>
  ) : (
    <g>
      {[44, 34, 24].map((r, i) => (
        <circle key={r} cx={cx} cy={cy + 6} r={r} fill="none" stroke={rings[i]} strokeOpacity={0.2} strokeWidth={8} />
      ))}
      {[44, 34, 24].map((r, i) => (
        <circle key={'a' + r} cx={cx} cy={cy + 6} r={r} fill="none" stroke={rings[i]} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * r * [0.72, 0.55, 0.85][i]} 999`} transform={`rotate(-90 ${cx} ${cy + 6})`} />
      ))}
      <rect x={cx + 18} y={cy - 54} width={26} height={7} rx={3.5} fill="#fff" opacity={0.85} />
    </g>
  );
  return {
    shadow: [200, 70, 9],
    el: (
      <g>
        <defs>
          {lin(c, 'wsT', [[0, S(-0.7)], [0.6, S(-0.15)], [1, S(0)]])}
          {lin(c, 'wsB', [[0, S(0.05)], [1, S(-0.4)]])}
        </defs>
        {sol(c, strapTop, strapFillT, { rim: 0.8 })}
        {mesh ? meshLines(62, 160) : <path d={strapTop} fill={c.u('sheen')} opacity={0.25 * c.k.sheen} />}
        {!mesh && !round ? [0, 1, 2, 3].map((i) => <circle key={i} cx={200} cy={78 + i * 16} r={3.2} fill={S(-0.55)} />) : null}
        {round && !mesh ? <path d="M166 66H234M164 150H236" stroke={S(0.3)} strokeOpacity={0.45} strokeDasharray="3 3" fill="none" /> : null}
        {sol(c, strapBot, strapFillB, { rim: 0.6, occ: 0.3 })}
        {mesh ? meshLines(276, 330) : null}
        {round ? (
          <g>
            {sol(c, rr(156, 132, 88, 34, 10), caseFill, { rim: 0.9 })}
            {sol(c, rr(156, 268, 88, 34, 10), caseFill, { rim: 0.4, occ: 0.4 })}
            <circle cx={cx + 5} cy={cy + 2} r={74} fill={c.P(-0.6)} />
            {sol(c, ell(cx, cy, 74), caseFill, { rim: 1.3, sheen: 0.6, cb: true })}
            <circle cx={cx} cy={cy} r={66} fill={c.u('mv')} />
            <circle cx={cx} cy={cy} r={64} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={5} strokeDasharray="1.4 5.3" />
            <circle cx={cx} cy={cy} r={58} fill="#040405" />
            {face}
            <circle cx={cx} cy={cy} r={58} fill={c.u('sheen')} opacity={0.35} />
            {sol(c, rr(271, 206, 10, 22, 3), c.u('mc'), { rim: 0.6 })}
          </g>
        ) : (
          <g>
            <path d={rr(cx - 63, cy - 72, 136, 150, 40)} fill={c.P(-0.6)} />
            {sol(c, rr(cx - 68, cy - 74, 136, 150, 40), caseFill, { rim: 1.3, sheen: 0.6, cb: true })}
            <path d={rr(cx - 61, cy - 67, 122, 136, 34)} fill="#040405" />
            <g>{face}</g>
            <path d={rr(cx - 61, cy - 67, 122, 136, 34)} fill={c.u('sheen')} opacity={0.35} />
            {sol(c, rr(266, 180, 10, 26, 3), c.u('mc'), { rim: 0.6 })}
            <rect x={268} y={186} width={8} height={2} fill={c.A(0)} />
            {sol(c, rr(267, 222, 5, 32, 2), c.u('mc'), { rim: 0.4 })}
          </g>
        )}
      </g>
    ),
  };
};

// ───────────────────────────── tablet ─────────────────────────────

const tablet: KindFn = (c) => {
  if (c.v % 2 === 0) {
    // lying flat, seen from above, with a stylus alongside
    const pr = makeProj(200, 252, -12, 0.62);
    const W = 128, D = 88;
    const body = prism(pr, rrPts(2 * W, 2 * D, 20, 4), 0, 7);
    const clip = c.id('tscr');
    return {
      shadow: [200, 160, 22],
      el: (
        <g>
          {block(c, body.sides, body.top, c.M, '#050506', { rim: 1.2, dark: -0.1 })}
          <g transform={pr.plane(7)}>
            <defs>
              <clipPath id={clip}>
                <path d={rr(-W + 11, -D + 11, 2 * W - 22, 2 * D - 22, 9)} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clip})`}>
              {wallpaper(c, -W, -D, 2 * W, 2 * D)}
              <rect x={-W + 30} y={-D + 28} width={80} height={56} rx={8} fill="#fff" opacity={0.1} />
              <rect x={-W + 118} y={-D + 28} width={50} height={56} rx={8} fill="#fff" opacity={0.08} />
              <rect x={-50} y={D - 40} width={100} height={18} rx={9} fill="#fff" opacity={0.15} />
            </g>
            <path d={rr(-W + 3, -D + 3, 2 * W - 6, 2 * D - 6, 17)} fill={c.u('sheen')} opacity={0.35} />
            <circle cx={0} cy={-D + 6} r={1.8} fill="#1d2230" />
            <g transform={`translate(0 ${D + 22}) rotate(-3)`}>
              {sol(c, rr(-96, -5, 186, 10, 5), c.u('sv'), { rim: 0.9, sheen: 0.8 })}
              <path d="M-96 -5L-112 0L-96 5Z" fill={c.S(-0.3)} />
              <rect x={70} y={-5} width={3} height={10} fill={c.M(0)} opacity={0.6} />
            </g>
          </g>
        </g>
      ),
    };
  }
  const [x, y, w, h] = [112, 52, 176, 248];
  const clip = c.id('tscr');
  return {
    shadow: [200, 110, 11],
    el: (
      <g>
        <defs>
          <clipPath id={clip}>
            <path d={rr(x + 11, y + 11, w - 22, h - 22, 8)} />
          </clipPath>
        </defs>
        {sol(c, `M186 ${y + h - 10}H214L224 322H176Z`, c.u('mv'), { rim: 0.7, side: 0.4 })}
        {sol(c, ell(200, 323, 62, 7), c.u('mv'), { rim: 1 })}
        <path d={rr(x + 5, y + 3, w, h, 18)} fill={c.M(-0.55)} />
        {sol(c, rr(x, y, w, h, 18), c.u('mc'), { rim: 1.3 })}
        <path d={rr(x + 3, y + 3, w - 6, h - 6, 15)} fill="#050506" />
        <g clipPath={`url(#${clip})`}>
          {wallpaper(c, x, y, w, h)}
          <rect x={x + 26} y={y + 30} width={w * 0.34} height={h * 0.3} rx={8} fill="#fff" opacity={0.1} />
          <rect x={x + 32 + w * 0.34} y={y + 30} width={w * 0.2} height={h * 0.3} rx={8} fill="#fff" opacity={0.08} />
          <rect x={x + w / 2 - 50} y={y + h - 42} width={100} height={20} rx={9} fill="#fff" opacity={0.14} />
        </g>
        <circle cx={x + w / 2} cy={y + 6.5} r={1.8} fill="#1d2230" />
        <path d={rr(x + 3, y + 3, w - 6, h - 6, 15)} fill={c.u('sheen')} opacity={0.3} />
        {sol(c, rr(x + w + 4, y + 40, 9, 150, 4.5), c.u('sc'), { rim: 0.8, sheen: 0.6 })}
      </g>
    ),
  };
};

// ───────────────────────────── speaker ─────────────────────────────

function dotGrid(c: Ctx, name: string, color: string, step = 5, r = 1.1) {
  return (
    <pattern id={c.id(name)} width={step} height={step} patternUnits="userSpaceOnUse">
      <circle cx={step / 2} cy={step / 2} r={r} fill={color} />
    </pattern>
  );
}

const speaker: KindFn = (c) => {
  const v = c.v % 3;
  if (v === 1) {
    const pr = makeProj(196, 318, 24, 0.32);
    const W = 74, D = 60, H = 226;
    const top = poly(pr(-W, D, H), pr(W, D, H), pr(W, -D, H), pr(-W, -D, H));
    return {
      shadow: [204, 100, 12],
      el: (
        <g>
          <g transform={pr.uplane(W)}>{sol(c, rr(-D, -H, 2 * D, H, 4), c.u('ph'), { side: 0.6, cb: true, rim: 0.7 })}</g>
          <g transform={pr.vplane(D)}>
            {sol(c, rr(-W, -H, 2 * W, H, 4), c.u('pv'), { occ: 0.3, sheen: 0.4, cb: true, rim: 1.1 })}
            <circle cx={0} cy={-H + 52} r={26} fill={c.u('mc')} />
            <circle cx={0} cy={-H + 52} r={21} fill="#0c0c0e" />
            <circle cx={0} cy={-H + 52} r={12} fill={c.u('mc')} />
            <ellipse cx={-3} cy={-H + 48} rx={5} ry={3} fill="#fff" opacity={0.6} />
            <circle cx={0} cy={-88} r={60} fill={c.u('mc')} />
            <circle cx={0} cy={-88} r={55} fill="#141417" />
            <circle cx={0} cy={-88} r={47} fill={c.u('wcone')} />
            <circle cx={0} cy={-88} r={16} fill={c.u('wcap')} />
            <ellipse cx={-6} cy={-96} rx={7} ry={4} fill="#fff" opacity={0.35} />
            <rect x={-26} y={-22} width={52} height={8} rx={4} fill="#050506" />
            {mark(W - 16, -12, 8, c.P(0.4), 0.5)}
          </g>
          {sol(c, top, c.u('pv'), { rim: 1.3, cb: true })}
          <defs>
            {rad(c, 'wcone', [[0, '#3a3b42'], [0.6, '#16161a'], [1, '#2a2b30']])}
            {rad(c, 'wcap', [[0, c.A(0.3)], [1, c.A(-0.5)]], 0.4, 0.35, 0.7)}
          </defs>
        </g>
      ),
    };
  }
  if (v === 2) {
    // portable pill speaker lying down
    const body = rr(66, 222, 268, 106, 53);
    return {
      shadow: [200, 140, 12],
      el: (
        <g>
          <defs>
            {dotGrid(c, 'mesh', '#000', 4.4, 1)}
            {lin(c, 'pillv', [[0, c.P(0.35 + c.lift)], [0.3, c.P(0)], [0.75, c.P(-0.35)], [1, c.P(-0.55)]])}
          </defs>
          {sol(c, body, c.u('pillv'), { rim: 1.2 })}
          <path d={body} fill={c.u(`mesh`)} opacity={0.45} />
          <path d={body} fill={c.u('sheen')} opacity={0.3 * c.k.sheen} />
          {sol(c, ell(84, 275, 20, 50), c.u('sv'), { rim: 0.8 })}
          <ellipse cx={84} cy={275} rx={12} ry={34} fill={c.A(0)} opacity={0.85} />
          <ellipse cx={82} cy={265} rx={4} ry={12} fill="#fff" opacity={0.35} />
          {sol(c, rr(176, 262, 48, 24, 12), c.u('sv'), { rim: 0.7 })}
          {mark(200, 274, 10, c.S(0.6), 0.7)}
          <path d="M300 236Q318 236 322 252" fill="none" stroke={c.S(-0.2)} strokeWidth={6} strokeLinecap="round" />
        </g>
      ),
    };
  }
  // cylindrical smart speaker
  const x0 = 136, x1 = 264, top = 102, bot = 318;
  const bodyD = `M${x0} ${top}V${bot}A64 12 0 0 0 ${x1} ${bot}V${top}Z`;
  return {
    shadow: [200, 72, 10],
    el: (
      <g>
        <defs>{dotGrid(c, 'mesh', '#000', 4, 1)}</defs>
        {sol(c, bodyD, c.u('pc'), { rim: 1.2, cb: true })}
        <path d={bodyD} fill={c.u('mesh')} opacity={0.5} />
        <path d={`M${x0} 300V${bot}A64 12 0 0 0 ${x1} ${bot}V300A64 12 0 0 1 ${x0} 300Z`} fill={c.S(-0.4)} />
        {sol(c, ell(200, top, 64, 12), c.u('pv'), { rim: 1.4 })}
        <ellipse cx={200} cy={top} rx={44} ry={8} fill="none" stroke={c.A(0.3)} strokeWidth={2.4} />
        {glow(c, 200, top, 60, 14, 0.6)}
        {[-20, 0, 20].map((d) => (
          <circle key={d} cx={200 + d} cy={top} r={1.8} fill="#fff" opacity={0.5} />
        ))}
      </g>
    ),
  };
};

// ───────────────────────────── drone ─────────────────────────────

const drone: KindFn = (c) => {
  const guards = c.v % 2 === 1;
  const motors: [number, number, number][] = [
    [128, 178, 0.82],
    [272, 178, 0.82],
    [84, 248, 1],
    [316, 248, 1],
  ];
  const prop = ([x, y, s]: [number, number, number], i: number) => (
    <g key={'p' + i}>
      {guards ? <ellipse cx={x} cy={y - 10 * s} rx={60 * s} ry={14 * s} fill="none" stroke={c.u('pv')} strokeWidth={4 * s} /> : null}
      <ellipse cx={x} cy={y - 12 * s} rx={56 * s} ry={13 * s} fill="#fff" opacity={0.07} />
      <ellipse cx={x} cy={y - 12 * s} rx={56 * s} ry={13 * s} fill="none" stroke="#fff" strokeOpacity={0.12} />
      <path d={`M${x - 50 * s} ${y - 9 * s}L${x + 50 * s} ${y - 15 * s}`} stroke="#0d0d10" strokeWidth={4 * s} strokeLinecap="round" opacity={0.75} />
    </g>
  );
  const motor = ([x, y, s]: [number, number, number], i: number) => (
    <g key={'m' + i}>
      {sol(c, rr(x - 10 * s, y - 12 * s, 20 * s, 18 * s, 4), c.u('mc'), { rim: 0.8 })}
      <ellipse cx={x} cy={y - 12 * s} rx={10 * s} ry={3.5 * s} fill={c.M(0.4)} />
      <circle cx={x} cy={y - 13 * s} r={2.5 * s} fill="#111" />
    </g>
  );
  const arm = ([x, y, s]: [number, number, number], i: number) => {
    const bx = x < 200 ? 176 : 224;
    const by = y < 200 ? 222 : 244;
    return (
      <g key={'a' + i}>
        <path d={`M${bx} ${by - 6}L${x} ${y - 5 * s}L${x} ${y + 4 * s}L${bx} ${by + 6}Z`} fill={c.P(-0.25)} />
        <path d={`M${bx} ${by - 6}L${x} ${y - 5 * s}`} stroke="#fff" strokeOpacity={0.3} />
        <path d={`M${x} ${y + 6 * s}L${x + (x < 200 ? 4 : -4)} ${y + 50 * s + (y < 200 ? 6 : 0)}`} stroke={c.P(-0.5)} strokeWidth={4 * s} strokeLinecap="round" />
      </g>
    );
  };
  const back = motors.slice(0, 2);
  const front = motors.slice(2);
  return {
    shadow: [200, 150, 13],
    el: (
      <g>
        {back.map(arm)}
        {back.map(motor)}
        {back.map(prop)}
        {/* body */}
        {sol(c, smooth([[150, 236], [168, 210], [200, 202], [232, 210], [250, 236], [238, 262], [200, 270], [162, 262]]), c.u('pv'), { sheen: 0.8, cb: true, rim: 1.3, occ: 0.25 })}
        <path d="M176 220Q200 212 224 220" stroke={c.S(0.2)} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.6} />
        {front.map(arm)}
        {sol(c, rr(184, 262, 32, 20, 6), c.u('sv'), { rim: 0.8 })}
        {lensEl(c, 200, 288, 15, c.u('mc'))}
        {front.map(motor)}
        {front.map(prop)}
        {[84, 316].map((x) => (
          <g key={x}>
            <circle cx={x} cy={256} r={2.5} fill={c.A(0.4)} />
            {glow(c, x, 256, 12, 8, 0.9)}
          </g>
        ))}
      </g>
    ),
  };
};

export const electronics: Partial<Record<ArtKind, KindFn>> = {
  phone,
  laptop,
  console: consoleKind,
  headphones,
  earbuds,
  camera,
  gpu,
  cpu,
  smartwatch,
  tablet,
  speaker,
  drone,
};
