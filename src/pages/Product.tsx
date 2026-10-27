import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, Eye, GitCompare, BellPlus, ShoppingCart, Lock, ChevronRight, Store as StoreIcon, Info, AlertTriangle, Package } from 'lucide-react';
import { useGame, useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID, PRODUCTS } from '../engine/catalog';
import { CATEGORY_BY_ID, RARITY_LABEL, SUBCATEGORY_LABEL } from '../engine/categories';
import { ProductCard, ProductImage } from '../components/ProductCard';
import { Change, DemandIndicator, Notice, QtyInput, RarityTag, Segmented, SupplyIndicator } from '../components/ui';
import { Chart } from '../components/Chart';
import { RANGES, averagePrice, changeOver, demandAgo, priceSeries, volume24h, volumeSeries, type RangeId } from '../engine/history';
import { availableUnits, demandLevel, fairValue, supplyLevel, supplyRatio } from '../engine/market';
import { MINUTES_PER_DAY } from '../engine/constants';
import { addToCart, buyNow, toggleCompare, toggleFavorite, toggleWatchlist, viewProduct } from '../engine/commands';
import { useAction, useIntentKey } from '../lib/hooks';
import { capacity, capacityUsed, availableQty } from '../engine/selectors';
import { rarityUnlockLevel } from '../engine/progression';
import { activeEvents } from '../engine/events';
import { cr, int, pct } from '../lib/format';
import { formatDuration } from '../engine/time';
import { upgradeValue } from '../engine/upgrades';
import { AlertModal, SellModal } from '../components/TradeModals';
import { NotFound } from './NotFound';
import type { GameState, MarketProduct, ProductDef } from '../engine/types';

function volatilityLabel(v: number): string {
  if (v < 0.04) return 'Low';
  if (v < 0.075) return 'Moderate';
  if (v < 0.11) return 'High';
  return 'Extreme';
}

export function ProductPage() {
  const { id = '' } = useParams();
  const def = PRODUCT_BY_ID[id];
  const dispatch = useGame((st) => st.dispatch);
  useEffect(() => {
    if (def) dispatch((st) => viewProduct(st, id), { quiet: true });
  }, [id, def, dispatch]);
  if (!def) return <NotFound />;
  return <ProductView key={id} def={def} />;
}

