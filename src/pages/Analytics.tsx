import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { BarChart, Chart } from '../components/Chart';
import { Credits, Empty, Notice, Segmented, Stat } from '../components/ui';
import { ProductThumb } from '../components/ProductCard';
import { GAME_START_MINUTE, MINUTES_PER_DAY, MINUTES_PER_HOUR } from '../engine/constants';
import { listedQty, periodTotals, txBetween, inventoryCost, inventoryValue, storeRevenueTotal, activeStore, listingSlots } from '../engine/selectors';
import { changeOver, demandAgo } from '../engine/history';
import { upgradeValue } from '../engine/upgrades';
import { cr, crSigned, int, pct } from '../lib/format';
import { dayOf, formatClock, formatDuration } from '../engine/time';
import type { GameState, Transaction } from '../engine/types';

type RangeKey = '1d' | '3d' | '7d' | '30d' | 'all';
const RANGE_DAYS: Record<RangeKey, number> = { '1d': 1, '3d': 3, '7d': 7, '30d': 30, all: 10_000 };

interface Bucket {
  label: string;
  from: number;
  to: number;
  txs: Transaction[];
}

function buckets(s: GameState, range: RangeKey): Bucket[] {
  const now = s.clock.t;
  const firstTx = s.transactions.find((t) => t.type !== 'starting_balance')?.t ?? now;
  // Never chart the simulated pre-game period: the business starts on Day 1.
  const gameStart = s.dailySnapshots[0]?.t ?? GAME_START_MINUTE;
  const start = Math.max(gameStart, range === 'all' ? Math.min(firstTx, now - MINUTES_PER_DAY) : now - RANGE_DAYS[range] * MINUTES_PER_DAY);
  const hourly = range === '1d';
  const step = hourly ? 2 * MINUTES_PER_HOUR : MINUTES_PER_DAY;
  const aligned = hourly ? Math.floor(start / step) * step : Math.floor(start / MINUTES_PER_DAY) * MINUTES_PER_DAY;
  const out: Bucket[] = [];
  for (let t = aligned; t <= now; t += step) {
    out.push({ label: hourly ? formatClock(t) : `D${dayOf(t)}`, from: t, to: t + step, txs: txBetween(s, t, t + step) });
  }
  return out.slice(-60);
}

