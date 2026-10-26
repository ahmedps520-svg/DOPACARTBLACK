/**
 * Player stores: listings, simulated customers and operating costs.
 *
 * Expected units sold per in-game day for a listing:
 *   λ = traffic × conversion × attractiveness × (demand / 100) / dilution
 *   traffic       = 26 visitors × visibility upgrade × reputation × scenario × events
 *   conversion    = rarity base rate × photography upgrade
 *   attractiveness= exp(−4.5 × (listPrice / marketPrice − 1)), clamped to [0.03, 3]
 *   dilution      = 1 + 0.08 × (active listings − 1)
 * Units sold each tick are Poisson(λ × dt), capped by the listed quantity.
 */
import type { CategoryId, GameState, Listing, PlayerStore, StoreThemeId } from './types';
import {
  LISTING_PRICE_MAX,
  LISTING_PRICE_MIN,
  MINUTES_PER_DAY,
  RARITY_PARAMS,
  STORE_LEVEL_REQUIREMENT,
  STORE_OPEN_COST,
  STORE_OPERATING_COST,
  STORE_PAYMENT_FEE,
  TICK_MINUTES,
} from './constants';
import { PRODUCT_BY_ID } from './catalog';
import { fail, money, nextId, notify, recordTx } from './ledger';
import { removeHolding } from './inventory';
import { availableQty, categorySlots, listingSlots, storeTrafficPerDay } from './selectors';
import { upgradeValue } from './upgrades';
import { trafficMultiplier, isActive } from './events';
import { poisson } from './rng';
import { addXp, STORE_THEMES, xpForProfit } from './progression';
import { CATEGORY_BY_ID } from './categories';

export function attractiveness(ratio: number): number {
  return Math.min(3, Math.max(0.03, Math.exp(-4.5 * (ratio - 1))));
}

export function newStore(id: string, name: string, t: number, categories: CategoryId[]): PlayerStore {
  return {
    id,
    name,
    theme: 'obsidian',
    categories,
    listings: [],
    open: false,
    openedAt: t,
    stats: { revenue: 0, unitsSold: 0, profit: 0, visitors: 0, fees: 0 },
    tagline: 'Curated drops. Fair prices. Fast handover.',
  };
}

export function getStore(s: GameState, storeId: string): PlayerStore {
  const st = s.stores.find((x) => x.id === storeId);
  if (!st) fail('Store not found.');
  return st;
}

export function operatingCost(s: GameState, storeIndex: number): number {
  const base = STORE_OPERATING_COST[Math.min(storeIndex, STORE_OPERATING_COST.length - 1)];
  return money(base * upgradeValue(s, 'operations'));
}

/** Expected units per day for a listing at a given price (used by UI forecasts too). */
export function expectedDailySales(s: GameState, store: PlayerStore, productId: string, price: number, activeListings: number): number {
  const def = PRODUCT_BY_ID[productId];
  const mp = s.market[productId];
  if (!def || !mp) return 0;
  const traffic = storeTrafficPerDay(s, store) * trafficMultiplier(s);
  const conv = RARITY_PARAMS[def.rarity].conversion * upgradeValue(s, 'photography');
  const dilution = 1 + 0.08 * Math.max(0, activeListings - 1);
  return (traffic * conv * attractiveness(price / mp.price) * (mp.demand / 100)) / dilution;
}

/** Simulated customers for every open store, for the tick ending at `t`. */
export function storeTick(s: GameState) {
  const dt = TICK_MINUTES / MINUTES_PER_DAY;
  for (const store of s.stores) {
    if (!store.open) continue;
    const traffic = storeTrafficPerDay(s, store) * trafficMultiplier(s);
    store.stats.visitors += poisson(s, traffic * dt);
    const active = store.listings.filter((l) => !l.paused && l.qty > 0);
    for (const l of active) {
      const lambda = expectedDailySales(s, store, l.productId, l.price, active.length);
      const n = Math.min(l.qty, poisson(s, lambda * dt));
      if (n > 0) sellFromListing(s, store, l, n);
    }
    const before = store.listings.length;
    store.listings = store.listings.filter((l) => l.qty > 0);
    if (store.listings.length < before) {
      notify(s, 'store', `${store.name}: listing sold out`, 'A listing sold its last unit. Restock to keep the shelf busy.', '/store');
    }
  }
}

