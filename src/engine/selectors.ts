/**
 * Pure derived values. UI components and the engine both read through these
 * so every screen agrees on how balances and values are computed.
 */
import type { GameState, Holding, Order, PlayerStore, ProductDef, Transaction } from './types';
import { PRODUCT_BY_ID } from './catalog';
import { SPREAD, STORE_LEVEL_REQUIREMENT, BASE_STORE_TRAFFIC, SCENARIOS, MINUTES_PER_DAY } from './constants';
import { upgradeValue } from './upgrades';
import { money } from './ledger';
import { startOfDay } from './time';

export function getDef(id: string): ProductDef {
  const d = PRODUCT_BY_ID[id];
  if (!d) throw new Error(`Unknown product ${id}`);
  return d;
}

export function inventoryValue(s: GameState): number {
  let v = 0;
  for (const h of Object.values(s.holdings)) v += h.qty * (s.market[h.productId]?.price ?? 0);
  return money(v);
}

export function inventoryCost(s: GameState): number {
  let v = 0;
  for (const h of Object.values(s.holdings)) v += h.qty * h.avgCost;
  return money(v);
}

export function unrealizedPnl(s: GameState): number {
  return money(inventoryValue(s) - inventoryCost(s));
}

export function inTransitOrders(s: GameState): Order[] {
  return s.orders.filter((o) => o.kind === 'supplier' && o.status !== 'delivered' && o.status !== 'cancelled');
}

export function inTransitValue(s: GameState): number {
  return money(inTransitOrders(s).reduce((sum, o) => sum + o.total, 0));
}

export function inTransitUnits(s: GameState): number {
  return inTransitOrders(s).reduce((sum, o) => sum + o.lines.reduce((a, l) => a + l.qty, 0), 0);
}

export function heldUnits(s: GameState): number {
  return Object.values(s.holdings).reduce((sum, h) => sum + h.qty, 0);
}

export function netWorth(s: GameState): number {
  return money(s.wallet.cash + inventoryValue(s) + inTransitValue(s));
}

export function capacity(s: GameState): number {
  return upgradeValue(s, 'warehouse');
}

export function capacityUsed(s: GameState): number {
  return heldUnits(s) + inTransitUnits(s);
}

export function listedQty(s: GameState, productId: string): number {
  let q = 0;
  for (const st of s.stores) for (const l of st.listings) if (l.productId === productId) q += l.qty;
  return q;
}

/** Units owned and not reserved by a store listing. */
export function availableQty(s: GameState, productId: string): number {
  const h = s.holdings[productId];
  return h ? Math.max(0, h.qty - listedQty(s, productId)) : 0;
}

export function marketFeeRate(s: GameState): number {
  return upgradeValue(s, 'seller');
}

export interface SellQuote {
  unitBid: number;
  gross: number;
  fee: number;
  net: number;
  costBasis: number;
  pnl: number;
  feeRate: number;
  spread: number;
}

/** What an instant market sale of `qty` units would pay right now. */
export function sellQuote(s: GameState, productId: string, qty: number): SellQuote {
  const def = getDef(productId);
  const mp = s.market[productId];
  const spread = SPREAD[def.rarity];
  const unitBid = money(mp.price * (1 - spread));
  const gross = money(unitBid * qty);
  const feeRate = marketFeeRate(s);
  const fee = money(gross * feeRate);
  const h: Holding | undefined = s.holdings[productId];
  const costBasis = money((h?.avgCost ?? 0) * qty);
  const net = money(gross - fee);
  return { unitBid, gross, fee, net, costBasis, pnl: money(net - costBasis), feeRate, spread };
}

export function activeStore(s: GameState): PlayerStore {
  return s.stores.find((st) => st.id === s.activeStoreId) ?? s.stores[0];
}

export function listingSlots(s: GameState): number {
  return upgradeValue(s, 'listings');
}

export function categorySlots(s: GameState): number {
  return upgradeValue(s, 'licenses');
}

export function maxStoresForLevel(level: number): number {
  return STORE_LEVEL_REQUIREMENT.filter((l) => level >= l).length;
}

/** Store reputation grows with lifetime units sold (up to ×2 traffic). */
export function storeReputation(store: PlayerStore): number {
  return 1 + Math.min(1, Math.log10(1 + store.stats.unitsSold) / 3);
}

/** Expected visitors per in-game day (before event multipliers). */
export function storeTrafficPerDay(s: GameState, store: PlayerStore): number {
  return BASE_STORE_TRAFFIC * upgradeValue(s, 'visibility') * storeReputation(store) * SCENARIOS[s.profile.scenario].trafficMult;
}

export function storeRevenueTotal(s: GameState): number {
  return money(s.stores.reduce((sum, st) => sum + st.stats.revenue, 0));
}

/** Transactions whose in-game time falls in [from, to). */
export function txBetween(s: GameState, from: number, to: number): Transaction[] {
  const out: Transaction[] = [];
  for (let i = s.transactions.length - 1; i >= 0; i--) {
    const tx = s.transactions[i];
    if (tx.t < from) break;
    if (tx.t < to) out.push(tx);
  }
  return out.reverse();
}

export function txToday(s: GameState): Transaction[] {
  const start = startOfDay(s.clock.t);
  return txBetween(s, start, start + MINUTES_PER_DAY);
}

/** Business totals over a window, from the ledger. */
export function periodTotals(txs: Transaction[]) {
  let revenue = 0;
  let storeRevenue = 0;
  let profit = 0;
  let fees = 0;
  let operating = 0;
  let purchases = 0;
  let investments = 0;
  let rewards = 0;
  let cashIn = 0;
  let cashOut = 0;
  let unitsSold = 0;
  let cogs = 0;
  for (const tx of txs) {
    if (tx.type === 'starting_balance') continue;
    if (tx.total >= 0) cashIn += tx.total;
    else cashOut -= tx.total;
    switch (tx.type) {
      case 'sale':
      case 'store_sale':
        revenue += tx.total;
        if (tx.type === 'store_sale') storeRevenue += tx.total;
        profit += tx.realizedPnl ?? 0;
        unitsSold += tx.qty ?? 0;
        cogs += tx.costBasis ?? 0;
        break;
      case 'fee':
        fees -= tx.total;
        break;
      case 'operating_cost':
        operating -= tx.total;
        break;
      case 'purchase':
      case 'supplier_order':
        purchases -= tx.total;
        break;
      case 'refund':
        purchases -= tx.total;
        break;
      case 'upgrade':
      case 'store_open':
        investments -= tx.total;
        break;
      case 'reward':
        rewards += tx.total;
        break;
    }
  }
  return {
    revenue: money(revenue),
    storeRevenue: money(storeRevenue),
    profit: money(profit),
    fees: money(fees),
    operating: money(operating),
    purchases: money(purchases),
    investments: money(investments),
    rewards: money(rewards),
    cashIn: money(cashIn),
    cashOut: money(cashOut),
    netCash: money(cashIn - cashOut),
    unitsSold,
    cogs: money(cogs),
  };
}
