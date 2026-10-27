import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Store as StoreIcon, Power, Upload, Trash2, Pause, Play, Lock, Check, Plus, TrendingUp, Users, Package, Camera, Eye, Truck, LayoutGrid, Wrench, ShieldCheck, BarChart3, Tags, Megaphone, Warehouse } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { CATEGORIES, CATEGORY_BY_ID } from '../engine/categories';
import { activeStore, availableQty, categorySlots, listingSlots, maxStoresForLevel, storeReputation, storeTrafficPerDay } from '../engine/selectors';
import { expectedDailySales, operatingCost } from '../engine/storefront';
import { buyUpgrade, openNewStore, removeListing, setStoreOpen, updateListing, updateStore } from '../engine/commands';
import { UPGRADES, nextUpgradeLevel, upgradeValue } from '../engine/upgrades';
import { STORE_THEMES } from '../engine/progression';
import { STORE_LEVEL_REQUIREMENT, STORE_OPEN_COST, LISTING_PRICE_MAX, LISTING_PRICE_MIN } from '../engine/constants';
import { trafficMultiplier } from '../engine/events';
import { useAction, useIntentKey } from '../lib/hooks';
import { ProductThumb } from '../components/ProductCard';
import { StoreBadge } from '../components/Layout';
import { Credits, Empty, Modal, Notice, RarityTag, Stat, ConfirmModal } from '../components/ui';
import { SellModal } from '../components/TradeModals';
import { cr, crSigned, int, pct } from '../lib/format';
import type { CategoryId, Listing, PlayerStore, StoreThemeId, UpgradeId } from '../engine/types';
import { formatAgo } from '../engine/time';
import { MINUTES_PER_DAY } from '../engine/constants';
import { txBetween } from '../engine/selectors';

type Tab = 'overview' | 'listings' | 'customize' | 'upgrades' | 'expand';

const UPGRADE_ICON: Record<UpgradeId, typeof Camera> = {
  warehouse: Warehouse,
  photography: Camera,
  visibility: Megaphone,
  logistics: Truck,
  listings: LayoutGrid,
  operations: Wrench,
  seller: ShieldCheck,
  analytics: BarChart3,
  licenses: Tags,
};

export function StorePage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  const s = useGameState((st) => st);
  const store = activeStore(s);
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const { run } = useAction();
  const cost = operatingCost(s, s.stores.indexOf(store));

  return (
    <div className="page">
      <div className="page-head">
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <StoreBadge name={store.name} logo={store.logo} theme={store.theme} size={64} />
          <div>
            <div className="kicker">Business builder · Store {s.stores.indexOf(store) + 1} of {s.stores.length}</div>
            <h1>{store.name}</h1>
            <p className="sub" style={{ marginTop: 4 }}>{store.tagline}</p>
          </div>
        </div>
        <div className="row-wrap">
          <span className={`badge ${store.open ? 'badge-up' : ''}`}>{store.open ? 'Open for customers' : 'Closed'}</span>
          <button
            className={`btn ${store.open ? '' : 'btn-primary'}`}
            onClick={() => run((st) => setStoreOpen(st, store.id, !store.open), { success: store.open ? `${store.name} closed` : `${store.name} is open`, successBody: store.open ? 'No sales and no operating costs while closed.' : `Operating cost: ${cr(cost)} CR per in-game day.` })}
          >
            <Power size={15} /> {store.open ? 'Close store' : 'Open store'}
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            ['overview', 'Overview'],
            ['listings', `Listings (${store.listings.length}/${listingSlots(s)})`],
            ['customize', 'Customize'],
            ['upgrades', 'Upgrades'],
            ['expand', 'Expand'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className="tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview store={store} />}
      {tab === 'listings' && <Listings store={store} />}
      {tab === 'customize' && <Customize store={store} />}
      {tab === 'upgrades' && <Upgrades />}
      {tab === 'expand' && <Expand />}
    </div>
  );
}

