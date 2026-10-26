/**
 * Player commands — the only way the UI can change game state.
 *
 * Each command runs inside an immer draft: it validates the request, prices
 * it, applies every state change and records transactions. If any step
 * fails the draft is discarded, so a command is atomic (all-or-nothing).
 * Commands that move money take an idempotency key; a repeated key (double
 * click, retried request) is rejected instead of charging twice.
 */
import { produce, setAutoFreeze } from 'immer';
import type { AlertKind, CategoryId, CommandResult, GameState, Order, Settings, StoreThemeId, UpgradeId } from './types';
import { PRODUCT_BY_ID } from './catalog';
import { MAX_CART_LINES, MAX_COMPARE, MAX_ORDER_QTY } from './constants';
import { GameError, fail, money, nextId, recordTx } from './ledger';
import { addHolding, removeHolding } from './inventory';
import { availableUnits } from './market';
import { capacity, capacityUsed, getDef, sellQuote } from './selectors';
import { addXp, checkProgress, claimDaily as claimDailyImpl, claimMission as claimMissionImpl, rarityUnlockLevel } from './progression';
import { RARITY_LABEL } from './categories';
import { UPGRADE_BY_ID, nextUpgradeLevel } from './upgrades';
import * as storefront from './storefront';
import * as orders from './orders';
import * as alerts from './alerts';
import { registerSaleCounters } from './storefront';
import { demandAgo } from './history';
import { tutorialCheck, tutorialNext as tutorialNextImpl, tutorialVisit } from './tutorial';

// Game state is large and replaced often; freezing it would only cost time.
setAutoFreeze(false);

function execute<T>(state: GameState, fn: (d: GameState) => T, key?: string): CommandResult<T> {
  if (key && state.processedKeys.includes(key)) {
    return { ok: false, error: 'This request was already processed — duplicate ignored.', state };
  }
  let data: T | undefined;
  try {
    const next = produce(state, (d) => {
      data = fn(d as GameState);
      if (key) d.processedKeys.push(key);
      checkProgress(d as GameState);
      tutorialCheck(d as GameState);
    });
    return { ok: true, state: next, data };
  } catch (e) {
    if (e instanceof GameError) return { ok: false, error: e.message, state };
    console.error(e);
    return { ok: false, error: 'Something went wrong. Nothing was changed.', state };
  }
}

function assertQty(qty: number, max = MAX_ORDER_QTY) {
  if (!Number.isInteger(qty) || qty <= 0) fail('Quantity must be a whole number above zero.');
  if (qty > max) fail(`Maximum ${max} units per order.`);
}

function assertPurchasable(s: GameState, productId: string, qty: number) {
  const def = PRODUCT_BY_ID[productId];
  if (!def) fail('Unknown product.');
  const mp = s.market[productId];
  if (!mp?.listed) fail(`${def.name} is not on the market yet.`);
  assertQty(qty);
  const lvl = rarityUnlockLevel(def.rarity);
  if (s.progression.level < lvl) fail(`${RARITY_LABEL[def.rarity]} products unlock at level ${lvl}. You are level ${s.progression.level}.`);
  const avail = availableUnits(mp);
  if (avail < qty) fail(avail === 0 ? `${def.name} is sold out on the market right now.` : `Only ${avail} unit${avail === 1 ? '' : 's'} of ${def.name} available.`);
}

function buyLine(s: GameState, productId: string, qty: number, orderId: string) {
  const def = getDef(productId);
  const mp = s.market[productId];
  const unit = mp.price;
  recordTx(s, {
    type: 'purchase',
    total: -money(unit * qty),
    productId,
    qty,
    unitPrice: unit,
    orderId,
    memo: `Bought ${qty}× ${def.name} at market`,
  });
  mp.supply = Math.max(0, mp.supply - qty);
  mp.totalVolume += qty;
  addHolding(s, productId, qty, unit);
  s.counters.unitsBought += qty;
}

