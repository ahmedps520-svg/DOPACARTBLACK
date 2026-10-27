import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Truck, Package, PackageCheck, Boxes, ClipboardList, Cog, MapPin, Ban, Zap, AlertTriangle, ChevronLeft } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { SUPPLIER_BY_ID } from '../engine/suppliers';
import { STATUS_FLOW, STATUS_LABEL, cancelTerms, displayEta, isDelayed, statusSchedule } from '../engine/orders';
import { cancelOrder } from '../engine/commands';
import { ProductThumb } from '../components/ProductCard';
import { ConfirmModal, Credits, Empty, Notice } from '../components/ui';
import { useAction, useIntentKey } from '../lib/hooks';
import { cr, int } from '../lib/format';
import { formatAgo, formatDuration, formatGameTime } from '../engine/time';
import type { Order, OrderStatus } from '../engine/types';
import { NotFound } from './NotFound';

const STEP_ICON: Record<Exclude<OrderStatus, 'cancelled'>, typeof Truck> = {
  placed: ClipboardList,
  processing: Cog,
  packed: Boxes,
  shipped: Truck,
  out_for_delivery: MapPin,
  delivered: PackageCheck,
};

function statusBadge(o: Order, t: number) {
  if (o.status === 'delivered') return <span className="badge badge-up">Delivered</span>;
  if (o.status === 'cancelled') return <span className="badge badge-down">Cancelled</span>;
  if (isDelayed(o, t)) return <span className="badge badge-down">Delayed · {STATUS_LABEL[o.status]}</span>;
  return <span className="badge badge-warn">{STATUS_LABEL[o.status]}</span>;
}

