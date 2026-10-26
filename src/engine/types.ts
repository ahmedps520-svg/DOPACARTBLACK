/**
 * DOPACART: BLACK MARKET — core game types.
 *
 * Everything here is fictional game data. Credits ("CR") are virtual game
 * currency with no real-world value, and no product is ever really shipped.
 *
 * Static definitions (ProductDef, SupplierDef, ...) are kept separate from
 * the mutable, persisted GameState so that catalog changes never corrupt a
 * player's save and so the simulation can run without any UI.
 */

// ───────────────────────────── Catalog ─────────────────────────────

export type CategoryId = 'electronics' | 'fashion' | 'gaming' | 'lifestyle' | 'luxury';

export type SubcategoryId =
  // electronics
  | 'smartphones'
  | 'laptops'
  | 'consoles'
  | 'headphones'
  | 'cameras'
  | 'components'
  | 'smartwatches'
  // fashion
  | 'sneakers'
  | 'clothing'
  | 'bags'
  | 'accessories'
  | 'watches'
  // gaming
  | 'controllers'
  | 'headsets'
  | 'keyboards'
  | 'mice'
  | 'monitors'
  | 'chairs'
  // lifestyle
  | 'furniture'
  | 'home'
  | 'fitness'
  | 'collectibles'
  | 'everyday'
  // luxury
  | 'luxury-watches'
  | 'luxury-accessories'
  | 'luxury-collectibles'
  | 'limited-editions';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'exclusive';

/** Illustration archetypes rendered by <ProductArt/>. */
export type ArtKind =
  | 'phone'
  | 'laptop'
  | 'console'
  | 'headphones'
  | 'earbuds'
  | 'camera'
  | 'gpu'
  | 'cpu'
  | 'smartwatch'
  | 'sneaker'
  | 'hoodie'
  | 'jacket'
  | 'tee'
  | 'bag'
  | 'backpack'
  | 'sunglasses'
  | 'cap'
  | 'wallet'
  | 'watch'
  | 'controller'
  | 'headset'
  | 'keyboard'
  | 'mouse'
  | 'monitor'
  | 'chair'
  | 'sofa'
  | 'lamp'
  | 'vase'
  | 'candle'
  | 'dumbbell'
  | 'kettlebell'
  | 'bottle'
  | 'figure'
  | 'card'
  | 'pen'
  | 'speaker'
  | 'tablet'
  | 'ring'
  | 'perfume'
  | 'trophy'
  | 'drone';

export type ArtFinish = 'matte' | 'gloss' | 'metal' | 'gold' | 'carbon';

export interface ArtSpec {
  kind: ArtKind;
  /** Main body colour (hex). */
  primary: string;
  /** Secondary panels / straps / soles (hex). */
  secondary: string;
  /** Small accent details, LEDs, logos (hex). */
  accent: string;
  finish?: ArtFinish;
  /** Small integer used by an illustration to pick a shape variation. */
  variant?: number;
}

export interface ProductDef {
  /** Stable slug, e.g. "novacore-x12". */
  id: string;
  name: string;
  /** Always a fictional brand. */
  brand: string;
  category: CategoryId;
  subcategory: SubcategoryId;
  rarity: Rarity;
  /** Fundamental value in credits (anchor of the price model). */
  basePrice: number;
  description: string;
  /** Ordered key facts used in the detail page and compare tool. */
  specs: [string, string][];
  art: ArtSpec;
  /** Limited editions have a fixed total supply and never restock. */
  limited?: boolean;
  totalSupply?: number;
  /**
   * In-game day on which the product is first listed. Products with
   * releaseDay <= 1 are on the market when a new game starts.
   */
  releaseDay?: number;
  /** When this product launches, the named older model loses demand. */
  successorOf?: string;
  /** Optional override of daily volatility. */
  volatility?: number;
}

export interface CategoryDef {
  id: CategoryId;
  label: string;
  tagline: string;
  subcategories: { id: SubcategoryId; label: string }[];
}

// ───────────────────────────── Market ─────────────────────────────

/**
 * Compact price history for a product. Each series is contiguous and its
 * last element corresponds to `*End` (in-game minutes).
 */
export interface PriceHistory {
  /** One sample per tick for the most recent in-game day. */
  ticks: number[];
  ticksEnd: number;
  /** Per-tick traded volume aligned with `ticks`. */
  vol: number[];
  /** Hourly closes for the most recent 30 in-game days. */
  hourly: number[];
  hourlyEnd: number;
  /** Daily closes for the whole game (capped). */
  daily: number[];
  dailyEnd: number;
  /** Hourly demand index samples for the last 7 in-game days (aligned with hourlyEnd). */
  demand: number[];
}