function sellFromListing(s: GameState, store: PlayerStore, l: Listing, n: number) {
  const def = PRODUCT_BY_ID[l.productId];
  const holding = s.holdings[l.productId];
  const heldSince = holding?.firstAcquiredAt ?? s.clock.t;
  const basis = removeHolding(s, l.productId, n, true);
  const revenue = money(l.price * n);
  const fee = money(revenue * STORE_PAYMENT_FEE);
  const pnl = money(revenue - fee - basis);
  const sale = recordTx(s, {
    type: 'store_sale',
    total: revenue,
    productId: l.productId,
    qty: n,
    unitPrice: l.price,
    costBasis: basis,
    realizedPnl: pnl,
    storeId: store.id,
    memo: `${store.name} sold ${n}× ${def.name}`,
  });
  recordTx(s, { type: 'fee', total: -fee, productId: l.productId, storeId: store.id, relatedTx: sale.id, memo: `Payment processing ${(STORE_PAYMENT_FEE * 100).toFixed(1)}% · ${sale.id}` });
  l.qty -= n;
  l.sold += n;
  l.revenue = money(l.revenue + revenue);
  store.stats.revenue = money(store.stats.revenue + revenue);
  store.stats.unitsSold += n;
  store.stats.profit = money(store.stats.profit + pnl);
  store.stats.fees = money(store.stats.fees + fee);
  s.market[l.productId].totalVolume += n;
  registerSaleCounters(s, l.productId, n, pnl, heldSince);
  s.counters.storeUnitsSold += n;
}

/** Shared bookkeeping for any completed sale. */
export function registerSaleCounters(s: GameState, productId: string, qty: number, pnl: number, heldSince: number) {
  const def = PRODUCT_BY_ID[productId];
  s.counters.unitsSold += qty;
  if (pnl > 0) {
    s.counters.profitableSales++;
    if (s.clock.t - heldSince >= 7 * MINUTES_PER_DAY) s.counters.diamondHands++;
    if (s.events.some((e) => isActive(e, s.clock.t) && e.productIds.includes(productId))) s.counters.eventProfits++;
    addXp(s, xpForProfit(pnl, def.rarity), 'a profitable sale');
  }
}

/** Charge daily operating costs; stores that cannot pay are closed. */
export function chargeOperatingCosts(s: GameState) {
  s.stores.forEach((store, i) => {
    if (!store.open) return;
    const cost = operatingCost(s, i);
    if (s.wallet.cash >= cost) {
      recordTx(s, { type: 'operating_cost', total: -cost, storeId: store.id, memo: `Daily operating cost · ${store.name}` });
    } else {
      store.open = false;
      notify(s, 'store', `${store.name} closed`, `Not enough cash to cover the ${cost} CR daily operating cost. Reopen it when you can pay.`, '/store');
    }
  });
}

// ───────────────────────────── Commands ─────────────────────────────

export function validateListingPrice(s: GameState, productId: string, price: number) {
  const mp = s.market[productId];
  if (!Number.isFinite(price) || price <= 0) fail('Enter a valid price.');
  const lo = money(mp.price * LISTING_PRICE_MIN);
  const hi = money(mp.price * LISTING_PRICE_MAX);
  if (price < lo || price > hi)
    fail(`Price must be between ${lo.toLocaleString()} and ${hi.toLocaleString()} CR (${LISTING_PRICE_MIN * 100}%–${LISTING_PRICE_MAX * 100}% of market).`);
}

export function createListing(s: GameState, storeId: string, productId: string, qty: number, price: number): Listing {
  const store = getStore(s, storeId);
  const def = PRODUCT_BY_ID[productId];
  if (!def) fail('Unknown product.');
  if (!store.categories.includes(def.category))
    fail(`${store.name} is not licensed to sell ${CATEGORY_BY_ID[def.category].label}. Change its categories first.`);
  if (store.listings.length >= listingSlots(s)) fail(`All ${listingSlots(s)} listing slots are in use. Buy the Listing Slots upgrade for more.`);
  if (store.listings.some((l) => l.productId === productId)) fail('This product is already listed in this store — edit that listing instead.');
  if (!Number.isInteger(qty) || qty <= 0) fail('Enter a whole number of units to list.');
  const avail = availableQty(s, productId);
  if (qty > avail) fail(`You have ${avail} free unit${avail === 1 ? '' : 's'} of ${def.name}.`);
  validateListingPrice(s, productId, price);
  const l: Listing = { id: nextId(s, 'listing'), productId, qty, price: money(price), createdAt: s.clock.t, sold: 0, revenue: 0, paused: false };
  store.listings.push(l);
  s.counters.listingsCreated++;
  return l;
}

