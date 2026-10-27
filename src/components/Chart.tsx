/**
 * Financial line/area chart drawn from recorded series only. Supports
 * several overlaid series (absolute or % normalised), an optional volume
 * strip, and a crosshair tooltip on hover/touch.
 */
import { memo, useMemo, useState, useId } from 'react';
import { useElementWidth } from '../lib/hooks';
import { cr, pct, crCompact } from '../lib/format';
import { dayOf, formatClock, formatGameTime } from '../engine/time';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  t: number[];
  v: number[];
}

interface Props {
  series: ChartSeries[];
  height?: number;
  mode?: 'value' | 'percent';
  volume?: { t: number[]; v: number[] };
  area?: boolean;
  valueFormat?: (v: number) => string;
  /** Draw a horizontal reference line (e.g. average cost). */
  reference?: { value: number; label: string };
  baselineZero?: boolean;
  compactAxis?: boolean;
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max - min < 1e-9) {
    max = min + 1;
    min = min - 1;
  }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function xLabel(t: number, span: number): string {
  if (span <= 1440 * 1.05) return formatClock(t);
  return `D${dayOf(t)}`;
}

function nearestIndex(ts: number[], t: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < t) lo = mid;
    else hi = mid;
  }
  return Math.abs(ts[lo] - t) <= Math.abs(ts[hi] - t) ? lo : hi;
}