export function Analytics() {
  const s = useGameState((st) => st);
  const [range, setRange] = useState<RangeKey>('7d');
  const advanced = upgradeValue(s, 'analytics') >= 1;
  const from = range === 'all' ? -Infinity : s.clock.t - RANGE_DAYS[range] * MINUTES_PER_DAY;

  const data = useMemo(() => {
    const bs = buckets(s, range);
    const txs = txBetween(s, from === -Infinity ? -1e12 : from, s.clock.t + 1);
    const totals = periodTotals(txs);
    const snaps = s.snapshots.filter((x) => x.t >= from);
    const avgInvCost = snaps.length ? snaps.reduce((a, x) => a + x.inventoryCost, 0) / snaps.length : inventoryCost(s);
    const turnover = avgInvCost > 0 ? totals.cogs / avgInvCost : 0;

    const byProduct = new Map<string, { units: number; revenue: number; profit: number; proceeds: number }>();
    for (const t of txs) {
      if ((t.type === 'sale' || t.type === 'store_sale') && t.productId) {
        const r = byProduct.get(t.productId) ?? { units: 0, revenue: 0, profit: 0, proceeds: 0 };
        r.units += t.qty ?? 0;
        r.revenue += t.total;
        r.profit += t.realizedPnl ?? 0;
        byProduct.set(t.productId, r);
      }
    }
    const best = [...byProduct.entries()].sort((a, b) => b[1].units - a[1].units).slice(0, 8);
    const margins = [...byProduct.entries()].filter(([, r]) => r.revenue > 0).sort((a, b) => b[1].profit / b[1].revenue - a[1].profit / a[1].revenue);
    const soldIds = new Set(byProduct.keys());
    const slow = Object.values(s.holdings)
      .filter((h) => s.clock.t - h.firstAcquiredAt > 2 * MINUTES_PER_DAY && !soldIds.has(h.productId))
      .sort((a, b) => b.qty * s.market[b.productId].price - a.qty * s.market[a.productId].price)
      .slice(0, 8);

    // Visitors per bucket from cumulative snapshot counters.
    const visitorsAt = (t: number) => {
      let v = 0;
      for (const x of s.snapshots) {
        if (x.t <= t) v = x.visitors;
        else break;
      }
      return v;
    };

    return { bs, totals, turnover, best, margins, slow, visitorsAt };
  }, [s, range, from]);

  const { bs, totals } = data;
  const revenueBars = bs.map((b) => {
    const p = periodTotals(b.txs);
    return {
      label: b.label,
      values: [
        { name: 'Gross revenue', v: p.revenue, color: '#5ab0ff' },
        { name: 'Realized profit', v: p.profit, color: p.profit >= 0 ? '#2fd17c' : '#ff4d5e' },
      ],
    };
  });
  const expenseBars = bs.map((b) => {
    const p = periodTotals(b.txs);
    return {
      label: b.label,
      values: [
        { name: 'Inventory purchases', v: p.purchases, color: '#9ca3af' },
        { name: 'Fees & operating', v: p.fees + p.operating, color: '#ffb547' },
        { name: 'Investments', v: p.investments, color: '#b36bff' },
      ],
    };
  });
  const cashBars = bs.map((b) => {
    const p = periodTotals(b.txs);
    return {
      label: b.label,
      values: [
        { name: 'Cash in', v: p.cashIn, color: '#2fd17c' },
        { name: 'Cash out', v: -p.cashOut, color: '#ff4d5e' },
        { name: 'Net', v: p.netCash, color: '#f4f4f5' },
      ],
    };
  });
  const storeBars = bs.map((b) => {
    const p = periodTotals(b.txs);
    return {
      label: b.label,
      values: [
        { name: 'Store revenue', v: p.storeRevenue, color: '#e5132f' },
        { name: 'Visitors', v: Math.max(0, data.visitorsAt(b.to) - data.visitorsAt(b.from)), color: '#55555f' },
      ],
    };
  });
  const snaps = s.snapshots.filter((x) => x.t >= from);
  const invSeries = [
    { id: 'value', label: 'Market value', color: '#2fd17c', t: snaps.map((x) => x.t), v: snaps.map((x) => x.inventoryValue) },
    { id: 'cost', label: 'Acquisition cost', color: '#f3d27a', t: snaps.map((x) => x.t), v: snaps.map((x) => x.inventoryCost) },
  ];
  const nwSeries = [
    { id: 'nw', label: 'Net worth', color: '#e5132f', t: snaps.map((x) => x.t), v: snaps.map((x) => x.netWorth) },
    { id: 'cash', label: 'Cash', color: '#5ab0ff', t: snaps.map((x) => x.t), v: snaps.map((x) => x.cash) },
  ];

  // Warnings and advisory recommendations from real data.
  const warnings: string[] = [];
  const invCost = inventoryCost(s);
  const tied = invCost / Math.max(1, invCost + s.wallet.cash);
  if (tied > 0.7) warnings.push(`${Math.round(tied * 100)}% of your capital is tied up in unsold inventory (cost ${cr(invCost)} CR vs ${cr(s.wallet.cash)} CR cash). A bad market move could leave you unable to restock or pay costs.`);
  const held = Object.values(s.holdings);
  if (held.length) {
    let w = 0;
    let ch = 0;
    for (const h of held) {
      const c = h.qty * h.avgCost;
      w += c;
      ch += c * changeOver(s.market[h.productId], 7 * MINUTES_PER_DAY);
    }
    const rise = w > 0 ? ch / w : 0;
    if (rise > 0.08) warnings.push(`Restocking costs are rising: the products you hold are ${pct(rise)} more expensive than 7 days ago. Supplier contracts lock in lower prices.`);
  }
  if (totals.revenue > 0 && totals.fees + totals.operating > totals.profit && totals.profit > 0)
    warnings.push(`Fees and operating costs (${cr(totals.fees + totals.operating)} CR) exceed realized profit (${cr(totals.profit)} CR) for this period.`);

  const recs: string[] = [];
  if (advanced) {
    for (const h of held) {
      const mp = s.market[h.productId];
      const past = demandAgo(mp, 24);
      const dChange = past > 0 ? mp.demand / past - 1 : 0;
      if (dChange < -0.1 && h.qty >= 3)
        recs.push(`You have ${h.qty} units of ${PRODUCT_BY_ID[h.productId].name} with declining demand (${pct(dChange, 0)} in 24h). Consider adjusting your sale price or listing it sooner.`);
    }
    for (const st of s.stores)
      for (const l of st.listings) {
        const ratio = l.price / s.market[l.productId].price;
        if (ratio > 1.3 && st.open && l.sold === 0 && s.clock.t - l.createdAt > MINUTES_PER_DAY / 2)
          recs.push(`${PRODUCT_BY_ID[l.productId].name} in ${st.name} is priced ${pct(ratio - 1, 0)} above market and hasn’t sold in ${formatDuration(s.clock.t - l.createdAt)}. A lower price converts far more visitors.`);
        if (ratio < 0.9) recs.push(`${PRODUCT_BY_ID[l.productId].name} in ${st.name} is ${pct(ratio - 1, 0)} below market — it will sell fast, but you may be leaving margin on the table.`);
      }
    const store = activeStore(s);
    if (store.open && store.listings.length < listingSlots(s) && held.some((h) => store.categories.includes(PRODUCT_BY_ID[h.productId].category) && h.qty > listedQty(s, h.productId)))
      recs.push(`${store.name} has ${listingSlots(s) - store.listings.length} free listing slots and you hold unlisted stock it can sell.`);
    for (const st of s.stores) if (!st.open && st.listings.length > 0) recs.push(`${st.name} is closed but has ${st.listings.length} listings. Open it to start selling.`);
    for (const h of data.slow.slice(0, 2)) recs.push(`${PRODUCT_BY_ID[h.productId].name} hasn’t sold in this period (held ${formatDuration(s.clock.t - h.firstAcquiredAt)}). Slow stock ties up cash.`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Business intelligence</div>
          <h1>Analytics</h1>
          <p className="sub">Built from your transaction ledger and hourly snapshots. Revenue is gross sales; profit is what remains after cost of goods and selling fees.</p>
        </div>
        <Segmented
          value={range}
          onChange={setRange}
          label="Date range"
          options={[
            { value: '1d', label: '24h' },
            { value: '3d', label: '3 days' },
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {warnings.length > 0 && (
        <div className="col" style={{ gap: 8, marginBottom: 16 }}>
          {warnings.map((w) => (
            <div key={w} className="notice notice-warn">
              <AlertTriangle size={16} />
              <div>{w}</div>
            </div>
          ))}
        </div>
      )}

      <div className="stats-row">
        <Stat label="Gross revenue">
          <Credits value={totals.revenue} />
        </Stat>
        <Stat label="Realized profit" foot={totals.revenue > 0 ? `${pct(totals.profit / totals.revenue)} net margin` : undefined}>
          <span className={totals.profit >= 0 ? 'up' : 'down'}>{crSigned(totals.profit)}</span>
        </Stat>
        <Stat label="Expenses" foot="Selling fees + operating costs">
          <Credits value={totals.fees + totals.operating} />
        </Stat>
        <Stat label="Inventory bought">
          <Credits value={totals.purchases} />
        </Stat>
        <Stat label="Net cash flow">
          <span className={totals.netCash >= 0 ? 'up' : 'down'}>{crSigned(totals.netCash)}</span>
        </Stat>
        <Stat label="Units sold">{int(totals.unitsSold)}</Stat>
      </div>

      <div className="grid grid-2 section" style={{ marginTop: 20 }}>
        <ChartCard title="Revenue vs realized profit">
          <BarChart bars={revenueBars} />
        </ChartCard>
        <ChartCard title="Expenses & spending">
          <BarChart bars={expenseBars} />
        </ChartCard>
        <ChartCard title="Cash-flow history">
          <BarChart bars={cashBars} />
        </ChartCard>
        <ChartCard title="Store growth" sub={`Lifetime store revenue ${cr(storeRevenueTotal(s))} CR`}>
          <BarChart bars={storeBars} valueFormat={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v)))} />
        </ChartCard>
        <ChartCard title="Inventory value vs cost" sub={`Now ${cr(inventoryValue(s))} CR value · ${cr(invCost)} CR cost`}>
          {snaps.length > 1 ? <Chart series={invSeries} height={220} area={false} compactAxis /> : <Empty title="Not enough history yet" />}
        </ChartCard>
        <ChartCard title="Net worth & cash">
          {snaps.length > 1 ? <Chart series={nwSeries} height={220} area={false} compactAxis /> : <Empty title="Not enough history yet" />}
        </ChartCard>
      </div>

      <div className="grid grid-2 section" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h3 className="row" style={{ gap: 8 }}>
              <TrendingUp size={16} /> Best-selling products
            </h3>
          </div>
          <div className="card-body">
            {data.best.length === 0 && <div className="dim">No sales in this period.</div>}
            {data.best.map(([id, r]) => (
              <Link key={id} to={`/product/${id}`} className="list-row">
                <ProductThumb id={id} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600 }}>{PRODUCT_BY_ID[id].name}</div>
                  <div className="dim" style={{ fontSize: 12 }}>
                    {int(r.units)} units · {cr(r.revenue)} CR revenue
                  </div>
                </div>
                <span className={`num ${r.profit >= 0 ? 'up' : 'down'}`}>{crSigned(r.profit)}</span>
              </Link>
            ))}
          </div>
        </div>

        <Advanced locked={!advanced} title="Inventory turnover & slow movers">
          <div className="spread" style={{ marginBottom: 10 }}>
            <Stat label="Inventory turnover" foot="Cost of goods sold ÷ average inventory cost">
              {data.turnover.toFixed(2)}×
            </Stat>
            <Stat label="COGS">
              <Credits value={totals.cogs} />
            </Stat>
          </div>
          <div className="label" style={{ margin: '10px 0 4px' }}>Slow-moving inventory (held 2+ days, no sales this period)</div>
          {data.slow.length === 0 && <div className="dim" style={{ fontSize: 13 }}>No slow movers. Nice.</div>}
          {data.slow.map((h) => (
            <div key={h.productId} className="list-row">
              <ProductThumb id={h.productId} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>{PRODUCT_BY_ID[h.productId].name}</div>
                <div className="dim" style={{ fontSize: 12 }}>
                  {h.qty} units · held {formatDuration(s.clock.t - h.firstAcquiredAt)}
                </div>
              </div>
              <span className="num">{cr(h.qty * s.market[h.productId].price)}</span>
            </div>
          ))}
        </Advanced>
      </div>

      <div className="grid grid-2 section" style={{ alignItems: 'start' }}>
        <Advanced locked={!advanced} title="Product margins">
          {data.margins.length === 0 && <div className="dim" style={{ fontSize: 13 }}>Margins appear once you sell products.</div>}
          {data.margins.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Units</th>
                    <th className="num">Revenue</th>
                    <th className="num">Profit</th>
                    <th className="num">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.margins.slice(0, 10).map(([id, r]) => (
                    <tr key={id}>
                      <td className="ellipsis" style={{ maxWidth: 200 }}>{PRODUCT_BY_ID[id].name}</td>
                      <td className="num">{r.units}</td>
                      <td className="num">{cr(r.revenue)}</td>
                      <td className={`num ${r.profit >= 0 ? 'up' : 'down'}`}>{crSigned(r.profit)}</td>
                      <td className={`num ${r.profit >= 0 ? 'up' : 'down'}`}>{pct(r.profit / r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Advanced>
        <Advanced locked={!advanced} title="Recommendations">
          {recs.length === 0 && <div className="dim" style={{ fontSize: 13 }}>No suggestions right now. Recommendations are advisory and never change your business automatically.</div>}
          {recs.slice(0, 8).map((r) => (
            <div key={r} className="list-row" style={{ alignItems: 'flex-start' }}>
              <Lightbulb size={16} className="gold" style={{ flex: 'none', marginTop: 2 }} />
              <span style={{ fontSize: 13 }}>{r}</span>
            </div>
          ))}
        </Advanced>
      </div>
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {sub && <span className="dim" style={{ fontSize: 12 }}>{sub}</span>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function Advanced({ locked, title, children }: { locked: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {locked && (
          <span className="badge">
            <Lock size={11} /> Advanced Analytics
          </span>
        )}
      </div>
      <div className="card-body">
        {locked ? (
          <Notice tone="info">
            Unlock with the <Link to="/store?tab=upgrades" className="accent">Advanced Analytics</Link> upgrade (tier 1). It adds product margins, inventory turnover, slow-mover detection and
            recommendations.
          </Notice>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
