import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Factory, Lock, Trash2, Truck, Star, Search, BadgePercent } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { SUPPLIERS, SUPPLIER_BY_ID, specialOffer, supplierCatalog, volumeDiscount, type SupplierDef } from '../engine/suppliers';
import { quoteSupplierOrder } from '../engine/orders';
import { placeSupplierOrder } from '../engine/commands';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { CATEGORY_BY_ID, RARITY_LABEL } from '../engine/categories';
import { ProductThumb } from '../components/ProductCard';
import { Credits, Empty, Notice, RarityTag } from '../components/ui';
import { useAction, useIntentKey } from '../lib/hooks';
import { cr, pct } from '../lib/format';
import { dayOf, formatDuration } from '../engine/time';
import { MINUTES_PER_DAY } from '../engine/constants';
import { capacity, capacityUsed } from '../engine/selectors';
import { upgradeValue } from '../engine/upgrades';
import { rarityUnlockLevel } from '../engine/progression';
import type { GameState } from '../engine/types';

function remainingToday(s: GameState, sup: SupplierDef) {
  const u = s.supplierUsage[sup.id];
  return sup.capacityPerDay - (u && u.day === dayOf(s.clock.t) ? u.units : 0);
}

export function Suppliers() {
  const s = useGameState((st) => st);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('s') ?? SUPPLIERS.find((x) => x.unlockLevel <= s.progression.level)?.id ?? SUPPLIERS[0].id;
  const sup = SUPPLIER_BY_ID[selectedId] ?? SUPPLIERS[0];
  const [lines, setLines] = useState<Record<string, Record<string, number>>>({});
  const [q, setQ] = useState('');
  const [key, renewKey] = useIntentKey();
  const { run, busy } = useAction();
  const nav = useNavigate();
  const level = s.progression.level;
  const myLines = lines[sup.id] ?? {};
  const orderLines = Object.entries(myLines)
    .filter(([, qty]) => qty > 0)
    .map(([productId, qty]) => ({ productId, qty }));
  const quote = useMemo(() => quoteSupplierOrder(s, sup, orderLines), [s, sup, JSON.stringify(orderLines)]); // eslint-disable-line react-hooks/exhaustive-deps
  const offer = specialOffer(s, sup);
  const stock = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return supplierCatalog(sup)
      .filter((p) => s.market[p.id].listed)
      .filter((p) => !needle || `${p.name} ${p.brand}`.toLowerCase().includes(needle))
      .sort((a, b) => (offer?.productId === a.id ? -1 : offer?.productId === b.id ? 1 : s.market[a.id].price - s.market[b.id].price));
  }, [sup, s.market, q, offer?.productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setQty = (pid: string, qty: number) => setLines((prev) => ({ ...prev, [sup.id]: { ...(prev[sup.id] ?? {}), [pid]: Math.max(0, Math.min(500, qty)) } }));
  const locked = level < sup.unlockLevel;

  const place = () => {
    const r = run((st) => placeSupplierOrder(st, sup.id, orderLines, key), {
      sound: 'buy',
      success: 'Supplier order placed',
      successBody: `${quote.units} units · ${cr(quote.total)} CR · ETA ${formatDuration(quote.plannedDuration)}`,
    });
    if (r?.ok) {
      renewKey();
      setLines((prev) => ({ ...prev, [sup.id]: {} }));
      const o = r.data as { id: string };
      nav(`/orders/${o.id}`);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Wholesale</div>
          <h1>Suppliers</h1>
          <p className="sub">Buy stock below market price — but you wait for delivery, meet minimum orders and accept each supplier’s reliability. Goods only reach your inventory when the simulated delivery completes.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Compare suppliers</h2>
          <span className="dim" style={{ fontSize: 12 }}>Express Logistics: {pct(1 - upgradeValue(s, 'logistics')).replace('+', '')} faster</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Categories</th>
                <th className="num">Price vs market</th>
                <th className="num">Delivery</th>
                <th className="num">On-time</th>
                <th className="num">Min. order</th>
                <th className="num">Capacity today</th>
                <th className="num">Freight</th>
                <th>Max rarity</th>
              </tr>
            </thead>
            <tbody>
              {SUPPLIERS.map((x) => {
                const lock = level < x.unlockLevel;
                return (
                  <tr key={x.id} onClick={() => setParams({ s: x.id }, { replace: true })} style={{ cursor: 'pointer', background: x.id === sup.id ? 'var(--surface-2)' : undefined, opacity: lock ? 0.55 : 1 }}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="store-badge" style={{ width: 32, height: 32, background: 'var(--surface-3)', fontSize: 14 }}>{x.monogram}</span>
                        <div>
                          <div style={{ fontWeight: 650 }}>{x.name}</div>
                          <div className="dim" style={{ fontSize: 11 }}>{lock ? <><Lock size={10} style={{ display: 'inline' }} /> Level {x.unlockLevel}</> : x.tagline}</div>
                        </div>
                      </div>
                    </td>
                    <td className="dim" style={{ fontSize: 12 }}>{x.categories.map((c) => CATEGORY_BY_ID[c].label).join(', ')}</td>
                    <td className="num up">−{Math.round((1 - x.priceRate) * 100)}%</td>
                    <td className="num">{formatDuration(x.deliveryDays * MINUTES_PER_DAY * upgradeValue(s, 'logistics'))}</td>
                    <td className="num">{Math.round(x.reliability * 100)}%</td>
                    <td className="num">{x.moq}</td>
                    <td className="num">{remainingToday(s, x)}/{x.capacityPerDay}</td>
                    <td className="num">{x.shipping} CR</td>
                    <td>{RARITY_LABEL[x.maxRarity]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split section">
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2>{sup.name}</h2>
              <div className="row-wrap" style={{ marginTop: 6 }}>
                {sup.strengths.map((t) => (
                  <span key={t} className="badge badge-up">{t}</span>
                ))}
                {sup.weaknesses.map((t) => (
                  <span key={t} className="badge badge-down">{t}</span>
                ))}
              </div>
            </div>
            <div className="header-search" style={{ maxWidth: 240, flex: '1 1 200px' }}>
              <Search size={15} />
              <input placeholder="Search stock…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search supplier stock" />
            </div>
          </div>
          {locked ? (
            <Empty icon={<Lock size={28} />} title={`Unlocks at level ${sup.unlockLevel}`}>
              Earn XP through profitable sales, missions and supplier deliveries.
            </Empty>
          ) : stock.length === 0 ? (
            <Empty icon={<Factory size={28} />} title="No stock matches" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Market</th>
                    <th className="num">Wholesale</th>
                    <th className="num">Order qty</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((p) => {
                    const mp = s.market[p.id];
                    const qty = myLines[p.id] ?? 0;
                    const isOffer = offer?.productId === p.id;
                    const disc = volumeDiscount(sup, Math.max(qty, sup.moq)) + (isOffer ? offer!.discount : 0);
                    const unit = mp.price * sup.priceRate * (1 - disc);
                    const rarityLocked = level < rarityUnlockLevel(p.rarity);
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link to={`/product/${p.id}`} className="row" style={{ gap: 10, minWidth: 200 }}>
                            <ProductThumb id={p.id} />
                            <div style={{ minWidth: 0 }}>
                              <div className="ellipsis" style={{ fontWeight: 600, maxWidth: 230 }}>{p.name}</div>
                              <div className="row" style={{ gap: 6 }}>
                                <RarityTag rarity={p.rarity} />
                                {isOffer && (
                                  <span className="badge badge-gold">
                                    <BadgePercent size={11} /> Today −12%
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="num">{cr(mp.price)}</td>
                        <td className="num">
                          <span className="up" style={{ fontWeight: 650 }}>{cr(unit)}</span>
                          <div className="dim" style={{ fontSize: 11 }}>{pct(unit / mp.price - 1)}</div>
                        </td>
                        <td className="num">
                          {rarityLocked ? (
                            <span className="dim" style={{ fontSize: 12 }}>
                              <Lock size={11} style={{ display: 'inline' }} /> Lv {rarityUnlockLevel(p.rarity)}
                            </span>
                          ) : (
                            <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                              {qty === 0 ? (
                                <button className="btn btn-xs" onClick={() => setQty(p.id, sup.moq)}>
                                  Add {sup.moq}
                                </button>
                              ) : (
                                <>
                                  <input className="input" style={{ width: 70, height: 30 }} inputMode="numeric" value={qty} onChange={(e) => setQty(p.id, parseInt(e.target.value.replace(/\D/g, '') || '0', 10))} aria-label={`Quantity of ${p.name}`} />
                                  <button className="btn btn-xs btn-ghost" onClick={() => setQty(p.id, 0)} aria-label="Remove">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card card-pad sticky-panel">
          <div className="section-title" style={{ marginBottom: 12 }}>Purchase order</div>
          {orderLines.length === 0 ? (
            <div className="dim" style={{ fontSize: 13 }}>Add products from {sup.name}. Minimum {sup.moq} units per product; volume discounts at {sup.moq * 3}+ (−4%) and {sup.moq * 8}+ (−8%).</div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {quote.lines.map((l) => (
                <div key={l.productId} className="spread" style={{ fontSize: 13 }}>
                  <span className="ellipsis grow">
                    {l.qty}× {PRODUCT_BY_ID[l.productId].name}
                  </span>
                  <span className="num">{cr(l.lineTotal)}</span>
                </div>
              ))}
              <div className="divider" style={{ margin: '8px 0' }} />
              <dl className="kv">
                <dt>Subtotal</dt>
                <dd>{cr(quote.subtotal)}</dd>
                <dt>Freight</dt>
                <dd>{cr(quote.shipping)}</dd>
                <dt>Total</dt>
                <dd style={{ fontWeight: 700 }}>{cr(quote.total)}</dd>
                <dt>Market value today</dt>
                <dd>{cr(quote.lines.reduce((a, l) => a + l.marketPrice * l.qty, 0))}</dd>
                <dt>Estimated delivery</dt>
                <dd>{formatDuration(quote.plannedDuration)}</dd>
                <dt>Warehouse after</dt>
                <dd>
                  {capacityUsed(s) + quote.units}/{capacity(s)}
                </dd>
              </dl>
              <div className="hint">
                <Star size={11} style={{ display: 'inline' }} /> {Math.round(sup.reliability * 100)}% on-time. Delays add 25–75% to transit time. Packed orders can be cancelled for an 85% refund.
              </div>
            </div>
          )}
          {orderLines.length > 0 && quote.errors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Notice tone="warn">
                {quote.errors.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </Notice>
            </div>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={busy || locked || orderLines.length === 0 || quote.errors.length > 0} onClick={place}>
            <Truck size={15} /> Confirm order · <Credits value={quote.total} />
          </button>
          <p className="hint" style={{ marginTop: 8 }}>Simulated wholesale. No real goods are ordered or shipped.</p>
        </div>
      </div>
    </div>
  );
}