function marketOrder(s: GameState, lines: { productId: string; qty: number }[], key: string): Order {
  const id = nextId(s, 'order');
  const order: Order = {
    id,
    kind: 'market',
    lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: s.market[l.productId].price })),
    subtotal: 0,
    shipping: 0,
    total: 0,
    placedAt: s.clock.t,
    plannedDuration: 0,
    delay: 0,
    status: 'delivered',
    history: [
      { status: 'placed', t: s.clock.t },
      { status: 'delivered', t: s.clock.t },
    ],
    idempotencyKey: key,
  };
  order.subtotal = money(order.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0));
  order.total = order.subtotal;
  for (const l of lines) buyLine(s, l.productId, l.qty, id);
  s.orders.unshift(order);
  s.counters.purchases++;
  return order;
}

function assertCapacity(s: GameState, units: number) {
  const free = capacity(s) - capacityUsed(s);
  if (units > free) fail(`Warehouse full: ${free} unit${free === 1 ? '' : 's'} of space left. Expand it with the Warehouse upgrade.`);
}

// ───────────────────────────── Trading ─────────────────────────────

export function buyNow(s: GameState, productId: string, qty: number, key: string) {
  return execute(
    s,
    (d) => {
      assertPurchasable(d, productId, qty);
      assertCapacity(d, qty);
      const total = money(d.market[productId].price * qty);
      if (total > d.wallet.cash) fail(`Insufficient funds: ${qty}× costs ${total.toLocaleString()} CR, you have ${d.wallet.cash.toLocaleString()} CR.`);
      return marketOrder(d, [{ productId, qty }], key);
    },
    key,
  );
}

export function checkoutCart(s: GameState, key: string) {
  return execute(
    s,
    (d) => {
      if (d.cart.length === 0) fail('Your cart is empty.');
      let units = 0;
      let total = 0;
      for (const l of d.cart) {
        assertPurchasable(d, l.productId, l.qty);
        units += l.qty;
        total += d.market[l.productId].price * l.qty;
      }
      assertCapacity(d, units);
      total = money(total);
      if (total > d.wallet.cash) fail(`Insufficient funds: the cart costs ${total.toLocaleString()} CR, you have ${d.wallet.cash.toLocaleString()} CR.`);
      const order = marketOrder(d, d.cart, key);
      d.cart = [];
      return order;
    },
    key,
  );
}

export function sellToMarket(s: GameState, productId: string, qty: number, key: string) {
  return execute(
    s,
    (d) => {
      const def = PRODUCT_BY_ID[productId];
      if (!def) fail('Unknown product.');
      assertQty(qty, 100_000);
      const h = d.holdings[productId];
      if (!h || h.qty < qty) fail(`You only own ${h?.qty ?? 0} unit${h?.qty === 1 ? '' : 's'} of ${def.name}.`);
      const heldSince = h.firstAcquiredAt;
      const q = sellQuote(d, productId, qty);
      removeHolding(d, productId, qty);
      const sale = recordTx(d, {
        type: 'sale',
        total: q.gross,
        productId,
        qty,
        unitPrice: q.unitBid,
        costBasis: q.costBasis,
        realizedPnl: q.pnl,
        memo: `Sold ${qty}× ${def.name} to the market`,
      });
      if (q.fee > 0)
        recordTx(d, { type: 'fee', total: -q.fee, productId, relatedTx: sale.id, memo: `Marketplace fee ${(q.feeRate * 100).toFixed(2).replace(/\.?0+$/, '')}% · ${sale.id}` });
      const mp = d.market[productId];
      mp.supply += qty;
      mp.totalVolume += qty;
      d.counters.marketSales++;
      registerSaleCounters(d, productId, qty, q.pnl, heldSince);
      return q;
    },
    key,
  );
}

// ───────────────────────────── Cart ─────────────────────────────

