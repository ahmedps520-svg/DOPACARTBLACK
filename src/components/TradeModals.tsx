import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store, Zap } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { availableQty, activeStore, listedQty, listingSlots, sellQuote } from '../engine/selectors';
import { createAlert, createListing, sellToMarket } from '../engine/commands';
import { useAction, useIntentKey } from '../lib/hooks';
import { Credits, Modal, Notice, QtyInput, Segmented } from './ui';
import { cr, crSigned, pct } from '../lib/format';
import { LISTING_PRICE_MAX, LISTING_PRICE_MIN, STORE_PAYMENT_FEE } from '../engine/constants';
import { expectedDailySales } from '../engine/storefront';
import { ALERT_KIND_LABEL } from '../engine/alerts';
import type { AlertKind } from '../engine/types';
import { CATEGORY_BY_ID } from '../engine/categories';
import { isSupplyLimited } from '../engine/market';

/** Sell dialog: instant market sale vs. listing in the player's own store. */
export function SellModal({ productId, open, onClose, initialMode = 'market' }: { productId: string; open: boolean; onClose: () => void; initialMode?: 'market' | 'store' }) {
  const s = useGameState((st) => st);
  const def = PRODUCT_BY_ID[productId];
  const holding = s.holdings[productId];
  const free = availableQty(s, productId);
  const [mode, setMode] = useState<'market' | 'store'>(initialMode);
  const [qty, setQty] = useState(1);
  const [key, renewKey] = useIntentKey();
  const { run, busy } = useAction();
  const store = activeStore(s);
  const mp = s.market[productId];
  const [price, setPrice] = useState(() => Math.round(mp.price * 100) / 100);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setQty(Math.min(1, free) || 1);
      setPrice(Math.round(mp.price * 100) / 100);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useMemo(() => (holding ? sellQuote(s, productId, Math.max(1, qty)) : null), [s, productId, qty, holding]);
  if (!def) return null;
  const lo = Math.round(mp.price * LISTING_PRICE_MIN * 100) / 100;
  const hi = Math.round(mp.price * LISTING_PRICE_MAX * 100) / 100;
  const catOk = store.categories.includes(def.category);
  const slotsLeft = listingSlots(s) - store.listings.length;
  const alreadyListed = store.listings.some((l) => l.productId === productId);
  const forecast = expectedDailySales(s, store, productId, price, store.listings.filter((l) => !l.paused).length + 1);
  const storeProfitPerUnit = price * (1 - STORE_PAYMENT_FEE) - (holding?.avgCost ?? 0);

  const sellMarket = () => {
    const r = run((st) => sellToMarket(st, productId, qty, key), {
      sound: 'sell',
      success: `Sold ${qty}× ${def.name}`,
      successBody: q ? `Received ${cr(q.net)} CR · realized ${crSigned(q.pnl)} CR` : undefined,
    });
    if (r?.ok) {
      renewKey();
      onClose();
    }
  };
  const list = () => {
    const r = run((st) => createListing(st, store.id, productId, qty, price), { sound: 'coin', success: `Listed ${qty}× ${def.name} in ${store.name}` });
    if (r?.ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Sell ${def.name}`} kicker={`You own ${holding?.qty ?? 0} · ${free} free to sell`}>
      <Segmented
        value={mode}
        onChange={setMode}
        label="Sale channel"
        options={[
          { value: 'market', label: <span className="row" style={{ gap: 6 }}><Zap size={13} /> Sell to market now</span> },
          { value: 'store', label: <span className="row" style={{ gap: 6 }}><Store size={13} /> List in my store</span> },
        ]}
      />
      <p className="hint" style={{ marginTop: 10 }}>
        {mode === 'market'
          ? 'Instant: market buyers pay the bid price (current price minus the rarity spread) and the marketplace charges a fee. Units leave your inventory immediately.'
          : 'Slower: your store sells to simulated customers over time at the price you set. Better margins, but sales depend on price, demand and traffic. Units stay reserved until sold.'}
      </p>
      {free === 0 ? (
        <div style={{ marginTop: 14 }}>
          <Notice tone="warn">All your units are reserved by store listings. Reduce or remove a listing on the Store page to free them.</Notice>
        </div>
      ) : mode === 'market' ? (
        <div style={{ marginTop: 16 }} className="col">
          <div className="spread">
            <span className="label">Quantity</span>
            <QtyInput value={qty} onChange={setQty} max={free} />
          </div>
          {q && (
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Market price</dt>
              <dd>{cr(mp.price)}</dd>
              <dt>Bid after {pct(q.spread, 1).replace('+', '')} spread</dt>
              <dd>{cr(q.unitBid)} × {qty}</dd>
              <dt>Gross proceeds</dt>
              <dd>{cr(q.gross)}</dd>
              <dt>Marketplace fee ({(q.feeRate * 100).toFixed(2).replace(/\.?0+$/, '')}%)</dt>
              <dd className="down">−{cr(q.fee)}</dd>
              <dt>Cash you receive</dt>
              <dd style={{ fontWeight: 700 }}>{cr(q.net)}</dd>
              <dt>Cost basis ({cr(holding?.avgCost ?? 0)} avg)</dt>
              <dd>{cr(q.costBasis)}</dd>
              <dt>Realized profit / loss</dt>
              <dd className={q.pnl >= 0 ? 'up' : 'down'} style={{ fontWeight: 700 }}>
                {crSigned(q.pnl)}
              </dd>
            </dl>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 16 }} className="col">
          {!catOk && (
            <Notice tone="warn">
              {store.name} isn’t licensed for {CATEGORY_BY_ID[def.category].label}. Change its categories on the <Link to="/store?tab=customize" className="accent">Store page</Link>.
            </Notice>
          )}
          {alreadyListed && <Notice tone="info">This product is already listed in {store.name}. Edit that listing on the Store page.</Notice>}
          {slotsLeft <= 0 && <Notice tone="warn">All {listingSlots(s)} listing slots are in use. Buy the Listing Slots upgrade for more.</Notice>}
          {!store.open && <Notice tone="info">{store.name} is closed — open it on the Store page so customers can buy.</Notice>}
          <div className="spread">
            <span className="label">Quantity to list</span>
            <QtyInput value={qty} onChange={setQty} max={free} />
          </div>
          <div className="field">
            <label htmlFor="list-price">Your price (allowed {cr(lo)} – {cr(hi)})</label>
            <div className="input-suffix">
              <input id="list-price" className={`input ${price < lo || price > hi ? 'invalid' : ''}`} inputMode="decimal" value={price} onChange={(e) => setPrice(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)} />
              <span>CR</span>
            </div>
            <input type="range" min={lo} max={hi} step={Math.max(0.01, (hi - lo) / 200)} value={Math.min(hi, Math.max(lo, price))} onChange={(e) => setPrice(Math.round(Number(e.target.value) * 100) / 100)} aria-label="Price slider" />
            <span className="hint">{pct(price / mp.price - 1)} vs market · higher prices sell slower.</span>
          </div>
          <dl className="kv">
            <dt>Expected sales at this price</dt>
            <dd>≈ {forecast.toFixed(1)} units / day</dd>
            <dt>Payment fee ({(STORE_PAYMENT_FEE * 100).toFixed(1)}%)</dt>
            <dd>{cr(price * STORE_PAYMENT_FEE)} / unit</dd>
            <dt>Profit per unit vs your cost</dt>
            <dd className={storeProfitPerUnit >= 0 ? 'up' : 'down'}>{crSigned(storeProfitPerUnit)}</dd>
          </dl>
        </div>
      )}
      <div className="modal-foot" style={{ padding: '18px 0 0' }}>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {mode === 'market' ? (
          <button className="btn btn-primary" onClick={sellMarket} disabled={busy || free === 0 || qty < 1 || qty > free}>
            Sell {qty} for <Credits value={q?.net ?? 0} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={list} disabled={busy || free === 0 || !catOk || slotsLeft <= 0 || alreadyListed || price < lo || price > hi}>
            List {qty} at {cr(price)} CR
          </button>
        )}
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Listed elsewhere: {listedQty(s, productId)} units. All sales are simulated with virtual credits.
      </p>
    </Modal>
  );
}

export function AlertModal({ productId, open, onClose }: { productId: string; open: boolean; onClose: () => void }) {
  const mp = useGameState((s) => s.market[productId]);
  const def = PRODUCT_BY_ID[productId];
  const [kind, setKind] = useState<AlertKind>('below');
  const [value, setValue] = useState('');
  const { run, busy } = useAction();
  useEffect(() => {
    if (open) {
      setKind('below');
      setValue(String(Math.floor(mp.price * 0.95)));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!def || !mp) return null;
  const pctKind = kind === 'rise_pct' || kind === 'fall_pct';
  const submit = () => {
    const r = run((s) => createAlert(s, productId, kind, Number(value)), { success: 'Price alert created', successBody: 'You’ll be notified when the simulated market meets the condition.' });
    if (r?.ok) onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create price alert"
      kicker={def.name}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            Create alert
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div className="spread">
          <span className="dim">Current price</span>
          <Credits value={mp.price} />
        </div>
        <div className="field">
          <label htmlFor="alert-kind">Condition</label>
          <select
            id="alert-kind"
            className="select"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as AlertKind;
              setKind(k);
              setValue(k === 'below' ? String(Math.floor(mp.price * 0.95)) : k === 'above' ? String(Math.ceil(mp.price * 1.05)) : k === 'supply_limited' ? '' : '15');
            }}
          >
            {(Object.keys(ALERT_KIND_LABEL) as AlertKind[]).map((k) => (
              <option key={k} value={k} disabled={k === 'supply_limited' && isSupplyLimited(mp)}>
                {ALERT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        {kind !== 'supply_limited' && (
          <div className="field">
            <label htmlFor="alert-val">{pctKind ? 'Percentage from current price' : 'Price threshold'}</label>
            <div className="input-suffix">
              <input id="alert-val" className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} />
              <span>{pctKind ? '%' : 'CR'}</span>
            </div>
            {pctKind && Number(value) > 0 && (
              <span className="hint">
                Triggers at {cr(kind === 'rise_pct' ? mp.price * (1 + Number(value) / 100) : mp.price * (1 - Number(value) / 100))} CR
              </span>
            )}
          </div>
        )}
        {kind === 'supply_limited' && <p className="hint">Triggers when market supply drops below 40% of its normal level.</p>}
        <p className="hint">Alerts are checked against every simulated market update (each 10 in-game minutes).</p>
      </div>
    </Modal>
  );
}
