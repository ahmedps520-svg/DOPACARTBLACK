import { describe, expect, it } from 'vitest';
import { createNewGame } from '../newGame';
import * as cmd from '../commands';
import type { GameState } from '../types';
import { PRODUCTS, PRODUCT_BY_ID } from '../catalog';
import { runTicks, advanceRealTime } from '../sim';
import { priceCeiling, priceFloor, computeMods, stepProduct } from '../market';
import { sellQuote, capacity, netWorth, inventoryValue } from '../selectors';
import { SPREAD, MAX_OFFLINE_MINUTES, REAL_MS_PER_TICK, TICK_MINUTES, MINUTES_PER_DAY } from '../constants';
import { statusSchedule } from '../orders';
import { supplierCatalog, SUPPLIER_BY_ID } from '../suppliers';
import { EVENT_DEFS } from '../events';

function game(seed = 1234, balance = 10_000): GameState {
  return createNewGame({ playerName: 'Tester', storeName: 'Test Store', seed, startingBalance: balance, now: 0, tutorial: false });
}

function ok<T>(r: ReturnType<typeof cmd.buyNow> | { ok: boolean; state: GameState; error?: string; data?: T }): GameState {
  if (!r.ok) throw new Error(`expected ok, got: ${(r as { error: string }).error}`);
  return r.state;
}

function ledgerSum(s: GameState) {
  return Math.round(s.transactions.reduce((a, t) => a + t.total, 0) * 100) / 100;
}

/** A cheap, listed, level-1 product with plenty of supply. */
function cheapProduct(s: GameState) {
  return PRODUCTS.filter((p) => p.rarity === 'common' && s.market[p.id].listed && s.market[p.id].supply > 20).sort(
    (a, b) => s.market[a.id].price - s.market[b.id].price,
  )[0];
}

let keySeq = 0;
const key = () => `k-${++keySeq}`;

describe('new game', () => {
  it('starts with the configured balance recorded in the ledger', () => {
    const s = game(1, 25_000);
    expect(s.wallet.cash).toBe(25_000);
    expect(ledgerSum(s)).toBe(25_000);
    expect(s.transactions[0].type).toBe('starting_balance');
  });

  it('pre-simulates 30 days of market history', () => {
    const s = game();
    const mp = s.market[cheapProduct(s).id];
    expect(mp.history.daily.length).toBeGreaterThanOrEqual(30);
    expect(mp.history.ticks.length).toBe(145);
    expect(mp.history.hourly.length).toBeGreaterThan(700);
  });

  it('is deterministic for a given seed', () => {
    const a = game(99);
    const b = game(99);
    const id = cheapProduct(a).id;
    expect(a.market[id].price).toBe(b.market[id].price);
  });
});

describe('purchasing', () => {
  it('updates cash, inventory, supply, ledger and orders', () => {
    let s = game();
    const p = cheapProduct(s);
    const price = s.market[p.id].price;
    const supply = s.market[p.id].supply;
    s = ok(cmd.buyNow(s, p.id, 2, key()));
    expect(s.wallet.cash).toBeCloseTo(10_000 - price * 2, 2);
    expect(s.holdings[p.id].qty).toBe(2);
    expect(s.holdings[p.id].avgCost).toBe(price);
    expect(s.market[p.id].supply).toBeCloseTo(supply - 2, 5);
    const tx = s.transactions[s.transactions.length - 1];
    expect(tx.type).toBe('purchase');
    expect(tx.qty).toBe(2);
    expect(tx.balanceAfter).toBe(s.wallet.cash);
    expect(s.orders[0].status).toBe('delivered');
    expect(ledgerSum(s)).toBe(s.wallet.cash);
  });

  it('rejects purchases the player cannot afford and changes nothing', () => {
    const s = game(1, 100);
    const p = PRODUCTS.find((x) => s.market[x.id].listed && s.market[x.id].price > 200 && x.rarity === 'common')!;
    const r = cmd.buyNow(s, p.id, 1, key());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Insufficient funds/);
    expect(r.state).toBe(s);
  });

  it('rejects quantities above available supply', () => {
    const s = game();
    const p = cheapProduct(s);
    const r = cmd.buyNow(s, p.id, Math.floor(s.market[p.id].supply) + 1, key());
    expect(r.ok).toBe(false);
  });

  it('rejects locked rarities', () => {
    const s = game(5, 1_000_000);
    const legend = PRODUCTS.find((p) => p.rarity === 'legendary' && s.market[p.id].listed)!;
    const r = cmd.buyNow(s, legend.id, 1, key());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/level/);
  });

  it('enforces warehouse capacity', () => {
    const s = game(1, 1_000_000);
    const p = cheapProduct(s);
    const r = cmd.buyNow(s, p.id, capacity(s) + 1, key());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Warehouse full/);
  });

  it('ignores duplicate submissions with the same idempotency key', () => {
    let s = game();
    const p = cheapProduct(s);
    const k = key();
    s = ok(cmd.buyNow(s, p.id, 1, k));
    const again = cmd.buyNow(s, p.id, 1, k);
    expect(again.ok).toBe(false);
    expect(again.state.holdings[p.id].qty).toBe(1);
  });

  it('checks out a cart atomically', () => {
    const probe = game(3);
    const cheap = cheapProduct(probe);
    const pricey = PRODUCTS.filter((x) => probe.market[x.id].listed && x.rarity === 'common' && x.id !== cheap.id).sort(
      (a, b) => probe.market[b.id].price - probe.market[a.id].price,
    )[0];
    const balance = Math.floor(probe.market[cheap.id].price + probe.market[pricey.id].price - 1);
    let s = game(3, balance);
    s = ok(cmd.addToCart(s, cheap.id, 1));
    s = ok(cmd.addToCart(s, pricey.id, 1));
    const r = cmd.checkoutCart(s, key());
    expect(r.ok).toBe(false);
    expect(r.state.holdings[cheap.id]).toBeUndefined();
    expect(r.state.wallet.cash).toBe(balance);
    s = ok(cmd.removeFromCart(s, pricey.id));
    s = ok(cmd.checkoutCart(s, key()));
    expect(s.holdings[cheap.id].qty).toBe(1);
    expect(s.cart).toHaveLength(0);
  });
});