export function addToCart(s: GameState, productId: string, qty: number) {
  return execute(s, (d) => {
    const def = PRODUCT_BY_ID[productId];
    if (!def || !d.market[productId]?.listed) fail('That product is not on the market.');
    assertQty(qty);
    const line = d.cart.find((l) => l.productId === productId);
    if (line) {
      line.qty = Math.min(MAX_ORDER_QTY, line.qty + qty);
    } else {
      if (d.cart.length >= MAX_CART_LINES) fail(`Your cart can hold ${MAX_CART_LINES} different products.`);
      d.cart.push({ productId, qty });
    }
  });
}

export function setCartQty(s: GameState, productId: string, qty: number) {
  return execute(s, (d) => {
    const line = d.cart.find((l) => l.productId === productId);
    if (!line) fail('Item is not in your cart.');
    if (qty <= 0) d.cart = d.cart.filter((l) => l.productId !== productId);
    else {
      assertQty(qty);
      line.qty = qty;
    }
  });
}

export function removeFromCart(s: GameState, productId: string) {
  return execute(s, (d) => {
    d.cart = d.cart.filter((l) => l.productId !== productId);
  });
}

export function clearCart(s: GameState) {
  return execute(s, (d) => {
    d.cart = [];
  });
}

// ───────────────────────────── Lists ─────────────────────────────

export function toggleWatchlist(s: GameState, productId: string) {
  return execute(s, (d) => {
    if (!PRODUCT_BY_ID[productId]) fail('Unknown product.');
    if (d.watchlist.includes(productId)) {
      d.watchlist = d.watchlist.filter((x) => x !== productId);
      return false;
    }
    d.watchlist.push(productId);
    const mp = d.market[productId];
    const past = demandAgo(mp, 24);
    if (mp.listed && past > 0 && mp.demand / past - 1 >= 0.1) d.counters.risingDemandSpotted++;
    return true;
  });
}

export function toggleFavorite(s: GameState, productId: string) {
  return execute(s, (d) => {
    if (!PRODUCT_BY_ID[productId]) fail('Unknown product.');
    if (d.favorites.includes(productId)) d.favorites = d.favorites.filter((x) => x !== productId);
    else d.favorites.push(productId);
  });
}

export function toggleCompare(s: GameState, productId: string) {
  return execute(s, (d) => {
    if (d.compare.includes(productId)) d.compare = d.compare.filter((x) => x !== productId);
    else {
      if (d.compare.length >= MAX_COMPARE) fail(`Compare up to ${MAX_COMPARE} products at once.`);
      d.compare.push(productId);
    }
  });
}

export function clearCompare(s: GameState) {
  return execute(s, (d) => {
    d.compare = [];
  });
}

export function viewProduct(s: GameState, productId: string) {
  return execute(s, (d) => {
    d.recentlyViewed = [productId, ...d.recentlyViewed.filter((x) => x !== productId)].slice(0, 12);
  });
}

// ───────────────────────────── Alerts & notifications ─────────────────────────────

export function createAlert(s: GameState, productId: string, kind: AlertKind, threshold: number) {
  return execute(s, (d) => alerts.createAlert(d, productId, kind, threshold));
}

export function deleteAlert(s: GameState, alertId: string) {
  return execute(s, (d) => {
    d.alerts = d.alerts.filter((a) => a.id !== alertId);
  });
}

export function markNotificationsRead(s: GameState, ids?: string[]) {
  return execute(s, (d) => {
    for (const n of d.notifications) if (!ids || ids.includes(n.id)) n.read = true;
  });
}

export function clearNotifications(s: GameState) {
  return execute(s, (d) => {
    d.notifications = [];
  });
}

// ───────────────────────────── Business ─────────────────────────────

