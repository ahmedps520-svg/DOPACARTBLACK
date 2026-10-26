/**
 * Market price model. See docs/ECONOMY.md for the full write-up.
 *
 *   fair value  F = B · (D/100)^α · clamp((S_ref / S)^β, 0.55, 2.4)
 *   log price   x' = x + κ·dt·(ln F − x) + σ·m·√dt·Z      (|Δx| ≤ 5% per tick)
 *   demand      D' = D + κ_D·dt·(D_target − D) + σ_D·√dt·Z·D
 *   supply      S' = S + r·dt·(S_eq − S) + noise,  S_eq = S_ref·m_s·√(100/D)
 *
 * B = base price, D = demand index, S = market supply, α = demand
 * elasticity, β = rarity-dependent supply elasticity, κ = reversion speed,
 * σ = volatility, m = event volatility multiplier, m_s = event supply
 * multiplier. Prices are clamped to [floor, ceiling] so they never go
 * negative or explode without a game mechanic behind it.
 */
import type { GameState, MarketProduct, ProductDef } from './types';
import {
  CATEGORY_VOLATILITY,
  DEMAND_ELASTICITY,
  DEMAND_MAX,
  DEMAND_MIN,
  DEMAND_NOISE,
  DEMAND_REVERSION,
  MAX_TICK_MOVE,
  MINUTES_PER_DAY,
  PRICE_REVERSION,
  RARITY_PARAMS,
  SCENARIOS,
  TICK_MINUTES,
} from './constants';
import { PRODUCT_BY_ID } from './catalog';
import { RARITY_RANK } from './categories';
import { gauss, poisson, rand, type RngHolder } from './rng';
import { emptyHistory, recordTick } from './history';

export interface ProductMods {
  demandMult: number;
  supplyMult: number;
  volatilityMult: number;
}

const NEUTRAL: ProductMods = { demandMult: 1, supplyMult: 1, volatilityMult: 1 };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round2 = (x: number) => Math.round(x * 100) / 100;

export function defaultVolatility(def: ProductDef): number {
  return def.volatility ?? RARITY_PARAMS[def.rarity].volatility * CATEGORY_VOLATILITY[def.category];
}

export function priceFloor(def: ProductDef, mp: MarketProduct): number {
  return Math.max(def.basePrice * 0.3, mp.productionCost * 0.85);
}

export function priceCeiling(def: ProductDef): number {
  return def.basePrice * RARITY_PARAMS[def.rarity].ceiling;
}

/** Create the market entry for a product (not yet listed unless `listed`). */
export function initMarketProduct(h: RngHolder, def: ProductDef, t: number, listed: boolean): MarketProduct {
  const rp = RARITY_PARAMS[def.rarity];
  const supplyTarget = def.limited ? Math.max(2, Math.round((def.totalSupply ?? 10) * 0.45)) : rp.supplyTarget;
  const demand = 100 * (0.92 + rand(h) * 0.16);
  const price = round2(def.basePrice * (0.95 + rand(h) * 0.1));
  return {
    id: def.id,
    listed,
    listedAt: t,
    price,
    prevClose: price,
    demand,
    demandBase: 100,
    supply: Math.round(supplyTarget * (0.85 + rand(h) * 0.3)),
    supplyTarget,
    volatility: defaultVolatility(def),
    productionCost: round2(def.basePrice * (0.4 + rand(h) * 0.2)),
    totalVolume: 0,
    history: emptyHistory(t, price, demand),
  };
}

/** Fair (equilibrium) value implied by current demand and supply. */
export function fairValue(def: ProductDef, mp: MarketProduct): number {
  const beta = RARITY_PARAMS[def.rarity].supplyElasticity;
  const ref = mp.supplyTarget;
  const ratio = ref / Math.max(mp.supply, ref * 0.05, 0.5);
  const sf = clamp(Math.pow(ratio, beta), 0.55, 2.4);
  const df = Math.pow(Math.max(mp.demand, 1) / 100, DEMAND_ELASTICITY);
  return clamp(def.basePrice * df * sf, priceFloor(def, mp), priceCeiling(def));
}

/**
 * Advance one listed product by one tick. Mutates `mp` and records history.
 * `scenarioDemand` folds scenario-wide multipliers into the demand target.
 */