export function Tracker({ o, compact }: { o: Order; compact?: boolean }) {
  // Unreported delays stay hidden: future steps use the original promise.
  const sched = statusSchedule(displayEta(o).revised ? o : { ...o, delay: 0 });
  const idx = o.status === 'cancelled' ? STATUS_FLOW.indexOf(o.history[o.history.length - 2]?.status ?? 'placed') : STATUS_FLOW.indexOf(o.status);
  const fillPct = (Math.max(0, idx) / (STATUS_FLOW.length - 1)) * 83.33;
  const reached = new Map(o.history.map((h) => [h.status, h.t]));
  return (
    <div className="tracker" aria-label={`Order status: ${STATUS_LABEL[o.status]}`}>
      <span className="fill" style={{ width: `${fillPct}%`, background: o.status === 'cancelled' ? 'var(--down)' : undefined }} />
      {STATUS_FLOW.map((st, i) => {
        const Icon = STEP_ICON[st as Exclude<OrderStatus, 'cancelled'>];
        const done = i < idx || (i === idx && o.status === 'delivered');
        const current = i === idx && o.status !== 'delivered' && o.status !== 'cancelled';
        const when = reached.get(st);
        const showPlanned = !when && o.status !== 'cancelled' && o.kind === 'supplier';
        return (
          <div key={st} className={`tracker-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <span className="dot">
              <Icon size={compact ? 13 : 15} />
            </span>
            <span className="lbl">{STATUS_LABEL[st]}</span>
            {!compact && (
              <span className="when">
                {when !== undefined ? formatGameTime(when) : showPlanned ? `≈ ${formatGameTime(sched[st as keyof typeof sched])}` : '—'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type Filter = 'active' | 'all' | 'delivered' | 'cancelled';

export function Orders() {
  const orders = useGameState((s) => s.orders);
  const now = useGameState((s) => s.clock.t);
  const [filter, setFilter] = useState<Filter>('active');
  const list = orders.filter((o) =>
    filter === 'all' ? true : filter === 'active' ? o.status !== 'delivered' && o.status !== 'cancelled' : o.status === filter,
  );
  const counts = {
    active: orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
    all: orders.length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Fulfilment</div>
          <h1>Orders</h1>
          <p className="sub">Track simulated deliveries. Statuses advance with the in-game clock — including while the game is closed. These are game events, not real shipments.</p>
        </div>
        <Link to="/suppliers" className="btn btn-primary btn-sm">
          <Truck size={14} /> New supplier order
        </Link>
      </div>
      <div className="tabs" role="tablist">
        {(['active', 'all', 'delivered', 'cancelled'] as Filter[]).map((f) => (
          <button key={f} className="tab" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
            {f === 'active' ? 'In progress' : f[0].toUpperCase() + f.slice(1)} <span className="dim">{counts[f]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="card">
          <Empty icon={<Package size={30} />} title={filter === 'active' ? 'No orders in progress' : 'No orders here'}>
            Supplier orders appear here with live tracking. Market purchases are filled instantly.
          </Empty>
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {list.slice(0, 100).map((o) => (
            <Link key={o.id} to={`/orders/${o.id}`} className="card order-card" style={{ display: 'block' }}>
              <div className="spread" style={{ flexWrap: 'wrap' }}>
                <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                  <span className="num" style={{ fontWeight: 700 }}>{o.id}</span>
                  {statusBadge(o, now)}
                  <span className="dim" style={{ fontSize: 12 }}>
                    {o.kind === 'market' ? 'Market purchase · instant' : SUPPLIER_BY_ID[o.supplierId!]?.name} · {formatGameTime(o.placedAt)}
                  </span>
                </div>
                <div className="row" style={{ gap: 14 }}>
                  {o.kind === 'supplier' && o.status !== 'delivered' && o.status !== 'cancelled' && (
                    <span className="dim" style={{ fontSize: 12 }}>ETA {formatDuration(Math.max(0, displayEta(o).t - now))}</span>
                  )}
                  <Credits value={o.total} />
                </div>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
                {o.lines.slice(0, 6).map((l) => (
                  <span key={l.productId} className="row" style={{ gap: 6 }}>
                    <ProductThumb id={l.productId} />
                    <span style={{ fontSize: 12 }}>
                      {l.qty}× <span className="dim">{PRODUCT_BY_ID[l.productId].name}</span>
                    </span>
                  </span>
                ))}
              </div>
              {o.kind === 'supplier' && o.status !== 'cancelled' && (
                <div style={{ marginTop: 14 }}>
                  <Tracker o={o} compact />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const o = useGameState((s) => s.orders.find((x) => x.id === id));
  const now = useGameState((s) => s.clock.t);
  const [confirm, setConfirm] = useState(false);
  const [key, renewKey] = useIntentKey();
  const { run, busy } = useAction();
  if (!o) return <NotFound />;
  const terms = cancelTerms(o);
  const sup = o.supplierId ? SUPPLIER_BY_ID[o.supplierId] : undefined;
  const units = o.lines.reduce((a, l) => a + l.qty, 0);
  const shown = displayEta(o);

  return (
    <div className="page">
      <Link to="/orders" className="row dim" style={{ fontSize: 12, marginBottom: 12 }}>
        <ChevronLeft size={14} /> All orders
      </Link>
      <div className="page-head">
        <div>
          <div className="kicker">{o.kind === 'market' ? 'Market purchase' : `Supplier order · ${sup?.name}`}</div>
          <h1 className="num">{o.id}</h1>
          <p className="sub">
            Placed {formatGameTime(o.placedAt)} ({formatAgo(now, o.placedAt)}) · {int(units)} units
          </p>
        </div>
        <div className="row-wrap">
          {statusBadge(o, now)}
          {terms.allowed && (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirm(true)} disabled={busy}>
              <Ban size={14} /> Cancel order
            </button>
          )}
        </div>
      </div>

      <div className="card card-pad">
        {o.kind === 'market' ? (
          <Notice tone="up">
            <span className="row" style={{ gap: 6 }}>
              <Zap size={14} /> Instant market fill — items were added to your inventory the moment you paid.
            </span>
          </Notice>
        ) : (
          <>
            <Tracker o={o} />
            <div className="spread" style={{ marginTop: 18, flexWrap: 'wrap' }}>
              {o.status === 'delivered' ? (
                <span className="up">Delivered {formatGameTime(o.history[o.history.length - 1].t)} — goods added to inventory.</span>
              ) : o.status === 'cancelled' ? (
                <span className="down">Cancelled {formatGameTime(o.history[o.history.length - 1].t)} · refunded {cr(o.refund ?? 0)} CR{o.cancelFee ? ` (${cr(o.cancelFee)} CR not refundable)` : ''}.</span>
              ) : (
                <span>
                  {shown.revised ? (
                    <span className="down row" style={{ gap: 6, display: 'inline-flex' }}>
                      <AlertTriangle size={14} /> Delayed by the supplier. New estimate:
                    </span>
                  ) : (
                    'Estimated delivery:'
                  )}{' '}
                  <strong className="num">{formatGameTime(shown.t)}</strong> <span className="dim">(in {formatDuration(Math.max(0, shown.t - now))})</span>
                </span>
              )}
              {sup && <span className="dim" style={{ fontSize: 12 }}>{Math.round(sup.reliability * 100)}% on-time supplier</span>}
            </div>
          </>
        )}
      </div>

      <div className="split section">
        <div className="card">
          <div className="card-head">
            <h2>Items</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit price</th>
                  <th className="num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.productId}>
                    <td>
                      <Link to={`/product/${l.productId}`} className="row" style={{ gap: 10 }}>
                        <ProductThumb id={l.productId} />
                        <span style={{ fontWeight: 600 }}>{PRODUCT_BY_ID[l.productId].name}</span>
                      </Link>
                    </td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{cr(l.unitPrice)}</td>
                    <td className="num">{cr(l.unitPrice * l.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card card-pad">
          <div className="section-title" style={{ marginBottom: 12 }}>Summary</div>
          <dl className="kv">
            <dt>Subtotal</dt>
            <dd>{cr(o.subtotal)}</dd>
            <dt>Freight</dt>
            <dd>{cr(o.shipping)}</dd>
            <dt>Total paid</dt>
            <dd style={{ fontWeight: 700 }}>{cr(o.total)}</dd>
            {o.refund !== undefined && (
              <>
                <dt>Refunded</dt>
                <dd className="up">{cr(o.refund)}</dd>
              </>
            )}
          </dl>
          <div className="divider" />
          <div className="label" style={{ marginBottom: 6 }}>Cancellation policy</div>
          <ul className="hint" style={{ margin: 0, paddingLeft: 16 }}>
            <li>Before packing: full refund including freight.</li>
            <li>Packed or shipped: 85% of goods refunded; freight is lost.</li>
            <li>Out for delivery or delivered: cannot be cancelled.</li>
          </ul>
          <p className="hint" style={{ marginTop: 10 }}>Now: {terms.rule}</p>
        </div>
      </div>

      <ConfirmModal
        open={confirm}
        danger
        title={`Cancel ${o.id}?`}
        confirmLabel={`Cancel & refund ${cr(terms.refund)} CR`}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          const r = run((st) => cancelOrder(st, o.id, key), { success: `Order ${o.id} cancelled`, successBody: `${cr(terms.refund)} CR refunded to your wallet.` });
          if (r?.ok) renewKey();
          setConfirm(false);
        }}
      >
        <p className="muted">{terms.rule}</p>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Refund</dt>
          <dd className="up">{cr(terms.refund)} CR</dd>
          <dt>Not refunded</dt>
          <dd className="down">{cr(terms.fee)} CR</dd>
        </dl>
      </ConfirmModal>
    </div>
  );
}
