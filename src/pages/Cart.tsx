import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, AlertTriangle } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { ProductThumb } from '../components/ProductCard';
import { Change, Credits, Empty, QtyInput, RarityTag, VirtualNote } from '../components/ui';
import { checkoutCart, clearCart, removeFromCart, setCartQty } from '../engine/commands';
import { useAction, useIntentKey } from '../lib/hooks';
import { availableUnits } from '../engine/market';
import { capacity, capacityUsed } from '../engine/selectors';
import { rarityUnlockLevel } from '../engine/progression';
import { changeOver } from '../engine/history';
import { cr } from '../lib/format';

export function Cart() {
  const s = useGameState((st) => st);
  const { run, busy } = useAction();
  const [key, renewKey] = useIntentKey();
  const nav = useNavigate();
  const lines = s.cart;
  const total = Math.round(lines.reduce((a, l) => a + s.market[l.productId].price * l.qty, 0) * 100) / 100;
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const space = capacity(s) - capacityUsed(s);

  const problems: string[] = [];
  for (const l of lines) {
    const def = PRODUCT_BY_ID[l.productId];
    const mp = s.market[l.productId];
    if (s.progression.level < rarityUnlockLevel(def.rarity)) problems.push(`${def.name} requires level ${rarityUnlockLevel(def.rarity)}.`);
    if (availableUnits(mp) < l.qty) problems.push(`${def.name}: only ${availableUnits(mp)} available.`);
  }
  if (units > space) problems.push(`Warehouse space: ${space} units free, cart has ${units}.`);
  if (total > s.wallet.cash) problems.push(`Insufficient funds: cart costs ${cr(total)} CR, you have ${cr(s.wallet.cash)} CR.`);

  const checkout = () => {
    const r = run((st) => checkoutCart(st, key), { sound: 'buy', success: `Order complete · ${units} units`, successBody: `${cr(total)} CR paid. Items are in your inventory.` });
    if (r?.ok) {
      renewKey();
      const order = r.data as { id: string } | undefined;
      if (order) nav(`/orders/${order.id}`);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Checkout</div>
          <h1>Your cart</h1>
          <p className="sub">Prices update live. You pay the market price at the moment of checkout — every line succeeds or none do.</p>
        </div>
        {lines.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => run((st) => clearCart(st), { quiet: true })}>
            <Trash2 size={14} /> Empty cart
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="card">
          <Empty icon={<ShoppingCart size={32} />} title="Your cart is empty" action={<Link to="/market" className="btn btn-primary btn-sm">Browse the market</Link>}>
            Add products from the marketplace, then check out with virtual credits.
          </Empty>
        </div>
      ) : (
        <div className="split">
          <div className="card">
            {lines.map((l) => {
              const def = PRODUCT_BY_ID[l.productId];
              const mp = s.market[l.productId];
              const max = Math.min(500, availableUnits(mp));
              return (
                <div key={l.productId} className="list-row" style={{ padding: '14px 18px', flexWrap: 'wrap' }}>
                  <ProductThumb id={l.productId} large />
                  <div className="grow" style={{ minWidth: 160 }}>
                    <Link to={`/product/${l.productId}`} style={{ fontWeight: 650 }}>
                      {def.name}
                    </Link>
                    <div className="row" style={{ gap: 10, marginTop: 4 }}>
                      <span className="dim" style={{ fontSize: 12 }}>{def.brand}</span>
                      <RarityTag rarity={def.rarity} />
                    </div>
                    <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                      {cr(mp.price)} CR each · <Change value={changeOver(mp, 1440)} /> 24h · {availableUnits(mp)} available
                    </div>
                  </div>
                  <QtyInput value={l.qty} max={Math.max(1, max)} onChange={(n) => run((st) => setCartQty(st, l.productId, n), { lock: false })} />
                  <div className="right" style={{ minWidth: 110 }}>
                    <Credits value={mp.price * l.qty} />
                  </div>
                  <button className="icon-btn" onClick={() => run((st) => removeFromCart(st, l.productId), { quiet: true })} aria-label={`Remove ${def.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="card card-pad sticky-panel">
            <div className="section-title" style={{ marginBottom: 14 }}>Order summary</div>
            <dl className="kv">
              <dt>Items</dt>
              <dd>{units} units</dd>
              <dt>Subtotal</dt>
              <dd>{cr(total)}</dd>
              <dt>Fulfilment</dt>
              <dd>Instant · free</dd>
              <dt>Warehouse after</dt>
              <dd>
                {capacityUsed(s) + units}/{capacity(s)}
              </dd>
              <dt>Balance after</dt>
              <dd className={s.wallet.cash - total < 0 ? 'down' : ''}>{cr(s.wallet.cash - total)}</dd>
            </dl>
            <div className="divider" />
            <div className="spread">
              <span className="label">Total</span>
              <Credits value={total} className="num" />
            </div>
            {problems.length > 0 && (
              <div className="notice notice-warn" style={{ marginTop: 14 }}>
                <AlertTriangle size={16} />
                <div>
                  {problems.map((p) => (
                    <div key={p}>{p}</div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }} onClick={checkout} disabled={busy || problems.length > 0}>
              Place order
            </button>
            <div style={{ marginTop: 10 }}>
              <VirtualNote />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