export const Chart = memo(function Chart({
  series,
  height = 280,
  mode = 'value',
  volume,
  area = true,
  valueFormat,
  reference,
  baselineZero,
  compactAxis,
}: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hoverT, setHoverT] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');

  const data = useMemo(() => {
    const valid = series.filter((s) => s.t.length > 0);
    return valid.map((s) => {
      const base = s.v[0] || 1;
      return { ...s, y: mode === 'percent' ? s.v.map((v) => v / base - 1) : s.v };
    });
  }, [series, mode]);

  const padL = compactAxis ? 8 : 10;
  const padR = compactAxis ? 44 : 64;
  const padT = 12;
  const volH = volume ? 46 : 0;
  const padB = 26 + volH;
  const W = Math.max(0, width);
  const H = height;
  const innerW = Math.max(10, W - padL - padR);
  const innerH = Math.max(10, H - padT - padB);

  const dom = useMemo(() => {
    let tMin = Infinity;
    let tMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const s of data) {
      tMin = Math.min(tMin, s.t[0]);
      tMax = Math.max(tMax, s.t[s.t.length - 1]);
      for (const y of s.y) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    if (reference) {
      yMin = Math.min(yMin, reference.value);
      yMax = Math.max(yMax, reference.value);
    }
    if (baselineZero) {
      yMin = Math.min(0, yMin);
      yMax = Math.max(0, yMax);
    }
    const pad = (yMax - yMin) * 0.1 || Math.abs(yMax) * 0.05 || 1;
    return { tMin, tMax: tMax === tMin ? tMin + 1 : tMax, yMin: yMin - pad, yMax: yMax + pad };
  }, [data, reference, baselineZero]);

  const x = (t: number) => padL + ((t - dom.tMin) / (dom.tMax - dom.tMin)) * innerW;
  const y = (v: number) => padT + (1 - (v - dom.yMin) / (dom.yMax - dom.yMin)) * innerH;
  const fmt = valueFormat ?? (mode === 'percent' ? (v: number) => pct(v) : (v: number) => (compactAxis ? crCompact(v) : cr(v)));

  const yTicks = niceTicks(dom.yMin, dom.yMax, 4);
  const span = dom.tMax - dom.tMin;
  const xTicks = useMemo(() => {
    const n = W < 480 ? 3 : 5;
    return Array.from({ length: n }, (_, i) => dom.tMin + (span * (i + 0.5)) / n);
  }, [dom.tMin, span, W]);

  const paths = data.map((s) => {
    let d = '';
    for (let i = 0; i < s.t.length; i++) d += `${i ? 'L' : 'M'}${x(s.t[i]).toFixed(1)},${y(s.y[i]).toFixed(1)}`;
    const areaD = `${d}L${x(s.t[s.t.length - 1]).toFixed(1)},${padT + innerH}L${x(s.t[0]).toFixed(1)},${padT + innerH}Z`;
    return { s, d, areaD };
  });

  const volMax = volume ? Math.max(1, ...volume.v) : 1;
  const hover =
    hoverT !== null && data.length
      ? data.map((s) => {
          const i = nearestIndex(s.t, hoverT);
          return { s, i, t: s.t[i], v: s.v[i], yv: s.y[i] };
        })
      : null;

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    const t = dom.tMin + ((px - padL) / innerW) * (dom.tMax - dom.tMin);
    setHoverT(Math.max(dom.tMin, Math.min(dom.tMax, t)));
  };

  const single = data.length === 1;
  const first = data[0];
  const trendUp = single && first ? first.v[first.v.length - 1] >= first.v[0] : true;

  return (
    <div className="chart" ref={ref} style={{ height: H }}>
      {W > 0 && data.length > 0 && (
        <svg
          width={W}
          height={H}
          role="img"
          aria-label="Price history chart"
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHoverT(null)}
          onTouchMove={(e) => onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
          onTouchEnd={() => setHoverT(null)}
        >
          <defs>
            {paths.map(({ s }) => (
              <linearGradient key={s.id} id={`${gid}-${s.id.replace(/[^a-z0-9]/gi, '')}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={padL + innerW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 && mode === 'percent' ? '0' : '2 4'} />
              <text x={padL + innerW + 8} y={y(v) + 4} fontSize={10.5} fill="var(--text-3)" fontFamily="var(--font-mono)">
                {fmt(v)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={padT + innerH + 18} fontSize={10.5} fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono)">
              {xLabel(t, span)}
            </text>
          ))}
          {reference && (
            <g>
              <line x1={padL} x2={padL + innerW} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--gold)" strokeDasharray="5 4" strokeWidth={1} />
              <text x={padL + 6} y={y(reference.value) - 6} fontSize={10.5} fill="var(--gold-2)">
                {reference.label}
              </text>
            </g>
          )}
          {paths.map(({ s, d, areaD }) => (
            <g key={s.id}>
              {area && single && <path d={areaD} fill={`url(#${gid}-${s.id.replace(/[^a-z0-9]/gi, '')})`} />}
              <path d={d} fill="none" stroke={single ? (trendUp ? 'var(--up)' : 'var(--down)') : s.color} strokeWidth={single ? 2 : 1.8} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {volume && (
            <g>
              {volume.t.map((t, i) => {
                const bw = Math.max(1, innerW / volume.t.length - 1);
                const h = (volume.v[i] / volMax) * (volH - 10);
                return <rect key={t} x={x(t) - bw / 2} y={H - h - 2} width={bw} height={h} fill="var(--surface-3)" rx={1} />;
              })}
              <text x={padL + innerW + 8} y={H - 4} fontSize={10} fill="var(--text-4)">
                VOL
              </text>
            </g>
          )}
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover[0].t)} x2={x(hover[0].t)} y1={padT} y2={padT + innerH} stroke="var(--text-3)" strokeDasharray="3 3" />
              {hover.map((h) => (
                <circle key={h.s.id} cx={x(h.t)} cy={y(h.yv)} r={4} fill={single ? (trendUp ? 'var(--up)' : 'var(--down)') : h.s.color} stroke="var(--bg)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(0, x(hover[0].t) - 80), W - 180), top: 6 }}>
          <div className="t">{formatGameTime(hover[0].t)}</div>
          {hover.map((h) => (
            <div key={h.s.id} className="row" style={{ gap: 6 }}>
              {!single && <i style={{ width: 8, height: 8, borderRadius: 2, background: h.s.color, display: 'inline-block' }} />}
              {!single && <span className="dim">{h.s.label}</span>}
              <span className="num" style={{ marginLeft: 'auto', fontWeight: 600 }}>
                {mode === 'percent' ? `${pct(h.yv)} · ${cr(h.v)}` : valueFormat ? valueFormat(h.v) : `${cr(h.v)} CR`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/** Minimal sparkline for cards and tables. */
export const Sparkline = memo(function Sparkline({ values, width = 96, height = 30, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const step = width / (values.length - 1);
  let d = '';
  values.forEach((v, i) => {
    d += `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`;
  });
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color ?? (up ? 'var(--up)' : 'var(--down)')} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
});

/** Vertical bar chart for signed values (revenue, profit, cash flow). */
export const BarChart = memo(function BarChart({
  bars,
  height = 220,
  valueFormat = (v: number) => crCompact(v),
}: {
  bars: { label: string; values: { v: number; color: string; name: string }[] }[];
  height?: number;
  valueFormat?: (v: number) => string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 6;
  const padR = 56;
  const padT = 10;
  const padB = 24;
  const innerW = Math.max(10, width - padL - padR);
  const innerH = height - padT - padB;
  let min = 0;
  let max = 0;
  for (const b of bars) for (const v of b.values) {
    min = Math.min(min, v.v);
    max = Math.max(max, v.v);
  }
  if (max === min) max = min + 1;
  const pad = (max - min) * 0.08;
  max += pad;
  if (min < 0) min -= pad;
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * innerH;
  const groupW = innerW / Math.max(1, bars.length);
  const n = bars[0]?.values.length ?? 1;
  const bw = Math.max(2, Math.min(28, (groupW * 0.72) / n));
  const ticks = niceTicks(min, max, 4);
  const labelEvery = Math.ceil(bars.length / Math.max(1, Math.floor(innerW / 54)));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} onMouseLeave={() => setHover(null)} role="img" aria-label="Bar chart">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={padL + innerW} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 ? '0' : '2 4'} />
              <text x={padL + innerW + 8} y={y(v) + 4} fontSize={10.5} fill="var(--text-3)" fontFamily="var(--font-mono)">
                {valueFormat(v)}
              </text>
            </g>
          ))}
          {bars.map((b, gi) => {
            const gx = padL + gi * groupW + (groupW - bw * n) / 2;
            return (
              <g key={gi} onMouseEnter={() => setHover(gi)}>
                <rect x={padL + gi * groupW} y={padT} width={groupW} height={innerH} fill={hover === gi ? 'rgba(255,255,255,0.03)' : 'transparent'} />
                {b.values.map((v, vi) => (
                  <rect key={vi} x={gx + vi * bw} y={Math.min(y(v.v), y(0))} width={bw - 1} height={Math.max(1, Math.abs(y(v.v) - y(0)))} rx={2} fill={v.color} opacity={hover === null || hover === gi ? 1 : 0.55} />
                ))}
                {gi % labelEvery === 0 && (
                  <text x={padL + gi * groupW + groupW / 2} y={height - 6} fontSize={10.5} fill="var(--text-3)" textAnchor="middle" fontFamily="var(--font-mono)">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && bars[hover] && (
        <div className="chart-tip" style={{ left: Math.min(Math.max(0, padL + hover * groupW - 40), width - 180), top: 4 }}>
          <div className="t">{bars[hover].label}</div>
          {bars[hover].values.map((v) => (
            <div key={v.name} className="row" style={{ gap: 6 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: v.color, display: 'inline-block' }} />
              <span className="dim">{v.name}</span>
              <span className="num" style={{ marginLeft: 'auto', fontWeight: 600 }}>
                {cr(v.v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
