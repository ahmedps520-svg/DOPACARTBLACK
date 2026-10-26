/**
 * Simulated rival businesses. They are NOT real players. Each follows a
 * simple, documented rule set, trades on the same market as the player
 * (so their purchases really move supply and prices) and runs a storefront
 * that sells a small share of its stock to customers every hour.
 */
import type { Competitor, CompetitorStrategy, GameState, ProductDef } from './types';
import { PRODUCTS, PRODUCT_BY_ID } from './catalog';
import { MARKET_FEE_BASE, SPREAD, MINUTES_PER_DAY } from './constants';
import { RARITY_RANK } from './categories';
import { averagePrice, changeOver } from './history';
import { isActive } from './events';
import { levelForXp } from './progression';
import { money } from './ledger';
import { rand, randInt } from './rng';
import { availableUnits } from './market';

export const STRATEGY_INFO: Record<CompetitorStrategy, { label: string; rule: string }> = {
  value: {
    label: 'Value Hunter',
    rule: 'Buys products trading 7%+ below their 7-day average; sells at +8% or cuts losses at −12%.',
  },
  momentum: {
    label: 'Momentum Trader',
    rule: 'Buys products up 4%+ over 24h; sells when momentum turns negative, at +12%, or at −8%.',
  },
  collector: {
    label: 'Collector',
    rule: 'Buys Rare-or-better items at or below their 7-day average and holds for a +25% gain.',
  },
  event: {
    label: 'Event Chaser',
    rule: 'Buys into positive market events in their first hours and sells when the event ends or at +15%.',
  },
  volume: {
    label: 'Volume Dealer',
    rule: 'Stocks Common goods priced at or below base value and moves them through a busy storefront.',
  },
};

const ROSTER: Omit<Competitor, 'holdings' | 'revenue' | 'realizedProfit' | 'sales' | 'xp' | 'level' | 'lastAction' | 'lastActionAt' | 'cash'>[] = [
  { id: 'rival-kestrel', name: 'Kestrel Goods', owner: 'SIM-01', strategy: 'value', color: '#5ab0ff', startingCash: 10_000 },
  { id: 'rival-ironveil', name: 'Ironveil Trading', owner: 'SIM-02', strategy: 'momentum', color: '#ffb547', startingCash: 12_000 },
  { id: 'rival-maison', name: 'Maison Ombre', owner: 'SIM-03', strategy: 'collector', color: '#c792ff', startingCash: 15_000 },
  { id: 'rival-pulse', name: 'Pulse Resale', owner: 'SIM-04', strategy: 'event', color: '#3ddc97', startingCash: 9_000 },
  { id: 'rival-bulkhaus', name: 'Bulkhaus', owner: 'SIM-05', strategy: 'volume', color: '#ff7a59', startingCash: 8_000 },
];

export function createCompetitors(t: number): Competitor[] {
  return ROSTER.map((r) => ({
    ...r,
    cash: r.startingCash,
    holdings: {},
    revenue: 0,
    realizedProfit: 0,
    sales: 0,
    xp: 0,
    level: 1,
    lastAction: 'Opened for business',
    lastActionAt: t,
  }));
}

export function competitorInventoryValue(s: GameState, c: Competitor): number {
  let v = 0;
  for (const id in c.holdings) v += c.holdings[id].qty * (s.market[id]?.price ?? 0);
  return money(v);
}

export function competitorNetWorth(s: GameState, c: Competitor): number {
  return money(c.cash + competitorInventoryValue(s, c));
}

function buy(s: GameState, c: Competitor, def: ProductDef, budgetShare: number) {
  const mp = s.market[def.id];
  const maxBySupply = Math.floor(availableUnits(mp) * 0.1);
  const qty = Math.min(maxBySupply, Math.floor((c.cash * budgetShare) / mp.price));
  if (qty <= 0) return;
  const cost = money(qty * mp.price);
  c.cash = money(c.cash - cost);
  mp.supply = Math.max(0, mp.supply - qty);
  mp.totalVolume += qty;
  const h = c.holdings[def.id];
  if (h) {
    h.avgCost = money((h.qty * h.avgCost + cost) / (h.qty + qty));
    h.qty += qty;
  } else {
    c.holdings[def.id] = { qty, avgCost: mp.price, boughtAt: s.clock.t };
  }
  c.lastAction = `Bought ${qty}× ${def.name}`;
  c.lastActionAt = s.clock.t;
}

