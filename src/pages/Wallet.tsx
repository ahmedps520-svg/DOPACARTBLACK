import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Receipt, ShieldCheck } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { Credits, Empty, Stat } from '../components/ui';
import { Chart } from '../components/Chart';
import { inTransitValue, inventoryCost, inventoryValue } from '../engine/selectors';
import { cr, crSigned, int } from '../lib/format';
import { dayOf, formatGameTime } from '../engine/time';
import type { TxType } from '../engine/types';

export const TX_LABEL: Record<TxType, string> = {
  starting_balance: 'Starting balance',
  purchase: 'Purchase',
  sale: 'Market sale',
  store_sale: 'Store sale',
  fee: 'Fee',
  supplier_order: 'Supplier order',
  refund: 'Refund',
  operating_cost: 'Operating cost',
  upgrade: 'Upgrade',
  store_open: 'Store opening',
  reward: 'Reward',
};

const PAGE = 40;

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function WalletPage() {
  const s = useGameState((st) => st);
  const w = s.wallet;
  const inv = inventoryValue(s);
  const invCost = inventoryCost(s);
  const transit = inTransitValue(s);
  const [types, setTypes] = useState<Set<TxType>>(new Set());
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const fd = fromDay ? Number(fromDay) : -Infinity;
    const td = toDay ? Number(toDay) : Infinity;
    const needle = q.trim().toLowerCase();
    return s.transactions
      .filter((tx) => {
        if (types.size && !types.has(tx.type)) return false;
        const d = dayOf(tx.t);
        if (d < fd || d > td) return false;
        if (needle) {
          const name = tx.productId ? PRODUCT_BY_ID[tx.productId]?.name ?? '' : '';
          if (!`${tx.id} ${tx.memo} ${name} ${tx.orderId ?? ''}`.toLowerCase().includes(needle)) return false;
        }
        return true;
      })
      .reverse();
  }, [s.transactions, types, fromDay, toDay, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const cashSeries = useMemo(() => {
    const pts = s.snapshots.slice(-24 * 7);
    return [{ id: 'cash', label: 'Cash', color: 'var(--accent)', t: [...pts.map((p) => p.t), s.clock.t], v: [...pts.map((p) => p.cash), w.cash] }];
  }, [s.snapshots, s.clock.t, w.cash]);

  const toggleType = (t: TxType) => {
    const n = new Set(types);
    if (n.has(t)) n.delete(t);
    else n.add(t);
    setTypes(n);
    setPage(0);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Virtual wallet</div>
          <h1>Wallet</h1>
          <p className="sub">Every credit in or out is recorded below. Inventory is never counted as cash, and realized profit is kept separate from paper gains on unsold stock.</p>
        </div>
      </div>

      <div className="wallet-hero">
        <div className="balance-card">
          <span className="label">Available balance</span>
          <span className="amount">
            {cr(w.cash)} <span style={{ fontSize: 16, color: 'var(--text-3)' }}>CR</span>
          </span>
          <span className="dim" style={{ fontSize: 12, marginTop: 6 }}>
            Spendable cash · started with {cr(w.startingBalance)} CR
          </span>
          <span className="row dim" style={{ marginTop: 'auto', fontSize: 11, gap: 6, paddingTop: 18 }}>
            <ShieldCheck size={13} /> Virtual game currency. No real-world value; cannot be bought, withdrawn or exchanged.
          </span>
        </div>
        <div className="card card-pad">
          <div className="spread">
            <span className="label">Cash over the last 7 days</span>
            <span className="dim" style={{ fontSize: 11 }}>Hourly snapshots</span>
          </div>
          {cashSeries[0].t.length > 2 ? <Chart series={cashSeries} height={170} compactAxis /> : <div className="dim" style={{ padding: 30 }}>Cash history records every in-game hour.</div>}
        </div>
      </div>

      <div className="stats-row" style={{ marginTop: 16 }}>
        <Stat label="Inventory value" foot={`Cost ${cr(invCost)} CR`}>
          <Credits value={inv} />
        </Stat>
        <Stat label="Total business assets" foot="Cash + inventory + in transit">
          <Credits value={w.cash + inv + transit} />
        </Stat>
        <Stat label="Lifetime spending" foot="Net of refunds">
          <Credits value={w.lifetimeSpending} />
        </Stat>
        <Stat label="Lifetime revenue" foot="Gross sales">
          <Credits value={w.lifetimeRevenue} />
        </Stat>
        <Stat label="Realized profit" foot="Sales net of fees − cost">
          <span className={w.realizedProfit >= 0 ? 'up' : 'down'}>{crSigned(w.realizedProfit)}</span>
        </Stat>
        <Stat label="Unrealized gain / loss" foot="Unsold stock at market">
          <span className={inv - invCost >= 0 ? 'up' : 'down'}>{crSigned(inv - invCost)}</span>
        </Stat>
        <Stat label="Operating expenses" foot="Rent & lost cancellation fees">
          <Credits value={w.operatingExpenses} />
        </Stat>
        <Stat label="Business investments" foot="Upgrades & new stores">
          <Credits value={w.investments} />
        </Stat>
        <Stat label="Selling fees" foot="Included in realized profit">
          <Credits value={w.sellingFees} />
        </Stat>
        <Stat label="Rewards earned" foot="Missions & challenges">
          <Credits value={w.rewards} />
        </Stat>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Transaction history</h2>
            <div className="sub">{int(filtered.length)} of {int(s.transactions.length)} records</div>
          </div>
          <button
            className="btn btn-sm"
            onClick={() =>
              downloadCsv('dopacart-transactions.csv', [
                ['id', 'day', 'time', 'type', 'product', 'qty', 'unit_price', 'total', 'balance_after', 'realized_pnl', 'memo'],
                ...filtered.map((tx) => [
                  tx.id,
                  dayOf(tx.t),
                  formatGameTime(tx.t),
                  TX_LABEL[tx.type],
                  tx.productId ? PRODUCT_BY_ID[tx.productId]?.name ?? tx.productId : '',
                  tx.qty ?? '',
                  tx.unitPrice ?? '',
                  tx.total,
                  tx.balanceAfter,
                  tx.realizedPnl ?? '',
                  tx.memo,
                ]),
              ])
            }
            disabled={filtered.length === 0}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="card card-pad" style={{ marginBottom: 12 }}>
          <div className="filter-bar">
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Search ID, product, memo…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search transactions" />
            <div className="row">
              <label className="label" htmlFor="tx-from">Day</label>
              <input id="tx-from" className="input" style={{ width: 80 }} inputMode="numeric" placeholder="From" value={fromDay} onChange={(e) => { setFromDay(e.target.value.replace(/[^\d-]/g, '')); setPage(0); }} />
              <span className="dim">–</span>
              <input className="input" style={{ width: 80 }} inputMode="numeric" placeholder="To" value={toDay} onChange={(e) => { setToDay(e.target.value.replace(/[^\d-]/g, '')); setPage(0); }} aria-label="To day" />
            </div>
          </div>
          <div className="row-wrap" style={{ marginTop: 12 }}>
            {(Object.keys(TX_LABEL) as TxType[]).map((t) => (
              <button key={t} className="chip" aria-pressed={types.has(t)} onClick={() => toggleType(t)}>
                {TX_LABEL[t]}
              </button>
            ))}
            {(types.size > 0 || fromDay || toDay || q) && (
              <button className="btn btn-xs btn-ghost" onClick={() => { setTypes(new Set()); setFromDay(''); setToDay(''); setQ(''); setPage(0); }}>
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="card">
          {rows.length === 0 ? (
            <Empty icon={<Receipt size={30} />} title="No transactions match" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date · time</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit price</th>
                    <th className="num">Total</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((tx) => (
                    <tr key={tx.id} title={tx.memo}>
                      <td className="num dim">{tx.id}</td>
                      <td className="num nowrap">{formatGameTime(tx.t)}</td>
                      <td>
                        <span className={`badge ${tx.total > 0 ? 'badge-up' : tx.total < 0 ? 'badge-down' : ''}`}>{TX_LABEL[tx.type]}</span>
                      </td>
                      <td style={{ maxWidth: 280 }}>
                        {tx.productId ? (
                          <Link to={`/product/${tx.productId}`} className="ellipsis" style={{ display: 'block' }}>
                            {PRODUCT_BY_ID[tx.productId]?.name}
                          </Link>
                        ) : (
                          <span className="dim ellipsis" style={{ display: 'block' }}>
                            {tx.orderId ? <Link to={`/orders/${tx.orderId}`}>{tx.memo}</Link> : tx.memo}
                          </span>
                        )}
                        {tx.realizedPnl !== undefined && (
                          <span className={`num ${tx.realizedPnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: 11 }}>
                            P/L {crSigned(tx.realizedPnl)}
                          </span>
                        )}
                      </td>
                      <td className="num">{tx.qty ?? '—'}</td>
                      <td className="num">{tx.unitPrice !== undefined ? cr(tx.unitPrice) : '—'}</td>
                      <td className={`num ${tx.total >= 0 ? 'up' : 'down'}`} style={{ fontWeight: 600 }}>
                        {crSigned(tx.total)}
                      </td>
                      <td className="num">{cr(tx.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="card-foot spread">
              <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Newer
              </button>
              <span className="dim" style={{ fontSize: 12 }}>
                Page {page + 1} of {pages}
              </span>
              <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Older
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
