/**
 * Market events. Every event is defined by explicit rules (which products
 * it touches and which multipliers it applies). The price model reads the
 * active events every tick, so headlines always correspond to real changes
 * in the simulated economy.
 */
import type {
  CategoryId,
  EventEffects,
  GameState,
  MarketEvent,
  ProductDef,
  SubcategoryId,
} from './types';
import { GAME_START_MINUTE, MINUTES_PER_DAY, SCENARIOS, TICKS_PER_DAY } from './constants';
import { PRODUCTS, PRODUCT_BY_ID } from './catalog';
import { CATEGORIES, CATEGORY_BY_ID, RARITY_RANK } from './categories';
import { chance, pick, pickWeighted, randRange } from './rng';
import { nextId, notify } from './ledger';
import { initMarketProduct, round2 } from './market';
import { dayOf, minuteOfDay } from './time';
import { changeOver, volume24h } from './history';

interface Target {
  categories: CategoryId[];
  subcategories: SubcategoryId[];
  productIds: string[];
  label: string;
  product?: ProductDef;
}

interface EventDef {
  id: string;
  weight: number;
  bias: 'up' | 'down' | 'mixed';
  duration: [number, number];
  effects: EventEffects;
  select: (s: GameState) => Target | undefined;
  headline: (t: Target) => string;
  body: (t: Target) => string;
}

const ALL_CATEGORIES = CATEGORIES.map((c) => c.id);

function listedDefs(s: GameState, filter: (p: ProductDef) => boolean): ProductDef[] {
  return PRODUCTS.filter((p) => s.market[p.id]?.listed && filter(p));
}

function byCategories(s: GameState, cats: CategoryId[], label: string): Target | undefined {
  const defs = listedDefs(s, (p) => cats.includes(p.category));
  if (defs.length === 0) return undefined;
  return { categories: cats, subcategories: [], productIds: defs.map((d) => d.id), label };
}

function bySubcategories(s: GameState, subs: SubcategoryId[], label: string, extra?: (p: ProductDef) => boolean): Target | undefined {
  const defs = listedDefs(s, (p) => subs.includes(p.subcategory) || (extra ? extra(p) : false));
  if (defs.length === 0) return undefined;
  return {
    categories: [...new Set(defs.map((d) => d.category))],
    subcategories: subs,
    productIds: defs.map((d) => d.id),
    label,
  };
}

function singleProduct(s: GameState, filter: (p: ProductDef) => boolean): Target | undefined {
  const defs = listedDefs(s, filter);
  if (defs.length === 0) return undefined;
  const p = pick(s, defs);
  return { categories: [p.category], subcategories: [p.subcategory], productIds: [p.id], label: p.name, product: p };
}

function randomCategory(s: GameState, exclude: CategoryId[] = []): Target | undefined {
  const cat = pick(s, ALL_CATEGORIES.filter((c) => !exclude.includes(c)));
  return byCategories(s, [cat], CATEGORY_BY_ID[cat].label);
}