export interface MarketProduct {
  id: string;
  listed: boolean;
  listedAt: number;
  price: number;
  /** Close of the previous in-game day, for daily % change. */
  prevClose: number;
  /** Demand index, 100 = normal. */
  demand: number;
  /** Long-run demand baseline (reduced by successor releases). */
  demandBase: number;
  /** Units currently available to buy on the open market. */
  supply: number;
  /** Normal market supply level (limited editions: remaining circulation). */
  supplyTarget: number;
  /** Daily volatility (sigma of log price per sqrt(day)). */
  volatility: number;
  productionCost: number;
  /** Lifetime simulated + player traded units (popularity). */
  totalVolume: number;
  history: PriceHistory;
}

export interface EventEffects {
  /** Multiplies demand target of affected products. */
  demandMult?: number;
  /** Multiplies the supply equilibrium of affected products. */
  supplyMult?: number;
  /** Immediate one-off supply shock as a fraction (+0.6 = +60%). */
  supplyShock?: number;
  /** Multiplies price volatility. */
  volatilityMult?: number;
  /** Multiplies supplier delivery times for affected categories. */
  deliveryMult?: number;
  /** Multiplies customer traffic to player stores. */
  trafficMult?: number;
  /** Permanent multiplier applied to demandBase on start (lifecycle). */
  lifecycleMult?: number;
}

export type EventKind = 'event' | 'release' | 'report';

export interface MarketEvent {
  id: string;
  defId: string;
  kind: EventKind;
  headline: string;
  body: string;
  categories: CategoryId[];
  subcategories: SubcategoryId[];
  /** Products whose economy this event changes. */
  productIds: string[];
  start: number;
  end: number;
  effects: EventEffects;
  /** Prices of affected products when the event started (impact tracking). */
  startPrices: Record<string, number>;
  /** 'up' if the rules push prices up, 'down' otherwise. */
  bias: 'up' | 'down' | 'mixed';
}

// ───────────────────────────── Player ─────────────────────────────

export type TxType =
  | 'starting_balance'
  | 'purchase'
  | 'sale'
  | 'store_sale'
  | 'fee'
  | 'supplier_order'
  | 'refund'
  | 'operating_cost'
  | 'upgrade'
  | 'store_open'
  | 'reward';

export interface Transaction {
  /** e.g. "TX-000042" */
  id: string;
  /** In-game minute. */
  t: number;
  /** Real wall-clock timestamp (ms). */
  real: number;
  type: TxType;
  productId?: string;
  qty?: number;
  unitPrice?: number;
  /** Signed cash delta: positive = money in, negative = money out. */
  total: number;
  balanceAfter: number;
  memo: string;
  /** For sales: acquisition cost of the units sold. */
  costBasis?: number;
  /** For sales: proceeds net of fees minus cost basis. */
  realizedPnl?: number;
  orderId?: string;
  storeId?: string;
  /** Links a fee to the sale or order it belongs to. */
  relatedTx?: string;
}

export interface Holding {
  productId: string;
  qty: number;
  /** Weighted average acquisition cost per unit. */
  avgCost: number;
  firstAcquiredAt: number;
  lastAcquiredAt: number;
}

export interface Wallet {
  cash: number;
  startingBalance: number;
  lifetimeSpending: number;
  lifetimeRevenue: number;
  /** Sum of realizedPnl across all sales. */
  realizedProfit: number;
  /** Rent and cancellation fees. */
  operatingExpenses: number;
  /** Upgrades and store openings. */
  investments: number;
  rewards: number;
  /** Selling fees (already included in realized profit). */
  sellingFees: number;
}

export type StoreThemeId = 'obsidian' | 'crimson' | 'gilded' | 'chrome' | 'phantom' | 'legend';

export interface Listing {
  id: string;
  productId: string;
  /** Units reserved for this listing and still unsold. */
  qty: number;
  price: number;
  createdAt: number;
  sold: number;
  revenue: number;
  paused: boolean;
}

export interface StoreStats {
  revenue: number;
  unitsSold: number;
  profit: number;
  visitors: number;
  fees: number;
}

export interface PlayerStore {
  id: string;
  name: string;
  /** Data URL of an uploaded, downscaled logo. */
  logo?: string;
  theme: StoreThemeId;
  categories: CategoryId[];
  listings: Listing[];
  open: boolean;
  openedAt: number;
  stats: StoreStats;
  tagline: string;
}

export type OrderStatus =
  | 'placed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface OrderLine {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  /** e.g. "DC-104233" */
  id: string;
  kind: 'market' | 'supplier';
  supplierId?: string;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
  placedAt: number;
  /** Planned delivery duration (in-game minutes) shown as the estimate. */
  plannedDuration: number;
  /** Hidden extra delay caused by supplier reliability or events. */
  delay: number;
  status: OrderStatus;
  history: { status: OrderStatus; t: number }[];
  refund?: number;
  cancelFee?: number;
  idempotencyKey: string;
}