function ProductView({ def }: { def: ProductDef }) {
  const id = def.id;
  const s = useGameState((st) => st);
  const mp = s.market[id];
  const [range, setRange] = useState<RangeId>('1D');
  const [sellOpen, setSellOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const { run } = useAction();

  const series = useMemo(() => {
    const ps = priceSeries(mp, range, s.clock.t);
    return [{ id, label: def.name, color: 'var(--accent)', t: ps.t, v: ps.p }];
  }, [mp, range, s.clock.t, id, def.name]);
  const vol = useMemo(() => (range === '1H' || range === '1D' ? volumeSeries(mp, range === '1H' ? 7 : 145) : undefined), [mp, range]);

  const fav = s.favorites.includes(id);
  const watching = s.watchlist.includes(id);
  const comparing = s.compare.includes(id);
  const holding = s.holdings[id];
  const ch24 = changeOver(mp, MINUTES_PER_DAY);
  const related = PRODUCTS.filter((p) => p.subcategory === def.subcategory && p.id !== id && s.market[p.id].listed).slice(0, 6);
  const events = activeEvents(s).filter((e) => e.productIds.includes(id));

  return (
    <div className="page">
      <nav className="row dim" style={{ fontSize: 12, marginBottom: 16, flexWrap: 'wrap' }} aria-label="Breadcrumb">
        <Link to="/market">Market</Link>
        <ChevronRight size={12} />
        <Link to={`/market?cat=${def.category}`}>{CATEGORY_BY_ID[def.category].label}</Link>
        <ChevronRight size={12} />
        <Link to={`/market?cat=${def.category}&sub=${def.subcategory}`}>{SUBCATEGORY_LABEL[def.subcategory]}</Link>
      </nav>

      <div className="pdp">
        <div>
          <div className="pdp-media" style={{ ['--rc' as string]: `var(--r-${def.rarity})` }}>
            <ProductImage id={id} />
            <div className="flags">
              {def.limited && <span className="badge badge-accent">Limited edition · {def.totalSupply} made</span>}
              {events.map((e) => (
                <Link key={e.id} to={`/news/${e.id}`} className={`badge ${e.bias === 'down' ? 'badge-down' : 'badge-up'}`}>
                  {e.kind === 'release' ? 'New release' : 'Market event'}
                </Link>
              ))}
            </div>
          </div>
          <p className="dim row" style={{ fontSize: 11, marginTop: 10 }}>
            <Info size={12} /> Studio render of a fictional product. Not a real item and never shipped.
          </p>
        </div>

        <div>
          <div className="row-wrap" style={{ gap: 10 }}>
            <span className="pcard-brand" style={{ fontSize: 12 }}>{def.brand}</span>
            <RarityTag rarity={def.rarity} />
            <span className="badge">{SUBCATEGORY_LABEL[def.subcategory]}</span>
          </div>
          <h1 className="pdp-title">{def.name}</h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 560 }}>
            {def.description}
          </p>

          {!mp.listed ? (
            <div style={{ marginTop: 20 }}>
              <Notice tone="info">
                This product launches on Day {def.releaseDay} at 09:00 (in {formatDuration((def.releaseDay! - 1) * MINUTES_PER_DAY + 540 - s.clock.t)}). It can’t be bought until it is listed.
              </Notice>
            </div>
          ) : (
            <>
              <div className="pdp-price">
                <span className="now">
                  {cr(mp.price)}
                  <span style={{ fontSize: 15, color: 'var(--text-3)', marginLeft: 6 }}>CR</span>
                </span>
                <Change value={ch24} className="num" />
                <span className="dim" style={{ fontSize: 13 }}>
                  Previous close <span className="num">{cr(mp.prevClose)}</span>
                </span>
              </div>
              <div className="dim" style={{ fontSize: 12 }}>Live market price · updates every 10 in-game minutes · virtual credits</div>

              <div className="metric-grid">
                <div>
                  <div className="lbl">Demand</div>
                  <div className="v"><DemandIndicator mp={mp} /></div>
                </div>
                <div>
                  <div className="lbl">Supply</div>
                  <div className="v"><SupplyIndicator mp={mp} /></div>
                </div>
                <div>
                  <div className="lbl">Available</div>
                  <div className="v">{int(availableUnits(mp))} units</div>
                </div>
                <div>
                  <div className="lbl">Rarity</div>
                  <div className="v">{RARITY_LABEL[def.rarity]}</div>
                </div>
                <div>
                  <div className="lbl">24h volume</div>
                  <div className="v">{int(volume24h(mp))} units</div>
                </div>
                <div>
                  <div className="lbl">Volatility</div>
                  <div className="v">{volatilityLabel(mp.volatility)}</div>
                </div>
              </div>

              <BuyBox def={def} mp={mp} s={s} />
            </>
          )}

          <div className="row-wrap" style={{ marginTop: 14 }}>
            <button className="btn btn-sm" aria-pressed={fav} onClick={() => run((st) => toggleFavorite(st, id), { success: fav ? 'Removed from favorites' : 'Saved to favorites' })}>
              <Heart size={14} fill={fav ? 'currentColor' : 'none'} className={fav ? 'accent' : ''} /> {fav ? 'Favorited' : 'Favorite'}
            </button>
            <button
              className="btn btn-sm"
              aria-pressed={watching}
              onClick={() => run((st) => toggleWatchlist(st, id), { success: watching ? 'Removed from watchlist' : 'Added to watchlist' })}
            >
              <Eye size={14} className={watching ? 'accent' : ''} /> {watching ? 'Watching' : 'Watchlist'}
            </button>
            <button className="btn btn-sm" aria-pressed={comparing} onClick={() => run((st) => toggleCompare(st, id), { success: comparing ? 'Removed from comparison' : 'Added to comparison' })} disabled={!mp.listed}>
              <GitCompare size={14} className={comparing ? 'accent' : ''} /> {comparing ? 'Comparing' : 'Compare'}
            </button>
            <button className="btn btn-sm" onClick={() => setAlertOpen(true)} disabled={!mp.listed}>
              <BellPlus size={14} /> Price alert
            </button>
          </div>

          {holding && (
            <div className="card card-pad" style={{ marginTop: 16 }}>
              <div className="spread">
                <div>
                  <div className="label">In your inventory</div>
                  <div style={{ marginTop: 4 }}>
                    <span className="num" style={{ fontWeight: 700 }}>{holding.qty}</span> units · avg cost <span className="num">{cr(holding.avgCost)}</span> ·{' '}
                    <span className={mp.price >= holding.avgCost ? 'up' : 'down'}>{pct(mp.price / holding.avgCost - 1)} vs market</span>
                  </div>
                  {availableQty(s, id) < holding.qty && <div className="hint">{holding.qty - availableQty(s, id)} reserved by store listings</div>}
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => setSellOpen(true)}>
                  Sell
                </button>
              </div>
            </div>
          )}

          <div className="card card-pad" style={{ marginTop: 16 }}>
            <div className="label" style={{ marginBottom: 8 }}>Seller</div>
            <div className="row" style={{ gap: 12 }}>
              <span className="store-badge" style={{ width: 36, height: 36, background: 'var(--surface-3)' }}>
                <StoreIcon size={16} />
              </span>
              <div className="grow">
                <div style={{ fontWeight: 650 }}>DOPACART Open Market</div>
                <div className="dim" style={{ fontSize: 12 }}>
                  Simulated sellers · instant virtual fulfilment · est. production cost {cr(mp.productionCost)} CR
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mp.listed && (
        <>
          <section className="section">
            <div className="card">
              <div className="card-head" style={{ flexWrap: 'wrap' }}>
                <h2>Price history</h2>
                <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} label="Time range" />
              </div>
              <div className="card-body">
                <Chart series={series} height={320} volume={vol ? { t: vol.t, v: vol.p } : undefined} reference={holding ? { value: holding.avgCost, label: `Your avg cost ${cr(holding.avgCost)}` } : undefined} />
                <p className="hint" style={{ marginTop: 8 }}>
                  Every point is a recorded market sample: 10-minute ticks (1H/1D), hourly closes (1W/1M) and daily closes (ALL). Range change {pct(series[0].v[series[0].v.length - 1] / series[0].v[0] - 1)}.
                </p>
              </div>
            </div>
          </section>

          <section className="section grid grid-2" style={{ alignItems: 'start' }}>
            <MarketAnalysis def={def} mp={mp} s={s} />
            <div className="card">
              <div className="card-head">
                <h2>Specifications</h2>
              </div>
              <div className="card-body">
                <dl className="specs" style={{ gridTemplateColumns: '1fr' }}>
                  {def.specs.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Brand</dt>
                    <dd>{def.brand} (fictional)</dd>
                  </div>
                  <div>
                    <dt>Base value</dt>
                    <dd className="num">{cr(def.basePrice)} CR</dd>
                  </div>
                  {def.limited && (
                    <div>
                      <dt>Edition size</dt>
                      <dd>{def.totalSupply} units, never restocked</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </section>
        </>
      )}

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>More {SUBCATEGORY_LABEL[def.subcategory]}</h2>
          </div>
          <div className="rail">
            {related.map((p) => (
              <ProductCard key={p.id} id={p.id} />
            ))}
          </div>
        </section>
      )}

      {holding && <SellModal productId={id} open={sellOpen} onClose={() => setSellOpen(false)} />}
      <AlertModal productId={id} open={alertOpen} onClose={() => setAlertOpen(false)} />
    </div>
  );
}