export const EVENT_DEFS: EventDef[] = [
  {
    id: 'electronics_surge',
    weight: 1,
    bias: 'up',
    duration: [1.5, 2.5],
    effects: { demandMult: 1.35 },
    select: (s) => byCategories(s, ['electronics'], 'Electronics'),
    headline: () => 'Electronics Demand Surges as Upgrade Season Hits',
    body: () =>
      'Shoppers are replacing devices across the board. Demand for every electronics product is running about 35% above normal for the duration of the rush, which tends to pull prices up until it fades.',
  },
  {
    id: 'sneaker_frenzy',
    weight: 1,
    bias: 'up',
    duration: [1, 2],
    effects: { demandMult: 1.6, volatilityMult: 1.5 },
    select: (s) => bySubcategories(s, ['sneakers'], 'Sneakers', (p) => p.art.kind === 'sneaker'),
    headline: () => 'Sneaker Collector Frenzy Sweeps the Resale Market',
    body: () =>
      'Collectors are camping every drop. Sneaker demand jumps 60% and price swings grow 50% wilder while the frenzy lasts — big upside, but late buyers often get caught when it ends.',
  },
  {
    id: 'shipment_delay',
    weight: 1,
    bias: 'up',
    duration: [1.5, 3],
    effects: { supplyMult: 0.55, deliveryMult: 1.6 },
    select: (s) => randomCategory(s),
    headline: (t) => `Supplier Shipment Delays Squeeze ${t.label} Stock`,
    body: (t) =>
      `Port congestion is holding back ${t.label.toLowerCase()} freight. Market supply drifts toward 55% of normal and supplier deliveries in the category take 60% longer. Thin supply usually lifts prices.`,
  },
  {
    id: 'surplus',
    weight: 1,
    bias: 'down',
    duration: [1.5, 2.5],
    effects: { supplyShock: 0.6, supplyMult: 1.4 },
    select: (s) => randomCategory(s, ['luxury']),
    headline: (t) => `Unexpected Inventory Surplus Floods the ${t.label} Market`,
    body: (t) =>
      `Distributors over-ordered. ${t.label} supply jumps 60% immediately and stays elevated, putting downward pressure on prices until the excess clears.`,
  },
  {
    id: 'collectible_crash',
    weight: 0.7,
    bias: 'down',
    duration: [1.5, 2],
    effects: { demandMult: 0.6, volatilityMult: 1.8 },
    select: (s) => bySubcategories(s, ['collectibles', 'luxury-collectibles', 'limited-editions'], 'Collectibles'),
    headline: () => 'Collectible Market Crash: Buyers Retreat From Rare Pieces',
    body: () =>
      'A wave of forced selling has spooked collectors. Demand for collectibles and limited editions falls 40% and volatility nearly doubles. Rare does not mean safe.',
  },
  {
    id: 'tournament',
    weight: 1,
    bias: 'up',
    duration: [1, 2],
    effects: { demandMult: 1.4 },
    select: (s) => bySubcategories(s, ['consoles', 'controllers', 'headsets', 'keyboards', 'mice', 'monitors'], 'Gaming'),
    headline: () => 'Gaming Console Demand Surges Following Major Tournament',
    body: () =>
      'Record viewership at the Obsidian Cup sent fans shopping. Demand for consoles and gaming peripherals is up 40% for the next day or two.',
  },
  {
    id: 'influencer',
    weight: 1.2,
    bias: 'up',
    duration: [0.5, 1],
    effects: { demandMult: 2 },
    select: (s) => singleProduct(s, (p) => RARITY_RANK[p.rarity] <= RARITY_RANK.epic),
    headline: (t) => `${t.label} Goes Viral After Creator Spotlight`,
    body: (t) =>
      `A viral review put the ${t.label} in front of millions. Demand doubles for a short window — spikes like this rarely last.`,
  },
  {
    id: 'limited_sellout',
    weight: 0.7,
    bias: 'up',
    duration: [1, 1.5],
    effects: { supplyShock: -0.5, demandMult: 1.3 },
    select: (s) => singleProduct(s, (p) => !!p.limited),
    headline: (t) => `Limited ${t.label} Release Sells Out Across the Market`,
    body: (t) =>
      `Half of the available ${t.label} units vanished in hours and demand is up 30%. Limited editions never restock, so remaining units are scarce.`,
  },
  {
    id: 'fashion_week',
    weight: 0.8,
    bias: 'up',
    duration: [1.5, 2],
    effects: { demandMult: 1.3 },
    select: (s) => byCategories(s, ['fashion'], 'Fashion'),
    headline: () => 'Fashion Week Lifts Designer Demand',
    body: () => 'Runway season is here. Demand across fashion runs about 30% above normal while the shows are on.',
  },
  {
    id: 'logistics_strike',
    weight: 0.6,
    bias: 'mixed',
    duration: [1, 2],
    effects: { deliveryMult: 1.5, supplyMult: 0.85 },
    select: (s) => byCategories(s, ALL_CATEGORIES, 'All categories'),
    headline: () => 'Logistics Strike Slows Freight Nationwide',
    body: () =>
      'Carriers have walked out. Every supplier delivery placed during the strike takes 50% longer, and market supply across all categories tightens by 15%.',
  },
  {
    id: 'luxury_boom',
    weight: 0.7,
    bias: 'up',
    duration: [1.5, 2.5],
    effects: { demandMult: 1.3 },
    select: (s) => byCategories(s, ['luxury'], 'Luxury'),
    headline: () => 'Luxury Buyers Return as Confidence Rises',
    body: () => 'Wealthy collectors are spending again. Luxury demand rises 30% while sentiment holds.',
  },
  {
    id: 'recall',
    weight: 0.8,
    bias: 'down',
    duration: [1, 2],
    effects: { demandMult: 0.55 },
    select: (s) =>
      singleProduct(s, (p) => (p.category === 'electronics' || p.category === 'gaming') && RARITY_RANK[p.rarity] <= RARITY_RANK.rare),
    headline: (t) => `Quality Concerns Hit ${t.label}; Buyers Hold Off`,
    body: (t) =>
      `Reports of early hardware faults have buyers waiting on the ${t.label}. Demand falls 45% until confidence returns.`,
  },
  {
    id: 'chip_shortage',
    weight: 0.7,
    bias: 'up',
    duration: [2, 3],
    effects: { supplyMult: 0.5 },
    select: (s) => bySubcategories(s, ['components', 'consoles', 'laptops'], 'Components'),
    headline: () => 'Chip Shortage Squeezes Component Supply',
    body: () =>
      'Fabrication delays are rippling through hardware. Supply of components, consoles and laptops drifts toward half of normal, which pushes prices higher.',
  },
  {
    id: 'home_lull',
    weight: 0.7,
    bias: 'down',
    duration: [1.5, 2.5],
    effects: { demandMult: 0.75 },
    select: (s) => bySubcategories(s, ['furniture', 'home'], 'Home'),
    headline: () => 'Home Goods Demand Cools After Spending Spree',
    body: () => 'Households are pausing big purchases. Demand for furniture and home accessories slips 25%.',
  },
  {
    id: 'tech_slump',
    weight: 0.6,
    bias: 'down',
    duration: [1.5, 2.5],
    effects: { demandMult: 0.78 },
    select: (s) => byCategories(s, ['electronics'], 'Electronics'),
    headline: () => 'Electronics Sales Slump as Buyers Wait for New Models',
    body: () => 'Rumours of next-generation launches have shoppers holding off. Electronics demand is down about 22%.',
  },
];

