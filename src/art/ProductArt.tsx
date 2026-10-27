/**
 * <ProductArt/> — studio-lit SVG "product photography" for fictional products.
 *
 * Every product is drawn in a 400×400 frame, centred, resting on an implied
 * floor at y≈330, on a black studio sweep with a soft top spotlight, contact
 * shadow and faint floor reflection. All ids are unique per instance.
 */
import { useId, useMemo } from 'react';
import type { ArtSpec } from '../engine/types';
import { FLOOR, lin, makeCtx, rad, sharedDefs, type CtxInternal } from './kit';
import { KINDS, fallbackArt } from './kinds';
import { safeId } from './shading';

export interface ProductArtProps {
  spec: ArtSpec;
  className?: string;
  /** Draw the studio backdrop (default true). When false only the product + contact shadow are drawn. */
  backdrop?: boolean;
  title?: string;
}

function renderScene(c: CtxInternal, backdrop: boolean) {
  const fn = KINDS[c.spec.kind] ?? fallbackArt;
  const art = fn(c);
  const [sx, srx, sry = Math.max(8, srx * 0.09), sy = FLOOR, srot = 0] = art.shadow ?? [200, 110];
  const mirror = art.floor === undefined ? FLOOR : art.floor;
  const reflTop = mirror === false ? FLOOR : mirror;
  const prodId = c.id('prod');

  const back = backdrop ? (
    <g>
      <rect width={400} height={400} fill={c.u('bg')} />
      <ellipse cx={200} cy={20} rx={230} ry={190} fill={c.u('spot')} />
      <rect y={250} width={400} height={150} fill={c.u('floor')} />
      <ellipse cx={200} cy={FLOOR + 6} rx={200} ry={52} fill={c.u('pool')} />
    </g>
  ) : null;

  const shadow = (
    <g transform={srot ? `rotate(${srot} ${sx} ${sy})` : undefined}>
      <ellipse cx={sx} cy={sy + 1} rx={srx * 1.18} ry={sry * 1.7} fill={c.u('cs')} opacity={backdrop ? 0.9 : 0.6} />
      <ellipse cx={sx} cy={sy} rx={srx * 0.92} ry={sry * 0.55} fill={c.u('cs')} />
    </g>
  );

  const reflection =
    backdrop && mirror !== false ? (
      <g mask={c.u('rm')} opacity={0.2}>
        <use href={`#${prodId}`} transform={`matrix(1 0 0 -1 0 ${mirror * 2 + 2})`} />
      </g>
    ) : null;

  const vignette = backdrop ? <rect width={400} height={400} fill={c.u('vign')} pointerEvents="none" /> : null;

  const backDefs = backdrop
    ? [
        rad(c, 'bg', [[0, '#1d1d22'], [0.5, '#131316'], [1, '#09090a']], 200, 150, 320, 200, 120, true),
        rad(c, 'spot', [[0, '#ffffff', 0.075], [0.55, '#ffffff', 0.025], [1, '#ffffff', 0]]),
        lin(c, 'floor', [[0, '#000000', 0], [0.55, '#000000', 0.12], [1, '#000000', 0.45]]),
        rad(c, 'pool', [[0, '#ffffff', 0.06], [0.6, '#ffffff', 0.02], [1, '#ffffff', 0]]),
        rad(c, 'vign', [[0.55, '#000000', 0], [1, '#000000', 0.62]], 200, 185, 300, 200, 185, true),
        lin(c, 'rmg', [[0, '#ffffff', 0.9], [0.55, '#ffffff', 0.15], [1, '#ffffff', 0]], 0, reflTop, 0, reflTop + 72, true),
        <mask key="rm" id={c.id('rm')} maskUnits="userSpaceOnUse" x={0} y={0} width={400} height={400}>
          <rect y={reflTop} width={400} height={400 - reflTop} fill={c.u('rmg')} />
        </mask>,
      ]
    : null;

  // Shared defs must be collected last: everything above registers what it uses.
  const defs = (
    <defs>
      {backDefs}
      {sharedDefs(c)}
    </defs>
  );

  return (
    <>
      {defs}
      {back}
      {shadow}
      {reflection}
      <g id={prodId}>{art.el}</g>
      {vignette}
    </>
  );
}

export function ProductArt({ spec, className, backdrop = true, title }: ProductArtProps): JSX.Element {
  const uid = 'pa' + safeId(useId());
  const { kind, primary, secondary, accent, finish, variant } = spec;
  const scene = useMemo(
    () => renderScene(makeCtx(uid, { kind, primary, secondary, accent, finish, variant }), backdrop),
    [uid, kind, primary, secondary, accent, finish, variant, backdrop],
  );
  return (
    <svg
      viewBox="0 0 400 400"
      width="100%"
      height="100%"
      role="img"
      aria-label={title ?? kind}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {scene}
    </svg>
  );
}

export default ProductArt;