function BuyBox({ def, mp, s }: { def: ProductDef; mp: MarketProduct; s: GameState }) {
  const [qty, setQty] = useState(1);
  const [key, renewKey] = useIntentKey();
  const { run, busy } = useAction();
  const toast = useGame((st) => st.toast);
  const avail = availableUnits(mp);
  const space = capacity(s) - capacityUsed(s);
  const affordable = Math.floor(s.wallet.cash / mp.price);
  const lockLevel = rarityUnlockLevel(def.rarity);
  const locked = s.progression.level < lockLevel;
  const maxQty = Math.max(1, Math.min(avail, space, affordable, 500));
  const total = Math.round(mp.price * qty * 100) / 100;

  let blocker: string | null = null;
  if (locked) blocker = `${RARITY_LABEL[def.rarity]} products unlock at level ${lockLevel}. You are level ${s.progression.level}.`;
  else if (avail === 0) blocker = 'Sold out on the market right now. Supply restocks over time' + (def.limited ? ' — except limited editions, which only return when holders sell.' : '.');
  else if (space <= 0) blocker = 'Your warehouse is full. Sell stock or buy the Warehouse Expansion upgrade.';
  else if (affordable < 1) blocker = `You need ${cr(mp.price)} CR but have ${cr(s.wallet.cash)} CR.`;
  else if (qty > avail) blocker = `Only ${avail} units available.`;
  else if (qty > space) blocker = `Only ${space} units of warehouse space left.`;
  else if (total > s.wallet.cash) blocker = `Insufficient funds: ${qty}× costs ${cr(total)} CR, you have ${cr(s.wallet.cash)} CR.`;

  const buy = () => {
    const r = run((st) => buyNow(st, def.id, qty, key), {
      sound: 'buy',
      success: `Purchased ${qty}× ${def.name}`,
      successBody: `${cr(total)} CR paid · now in your inventory`,
    });
    if (r?.ok) {
      renewKey();
      setQty(1);
    }
  };

  return (
    <div className="buy-box">
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <div className="col" style={{ gap: 4 }}>
          <span className="label">Quantity</span>
          <QtyInput value={qty} onChange={setQty} max={maxQty} />
        </div>
        <div className="right">
          <div className="label">Total</div>
          <div className="num" style={{ fontSize: 24, fontWeight: 700 }}>{cr(total)}</div>
          <div className="dim" style={{ fontSize: 12 }}>
            Balance after: <span className="num">{cr(Math.max(0, s.wallet.cash - total))}</span> CR
          </div>
        </div>
      </div>
      {blocker && (
        <div className="notice notice-warn" style={{ marginTop: 14 }}>
          {locked ? <Lock size={16} /> : <AlertTriangle size={16} />}
          <div>{blocker}</div>
        </div>
      )}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-primary btn-lg grow" onClick={buy} disabled={busy || !!blocker}>
          Buy product
        </button>
        <button
          className="btn btn-lg"
          style={{ letterSpacing: 0, textTransform: 'none' }}
          disabled={locked || avail === 0}
          onClick={() => {
            const r = run((st) => addToCart(st, def.id, qty), { sound: 'click' });
            if (r?.ok) toast({ tone: 'success', title: 'Added to cart', body: `${qty}× ${def.name}`, link: '/cart' });
          }}
          aria-label="Add to cart"
        >
          <ShoppingCart size={18} />
        </button>
      </div>
      <div className="row dim" style={{ fontSize: 11, marginTop: 10, gap: 6 }}>
        <Package size={12} /> Warehouse {capacityUsed(s)}/{capacity(s)} units · Instant market fill · Virtual purchase, nothing is shipped
      </div>
    </div>
  );
}

