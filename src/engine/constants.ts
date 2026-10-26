import type { CategoryId, Rarity, ScenarioId } from './types';

/** Bump when the persisted GameState shape changes incompatibly. */
export const SAVE_VERSION = 1;

// ─── Clock ───────────────────────────────────────────────────────────
/** In-game minutes simulated per market tick. */
export const TICK_MINUTES = 10;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
export const TICKS_PER_DAY = MINUTES_PER_DAY / TICK_MINUTES;
/** Real milliseconds per tick at 1× speed (1 in-game day ≈ 12 real minutes). */
export const REAL_MS_PER_TICK = 5000;
/** Longest stretch of in-game time simulated while the game was closed. */
export const MAX_OFFLINE_MINUTES = 7 * MINUTES_PER_DAY;
/** A new game starts on Day 1 at 08:00. */
export const GAME_START_MINUTE = 8 * 60;
/** Days of market history simulated before the player arrives. */
export const PREGAME_DAYS = 30;

// ─── History retention ───────────────────────────────────────────────
export const HISTORY_TICKS = TICKS_PER_DAY + 1; // 1 day of tick samples (inclusive)
export const HISTORY_HOURS = 30 * 24 + 1; // 30 days of hourly closes
export const HISTORY_DEMAND_HOURS = 7 * 24 + 1;
export const HISTORY_DAYS = 400;
export const SNAPSHOT_HOURS = 30 * 24;

// ─── Player economy ──────────────────────────────────────────────────
export const DEFAULT_STARTING_BALANCE = 10_000;
export const STARTING_BALANCE_OPTIONS = [5_000, 10_000, 25_000, 100_000];
/** Base marketplace fee when selling to the open market (reduced by Trusted Seller). */
export const MARKET_FEE_BASE = 0.04;
/** Payment-processing fee on every unit sold through a player store. */
export const STORE_PAYMENT_FEE = 0.025;
/** Listing prices must stay within these multiples of the market price when set. */
export const LISTING_PRICE_MIN = 0.5;
export const LISTING_PRICE_MAX = 1.75;
/** Bid/ask spread applied when selling instantly to the market. */
export const SPREAD: Record<Rarity, number> = {
  common: 0.03,
  uncommon: 0.035,
  rare: 0.04,
  epic: 0.05,
  legendary: 0.06,
  exclusive: 0.07,
};
/** Maximum units per single purchase line (sanity guard). */
export const MAX_ORDER_QTY = 500;
export const MAX_CART_LINES = 20;
export const MAX_ALERTS = 30;
export const MAX_COMPARE = 4;

// ─── Price model ─────────────────────────────────────────────────────
/** Mean-reversion speed of log price toward fair value, per day. */
export const PRICE_REVERSION = 2.5;
/** Hard cap on the log-price move in a single tick (≈ ±5%). */
export const MAX_TICK_MOVE = 0.05;
/** Demand index mean-reversion speed and noise per sqrt(day). */
export const DEMAND_REVERSION = 0.9;
export const DEMAND_NOISE = 0.14;
export const DEMAND_MIN = 20;
export const DEMAND_MAX = 400;
/** Elasticity of fair value to the demand index. */
export const DEMAND_ELASTICITY = 0.8;

export interface RarityParams {
  volatility: number;
  supplyTarget: number;
  restock: number; // per day
  supplyElasticity: number;
  ceiling: number; // × base price
  conversion: number; // store conversion rate per visitor
  unlockLevel: number;
  xpMultiplier: number;
}

export const RARITY_PARAMS: Record<Rarity, RarityParams> = {
  common: { volatility: 0.035, supplyTarget: 360, restock: 1.6, supplyElasticity: 0.25, ceiling: 3, conversion: 0.085, unlockLevel: 1, xpMultiplier: 1 },
  uncommon: { volatility: 0.05, supplyTarget: 200, restock: 1.2, supplyElasticity: 0.3, ceiling: 3.5, conversion: 0.065, unlockLevel: 1, xpMultiplier: 1.1 },
  rare: { volatility: 0.07, supplyTarget: 80, restock: 0.7, supplyElasticity: 0.4, ceiling: 4.5, conversion: 0.045, unlockLevel: 3, xpMultiplier: 1.2 },
  epic: { volatility: 0.09, supplyTarget: 36, restock: 0.45, supplyElasticity: 0.5, ceiling: 6, conversion: 0.032, unlockLevel: 8, xpMultiplier: 1.35 },
  legendary: { volatility: 0.11, supplyTarget: 14, restock: 0.25, supplyElasticity: 0.6, ceiling: 8, conversion: 0.022, unlockLevel: 15, xpMultiplier: 1.5 },
  exclusive: { volatility: 0.13, supplyTarget: 6, restock: 0.15, supplyElasticity: 0.7, ceiling: 10, conversion: 0.016, unlockLevel: 25, xpMultiplier: 1.75 },
};

export const CATEGORY_VOLATILITY: Record<CategoryId, number> = {
  electronics: 1,
  fashion: 1.15,
  gaming: 1,
  lifestyle: 0.8,
  luxury: 1.15,
};

// ─── Stores ──────────────────────────────────────────────────────────
/** Visitors per in-game day for a brand-new store with no upgrades. */
export const BASE_STORE_TRAFFIC = 26;
/** Daily operating cost of each open store, by store index. */
export const STORE_OPERATING_COST = [60, 110, 180, 260];
/** Cost to open each additional store, by store index. */
export const STORE_OPEN_COST = [0, 6_000, 18_000, 45_000];
/** Player level required to own n stores (index = store index). */
export const STORE_LEVEL_REQUIREMENT = [1, 10, 20, 35];
export const BASE_STORE_CATEGORIES = 2;

// ─── Orders ──────────────────────────────────────────────────────────
/** Full refund while an order has not yet been packed. */
export const CANCEL_RESTOCKING_FEE = 0.15;

// ─── Scenarios ───────────────────────────────────────────────────────
export interface ScenarioDef {
  id: ScenarioId;
  label: string;
  description: string;
  demandMult: number;
  trafficMult: number;
  rareDemandMult: number;
  rareVolatilityMult: number;
  /** Multiplies the weight of events whose bias is up / down. */
  upEventWeight: number;
  downEventWeight: number;
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  standard: {
    id: 'standard',
    label: 'Standard Market',
    description: 'Balanced demand and a fair mix of booms and busts. Recommended for a first run.',
    demandMult: 1,
    trafficMult: 1,
    rareDemandMult: 1,
    rareVolatilityMult: 1,
    upEventWeight: 1,
    downEventWeight: 1,
  },
  bull: {
    id: 'bull',
    label: 'Bull Run',
    description: 'Confident buyers, rising demand and more positive events. Easier, but prices start rich.',
    demandMult: 1.08,
    trafficMult: 1.15,
    rareDemandMult: 1,
    rareVolatilityMult: 1,
    upEventWeight: 1.6,
    downEventWeight: 0.6,
  },
  recession: {
    id: 'recession',
    label: 'Recession',
    description: 'Thin demand, fewer shoppers and frequent shocks. Cash discipline is everything.',
    demandMult: 0.92,
    trafficMult: 0.85,
    rareDemandMult: 1,
    rareVolatilityMult: 1,
    upEventWeight: 0.6,
    downEventWeight: 1.6,
  },
  collector: {
    id: 'collector',
    label: 'Collector Mania',
    description: 'Rare goods are hot and wildly volatile. High risk, high reward.',
    demandMult: 1,
    trafficMult: 1,
    rareDemandMult: 1.15,
    rareVolatilityMult: 1.35,
    upEventWeight: 1,
    downEventWeight: 1,
  },
};