export type AlertKind = 'below' | 'above' | 'rise_pct' | 'fall_pct' | 'supply_limited';

export interface PriceAlert {
  id: string;
  productId: string;
  kind: AlertKind;
  threshold: number;
  /** Price when the alert was created (reference for % alerts). */
  basePrice: number;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
  active: boolean;
}

export type NotificationKind =
  | 'alert'
  | 'order'
  | 'store'
  | 'mission'
  | 'level'
  | 'event'
  | 'system'
  | 'achievement';

export interface GameNotification {
  id: string;
  t: number;
  real: number;
  kind: NotificationKind;
  title: string;
  body: string;
  link?: string;
  read: boolean;
}

export type UpgradeId =
  | 'warehouse'
  | 'photography'
  | 'visibility'
  | 'logistics'
  | 'listings'
  | 'operations'
  | 'seller'
  | 'analytics'
  | 'licenses';

export interface MissionState {
  completedAt?: number;
  claimedAt?: number;
}

export interface DailyState {
  day: number;
  ids: string[];
  claimed: string[];
}

export interface Progression {
  xp: number;
  level: number;
  missions: Record<string, MissionState>;
  achievements: Record<string, number>;
  daily: DailyState;
}

export interface Counters {
  purchases: number;
  unitsBought: number;
  marketSales: number;
  unitsSold: number;
  storeUnitsSold: number;
  profitableSales: number;
  supplierOrdersDelivered: number;
  supplierOrdersPlaced: number;
  upgradesBought: number;
  alertsCreated: number;
  listingsCreated: number;
  risingDemandSpotted: number;
  eventProfits: number;
  diamondHands: number;
  consecutivePositiveDays: number;
  bestPositiveStreak: number;
}

/** Hourly business snapshot used for analytics charts. */
export interface Snapshot {
  t: number;
  cash: number;
  inventoryValue: number;
  inventoryCost: number;
  inTransit: number;
  netWorth: number;
  /** Cumulative store visitors across all stores. */
  visitors: number;
}

export type CompetitorStrategy = 'value' | 'momentum' | 'collector' | 'event' | 'volume';

export interface Competitor {
  id: string;
  name: string;
  owner: string;
  strategy: CompetitorStrategy;
  color: string;
  cash: number;
  startingCash: number;
  holdings: Record<string, { qty: number; avgCost: number; boughtAt: number }>;
  revenue: number;
  realizedProfit: number;
  sales: number;
  xp: number;
  level: number;
  lastAction: string;
  lastActionAt: number;
}

export type Speed = 0 | 1 | 2 | 4;

export interface Settings {
  sound: boolean;
  soundVolume: number;
  music: boolean;
  musicVolume: number;
  animations: boolean;
  reducedMotion: boolean;
  theme: 'obsidian' | 'graphite' | 'midnight';
  accent: 'crimson' | 'scarlet' | 'gold';
  language: 'en' | 'es';
  notify: Record<NotificationKind, boolean>;
  showOnLeaderboard: boolean;
  publicStorefront: boolean;
  speed: Speed;
}

export type ScenarioId = 'standard' | 'bull' | 'recession' | 'collector';

export interface TutorialState {
  active: boolean;
  step: number;
  done: boolean;
  skipped: boolean;
}

export interface Profile {
  name: string;
  avatar: number;
  createdAt: number;
  scenario: ScenarioId;
}

export interface Clock {
  /** In-game minutes since Day 1, 00:00. */
  t: number;
  /** Number of completed ticks. */
  tick: number;
  /** Real timestamp (ms) at which `t` was last advanced. */
  lastReal: number;
  /** Real ms accumulated toward the next tick. */
  carryMs: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  clock: Clock;
  profile: Profile;
  wallet: Wallet;
  holdings: Record<string, Holding>;
  stores: PlayerStore[];
  activeStoreId: string;
  upgrades: Record<UpgradeId, number>;
  market: Record<string, MarketProduct>;
  events: MarketEvent[];
  orders: Order[];
  transactions: Transaction[];
  alerts: PriceAlert[];
  notifications: GameNotification[];
  watchlist: string[];
  favorites: string[];
  recentlyViewed: string[];
  compare: string[];
  cart: { productId: string; qty: number }[];
  progression: Progression;
  counters: Counters;
  snapshots: Snapshot[];
  dailySnapshots: Snapshot[];
  competitors: Competitor[];
  supplierUsage: Record<string, { day: number; units: number }>;
  settings: Settings;
  tutorial: TutorialState;
  visited: string[];
  /** Idempotency keys of commands already applied (bounded). */
  processedKeys: string[];
  seq: { tx: number; order: number; note: number; event: number; alert: number; listing: number };
}

/** Outcome of a player command: either the new state or a clear error. */
export type CommandResult<T = unknown> =
  | { ok: true; state: GameState; data?: T; message?: string }
  | { ok: false; error: string; state: GameState };