function sell(s: GameState, c: Competitor, id: string, qty: number, toMarket: boolean, premium = 1) {
  const def = PRODUCT_BY_ID[id];
  const mp = s.market[id];
  const h = c.holdings[id];
  if (!h || qty <= 0) return;
  qty = Math.min(qty, h.qty);
  const unit = toMarket ? mp.price * (1 - SPREAD[def.rarity]) * (1 - MARKET_FEE_BASE) : mp.price * premium;
  const proceeds = money(unit * qty);
  const pnl = money(proceeds - h.avgCost * qty);
  c.cash = money(c.cash + proceeds);
  c.revenue = money(c.revenue + proceeds);
  c.realizedProfit = money(c.realizedProfit + pnl);
  c.sales += qty;
  c.xp += Math.max(0, pnl) / 8 + qty;
  c.level = levelForXp(c.xp);
  if (toMarket) mp.supply += qty;
  mp.totalVolume += qty;
  h.qty -= qty;
  if (h.qty <= 0) delete c.holdings[id];
  if (toMarket) {
    c.lastAction = `Sold ${qty}× ${def.name} ${pnl >= 0 ? 'for a gain' : 'at a loss'}`;
    c.lastActionAt = s.clock.t;
  }
}

function shouldExit(s: GameState, c: Competitor, id: string): boolean {
  const mp = s.market[id];
  const h = c.holdings[id];
  const gain = mp.price / h.avgCost - 1;
  switch (c.strategy) {
    case 'value':
      return gain >= 0.08 || gain <= -0.12;
    case 'momentum':
      return gain >= 0.12 || gain <= -0.08 || changeOver(mp, 6 * 60) < -0.02;
    case 'collector':
      return gain >= 0.25;
    case 'event': {
      const stillHot = s.events.some((e) => isActive(e, s.clock.t) && e.bias === 'up' && e.productIds.includes(id));
      return gain >= 0.15 || !stillHot || gain <= -0.1;
    }
    case 'volume':
      return gain >= 0.2 || gain <= -0.15;
  }
}

function candidates(s: GameState, c: Competitor): ProductDef[] {
  const listed = PRODUCTS.filter((p) => s.market[p.id]?.listed && availableUnits(s.market[p.id]) > 2 && !c.holdings[p.id]);
  switch (c.strategy) {
    case 'value':
      return listed.filter((p) => s.market[p.id].price < averagePrice(s.market[p.id], 7 * 24) * 0.93 && RARITY_RANK[p.rarity] <= RARITY_RANK.epic);
    case 'momentum':
      return listed.filter((p) => changeOver(s.market[p.id], MINUTES_PER_DAY) > 0.04);
    case 'collector':
      return listed.filter((p) => RARITY_RANK[p.rarity] >= RARITY_RANK.rare && s.market[p.id].price <= averagePrice(s.market[p.id], 7 * 24));
    case 'event': {
      const hot = new Set<string>();
      for (const e of s.events)
        if (isActive(e, s.clock.t) && e.bias === 'up' && s.clock.t - e.start < 6 * 60) e.productIds.forEach((id) => hot.add(id));
      return listed.filter((p) => hot.has(p.id));
    }
    case 'volume':
      return listed.filter((p) => p.rarity === 'common' && s.market[p.id].price <= p.basePrice);
  }
}

/** Hourly decision cycle for every rival. */
export function competitorsTick(s: GameState) {
  for (const c of s.competitors) {
    // Storefront: a share of every holding sells to customers at a small premium.
    const storeShare = c.strategy === 'volume' ? 0.06 : 0.02;
    for (const id of Object.keys(c.holdings)) {
      const h = c.holdings[id];
      const units = Math.floor(h.qty * storeShare + rand(s));
      if (units > 0) sell(s, c, id, units, false, 1.04);
    }
    // Exits.
    for (const id of Object.keys(c.holdings)) if (c.holdings[id] && shouldExit(s, c, id)) sell(s, c, id, c.holdings[id].qty, true);
    // Entries: at most one new position per hour, max 8 positions.
    if (Object.keys(c.holdings).length >= 8 || c.cash < 200) continue;
    const list = candidates(s, c);
    if (list.length === 0) continue;
    const def = list[randInt(s, 0, list.length - 1)];
    buy(s, c, def, c.strategy === 'volume' ? 0.25 : 0.18);
  }
}
