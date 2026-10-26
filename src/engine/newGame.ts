import type { CategoryId, GameState, NotificationKind, ScenarioId, Settings } from './types';
import { DEFAULT_STARTING_BALANCE, GAME_START_MINUTE, MINUTES_PER_DAY, PREGAME_DAYS, SAVE_VERSION, TICK_MINUTES } from './constants';
import { PRODUCTS } from './catalog';
import { initMarketProduct } from './market';
import { newSeed } from './rng';
import { emptyUpgrades } from './upgrades';
import { newStore } from './storefront';
import { createCompetitors } from './competitors';
import { recordTx, notify } from './ledger';
import { refreshDailies } from './progression';
import { takeSnapshot, worldTick } from './sim';

export interface NewGameOptions {
  playerName: string;
  storeName: string;
  startingBalance?: number;
  scenario?: ScenarioId;
  seed?: number;
  tutorial?: boolean;
  categories?: CategoryId[];
  /** Real timestamp to anchor the clock (tests pass a fixed value). */
  now?: number;
  settings?: Partial<Settings>;
}

const ALL_NOTIFY: Record<NotificationKind, boolean> = {
  alert: true,
  order: true,
  store: true,
  mission: true,
  level: true,
  event: true,
  system: true,
  achievement: true,
};

export function defaultSettings(): Settings {
  return {
    sound: true,
    soundVolume: 0.5,
    music: false,
    musicVolume: 0.35,
    animations: true,
    reducedMotion: false,
    theme: 'obsidian',
    accent: 'crimson',
    language: 'en',
    notify: { ...ALL_NOTIFY },
    showOnLeaderboard: true,
    publicStorefront: true,
    speed: 1,
  };
}

/**
 * Build a fresh game. Before the player arrives the market is simulated for
 * PREGAME_DAYS so every chart starts with real recorded history.
 */
export function createNewGame(opts: NewGameOptions): GameState {
  const seed = (opts.seed ?? newSeed()) >>> 0;
  const now = opts.now ?? Date.now();
  const startingBalance = Math.max(0, Math.round(opts.startingBalance ?? DEFAULT_STARTING_BALANCE));
  const t0 = GAME_START_MINUTE - PREGAME_DAYS * MINUTES_PER_DAY;

  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    clock: { t: t0, tick: 0, lastReal: now, carryMs: 0 },
    profile: { name: opts.playerName.trim() || 'Player', avatar: 0, createdAt: now, scenario: opts.scenario ?? 'standard' },
    wallet: {
      cash: 0,
      startingBalance,
      lifetimeSpending: 0,
      lifetimeRevenue: 0,
      realizedProfit: 0,
      operatingExpenses: 0,
      investments: 0,
      rewards: 0,
      sellingFees: 0,
    },
    holdings: {},
    stores: [],
    activeStoreId: 'store-1',
    upgrades: emptyUpgrades(),
    market: {},
    events: [],
    orders: [],
    transactions: [],
    alerts: [],
    notifications: [],
    watchlist: [],
    favorites: [],
    recentlyViewed: [],
    compare: [],
    cart: [],
    progression: { xp: 0, level: 1, missions: {}, achievements: {}, daily: { day: 0, ids: [], claimed: [] } },
    counters: {
      purchases: 0,
      unitsBought: 0,
      marketSales: 0,
      unitsSold: 0,
      storeUnitsSold: 0,
      profitableSales: 0,
      supplierOrdersDelivered: 0,
      supplierOrdersPlaced: 0,
      upgradesBought: 0,
      alertsCreated: 0,
      listingsCreated: 0,
      risingDemandSpotted: 0,
      eventProfits: 0,
      diamondHands: 0,
      consecutivePositiveDays: 0,
      bestPositiveStreak: 0,
    },
    snapshots: [],
    dailySnapshots: [],
    competitors: [],
    supplierUsage: {},
    settings: { ...defaultSettings(), ...opts.settings },
    tutorial: { active: opts.tutorial ?? true, step: 0, done: false, skipped: !(opts.tutorial ?? true) },
    visited: [],
    processedKeys: [],
    seq: { tx: 0, order: 0, note: 0, event: 0, alert: 0, listing: 0 },
  };

  for (const def of PRODUCTS) {
    const launch = !def.releaseDay || def.releaseDay <= 1;
    s.market[def.id] = initMarketProduct(s, def, t0, launch);
  }

  // Pre-game market history (prices, volume, events) — no player activity.
  const ticks = (GAME_START_MINUTE - t0) / TICK_MINUTES;
  for (let i = 0; i < ticks; i++) worldTick(s);
  for (const id in s.market) s.market[id].listedAt = Math.min(s.market[id].listedAt, GAME_START_MINUTE);

  s.stores.push(newStore('store-1', opts.storeName.trim() || `${s.profile.name}'s Store`, s.clock.t, opts.categories ?? ['electronics', 'gaming']));
  s.competitors = createCompetitors(s.clock.t);
  if (startingBalance > 0) recordTx(s, { type: 'starting_balance', total: startingBalance, memo: 'Starting capital (virtual credits)' });
  s.dailySnapshots.push(takeSnapshot(s));
  s.snapshots.push(takeSnapshot(s));
  refreshDailies(s);
  notify(
    s,
    'system',
    'Welcome to DOPACART',
    `You start with ${startingBalance.toLocaleString()} virtual credits. Everything here is a game — no real money, products or deliveries.`,
    '/',
  );
  return s;
}
