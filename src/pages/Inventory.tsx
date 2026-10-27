import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, ArrowUpDown, Store as StoreIcon, Zap } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { ProductThumb } from '../components/ProductCard';
import { Change, Credits, Empty, Meter, RarityTag, Stat } from '../components/ui';
import { SellModal } from '../components/TradeModals';
import { availableQty, capacity, capacityUsed, inTransitOrders, inTransitValue, inventoryCost, inventoryValue, listedQty } from '../engine/selectors';
import { changeOver } from '../engine/history';
import { MINUTES_PER_DAY } from '../engine/constants';
import { cr, crSigned, int, pct } from '../lib/format';
import { formatDuration } from '../engine/time';
import { displayEta } from '../engine/orders';
import { CATEGORIES } from '../engine/categories';
import type { CategoryId } from '../engine/types';

type SortKey = 'value' | 'pnl' | 'pnlPct' | 'name' | 'qty' | 'held';

export function Inventory() {
  const s = useGameState((st) => st);
  const [sellId, setSellId] = useState<string | null>(null);
  const [mode, setMode] = useState<'market' | 'store'>('market');
  const [sort, setSort] = useState<SortKey>('value');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');

  const rows = useMemo(() => {
    const list = Object.values(s.holdings).map((h) => {
      const def = PRODUCT_BY_ID[h.productId];
      const mp = s.market[h.productId];
      const value = h.qty * mp.price;
      const cost = h.qty * h.avgCost;
      return { h, def, mp, value, cost, pnl: value - cost, pnlPct: cost > 0 ? value / cost - 1 : 0, listed: listedQty(s, h.productId), free: availableQty(s, h.productId) };
    });
    const filtered = cat === 'all' ? list : list.filter((r) => r.def.category === cat);
    const by: Record<SortKey, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      value: (a, b) => b.value - a.value,
      pnl: (a, b) => b.pnl - a.pnl,
      pnlPct: (a, b) => b.pnlPct - a.pnlPct,
      name: (a, b) => a.def.name.localeCompare(b.def.name),
      qty: (a, b) => b.h.qty - a.h.qty,
      held: (a, b) => a.h.firstAcquiredAt - b.h.firstAcquiredAt,
    };
    return filtered.sort(by[sort]);
  }, [s, sort, cat]);

  const value = inventoryValue(s);
  const cost = inventoryCost(s);
  const used = capacityUsed(s);
  const cap = capacity(s);
  const transit = inTransitOrders(s);

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button className="sort" onClick={() => setSort(k)} aria-pressed={sort === k} style={{ color: sort === k ? 'var(--text)' : undefined }}>
      {children} <ArrowUpDown size={11} />
    </button>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Warehouse</div>
          <h1>Inventory</h1>
          <p className="sub">Everything you own, what you paid on average and what it is worth at today’s market price. Unrealized gains are estimates — they are not cash until you sell.</p>
        </div>
      </div>

      <div className="stats-row">
        <Stat label="Units held" foot={`${int(used)}/${int(cap)} capacity incl. in transit`}>
          {int(Object.values(s.holdings).reduce((a, h) => a + h.qty, 0))}
          <div style={{ marginTop: 8 }}>
            <Meter value={used} max={cap} tone={used / cap > 0.9 ? 'warn' : undefined} />
          </div>
        </Stat>
        <Stat label="Acquisition cost">
          <Credits value={cost} />
        </Stat>
        <Stat label="Est. market value">
          <Credits value={value} />
        </Stat>
        <Stat label="Unrealized P/L" foot={cost > 0 ? pct(value / cost - 1) : '—'}>
          <span className={value - cost >= 0 ? 'up' : 'down'}>{crSigned(value - cost)}</span>
        </Stat>
        <Stat label="In transit" foot={`${transit.length} supplier orders`}>
          <Credits value={inTransitValue(s)} />
        </Stat>
      </div>

      <div className="spread" style={{ margin: '22px 0 12px', flexWrap: 'wrap' }}>
        <div className="row-wrap">
          <button className="chip" aria-pressed={cat === 'all'} onClick={() => setCat('all')}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <Link to="/suppliers" className="btn btn-sm">
          <Truck size={14} /> Restock from suppliers
        </Link>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <Empty icon={<Package size={32} />} title={Object.keys(s.holdings).length ? 'Nothing in this category' : 'Your warehouse is empty'} action={<Link to="/market" className="btn btn-primary btn-sm">Buy your first product</Link>}>
            Buy from the market for instant stock, or order wholesale from suppliers for better margins.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <SortBtn k="name">Product</SortBtn>
                  </th>
                  <th className="num">
                    <SortBtn k="qty">Qty</SortBtn>
                  </th>
                  <th className="num">Avg cost</th>
                  <th className="num">Market price</th>
                  <th className="num">Total cost</th>
                  <th className="num">
                    <SortBtn k="value">Market value</SortBtn>
                  </th>
                  <th className="num">
                    <SortBtn k="pnl">Unrealized P/L</SortBtn>
                  </th>
                  <th className="num">
                    <SortBtn k="held">Held</SortBtn>
                  </th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.h.productId}>
                    <td>
                      <Link to={`/product/${r.h.productId}`} className="row" style={{ gap: 12, minWidth: 220 }}>
                        <ProductThumb id={r.h.productId} />
                        <div style={{ minWidth: 0 }}>
                          <div className="ellipsis" style={{ fontWeight: 600, maxWidth: 240 }}>{r.def.name}</div>
                          <RarityTag rarity={r.def.rarity} />
                        </div>
                      </Link>
                    </td>
                    <td className="num">
                      {int(r.h.qty)}
                      {r.listed > 0 && <div className="dim" style={{ fontSize: 11 }}>{r.listed} listed</div>}
                    </td>
                    <td className="num">{cr(r.h.avgCost)}</td>
                    <td className="num">
                      {cr(r.mp.price)}
                      <div>
                        <Change value={changeOver(r.mp, MINUTES_PER_DAY)} />
                      </div>
                    </td>
                    <td className="num">{cr(r.cost)}</td>
                    <td className="num">{cr(r.value)}</td>
                    <td className={`num ${r.pnl >= 0 ? 'up' : 'down'}`}>
                      {crSigned(r.pnl)}
                      <div style={{ fontSize: 11 }}>{pct(r.pnlPct)}</div>
                    </td>
                    <td className="num dim">{formatDuration(s.clock.t - r.h.firstAcquiredAt)}</td>
                    <td className="num">
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          className="btn btn-xs btn-primary"
                          disabled={r.free === 0}
                          onClick={() => {
                            setMode('market');
                            setSellId(r.h.productId);
                          }}
                          title="Sell instantly to the market at the bid price"
                        >
                          <Zap size={12} /> Sell
                        </button>
                        <button
                          className="btn btn-xs"
                          disabled={r.free === 0}
                          onClick={() => {
                            setMode('store');
                            setSellId(r.h.productId);
                          }}
                          title="List in your store at your own price"
                        >
                          <StoreIcon size={12} /> List
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {transit.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Arriving soon</h2>
            <Link to="/orders" className="more">
              Track orders
            </Link>
          </div>
          <div className="card">
            {transit.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="list-row" style={{ padding: '12px 18px' }}>
                <Truck size={16} className="dim" />
                <span className="num" style={{ fontWeight: 600 }}>{o.id}</span>
                <span className="grow dim ellipsis">{o.lines.map((l) => `${l.qty}× ${PRODUCT_BY_ID[l.productId].name}`).join(', ')}</span>
                <span className="dim nowrap">ETA {formatDuration(Math.max(0, displayEta(o).t - s.clock.t))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {sellId && <SellModal productId={sellId} open={!!sellId} initialMode={mode} onClose={() => setSellId(null)} />}
    </div>
  );
}