describe('selling', () => {
  it('applies spread and fee and records realized profit separately', () => {
    let s = game();
    const p = cheapProduct(s);
    s = ok(cmd.buyNow(s, p.id, 3, key()));
    const cost = s.holdings[p.id].avgCost;
    const q = sellQuote(s, p.id, 2);
    expect(q.unitBid).toBeCloseTo(s.market[p.id].price * (1 - SPREAD[p.rarity]), 2);
    expect(q.fee).toBeCloseTo(q.gross * 0.04, 2);
    const cashBefore = s.wallet.cash;
    s = ok(cmd.sellToMarket(s, p.id, 2, key()));
    expect(s.holdings[p.id].qty).toBe(1);
    expect(s.wallet.cash).toBeCloseTo(cashBefore + q.gross - q.fee, 2);
    expect(s.wallet.realizedProfit).toBeCloseTo(q.gross - q.fee - cost * 2, 2);
    expect(s.wallet.lifetimeRevenue).toBeCloseTo(q.gross, 2);
    const types = s.transactions.slice(-2).map((t) => t.type);
    expect(types).toEqual(['sale', 'fee']);
    expect(ledgerSum(s)).toBe(s.wallet.cash);
  });

  it('prevents selling more than owned', () => {
    let s = game();
    const p = cheapProduct(s);
    s = ok(cmd.buyNow(s, p.id, 1, key()));
    expect(cmd.sellToMarket(s, p.id, 2, key()).ok).toBe(false);
    expect(cmd.sellToMarket(s, 'nope', 1, key()).ok).toBe(false);
  });

  it('prevents selling units reserved by a store listing', () => {
    let s = game();
    const p = cheapProduct(s);
    s = ok(cmd.buyNow(s, p.id, 2, key()));
    const store = s.stores[0];
    if (!store.categories.includes(p.category)) s = ok(cmd.updateStore(s, store.id, { categories: [p.category] }));
    s = ok(cmd.createListing(s, store.id, p.id, 2, s.market[p.id].price));
    const r = cmd.sellToMarket(s, p.id, 1, key());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/reserved/);
  });
});