function MarketAnalysis({ def, mp, s }: { def: ProductDef; mp: MarketProduct; s: GameState }) {
  const ch24 = changeOver(mp, MINUTES_PER_DAY);
  const ch7 = changeOver(mp, 7 * MINUTES_PER_DAY);
  const pastD = demandAgo(mp, 24);
  const dTrend = pastD > 0 ? mp.demand / pastD - 1 : 0;
  const avg7 = averagePrice(mp, 7 * 24);
  const vsAvg = mp.price / avg7 - 1;
  const score = ch24 * 2 + ch7 + dTrend * 0.5;
  const verdict = score > 0.04 ? 'Rising' : score < -0.04 ? 'Falling' : 'Stable';
  const color = verdict === 'Rising' ? 'var(--up)' : verdict === 'Falling' ? 'var(--down)' : 'var(--text-2)';
  const intel = upgradeValue(s, 'analytics') >= 2;
  const fv = fairValue(def, mp);
  const fvGap = mp.price / fv - 1;
  const events = activeEvents(s).filter((e) => e.productIds.includes(def.id));

  return (
    <div className="card">
      <div className="card-head">
        <h2>Market analysis</h2>
        <span className="dim" style={{ fontSize: 11 }}>From recorded data</span>
      </div>
      <div className="card-body col" style={{ gap: 14 }}>
        <div className="analysis-verdict">
          <span className="big" style={{ color }}>{verdict.toUpperCase()}</span>
          <span className="muted" style={{ fontSize: 13 }}>
            24h <Change value={ch24} /> · 7d <Change value={ch7} /> · demand {dTrend >= 0 ? 'up' : 'down'} {pct(Math.abs(dTrend)).replace('+', '')} in 24h
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-2)', fontSize: 13, display: 'grid', gap: 6 }}>
          <li>
            Price is <strong className={vsAvg >= 0 ? 'up' : 'down'}>{pct(vsAvg)}</strong> versus its 7-day average of {cr(avg7)} CR.
          </li>
          <li>
            Demand is <strong>{demandLevel(mp).toLowerCase()}</strong> (index {Math.round(mp.demand)}, 100 = normal). Rising demand pushes prices up over the following hours.
          </li>
          <li>
            Supply is <strong>{supplyLevel(mp).toLowerCase()}</strong>: {int(availableUnits(mp))} units, {Math.round(supplyRatio(mp) * 100)}% of normal.{' '}
            {def.limited ? 'Limited editions never restock; scarcity can push prices higher.' : 'Supply restocks toward normal over time; surpluses weigh on price.'}
          </li>
          {events.map((e) => (
            <li key={e.id}>
              <Link to={`/news/${e.id}`} className="accent">
                {e.headline}
              </Link>{' '}
              — active for another {formatDuration(e.end - s.clock.t)}.
            </li>
          ))}
        </ul>
        {intel ? (
          <div>
            <div className="spread">
              <span className="label">Fair-value gauge (Market Intelligence)</span>
              <span className="num" style={{ fontSize: 12 }}>
                Equilibrium ≈ {cr(fv)} CR
              </span>
            </div>
            <div className="gauge">
              <i style={{ left: `${Math.max(2, Math.min(98, 50 + fvGap * 150))}%` }} />
            </div>
            <div className="spread dim" style={{ fontSize: 11 }}>
              <span>Below fair value</span>
              <span>{fvGap >= 0 ? `${pct(fvGap)} rich` : `${pct(fvGap)} cheap`}</span>
              <span>Above fair value</span>
            </div>
          </div>
        ) : (
          <div className="hint">
            <Lock size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Buy <Link to="/store?tab=upgrades" className="accent">Advanced Analytics tier 2</Link> to see the model’s fair-value estimate.
          </div>
        )}
        <p className="hint">Analysis describes the simulated market; it cannot predict random shocks or future events.</p>
      </div>
    </div>
  );
}