export function updateListing(s: GameState, storeId: string, listingId: string, patch: { price?: number; qty?: number; paused?: boolean }) {
  const store = getStore(s, storeId);
  const l = store.listings.find((x) => x.id === listingId);
  if (!l) fail('Listing not found.');
  if (patch.price !== undefined && patch.price !== l.price) {
    validateListingPrice(s, l.productId, patch.price);
    l.price = money(patch.price);
  }
  if (patch.qty !== undefined && patch.qty !== l.qty) {
    if (!Number.isInteger(patch.qty) || patch.qty <= 0) fail('Quantity must be a whole number above zero (remove the listing instead).');
    const free = availableQty(s, l.productId) + l.qty;
    if (patch.qty > free) fail(`You only have ${free} unit${free === 1 ? '' : 's'} available for this listing.`);
    l.qty = patch.qty;
  }
  if (patch.paused !== undefined) l.paused = patch.paused;
}

export function removeListing(s: GameState, storeId: string, listingId: string) {
  const store = getStore(s, storeId);
  const before = store.listings.length;
  store.listings = store.listings.filter((l) => l.id !== listingId);
  if (store.listings.length === before) fail('Listing not found.');
}

export function updateStoreSettings(
  s: GameState,
  storeId: string,
  patch: { name?: string; tagline?: string; logo?: string | null; theme?: StoreThemeId; categories?: CategoryId[] },
) {
  const store = getStore(s, storeId);
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2 || name.length > 32) fail('Store name must be 2–32 characters.');
    store.name = name;
  }
  if (patch.tagline !== undefined) store.tagline = patch.tagline.trim().slice(0, 80);
  if (patch.logo !== undefined) {
    if (patch.logo && (!patch.logo.startsWith('data:image/') || patch.logo.length > 400_000)) fail('Logo must be an image under ~300 KB.');
    store.logo = patch.logo ?? undefined;
  }
  if (patch.theme !== undefined) {
    const th = STORE_THEMES.find((x) => x.id === patch.theme);
    if (!th) fail('Unknown theme.');
    if (s.progression.level < th.level) fail(`${th.name} unlocks at level ${th.level}.`);
    store.theme = th.id;
  }
  if (patch.categories !== undefined) {
    const cats = [...new Set(patch.categories)];
    if (cats.length === 0) fail('Choose at least one category.');
    if (cats.length > categorySlots(s)) fail(`Your licenses allow ${categorySlots(s)} categories. Buy Category Licenses for more.`);
    const orphan = store.listings.find((l) => !cats.includes(PRODUCT_BY_ID[l.productId].category));
    if (orphan) fail(`Remove the ${PRODUCT_BY_ID[orphan.productId].name} listing before dropping its category.`);
    store.categories = cats;
  }
}

export function setStoreOpen(s: GameState, storeId: string, open: boolean) {
  const store = getStore(s, storeId);
  if (open && !store.open) {
    const cost = operatingCost(s, s.stores.indexOf(store));
    if (s.wallet.cash < cost) fail(`You need at least ${cost} CR to cover a day of operating costs.`);
  }
  store.open = open;
}

export function openNewStore(s: GameState, name: string, categories: CategoryId[]): PlayerStore {
  const idx = s.stores.length;
  if (idx >= STORE_LEVEL_REQUIREMENT.length) fail('You already run the maximum number of stores.');
  const req = STORE_LEVEL_REQUIREMENT[idx];
  if (s.progression.level < req) fail(`Store #${idx + 1} unlocks at level ${req}.`);
  const cost = STORE_OPEN_COST[idx];
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 32) fail('Store name must be 2–32 characters.');
  const cats = [...new Set(categories)];
  if (cats.length === 0 || cats.length > categorySlots(s)) fail(`Choose between 1 and ${categorySlots(s)} categories.`);
  if (cost > 0) recordTx(s, { type: 'store_open', total: -cost, memo: `Opened store #${idx + 1}: ${trimmed}` });
  const store = newStore(`store-${idx + 1}`, trimmed, s.clock.t, cats);
  s.stores.push(store);
  s.activeStoreId = store.id;
  return store;
}