describe('price model', () => {
  it('keeps every price positive, bounded and within the per-tick limit', () => {
    const s = game(77);
    const prev: Record<string, number> = {};
    for (const id in s.market) prev[id] = s.market[id].price;
    for (let i = 0; i < 400; i++) {
      runTicks(s, 1);
      for (const def of PRODUCTS) {
        const mp = s.market[def.id];
        if (!mp.listed) continue;
        expect(mp.price).toBeGreaterThan(0);
        expect(mp.price).toBeGreaterThanOrEqual(priceFloor(def, mp) - 0.01);
        expect(mp.price).toBeLessThanOrEqual(priceCeiling(def) + 0.01);
        if (prev[def.id] && mp.listedAt < s.clock.t - TICK_MINUTES) {
          const move = Math.abs(Math.log(mp.price / prev[def.id]));
          expect(move).toBeLessThanOrEqual(0.0505 + 0.01 / prev[def.id]);
        }
        expect(mp.supply).toBeGreaterThanOrEqual(0);
        prev[def.id] = mp.price;
      }
    }
  });

  it('applies active event multipliers to the affected products only', () => {
    const s = game(8);
    s.events = [];
    const def = EVENT_DEFS.find((d) => d.id === 'electronics_surge')!;
    const target = def.select(s)!;
    s.events.push({
      id: 'EV-T',
      defId: def.id,
      kind: 'event',
      headline: 'x',
      body: 'x',
      categories: target.categories,
      subcategories: [],
      productIds: target.productIds,
      start: s.clock.t,
      end: s.clock.t + MINUTES_PER_DAY,
      effects: def.effects,
      startPrices: {},
      bias: 'up',
    });
    const mods = computeMods(s);
    const elec = PRODUCTS.find((p) => p.category === 'electronics' && s.market[p.id].listed)!;
    const fashion = PRODUCTS.find((p) => p.category === 'fashion' && s.market[p.id].listed)!;
    expect(mods.get(elec.id)?.demandMult).toBeCloseTo(1.35);
    expect(mods.get(fashion.id)).toBeUndefined();
  });

  it('raises demand and price of a product under a demand surge (same random path)', () => {
    const s = game(11);
    const def = PRODUCTS.find((p) => p.category === 'electronics' && p.rarity === 'common' && s.market[p.id].listed)!;
    const a = structuredClone(s.market[def.id]);
    const b = structuredClone(s.market[def.id]);
    const ra = { rng: 999 };
    const rb = { rng: 999 };
    let t = s.clock.t;
    for (let i = 0; i < 288; i++) {
      t += TICK_MINUTES;
      stepProduct(ra, def, a, { demandMult: 1, supplyMult: 1, volatilityMult: 1 }, 1, 1, t);
      stepProduct(rb, def, b, { demandMult: 1.35, supplyMult: 1, volatilityMult: 1 }, 1, 1, t);
    }
    expect(b.demand).toBeGreaterThan(a.demand * 1.15);
    expect(b.price).toBeGreaterThan(a.price);
  });

  it('falls when supply floods the market (same random path)', () => {
    const s = game(12);
    const def = PRODUCTS.find((p) => p.category === 'gaming' && p.rarity === 'common' && s.market[p.id].listed)!;
    const a = structuredClone(s.market[def.id]);
    const b = structuredClone(s.market[def.id]);
    b.supply *= 1.6;
    const ra = { rng: 5 };
    const rb = { rng: 5 };
    let t = s.clock.t;
    for (let i = 0; i < 144; i++) {
      t += TICK_MINUTES;
      stepProduct(ra, def, a, { demandMult: 1, supplyMult: 1, volatilityMult: 1 }, 1, 1, t);
      stepProduct(rb, def, b, { demandMult: 1, supplyMult: 1.4, volatilityMult: 1 }, 1, 1, t);
    }
    expect(b.price).toBeLessThan(a.price);
  });
});