export function stepProduct(
  h: RngHolder,
  def: ProductDef,
  mp: MarketProduct,
  mods: ProductMods,
  scenarioDemand: number,
  scenarioVol: number,
  t: number,
) {
  const dt = TICK_MINUTES / MINUTES_PER_DAY;
  const sq = Math.sqrt(dt);
  const rp = RARITY_PARAMS[def.rarity];

  // Demand: mean-reverting toward a target shaped by lifecycle and events.
  const target = mp.demandBase * mods.demandMult * scenarioDemand;
  mp.demand += DEMAND_REVERSION * dt * (target - mp.demand) + DEMAND_NOISE * sq * gauss(h) * mp.demand;
  mp.demand = clamp(mp.demand, DEMAND_MIN, DEMAND_MAX);

  // Supply & simulated market volume.
  let vol: number;
  if (def.limited) {
    // Collectors absorb units; high prices tempt holders to release units.
    const absorb = poisson(h, 0.05 * mp.supply * (mp.demand / 100) * dt);
    const premium = Math.max(0, mp.price / def.basePrice - 1.25);
    const release = poisson(h, 0.2 * mp.supplyTarget * premium * dt);
    const shortage = 1 - mods.supplyMult; // shortages pull units off the market
    const pulled = shortage > 0 ? poisson(h, shortage * mp.supply * dt) : 0;
    mp.supply = Math.max(0, mp.supply - absorb - pulled + release);
    vol = absorb + release;
  } else {
    const eq = mp.supplyTarget * mods.supplyMult * Math.sqrt(100 / mp.demand);
    mp.supply += rp.restock * dt * (eq - mp.supply) + 0.04 * sq * gauss(h) * mp.supplyTarget;
    mp.supply = Math.max(0, mp.supply);
    vol = poisson(h, mp.supplyTarget * 0.6 * (mp.demand / 100) * dt);
  }
  mp.totalVolume += vol;

  // Price: log-price reverts toward fair value with bounded noise.
  const fv = fairValue(def, mp);
  const x = Math.log(mp.price);
  const sigma = mp.volatility * mods.volatilityMult * scenarioVol;
  const dx = clamp(PRICE_REVERSION * dt * (Math.log(fv) - x) + sigma * sq * gauss(h), -MAX_TICK_MOVE, MAX_TICK_MOVE);
  mp.price = round2(clamp(Math.exp(x + dx), priceFloor(def, mp), priceCeiling(def)));

  if (t % MINUTES_PER_DAY === 0) mp.prevClose = mp.price;
  recordTick(mp.history, t, mp.price, vol, mp.demand);
}

/** Aggregate active event effects per product. */
export function computeMods(s: GameState): Map<string, ProductMods> {
  const mods = new Map<string, ProductMods>();
  for (const ev of s.events) {
    if (ev.kind === 'report' || ev.start > s.clock.t || ev.end <= s.clock.t) continue;
    const e = ev.effects;
    if (!e.demandMult && !e.supplyMult && !e.volatilityMult) continue;
    for (const id of ev.productIds) {
      const m = mods.get(id) ?? { ...NEUTRAL };
      m.demandMult *= e.demandMult ?? 1;
      m.supplyMult *= e.supplyMult ?? 1;
      m.volatilityMult *= e.volatilityMult ?? 1;
      mods.set(id, m);
    }
  }
  return mods;
}

/** Advance every listed product by one tick ending at `t`. */
export function marketTick(s: GameState, t: number) {
  const mods = computeMods(s);
  const sc = SCENARIOS[s.profile.scenario];
  for (const id in s.market) {
    const mp = s.market[id];
    if (!mp.listed) continue;
    const def = PRODUCT_BY_ID[id];
    if (!def) continue;
    const rare = RARITY_RANK[def.rarity] >= RARITY_RANK.rare;
    stepProduct(
      s,
      def,
      mp,
      mods.get(id) ?? NEUTRAL,
      sc.demandMult * (rare ? sc.rareDemandMult : 1),
      rare ? sc.rareVolatilityMult : 1,
      t,
    );
  }
}

export type SupplyLevel = 'Critical' | 'Limited' | 'Tight' | 'Healthy' | 'Abundant';
export type DemandLevel = 'Weak' | 'Soft' | 'Steady' | 'Strong' | 'Surging';

export function supplyRatio(mp: MarketProduct): number {
  return mp.supply / Math.max(1, mp.supplyTarget);
}

export function supplyLevel(mp: MarketProduct): SupplyLevel {
  const r = supplyRatio(mp);
  if (r < 0.15 || Math.floor(mp.supply) <= 1) return 'Critical';
  if (r < 0.4) return 'Limited';
  if (r < 0.8) return 'Tight';
  if (r < 1.25) return 'Healthy';
  return 'Abundant';
}

export function isSupplyLimited(mp: MarketProduct): boolean {
  const l = supplyLevel(mp);
  return l === 'Critical' || l === 'Limited';
}

export function demandLevel(mp: MarketProduct): DemandLevel {
  const d = mp.demand;
  if (d < 70) return 'Weak';
  if (d < 90) return 'Soft';
  if (d < 115) return 'Steady';
  if (d < 145) return 'Strong';
  return 'Surging';
}

export function availableUnits(mp: MarketProduct): number {
  return Math.max(0, Math.floor(mp.supply));
}