export function buyUpgrade(s: GameState, id: UpgradeId, key: string) {
  return execute(
    s,
    (d) => {
      const def = UPGRADE_BY_ID[id];
      if (!def) fail('Unknown upgrade.');
      const next = nextUpgradeLevel(d, id);
      if (!next) fail(`${def.name} is already at its maximum tier.`);
      if (d.progression.level < next.requiredLevel) fail(`${def.name} tier ${(d.upgrades[id] ?? 0) + 1} unlocks at level ${next.requiredLevel}.`);
      recordTx(d, { type: 'upgrade', total: -next.cost, memo: `Upgrade: ${def.name} tier ${(d.upgrades[id] ?? 0) + 1} — ${next.benefit}` });
      d.upgrades[id] = (d.upgrades[id] ?? 0) + 1;
      d.counters.upgradesBought++;
      addXp(d, 30, 'a business upgrade');
    },
    key,
  );
}

export function createListing(s: GameState, storeId: string, productId: string, qty: number, price: number) {
  return execute(s, (d) => storefront.createListing(d, storeId, productId, qty, price));
}

export function updateListing(s: GameState, storeId: string, listingId: string, patch: { price?: number; qty?: number; paused?: boolean }) {
  return execute(s, (d) => storefront.updateListing(d, storeId, listingId, patch));
}

export function removeListing(s: GameState, storeId: string, listingId: string) {
  return execute(s, (d) => storefront.removeListing(d, storeId, listingId));
}

export function updateStore(
  s: GameState,
  storeId: string,
  patch: { name?: string; tagline?: string; logo?: string | null; theme?: StoreThemeId; categories?: CategoryId[] },
) {
  return execute(s, (d) => storefront.updateStoreSettings(d, storeId, patch));
}

export function setStoreOpen(s: GameState, storeId: string, open: boolean) {
  return execute(s, (d) => storefront.setStoreOpen(d, storeId, open));
}

export function openNewStore(s: GameState, name: string, categories: CategoryId[], key: string) {
  return execute(s, (d) => storefront.openNewStore(d, name, categories), key);
}

export function setActiveStore(s: GameState, storeId: string) {
  return execute(s, (d) => {
    storefront.getStore(d, storeId);
    d.activeStoreId = storeId;
  });
}

export function placeSupplierOrder(s: GameState, supplierId: string, lines: { productId: string; qty: number }[], key: string) {
  return execute(s, (d) => orders.placeSupplierOrder(d, supplierId, lines, key), key);
}

export function cancelOrder(s: GameState, orderId: string, key: string) {
  return execute(s, (d) => orders.cancelOrder(d, orderId), key);
}

// ───────────────────────────── Progression ─────────────────────────────

export function claimMission(s: GameState, id: string, key: string) {
  return execute(s, (d) => claimMissionImpl(d, id), key);
}

export function claimDaily(s: GameState, id: string, key: string) {
  return execute(s, (d) => claimDailyImpl(d, id), key);
}

// ───────────────────────────── Settings & tutorial ─────────────────────────────

export function updateSettings(s: GameState, patch: Partial<Settings>) {
  return execute(s, (d) => {
    if (patch.speed !== undefined && ![0, 1, 2, 4].includes(patch.speed)) fail('Invalid speed.');
    Object.assign(d.settings, patch);
    if (patch.notify) d.settings.notify = { ...s.settings.notify, ...patch.notify };
  });
}

export function updateProfile(s: GameState, patch: { name?: string; avatar?: number }) {
  return execute(s, (d) => {
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (n.length < 2 || n.length > 24) fail('Name must be 2–24 characters.');
      d.profile.name = n;
    }
    if (patch.avatar !== undefined) d.profile.avatar = patch.avatar;
  });
}

export function visitPage(s: GameState, page: string) {
  if (s.visited.includes(page) && !(s.tutorial.active && !s.tutorial.done)) return { ok: true as const, state: s };
  return execute(s, (d) => tutorialVisit(d, page));
}

export function tutorialNext(s: GameState) {
  return execute(s, (d) => tutorialNextImpl(d));
}

export function skipTutorial(s: GameState) {
  return execute(s, (d) => {
    d.tutorial.active = false;
    d.tutorial.skipped = true;
  });
}

export function restartTutorial(s: GameState) {
  return execute(s, (d) => {
    d.tutorial = { active: true, step: 0, done: false, skipped: false };
  });
}