describe('supplier orders', () => {
  function supplierGame() {
    const s = game(21, 50_000);
    const sup = SUPPLIER_BY_ID.northgate;
    const p = supplierCatalog(sup).find((x) => s.market[x.id].listed && x.rarity === 'common')!;
    return { s, sup, p };
  }

  it('does not add inventory until delivery time has elapsed', () => {
    const { s: s0, sup, p } = supplierGame();
    const s = ok(cmd.placeSupplierOrder(s0, sup.id, [{ productId: p.id, qty: sup.moq }], key()));
    const order = s.orders[0];
    expect(order.status).toBe('placed');
    expect(s.holdings[p.id]).toBeUndefined();
    expect(s.wallet.cash).toBeCloseTo(50_000 - order.total, 2);
    const sched = statusSchedule(order);
    const work = structuredClone(s);
    runTicks(work, (sched.delivered - work.clock.t) / TICK_MINUTES - 1);
    expect(work.holdings[p.id]).toBeUndefined();
    expect(work.orders[0].status).not.toBe('delivered');
    runTicks(work, 1);
    expect(work.orders[0].status).toBe('delivered');
    expect(work.holdings[p.id].qty).toBe(sup.moq);
    const units = sup.moq;
    expect(work.holdings[p.id].avgCost).toBeCloseTo(order.lines[0].unitPrice + order.shipping / units, 1);
    expect(work.orders[0].history.map((h) => h.status)).toEqual(['placed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered']);
  });

  it('enforces minimum order quantity', () => {
    const { s, sup, p } = supplierGame();
    const r = cmd.placeSupplierOrder(s, sup.id, [{ productId: p.id, qty: sup.moq - 1 }], key());
    expect(r.ok).toBe(false);
  });

  it('refunds in full before packing and partially after', () => {
    const { s: s0, sup, p } = supplierGame();
    let s = ok(cmd.placeSupplierOrder(s0, sup.id, [{ productId: p.id, qty: sup.moq }], key()));
    const total = s.orders[0].total;
    const full = ok(cmd.cancelOrder(s, s.orders[0].id, key()));
    expect(full.wallet.cash).toBeCloseTo(50_000, 2);
    expect(full.orders[0].status).toBe('cancelled');

    const sched = statusSchedule(s.orders[0]);
    s = structuredClone(s);
    runTicks(s, (sched.packed - s.clock.t) / TICK_MINUTES);
    expect(s.orders[0].status).toBe('packed');
    const cashBefore = s.wallet.cash;
    const partial = ok(cmd.cancelOrder(s, s.orders[0].id, key()));
    const o = partial.orders[0];
    expect(o.refund).toBeCloseTo(o.subtotal * 0.85, 1);
    expect(partial.wallet.cash).toBeCloseTo(cashBefore + o.refund!, 2);
    expect(o.refund! + o.cancelFee!).toBeCloseTo(total, 1);

    runTicks(s, (sched.out_for_delivery - s.clock.t) / TICK_MINUTES);
    expect(cmd.cancelOrder(s, s.orders[0].id, key()).ok).toBe(false);
  });
});

describe('stores', () => {
  it('sells listed stock to simulated customers and books revenue, fees and profit', () => {
    let s = game(31, 20_000);
    const p = cheapProduct(s);
    s = ok(cmd.buyNow(s, p.id, 20, key()));
    const store = s.stores[0];
    s = ok(cmd.updateStore(s, store.id, { categories: [p.category] }));
    s = ok(cmd.createListing(s, store.id, p.id, 20, Math.round(s.market[p.id].price * 0.6 * 100) / 100));
    s = ok(cmd.setStoreOpen(s, store.id, true));
    const work = structuredClone(s);
    runTicks(work, 288);
    const st = work.stores[0];
    expect(st.stats.unitsSold).toBeGreaterThan(0);
    expect(work.holdings[p.id]?.qty ?? 0).toBe(20 - st.stats.unitsSold);
    const storeSales = work.transactions.filter((t) => t.type === 'store_sale');
    expect(storeSales.reduce((a, t) => a + (t.qty ?? 0), 0)).toBe(st.stats.unitsSold);
    expect(work.transactions.some((t) => t.type === 'operating_cost')).toBe(true);
    expect(ledgerSum(work)).toBe(work.wallet.cash);
  });

  it('rejects listing prices outside the permitted band', () => {
    let s = game();
    const p = cheapProduct(s);
    s = ok(cmd.buyNow(s, p.id, 1, key()));
    s = ok(cmd.updateStore(s, s.stores[0].id, { categories: [p.category] }));
    expect(cmd.createListing(s, s.stores[0].id, p.id, 1, s.market[p.id].price * 3).ok).toBe(false);
    expect(cmd.createListing(s, s.stores[0].id, p.id, 1, s.market[p.id].price * 0.2).ok).toBe(false);
  });
});

describe('upgrades', () => {
  it('charge their price and change the mechanic', () => {
    let s = game();
    const before = capacity(s);
    s = ok(cmd.buyUpgrade(s, 'warehouse', key()));
    expect(capacity(s)).toBeGreaterThan(before);
    expect(s.wallet.cash).toBe(10_000 - 900);
    expect(s.transactions[s.transactions.length - 1].type).toBe('upgrade');
  });

  it('respect level requirements', () => {
    const s = game(1, 100_000);
    const r = cmd.buyUpgrade(s, 'visibility', key());
    expect(r.ok).toBe(false);
  });
});