const SEASONAL: (EventDef & { cycleDay: number })[] = [
  {
    id: 'holiday',
    cycleDay: 24,
    weight: 0,
    bias: 'up',
    duration: [3, 3],
    effects: { demandMult: 1.2, trafficMult: 1.5 },
    select: (s) => byCategories(s, ALL_CATEGORIES, 'All categories'),
    headline: () => 'Holiday Shopping Season Begins',
    body: () =>
      'The busiest stretch of the calendar is here. Demand rises 20% across every category and player storefronts see 50% more visitors for three days.',
  },
  {
    id: 'fitness_rush',
    cycleDay: 6,
    weight: 0,
    bias: 'up',
    duration: [2, 2],
    effects: { demandMult: 1.5 },
    select: (s) => bySubcategories(s, ['fitness'], 'Fitness'),
    headline: () => 'New-Season Fitness Rush Lifts Training Gear',
    body: () => 'Resolutions are back. Fitness equipment demand jumps 50% for two days.',
  },
];

/** Events per in-game day, on average. */
const EVENT_RATE = 1.3;
const MAX_ACTIVE_RANDOM = 4;

export function isActive(ev: MarketEvent, t: number): boolean {
  return ev.kind !== 'report' && ev.start <= t && ev.end > t;
}

export function activeEvents(s: GameState): MarketEvent[] {
  return s.events.filter((e) => isActive(e, s.clock.t));
}

function createEvent(
  s: GameState,
  def: Pick<EventDef, 'id' | 'bias' | 'effects' | 'duration'>,
  target: Target,
  headline: string,
  body: string,
  kind: MarketEvent['kind'] = 'event',
): MarketEvent {
  const t = s.clock.t;
  const days = randRange(s, def.duration[0], def.duration[1]);
  const startPrices: Record<string, number> = {};
  for (const id of target.productIds) startPrices[id] = s.market[id].price;
  const ev: MarketEvent = {
    id: nextId(s, 'event'),
    defId: def.id,
    kind,
    headline,
    body,
    categories: target.categories,
    subcategories: target.subcategories,
    productIds: target.productIds,
    start: t,
    end: kind === 'report' ? t : Math.round(t + days * MINUTES_PER_DAY),
    effects: def.effects,
    startPrices,
    bias: def.bias,
  };
  if (def.effects.supplyShock) {
    for (const id of target.productIds) {
      const mp = s.market[id];
      mp.supply = Math.max(0, mp.supply * (1 + def.effects.supplyShock));
    }
  }
  if (def.effects.lifecycleMult) {
    for (const id of target.productIds) s.market[id].demandBase *= def.effects.lifecycleMult;
  }
  s.events.push(ev);
  if (t >= GAME_START_MINUTE && kind !== 'report') {
    notify(s, 'event', headline, body.split('. ')[0] + '.', `/news/${ev.id}`);
  }
  return ev;
}

function startFromDef(s: GameState, def: EventDef): MarketEvent | undefined {
  const target = def.select(s);
  if (!target || target.productIds.length === 0) return undefined;
  return createEvent(s, def, target, def.headline(target), def.body(target));
}

/** Random + seasonal events for the tick ending at `t`. */
export function processEvents(s: GameState, t: number) {
  // Seasonal calendar (every 30 days).
  if (minuteOfDay(t) === 6 * 60) {
    const cycle = ((dayOf(t) % 30) + 30) % 30;
    for (const se of SEASONAL) {
      if (se.cycleDay === cycle) startFromDef(s, se);
    }
  }

  const sc = SCENARIOS[s.profile.scenario];
  if (!chance(s, EVENT_RATE / TICKS_PER_DAY)) return;
  const active = s.events.filter((e) => isActive(e, t) && e.kind === 'event');
  if (active.length >= MAX_ACTIVE_RANDOM) return;
  const activeIds = new Set(active.map((e) => e.defId));
  const def = pickWeighted(
    s,
    EVENT_DEFS.filter((d) => !activeIds.has(d.id)),
    (d) => d.weight * (d.bias === 'up' ? sc.upEventWeight : d.bias === 'down' ? sc.downEventWeight : 1),
  );
  if (def) startFromDef(s, def);
}

