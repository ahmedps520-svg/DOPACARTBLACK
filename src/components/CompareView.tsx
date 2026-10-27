import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { priceSeries, RANGES, changeOver, volume24h, type RangeId } from '../engine/history';
import { Chart } from './Chart';
import { Change, Credits, DemandIndicator, RarityTag, Segmented, SupplyIndicator } from './ui';
import { ProductThumb } from './ProductCard';
import { SUBCATEGORY_LABEL } from '../engine/categories';
import { MINUTES_PER_DAY } from '../engine/constants';
import { int } from '../lib/format';

export const SERIES_COLORS = ['#e5132f', '#5ab0ff', '#f3d27a', '#3ddc97'];

/** Side-by-side comparison of up to four products on one chart. */
export function CompareView({ ids, onRemove }: { ids: string[]; onRemove?: (id: string) => void }) {
  const market = useGameState((s) => s.market);
  const now = useGameState((s) => s.clock.t);
  const [range, setRange] = useState<RangeId>('1W');
  const [mode, setMode] = useState<'percent' | 'value'>('percent');
  const series = useMemo(
    () =>
      ids.map((id, i) => {
        const ps = priceSeries(market[id], range, now);
        return { id, label: PRODUCT_BY_ID[id].name, color: SERIES_COLORS[i % 4], t: ps.t, v: ps.p };
      }),
    [ids, market, range, now],
  );
  if (ids.length === 0) return <p className="dim">Add products to compare from the Market or any product page.</p>;
  const specLabels = [...new Set(ids.flatMap((id) => PRODUCT_BY_ID[id].specs.map(([k]) => k)))];

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.id}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="row-wrap">
          <Segmented value={mode} onChange={setMode} options={[{ value: 'percent', label: '% change' }, { value: 'value', label: 'Price' }]} label="Chart mode" />
          <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} label="Range" />
        </div>
      </div>
      <Chart series={series} mode={mode} height={260} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th />
              {ids.map((id, i) => (
                <th key={id} style={{ minWidth: 150 }}>
                  <div className="row" style={{ gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: SERIES_COLORS[i % 4] }} />
                    <Link to={`/product/${id}`} style={{ color: 'var(--text)', fontSize: 12 }} className="ellipsis">
                      {PRODUCT_BY_ID[id].name}
                    </Link>
                    {onRemove && (
                      <button className="icon-btn" style={{ width: 22, height: 22, marginLeft: 'auto' }} onClick={() => onRemove(id)} aria-label={`Remove ${PRODUCT_BY_ID[id].name}`}>
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="dim">Product</td>
              {ids.map((id) => (
                <td key={id}>
                  <ProductThumb id={id} large />
                </td>
              ))}
            </tr>
            <Row label="Brand" ids={ids} render={(id) => PRODUCT_BY_ID[id].brand} />
            <Row label="Category" ids={ids} render={(id) => SUBCATEGORY_LABEL[PRODUCT_BY_ID[id].subcategory]} />
            <Row label="Rarity" ids={ids} render={(id) => <RarityTag rarity={PRODUCT_BY_ID[id].rarity} />} />
            <Row label="Market price" ids={ids} render={(id) => <Credits value={market[id].price} />} />
            <Row label="24h change" ids={ids} render={(id) => <Change value={changeOver(market[id], MINUTES_PER_DAY)} />} />
            <Row label="7d change" ids={ids} render={(id) => <Change value={changeOver(market[id], 7 * MINUTES_PER_DAY)} />} />
            <Row label="Demand" ids={ids} render={(id) => <DemandIndicator mp={market[id]} />} />
            <Row label="Supply" ids={ids} render={(id) => <SupplyIndicator mp={market[id]} />} />
            <Row label="24h volume" ids={ids} render={(id) => <span className="num">{int(volume24h(market[id]))}</span>} />
            {specLabels.map((k) => (
              <Row key={k} label={k} ids={ids} render={(id) => PRODUCT_BY_ID[id].specs.find(([kk]) => kk === k)?.[1] ?? <span className="dim">—</span>} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, ids, render }: { label: string; ids: string[]; render: (id: string) => React.ReactNode }) {
  return (
    <tr>
      <td className="dim nowrap">{label}</td>
      {ids.map((id) => (
        <td key={id}>{render(id)}</td>
      ))}
    </tr>
  );
}