describe('alerts', () => {
  it('trigger only when the simulated price crosses the threshold', () => {
    let s = game(41);
    const p = cheapProduct(s);
    const price = s.market[p.id].price;
    s = ok(cmd.createAlert(s, p.id, 'above', price * 10));
    s = ok(cmd.createAlert(s, p.id, 'below', price * 0.999));
    const work = structuredClone(s);
    runTicks(work, 3);
    const above = work.alerts.find((a) => a.kind === 'above')!;
    expect(above.active).toBe(true);
    const below = work.alerts.find((a) => a.kind === 'below')!;
    if (!below.active) expect(below.triggeredPrice!).toBeLessThanOrEqual(below.threshold);
    else expect(work.market[p.id].price).toBeGreaterThan(below.threshold);
  });
});

describe('missions', () => {
  it('cannot be claimed before completion and pay once afterwards', () => {
    let s = game();
    expect(cmd.claimMission(s, 'm_first_purchase', key()).ok).toBe(false);
    s = ok(cmd.buyNow(s, cheapProduct(s).id, 1, key()));
    expect(s.progression.missions.m_first_purchase?.completedAt).toBeDefined();
    const xp = s.progression.xp;
    s = ok(cmd.claimMission(s, 'm_first_purchase', key()));
    expect(s.progression.xp).toBe(xp + 50);
    expect(cmd.claimMission(s, 'm_first_purchase', key()).ok).toBe(false);
  });

  it('credit rewards go through the ledger', () => {
    let s = game();
    const p = cheapProduct(s);
    s = ok(cmd.buyNow(s, p.id, 6, key()));
    for (let i = 0; i < 5; i++) s = ok(cmd.sellToMarket(s, p.id, 1, key()));
    s = ok(cmd.claimMission(s, 'm_sell_five', key()));
    const last = s.transactions[s.transactions.length - 1];
    expect(last.type).toBe('reward');
    expect(last.total).toBe(150);
    expect(ledgerSum(s)).toBe(s.wallet.cash);
  });
});

describe('clock', () => {
  it('caps offline catch-up', () => {
    const s = game();
    const t0 = s.clock.t;
    advanceRealTime(s, 10 ** 12);
    expect(s.clock.t - t0).toBeLessThanOrEqual(MAX_OFFLINE_MINUTES);
  });

  it('converts real time to ticks at the selected speed', () => {
    const s = game();
    s.settings.speed = 2;
    const t0 = s.clock.t;
    advanceRealTime(s, s.clock.lastReal + REAL_MS_PER_TICK * 3);
    expect(s.clock.t - t0).toBe(6 * TICK_MINUTES);
  });
});

describe('ledger integrity under random play', () => {
  it('cash always equals the sum of transactions and never goes negative', () => {
    let s = game(555, 15_000);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const affordable = PRODUCTS.filter((p) => (p.rarity === 'common' || p.rarity === 'uncommon') && s.market[p.id].listed);
    s = ok(cmd.updateStore(s, s.stores[0].id, { categories: ['electronics', 'gaming'] }));
    s = ok(cmd.setStoreOpen(s, s.stores[0].id, true));
    for (let i = 0; i < 150; i++) {
      const r = rnd();
      const p = affordable[Math.floor(rnd() * affordable.length)];
      let res;
      if (r < 0.35) res = cmd.buyNow(s, p.id, 1 + Math.floor(rnd() * 4), key());
      else if (r < 0.6) {
        const owned = Object.keys(s.holdings);
        if (owned.length) res = cmd.sellToMarket(s, owned[Math.floor(rnd() * owned.length)], 1, key());
      } else if (r < 0.7) {
        const owned = Object.keys(s.holdings).filter((id) => ['electronics', 'gaming'].includes(PRODUCT_BY_ID[id].category));
        if (owned.length) res = cmd.createListing(s, s.stores[0].id, owned[0], 1, s.market[owned[0]].price);
      } else if (r < 0.8) {
        const sup = SUPPLIER_BY_ID.quickship;
        const sp = supplierCatalog(sup).find((x) => s.market[x.id].listed)!;
        res = cmd.placeSupplierOrder(s, sup.id, [{ productId: sp.id, qty: sup.moq }], key());
      } else {
        s = structuredClone(s);
        runTicks(s, 1 + Math.floor(rnd() * 30));
      }
      if (res?.ok) s = res.state;
      expect(s.wallet.cash).toBeGreaterThanOrEqual(0);
      expect(ledgerSum(s)).toBe(s.wallet.cash);
      for (const h of Object.values(s.holdings)) expect(h.qty).toBeGreaterThan(0);
    }
    expect(netWorth(s)).toBeCloseTo(s.wallet.cash + inventoryValue(s) + s.orders.filter((o) => o.kind === 'supplier' && o.status !== 'delivered' && o.status !== 'cancelled').reduce((a, o) => a + o.total, 0), 1);
  });
});