/** Lists products whose release day has arrived (09:00 on that day). */
export function processReleases(s: GameState, t: number) {
  for (const def of PRODUCTS) {
    const mp = s.market[def.id];
    if (!def.releaseDay || def.releaseDay <= 1) continue;
    if (mp && mp.listed) continue;
    const releaseAt = (def.releaseDay - 1) * MINUTES_PER_DAY + 9 * 60;
    if (t < releaseAt) continue;
    const fresh = initMarketProduct(s, def, t, true);
    s.market[def.id] = fresh;
    createEvent(
      s,
      { id: 'release', bias: 'up', effects: { demandMult: 1.3 }, duration: [2, 2] },
      { categories: [def.category], subcategories: [def.subcategory], productIds: [def.id], label: def.name, product: def },
      `New Release: ${def.name} Hits the Market`,
      `${def.description} Launch-window demand runs 30% above normal for two days.`,
      'release',
    );
    const pred = def.successorOf ? PRODUCT_BY_ID[def.successorOf] : undefined;
    if (pred && s.market[pred.id]?.listed) {
      createEvent(
        s,
        { id: 'tech_release', bias: 'down', effects: { demandMult: 0.85, lifecycleMult: 0.8 }, duration: [2, 2] },
        { categories: [pred.category], subcategories: [pred.subcategory], productIds: [pred.id], label: pred.name, product: pred },
        `New ${def.name} Launch Pressures Older ${pred.name}`,
        `With the ${def.name} on shelves, the ${pred.name} is last generation. Its long-run demand baseline drops 20% permanently, with an extra 15% dip during launch week.`,
      );
    }
  }
}

/** End-of-day market wrap built from the day's recorded prices and volume. */
export function dailyReport(s: GameState, t: number) {
  const listed = PRODUCTS.filter((p) => s.market[p.id]?.listed && t - s.market[p.id].listedAt >= MINUTES_PER_DAY);
  if (listed.length < 3) return;
  const moves = listed.map((p) => ({ p, ch: changeOver(s.market[p.id], MINUTES_PER_DAY), vol: volume24h(s.market[p.id]) }));
  moves.sort((a, b) => b.ch - a.ch);
  const top = moves[0];
  const bottom = moves[moves.length - 1];
  const busiest = [...moves].sort((a, b) => b.vol - a.vol)[0];
  const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  createEvent(
    s,
    { id: 'report', bias: 'mixed', effects: {}, duration: [0, 0] },
    {
      categories: [...new Set([top.p.category, bottom.p.category, busiest.p.category])],
      subcategories: [],
      productIds: [...new Set([top.p.id, bottom.p.id, busiest.p.id])],
      label: 'Market Wrap',
    },
    `Day ${dayOf(t) - 1} Market Wrap: ${top.p.name} Leads, ${bottom.p.name} Slides`,
    `${top.p.name} finished the day ${pct(top.ch)} at ${round2(s.market[top.p.id].price)} CR. ` +
      `${bottom.p.name} lost ${pct(bottom.ch)}. ` +
      `The most traded item was the ${busiest.p.name} with ${busiest.vol} units changing hands.`,
    'report',
  );
}

/** Delivery-time multiplier from active events for a category. */
export function deliveryMultiplier(s: GameState, category: CategoryId): number {
  let m = 1;
  for (const ev of s.events) {
    if (isActive(ev, s.clock.t) && ev.effects.deliveryMult && ev.categories.includes(category)) m *= ev.effects.deliveryMult;
  }
  return m;
}

/** Store-traffic multiplier from active events. */
export function trafficMultiplier(s: GameState): number {
  let m = 1;
  for (const ev of s.events) if (isActive(ev, s.clock.t) && ev.effects.trafficMult) m *= ev.effects.trafficMult;
  return m;
}

/** Average price change of affected products since the event started. */
export function eventImpact(s: GameState, ev: MarketEvent): number {
  const ids = Object.keys(ev.startPrices);
  if (ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) sum += s.market[id].price / ev.startPrices[id] - 1;
  return sum / ids.length;
}

export function pruneEvents(s: GameState) {
  const keepAfter = s.clock.t - 12 * MINUTES_PER_DAY;
  s.events = s.events.filter((e) => e.end > keepAfter || e.start > keepAfter);
  if (s.events.length > 160) s.events.splice(0, s.events.length - 160);
}