function Overview({ store }: { store: PlayerStore }) {
  const s = useGameState((st) => st);
  const traffic = storeTrafficPerDay(s, store) * trafficMultiplier(s);
  const today = useMemo(() => {
    const from = Math.floor(s.clock.t / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    const txs = txBetween(s, from, from + MINUTES_PER_DAY).filter((t) => t.storeId === store.id && t.type === 'store_sale');
    return { units: txs.reduce((a, t) => a + (t.qty ?? 0), 0), revenue: txs.reduce((a, t) => a + t.total, 0) };
  }, [s, store.id]);
  const recent = useMemo(() => s.transactions.filter((t) => t.storeId === store.id && t.type === 'store_sale').slice(-8).reverse(), [s.transactions, store.id]);
  const active = store.listings.filter((l) => !l.paused);
  const forecast = active.reduce((a, l) => a + expectedDailySales(s, store, l.productId, l.price, active.length), 0);
  const idx = s.stores.indexOf(store);

  return (
    <div className="col" style={{ gap: 16 }}>
      {!store.open && (
        <Notice tone="info">
          Your store is closed: customers can’t buy and no operating cost is charged. Open it once you have listings — it costs {cr(operatingCost(s, idx))} CR per in-game day (charged at midnight).
        </Notice>
      )}
      {store.listings.length === 0 && (
        <Notice tone="info">
          No listings yet. Go to <Link to="/inventory" className="accent">Inventory</Link> and choose <strong>List</strong> on a product in {store.categories.map((c) => CATEGORY_BY_ID[c].label).join(' or ')}.
        </Notice>
      )}
      <div className="stats-row">
        <Stat label="Visitors / day" icon={<Users size={12} />} foot={`Reputation ×${storeReputation(store).toFixed(2)}`}>
          {store.open ? int(traffic) : '—'}
        </Stat>
        <Stat label="Expected sales / day" icon={<TrendingUp size={12} />} foot="At current prices & demand">
          {store.open ? forecast.toFixed(1) : '—'}
        </Stat>
        <Stat label="Sold today" icon={<Package size={12} />} foot={`${cr(today.revenue)} CR revenue`}>
          {int(today.units)}
        </Stat>
        <Stat label="Lifetime revenue">
          <Credits value={store.stats.revenue} />
        </Stat>
        <Stat label="Lifetime profit" foot={`${int(store.stats.unitsSold)} units sold`}>
          <span className={store.stats.profit >= 0 ? 'up' : 'down'}>{crSigned(store.stats.profit)}</span>
        </Stat>
        <Stat label="Operating cost" foot="Per in-game day while open">
          <Credits value={operatingCost(s, idx)} />
        </Stat>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h3>Customer demand on your shelf</h3>
            <Link to="?tab=listings" className="more dim" style={{ fontSize: 12 }}>
              Manage
            </Link>
          </div>
          <div className="card-body">
            {store.listings.length === 0 && <div className="dim">List products to see demand forecasts.</div>}
            {store.listings.map((l) => {
              const mp = s.market[l.productId];
              const exp = expectedDailySales(s, store, l.productId, l.price, active.length);
              return (
                <div key={l.id} className="list-row">
                  <ProductThumb id={l.productId} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontWeight: 600 }}>{PRODUCT_BY_ID[l.productId].name}</div>
                    <div className="dim" style={{ fontSize: 12 }}>
                      {cr(l.price)} CR · {pct(l.price / mp.price - 1)} vs market · demand {Math.round(mp.demand)}
                    </div>
                  </div>
                  <div className="right" style={{ fontSize: 12 }}>
                    <div className="num">{l.paused || !store.open ? 'paused' : `≈${exp.toFixed(1)}/day`}</div>
                    <div className="dim">{l.qty} left</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>Recent store sales</h3>
          </div>
          <div className="card-body">
            {recent.length === 0 && <div className="dim">No sales yet. Customers arrive while the store is open.</div>}
            {recent.map((t) => (
              <div key={t.id} className="list-row">
                <ProductThumb id={t.productId!} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600 }}>
                    {t.qty}× {PRODUCT_BY_ID[t.productId!].name}
                  </div>
                  <div className="dim" style={{ fontSize: 12 }}>{formatAgo(s.clock.t, t.t)}</div>
                </div>
                <div className="right">
                  <div className="num up">+{cr(t.total)}</div>
                  <div className={`num ${(t.realizedPnl ?? 0) >= 0 ? 'up' : 'down'}`} style={{ fontSize: 11 }}>
                    P/L {crSigned(t.realizedPnl ?? 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="hint">
        How sales work: each open store gets simulated visitors (boosted by Storefront Visibility, reputation and events). Each listing converts visitors based on its rarity, your Studio Photography tier, current demand
        and how your price compares with the market. Every sale pays a {2.5}% payment fee.
      </p>
    </div>
  );
}

function ListingRow({ store, l }: { store: PlayerStore; l: Listing }) {
  const s = useGameState((st) => st);
  const mp = s.market[l.productId];
  const def = PRODUCT_BY_ID[l.productId];
  const [price, setPrice] = useState(String(l.price));
  const [qty, setQty] = useState(String(l.qty));
  const { run } = useAction();
  const holding = s.holdings[l.productId];
  const lo = mp.price * LISTING_PRICE_MIN;
  const hi = mp.price * LISTING_PRICE_MAX;
  const active = store.listings.filter((x) => !x.paused).length;
  const exp = expectedDailySales(s, store, l.productId, Number(price) || l.price, active);
  const dirty = Number(price) !== l.price || Number(qty) !== l.qty;
  const margin = holding ? l.price * (1 - 0.025) - holding.avgCost : 0;
  return (
    <tr>
      <td>
        <Link to={`/product/${l.productId}`} className="row" style={{ gap: 10, minWidth: 200 }}>
          <ProductThumb id={l.productId} />
          <div style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600, maxWidth: 220 }}>{def.name}</div>
            <RarityTag rarity={def.rarity} />
          </div>
        </Link>
      </td>
      <td className="num">{cr(mp.price)}</td>
      <td>
        <input className="input" style={{ width: 110, height: 34 }} value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Listing price" />
        <div className="dim" style={{ fontSize: 11 }}>
          {cr(lo)}–{cr(hi)}
        </div>
      </td>
      <td>
        <input className="input" style={{ width: 70, height: 34 }} value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} aria-label="Listed quantity" />
        <div className="dim" style={{ fontSize: 11 }}>{availableQty(s, l.productId)} more free</div>
      </td>
      <td className="num">
        {int(l.sold)}
        <div className="dim" style={{ fontSize: 11 }}>{cr(l.revenue)} CR</div>
      </td>
      <td className={`num ${margin >= 0 ? 'up' : 'down'}`}>{crSigned(margin)}</td>
      <td className="num">{l.paused || !store.open ? <span className="dim">—</span> : `≈${exp.toFixed(1)}`}</td>
      <td className="num">
        <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
          {dirty && (
            <button
              className="btn btn-xs btn-primary"
              onClick={() => run((st) => updateListing(st, store.id, l.id, { price: Number(price), qty: Number(qty) }), { success: 'Listing updated' })}
            >
              <Check size={12} /> Save
            </button>
          )}
          <button className="btn btn-xs" onClick={() => run((st) => updateListing(st, store.id, l.id, { paused: !l.paused }), { quiet: true })} title={l.paused ? 'Resume' : 'Pause'}>
            {l.paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button className="btn btn-xs btn-danger" onClick={() => run((st) => removeListing(st, store.id, l.id), { success: 'Listing removed', successBody: 'Units returned to free inventory.' })} title="Remove listing">
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Listings({ store }: { store: PlayerStore }) {
  const s = useGameState((st) => st);
  const [pick, setPick] = useState(false);
  const [sellId, setSellId] = useState<string | null>(null);
  const eligible = Object.values(s.holdings).filter((h) => store.categories.includes(PRODUCT_BY_ID[h.productId].category) && availableQty(s, h.productId) > 0 && !store.listings.some((l) => l.productId === h.productId));
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="spread" style={{ flexWrap: 'wrap' }}>
        <div className="dim" style={{ fontSize: 13 }}>
          Sells: {store.categories.map((c) => CATEGORY_BY_ID[c].label).join(', ')} · {store.listings.length}/{listingSlots(s)} slots used · prices must be {LISTING_PRICE_MIN * 100}%–{LISTING_PRICE_MAX * 100}% of market when set
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setPick(true)} disabled={store.listings.length >= listingSlots(s)}>
          <Plus size={14} /> New listing
        </button>
      </div>
      <div className="card">
        {store.listings.length === 0 ? (
          <Empty icon={<StoreIcon size={30} />} title="No listings yet">
            Pick a product you own in one of this store’s categories and set your price.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Market</th>
                  <th>Your price</th>
                  <th>Listed qty</th>
                  <th className="num">Sold</th>
                  <th className="num">Margin / unit</th>
                  <th className="num">Exp. / day</th>
                  <th className="num">Actions</th>
                </tr>
              </thead>
              <tbody>
                {store.listings.map((l) => (
                  <ListingRow key={`${l.id}-${l.price}-${l.qty}`} store={store} l={l} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={pick} onClose={() => setPick(false)} title="Choose a product to list" kicker={store.name}>
        {eligible.length === 0 ? (
          <Empty title="Nothing eligible">
            You need free units of a product in {store.categories.map((c) => CATEGORY_BY_ID[c].label).join(' or ')} that isn’t already listed here.{' '}
            <Link to="/market" className="accent">
              Buy stock
            </Link>
          </Empty>
        ) : (
          eligible.map((h) => (
            <button
              key={h.productId}
              className="dropdown-item"
              onClick={() => {
                setPick(false);
                setSellId(h.productId);
              }}
            >
              <ProductThumb id={h.productId} />
              <span className="grow">
                <span style={{ display: 'block', color: 'var(--text)', fontWeight: 600 }}>{PRODUCT_BY_ID[h.productId].name}</span>
                <span style={{ fontSize: 12 }}>
                  {availableQty(s, h.productId)} free · cost {cr(h.avgCost)} · market {cr(s.market[h.productId].price)}
                </span>
              </span>
            </button>
          ))
        )}
      </Modal>
      {sellId && <SellModal productId={sellId} open initialMode="store" onClose={() => setSellId(null)} />}
    </div>
  );
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be decoded.'));
      img.onload = () => {
        const size = 160;
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d')!;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function Customize({ store }: { store: PlayerStore }) {
  const level = useGameState((st) => st.progression.level);
  const slots = useGameState((st) => categorySlots(st));
  const [name, setName] = useState(store.name);
  const [tagline, setTagline] = useState(store.tagline);
  const [cats, setCats] = useState<CategoryId[]>(store.categories);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const { run } = useAction();
  const save = (patch: Parameters<typeof updateStore>[2], msg: string) => run((st) => updateStore(st, store.id, patch), { success: msg });

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="col" style={{ gap: 16 }}>
        <div className="card card-pad col" style={{ gap: 14 }}>
          <div className="section-title">Identity</div>
          <div className="field">
            <label htmlFor="st-name">Store name</label>
            <input id="st-name" className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-tag">Tagline</label>
            <input id="st-tag" className="input" maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={name === store.name && tagline === store.tagline} onClick={() => save({ name, tagline }, 'Store details saved')}>
              Save details
            </button>
          </div>
        </div>

        <div className="card card-pad col" style={{ gap: 12 }}>
          <div className="section-title">Logo</div>
          <div className="row" style={{ gap: 16 }}>
            <StoreBadge name={store.name} logo={store.logo} theme={store.theme} size={72} />
            <div className="col" style={{ gap: 8 }}>
              <input
                ref={file}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setErr('');
                    const data = await resizeImage(f);
                    save({ logo: data }, 'Logo updated');
                  } catch (x) {
                    setErr((x as Error).message);
                  }
                }}
              />
              <div className="row">
                <button className="btn btn-sm" onClick={() => file.current?.click()}>
                  <Upload size={14} /> Upload logo
                </button>
                {store.logo && (
                  <button className="btn btn-sm btn-ghost" onClick={() => save({ logo: null }, 'Logo removed')}>
                    Remove
                  </button>
                )}
              </div>
              <span className="hint">Stored locally, resized to 160×160.</span>
              {err && <span className="error-text">{err}</span>}
            </div>
          </div>
        </div>

        <div className="card card-pad col" style={{ gap: 12 }}>
          <div className="spread">
            <div className="section-title">Product categories</div>
            <span className="dim" style={{ fontSize: 12 }}>
              {cats.length}/{slots} licensed
            </span>
          </div>
          <div className="row-wrap">
            {CATEGORIES.map((c) => {
              const on = cats.includes(c.id);
              return (
                <button key={c.id} className="chip" aria-pressed={on} onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])} disabled={!on && cats.length >= slots}>
                  {c.label}
                </button>
              );
            })}
          </div>
          <span className="hint">Your store can only list products in these categories. More slots come from Category Licenses.</span>
          <div>
            <button className="btn btn-primary btn-sm" disabled={cats.length === 0 || cats.slice().sort().join() === store.categories.slice().sort().join()} onClick={() => save({ categories: cats }, 'Categories updated')}>
              Save categories
            </button>
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        <div className="card card-pad">
          <div className="section-title" style={{ marginBottom: 12 }}>Theme</div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            {STORE_THEMES.map((th) => {
              const locked = level < th.level;
              return (
                <button
                  key={th.id}
                  className={`scenario ${store.theme === th.id ? 'on' : ''}`}
                  disabled={locked}
                  onClick={() => save({ theme: th.id as StoreThemeId }, `Theme: ${th.name}`)}
                  style={{ opacity: locked ? 0.5 : 1 }}
                >
                  <span className="row" style={{ gap: 6 }}>
                    {[th.bg, th.surface, th.accent].map((c) => (
                      <i key={c} style={{ width: 16, height: 16, borderRadius: 4, background: c, border: '1px solid #ffffff22', display: 'inline-block' }} />
                    ))}
                  </span>
                  <strong>{th.name}</strong>
                  <span>{locked ? <><Lock size={11} style={{ display: 'inline', verticalAlign: -1 }} /> Level {th.level}</> : store.theme === th.id ? 'Active' : 'Apply'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <StorefrontPreview store={store} />
      </div>
    </div>
  );
}

export function StorefrontPreview({ store }: { store: PlayerStore }) {
  const th = STORE_THEMES.find((x) => x.id === store.theme) ?? STORE_THEMES[0];
  const market = useGameState((st) => st.market);
  return (
    <div className="storefront-preview" style={{ background: th.bg, color: th.text }}>
      <div className="storefront-banner" style={{ background: `linear-gradient(120deg, ${th.surface}, ${th.bg})`, borderBottom: `1px solid ${th.accent}33` }}>
        <StoreBadge name={store.name} logo={store.logo} theme={store.theme} size={56} />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, letterSpacing: '0.04em', lineHeight: 1 }}>{store.name}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{store.tagline}</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: '0.2em', color: th.accent, fontWeight: 800 }}>PREVIEW</span>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {store.listings.slice(0, 6).map((l) => (
          <div key={l.id} style={{ background: th.surface, borderRadius: 12, overflow: 'hidden', border: `1px solid ${th.accent}22` }}>
            <div style={{ aspectRatio: '1' }}>
              <ProductThumbFill id={l.productId} />
            </div>
            <div style={{ padding: 8, fontSize: 11 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{PRODUCT_BY_ID[l.productId].name}</div>
              <div className="num" style={{ color: th.accent }}>{cr(l.price)} CR</div>
              {market[l.productId] && l.price < market[l.productId].price && <div style={{ opacity: 0.6 }}>Below market</div>}
            </div>
          </div>
        ))}
        {store.listings.length === 0 && <div style={{ gridColumn: '1 / -1', opacity: 0.6, fontSize: 13, padding: 20, textAlign: 'center' }}>Your shelves are empty.</div>}
      </div>
    </div>
  );
}

function ProductThumbFill({ id }: { id: string }) {
  return (
    <div style={{ width: '100%', height: '100%' }} className="thumb-fill">
      <ProductThumb id={id} />
    </div>
  );
}

function Upgrades() {
  const s = useGameState((st) => st);
  return (
    <div className="col" style={{ gap: 14 }}>
      <p className="muted" style={{ fontSize: 13 }}>
        Upgrades apply to your whole business and change real mechanics. Each tier costs virtual credits and some require a player level.
      </p>
      <div className="grid grid-3">
        {UPGRADES.map((u) => (
          <UpgradeCard key={u.id} id={u.id} level={s.progression.level} owned={s.upgrades[u.id] ?? 0} cash={s.wallet.cash} />
        ))}
      </div>
    </div>
  );
}

function UpgradeCard({ id, level, owned, cash }: { id: UpgradeId; level: number; owned: number; cash: number }) {
  const s = useGameState((st) => st);
  const u = UPGRADES.find((x) => x.id === id)!;
  const next = nextUpgradeLevel(s, id);
  const [key, renewKey] = useIntentKey();
  const { run, busy } = useAction();
  const [confirm, setConfirm] = useState(false);
  const Icon = UPGRADE_ICON[id];
  const lockedByLevel = next ? level < next.requiredLevel : false;
  return (
    <div className="card upgrade-card">
      <div className="row" style={{ gap: 12 }}>
        <span className="store-badge" style={{ width: 40, height: 40, background: 'var(--surface-3)', color: 'var(--accent-2)' }}>
          <Icon size={18} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>{u.name}</div>
          <div className="dim" style={{ fontSize: 12 }}>Now: {u.format(upgradeValue(s, id))}</div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>{u.summary}</p>
      <div className="upgrade-tiers" aria-label={`Tier ${owned} of ${u.levels.length}`}>
        {u.levels.map((_, i) => (
          <i key={i} className={i < owned ? 'on' : ''} />
        ))}
      </div>
      {next ? (
        <>
          <div className="notice" style={{ padding: '10px 12px' }}>
            <div>
              <div style={{ fontWeight: 650, color: 'var(--text)' }}>Tier {owned + 1}: {next.benefit}</div>
              <div className="dim" style={{ fontSize: 12 }}>Requires level {next.requiredLevel}</div>
            </div>
          </div>
          <button className="btn btn-primary" disabled={busy || lockedByLevel || cash < next.cost} onClick={() => setConfirm(true)}>
            {lockedByLevel ? (
              <>
                <Lock size={14} /> Level {next.requiredLevel}
              </>
            ) : (
              <>
                Buy · <Credits value={next.cost} />
              </>
            )}
          </button>
          {!lockedByLevel && cash < next.cost && <span className="hint">Need {cr(next.cost - cash)} CR more.</span>}
        </>
      ) : (
        <span className="badge badge-gold" style={{ alignSelf: 'flex-start' }}>Max tier</span>
      )}
      <ConfirmModal
        open={confirm}
        title={`Buy ${u.name}?`}
        confirmLabel={next ? `Pay ${cr(next.cost)} CR` : 'Buy'}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          const r = run((st) => buyUpgrade(st, id, key), { sound: 'level', success: `${u.name} upgraded`, successBody: next?.benefit });
          if (r?.ok) renewKey();
          setConfirm(false);
        }}
      >
        <p className="muted">{next?.benefit}</p>
        <p className="hint" style={{ marginTop: 8 }}>
          This is a business investment: it is recorded in your ledger and does not count toward realized profit.
        </p>
      </ConfirmModal>
    </div>
  );
}

function Expand() {
  const s = useGameState((st) => st);
  const level = s.progression.level;
  const allowed = maxStoresForLevel(level);
  const idx = s.stores.length;
  const nextReq = STORE_LEVEL_REQUIREMENT[idx];
  const cost = STORE_OPEN_COST[idx];
  const [name, setName] = useState('');
  const [cats, setCats] = useState<CategoryId[]>([]);
  const [key, renewKey] = useIntentKey();
  const { run, busy } = useAction();
  const slots = categorySlots(s);

  return (
    <div className="grid grid-2" style={{ alignItems: 'start' }}>
      <div className="card card-pad col" style={{ gap: 14 }}>
        <div className="section-title">Your stores</div>
        {s.stores.map((st, i) => (
          <div key={st.id} className="list-row">
            <StoreBadge name={st.name} logo={st.logo} theme={st.theme} size={40} />
            <div className="grow">
              <div style={{ fontWeight: 650 }}>{st.name}</div>
              <div className="dim" style={{ fontSize: 12 }}>
                {st.open ? 'Open' : 'Closed'} · {st.listings.length} listings · {cr(operatingCost(s, i))} CR/day
              </div>
            </div>
            <div className="right num">{cr(st.stats.revenue)} CR</div>
          </div>
        ))}
        <div className="hint">Inventory and upgrades are shared across all stores. Each store has its own shelf, categories, theme, traffic and operating cost.</div>
      </div>
      <div className="card card-pad col" style={{ gap: 14 }}>
        <div className="section-title">Open store #{idx + 1}</div>
        {nextReq === undefined ? (
          <Notice tone="up">You run the maximum number of stores. True empire.</Notice>
        ) : (
          <>
            <dl className="kv">
              <dt>Required level</dt>
              <dd className={level >= nextReq ? 'up' : 'down'}>{nextReq} (you: {level})</dd>
              <dt>Opening cost</dt>
              <dd>{cr(cost)} CR</dd>
              <dt>Daily operating cost</dt>
              <dd>{cr(operatingCost(s, idx))} CR</dd>
              <dt>Stores allowed now</dt>
              <dd>
                {allowed} / {STORE_LEVEL_REQUIREMENT.length}
              </dd>
            </dl>
            <div className="field">
              <label htmlFor="new-store">Store name</label>
              <input id="new-store" className="input" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vault No. 2" />
            </div>
            <div className="field">
              <label>Categories (up to {slots})</label>
              <div className="row-wrap">
                {CATEGORIES.map((c) => {
                  const on = cats.includes(c.id);
                  return (
                    <button key={c.id} className="chip" aria-pressed={on} disabled={!on && cats.length >= slots} onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id])}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || level < nextReq || s.wallet.cash < cost || name.trim().length < 2 || cats.length === 0}
              onClick={() => {
                const r = run((st) => openNewStore(st, name, cats, key), { sound: 'level', success: `${name.trim()} is ready`, successBody: 'Add listings and open it for customers.' });
                if (r?.ok) {
                  renewKey();
                  setName('');
                  setCats([]);
                }
              }}
            >
              {level < nextReq ? (
                <>
                  <Lock size={14} /> Unlocks at level {nextReq}
                </>
              ) : (
                <>
                  <Eye size={14} /> Open store for {cr(cost)} CR
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

