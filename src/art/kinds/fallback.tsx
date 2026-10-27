import { sol, mark, type KindFn } from '../kit';
import { poly } from '../shading';

/** Generic premium gift box, used for unknown kinds. */
export const fallbackArt: KindFn = (c) => {
  // Oblique box: front face, top face, right side.
  const x = 112, y = 178, w = 150, h = 150, dx = 52, dy = 34;
  const front = poly([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
  const top = poly([x, y], [x + dx, y - dy], [x + w + dx, y - dy], [x + w, y]);
  const side = poly([x + w, y], [x + w + dx, y - dy], [x + w + dx, y + h - dy], [x + w, y + h]);
  const rib = c.u('av');
  return {
    shadow: [214, 118],
    el: (
      <g>
        {sol(c, side, c.u('ph'), { side: 0.6, cb: true })}
        {sol(c, front, c.u('pv'), { occ: 0.35, sheen: 0.5, cb: true })}
        {sol(c, top, c.u('pv'), { rim: 1.2 })}
        <path d={poly([x + w * 0.42, y], [x + w * 0.58, y], [x + w * 0.58, y + h], [x + w * 0.42, y + h])} fill={rib} />
        <path d={poly([x + w + dx * 0.42, y - dy * 0.42], [x + w + dx * 0.58, y - dy * 0.58], [x + w + dx * 0.58, y + h - dy * 0.58], [x + w + dx * 0.42, y + h - dy * 0.42])} fill={c.A(-0.35)} />
        <path
          d={poly([x + w * 0.42 + dx * 0, y], [x + w * 0.42 + dx, y - dy], [x + w * 0.58 + dx, y - dy], [x + w * 0.58, y])}
          fill={c.A(0.25)}
        />
        <path d={poly([x + dx * 0.42, y - dy * 0.42], [x + w + dx * 0.42, y - dy * 0.42], [x + w + dx * 0.58, y - dy * 0.58], [x + dx * 0.58, y - dy * 0.58])} fill={c.A(0.15)} />
        <path
          d={`M${x + w / 2 + dx / 2} ${y - dy / 2}c-30 -36 -62 -22 -46 -4c10 10 36 6 46 4c10 -2 36 -6 46 -4c16 -18 -16 -32 -46 4z`}
          fill={c.u('av')}
          stroke={c.A(-0.3)}
          strokeWidth={1}
        />
        {mark(x + w * 0.25, y + h * 0.78, 14, c.P(0.5), 0.5)}
      </g>
    ),
  };
};
