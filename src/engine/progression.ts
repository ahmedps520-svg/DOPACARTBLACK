/**
 * Player progression: experience, levels, unlocks, missions, daily
 * challenges and achievements. Every reward is granted only after the
 * condition is verified against real game state.
 */
import type { CategoryId, GameState, Rarity, StoreThemeId } from './types';
import { CATEGORY_BY_ID, RARITY_LABEL, RARITY_RANK, RARITIES, CATEGORIES } from './categories';
import { RARITY_PARAMS, STORE_LEVEL_REQUIREMENT, MINUTES_PER_DAY } from './constants';
import { PRODUCT_BY_ID } from './catalog';
import { SUPPLIERS } from './suppliers';
import { UPGRADES } from './upgrades';
import { hashRand } from './rng';
import { fail, notify, recordTx } from './ledger';
import { dayOf, startOfDay } from './time';
import { netWorth, periodTotals, storeRevenueTotal, txBetween } from './selectors';

export const MAX_LEVEL = 50;

export function xpForLevel(level: number): number {
  return Math.round(50 * Math.pow(Math.max(0, level - 1), 1.75));
}

export function levelForXp(xp: number): number {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l + 1)) l++;
  return l;
}

export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: 'Beginner' },
  { level: 5, title: 'Reseller' },
  { level: 10, title: 'Store Owner' },
  { level: 20, title: 'Market Specialist' },
  { level: 35, title: 'Business Mogul' },
  { level: 50, title: 'Market Legend' },
];

export function titleForLevel(level: number): string {
  let t = TITLES[0].title;
  for (const x of TITLES) if (level >= x.level) t = x.title;
  return t;
}

export interface StoreThemeDef {
  id: StoreThemeId;
  name: string;
  level: number;
  bg: string;
  surface: string;
  accent: string;
  text: string;
}

export const STORE_THEMES: StoreThemeDef[] = [
  { id: 'obsidian', name: 'Obsidian', level: 1, bg: '#0b0b0d', surface: '#17171b', accent: '#e5132f', text: '#f4f4f5' },
  { id: 'crimson', name: 'Crimson Velvet', level: 5, bg: '#140507', surface: '#2a0b10', accent: '#ff3348', text: '#fbeff0' },
  { id: 'gilded', name: 'Gilded Noir', level: 10, bg: '#0d0b07', surface: '#1d1a12', accent: '#d4af37', text: '#f7f1df' },
  { id: 'chrome', name: 'Liquid Chrome', level: 20, bg: '#0e1013', surface: '#1f242b', accent: '#c9d3df', text: '#f2f5f8' },
  { id: 'phantom', name: 'Phantom', level: 35, bg: '#07060c', surface: '#16122a', accent: '#8f6bff', text: '#efeaff' },
  { id: 'legend', name: 'Legend', level: 50, bg: '#000000', surface: '#141414', accent: '#ffffff', text: '#ffffff' },
];

export function rarityUnlockLevel(r: Rarity): number {
  return RARITY_PARAMS[r].unlockLevel;
}

export interface Unlock {
  level: number;
  label: string;
  kind: 'rarity' | 'supplier' | 'upgrade' | 'theme' | 'store';
}

/** Everything that opens up at each level, derived from the real gates. */
export function allUnlocks(): Unlock[] {
  const out: Unlock[] = [];
  for (const r of RARITIES) {
    const l = rarityUnlockLevel(r);
    if (l > 1) out.push({ level: l, label: `${RARITY_LABEL[r]} products can be purchased`, kind: 'rarity' });
  }
  for (const s of SUPPLIERS) if (s.unlockLevel > 1) out.push({ level: s.unlockLevel, label: `Supplier: ${s.name}`, kind: 'supplier' });
  for (const u of UPGRADES)
    u.levels.forEach((lv, i) => {
      if (lv.requiredLevel > 1) out.push({ level: lv.requiredLevel, label: `${u.name} tier ${i + 1}`, kind: 'upgrade' });
    });
  for (const t of STORE_THEMES) if (t.level > 1) out.push({ level: t.level, label: `Store theme: ${t.name}`, kind: 'theme' });
  STORE_LEVEL_REQUIREMENT.forEach((l, i) => {
    if (i > 0) out.push({ level: l, label: `Store slot #${i + 1}`, kind: 'store' });
  });
  return out.sort((a, b) => a.level - b.level);
}

export function addXp(s: GameState, amount: number, reason: string) {
  if (amount <= 0) return;
  const before = s.progression.level;
  s.progression.xp += Math.round(amount);
  const after = levelForXp(s.progression.xp);
  if (after > before) {
    s.progression.level = after;
    const unlocked = allUnlocks().filter((u) => u.level > before && u.level <= after);
    notify(
      s,
      'level',
      `Level ${after} — ${titleForLevel(after)}`,
      unlocked.length ? `Unlocked: ${unlocked.map((u) => u.label).join(', ')}.` : `Earned through ${reason}.`,
      '/missions',
    );
  }
}

/** XP for a profitable sale: proportional to profit, never to clicks. */
export function xpForProfit(pnl: number, rarity: Rarity): number {
  if (pnl <= 0) return 0;
  return Math.min(250, Math.floor((pnl / 8) * RARITY_PARAMS[rarity].xpMultiplier));
}

// ───────────────────────────── Missions ─────────────────────────────

export interface MissionDef {
  id: string;
  group: 'Getting Started' | 'Trading' | 'Business' | 'Mastery';
  title: string;
  description: string;
  xp: number;
  credits: number;
  progress: (s: GameState) => [number, number];
}

function rareUnitsHeld(s: GameState): number {
  let n = 0;
  for (const h of Object.values(s.holdings)) if (RARITY_RANK[PRODUCT_BY_ID[h.productId].rarity] >= RARITY_RANK.rare) n += h.qty;
  return n;
}

function distinctRareHeld(s: GameState): number {
  return Object.values(s.holdings).filter((h) => h.qty > 0 && RARITY_RANK[PRODUCT_BY_ID[h.productId].rarity] >= RARITY_RANK.rare).length;
}

function ownsRarity(s: GameState, r: Rarity): boolean {
  return Object.values(s.holdings).some((h) => h.qty > 0 && PRODUCT_BY_ID[h.productId].rarity === r);
}

export const MISSIONS: MissionDef[] = [
  { id: 'm_first_purchase', group: 'Getting Started', title: 'First Acquisition', description: 'Buy your first product from the marketplace.', xp: 50, credits: 0, progress: (s) => [s.counters.purchases, 1] },
  { id: 'm_first_sale', group: 'Getting Started', title: 'Open for Business', description: 'Complete your first sale — to the market or through your store.', xp: 75, credits: 0, progress: (s) => [s.counters.unitsSold, 1] },
  { id: 'm_first_profit', group: 'Getting Started', title: 'In the Green', description: 'Complete your first profitable sale.', xp: 120, credits: 100, progress: (s) => [s.counters.profitableSales, 1] },
  { id: 'm_open_store', group: 'Getting Started', title: 'Storefront Live', description: 'Create your first store listing.', xp: 100, credits: 0, progress: (s) => [s.counters.listingsCreated, 1] },
  { id: 'm_upgrade', group: 'Getting Started', title: 'Reinvest', description: 'Buy your first business upgrade.', xp: 100, credits: 0, progress: (s) => [s.counters.upgradesBought, 1] },
  { id: 'm_alert', group: 'Trading', title: 'Eyes on the Tape', description: 'Create a price alert on the Trading Floor or a product page.', xp: 50, credits: 0, progress: (s) => [s.counters.alertsCreated, 1] },
  { id: 'm_watch_rising', group: 'Trading', title: 'Trend Spotter', description: 'Add a product whose demand rose at least 10% over the last 24 in-game hours to your watchlist.', xp: 80, credits: 0, progress: (s) => [s.counters.risingDemandSpotted, 1] },
  { id: 'm_sell_five', group: 'Trading', title: 'Moving Units', description: 'Sell five products.', xp: 120, credits: 150, progress: (s) => [s.counters.unitsSold, 5] },
  { id: 'm_profit_500', group: 'Trading', title: 'First Margin', description: 'Earn 500 CR in realized profit.', xp: 200, credits: 250, progress: (s) => [Math.max(0, Math.floor(s.wallet.realizedProfit)), 500] },
  { id: 'm_rare', group: 'Trading', title: 'Rare Stock', description: 'Hold three Rare-or-better units at the same time.', xp: 200, credits: 0, progress: (s) => [rareUnitsHeld(s), 3] },
  { id: 'm_supplier_3', group: 'Business', title: 'Supply Chain', description: 'Receive three supplier orders.', xp: 250, credits: 250, progress: (s) => [s.counters.supplierOrdersDelivered, 3] },
  { id: 'm_store_rev_2k', group: 'Business', title: 'Steady Trade', description: 'Reach 2,000 CR in store revenue.', xp: 250, credits: 300, progress: (s) => [Math.floor(storeRevenueTotal(s)), 2000] },
  { id: 'm_warehouse', group: 'Business', title: 'Room to Grow', description: 'Expand your warehouse to 300 units.', xp: 250, credits: 0, progress: (s) => [Math.min(2, s.upgrades.warehouse), 2] },
  { id: 'm_cashflow_7', group: 'Business', title: 'Cash Machine', description: 'Maintain positive daily cash flow for seven in-game days in a row.', xp: 400, credits: 500, progress: (s) => [Math.min(7, Math.max(s.counters.consecutivePositiveDays, s.counters.bestPositiveStreak)), 7] },
  { id: 'm_store_rev_10k', group: 'Mastery', title: 'Retail Force', description: 'Reach 10,000 CR in store revenue.', xp: 500, credits: 750, progress: (s) => [Math.floor(storeRevenueTotal(s)), 10000] },
  { id: 'm_networth_25k', group: 'Mastery', title: 'Quarter Stack', description: 'Reach a net worth of 25,000 CR.', xp: 400, credits: 500, progress: (s) => [Math.floor(netWorth(s)), 25000] },
  { id: 'm_second_store', group: 'Mastery', title: 'Expansion', description: 'Open a second store.', xp: 600, credits: 0, progress: (s) => [s.stores.length, 2] },
  { id: 'm_networth_100k', group: 'Mastery', title: 'Six Figures', description: 'Reach a net worth of 100,000 CR.', xp: 1000, credits: 1500, progress: (s) => [Math.floor(netWorth(s)), 100000] },
];

export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

// ───────────────────────────── Achievements ─────────────────────────────

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xp: number;
  check: (s: GameState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_rare', title: 'Rare Find', description: 'Own a Rare product.', xp: 60, check: (s) => ownsRarity(s, 'rare') },
  { id: 'a_epic', title: 'Epic Taste', description: 'Own an Epic product.', xp: 120, check: (s) => ownsRarity(s, 'epic') },
  { id: 'a_legendary', title: 'Legend Holder', description: 'Own a Legendary product.', xp: 250, check: (s) => ownsRarity(s, 'legendary') },
  { id: 'a_exclusive', title: 'Exclusive Club', description: 'Own an Exclusive product.', xp: 400, check: (s) => ownsRarity(s, 'exclusive') },
  { id: 'a_curator', title: 'Curator', description: 'Hold 10 different Rare-or-better products at once.', xp: 300, check: (s) => distinctRareHeld(s) >= 10 },
  { id: 'a_century', title: 'Century', description: 'Sell 100 units.', xp: 150, check: (s) => s.counters.unitsSold >= 100 },
  { id: 'a_market_maker', title: 'Market Maker', description: 'Sell 1,000 units.', xp: 500, check: (s) => s.counters.unitsSold >= 1000 },
  { id: 'a_diamond', title: 'Diamond Hands', description: 'Sell at a profit a product you held for 7+ in-game days.', xp: 150, check: (s) => s.counters.diamondHands >= 1 },
  { id: 'a_event', title: 'Read the News', description: 'Realize a profit on a product while a market event is affecting it.', xp: 120, check: (s) => s.counters.eventProfits >= 1 },
  { id: 'a_50k', title: 'Five Figures', description: 'Reach a net worth of 50,000 CR.', xp: 300, check: (s) => netWorth(s) >= 50_000 },
  { id: 'a_250k', title: 'Quarter Million', description: 'Reach a net worth of 250,000 CR.', xp: 800, check: (s) => netWorth(s) >= 250_000 },
  { id: 'a_million', title: 'Empire', description: 'Reach a net worth of 1,000,000 CR.', xp: 2000, check: (s) => netWorth(s) >= 1_000_000 },
  { id: 'a_chain', title: 'Chain Store', description: 'Own two stores.', xp: 200, check: (s) => s.stores.length >= 2 },
  { id: 'a_mega', title: 'Mega Warehouse', description: 'Max out the warehouse.', xp: 500, check: (s) => s.upgrades.warehouse >= 5 },
  { id: 'a_streak', title: 'Unbroken', description: 'Post 14 consecutive days of positive cash flow.', xp: 600, check: (s) => s.counters.bestPositiveStreak >= 14 },
];

// ───────────────────────────── Daily challenges ─────────────────────────────

export interface DailyInstance {
  id: string;
  title: string;
  target: number;
  current: number;
  xp: number;
  credits: number;
  unit?: string;
}

type DailyKind = 'store_units' | 'profit' | 'supplier' | 'buy_cat' | 'sell_uncommon' | 'revenue' | 'growth';
const DAILY_KINDS: DailyKind[] = ['store_units', 'profit', 'supplier', 'buy_cat', 'sell_uncommon', 'revenue', 'growth'];

/** Three challenges per in-game day, chosen deterministically from the seed. */
export function rollDailies(s: GameState, day: number): string[] {
  const kinds = [...DAILY_KINDS];
  const out: string[] = [];
  const scale = Math.max(1, s.progression.level / 3);
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(hashRand(s.seed, 'daily', day, i) * kinds.length);
    const k = kinds.splice(idx, 1)[0];
    switch (k) {
      case 'profit':
        out.push(`profit:${Math.round((300 * scale) / 50) * 50}`);
        break;
      case 'revenue':
        out.push(`revenue:${Math.round((1500 * scale) / 100) * 100}`);
        break;
      case 'buy_cat': {
        const cat = CATEGORIES[Math.floor(hashRand(s.seed, 'cat', day) * 4)].id; // luxury excluded
        out.push(`buy_cat:${cat}`);
        break;
      }
      case 'store_units':
        out.push('store_units:3');
        break;
      case 'supplier':
        out.push('supplier:1');
        break;
      case 'sell_uncommon':
        out.push('sell_uncommon:1');
        break;
      case 'growth':
        out.push('growth:2');
        break;
    }
  }
  return out;
}

export function evaluateDaily(s: GameState, id: string): DailyInstance {
  const [kind, param] = id.split(':') as [DailyKind, string];
  const from = startOfDay(s.clock.t);
  const txs = txBetween(s, from, from + MINUTES_PER_DAY);
  const n = Number(param);
  switch (kind) {
    case 'store_units': {
      const units = txs.filter((t) => t.type === 'store_sale').reduce((a, t) => a + (t.qty ?? 0), 0);
      return { id, title: `Sell ${n} units through your stores`, target: n, current: units, xp: 60, credits: 120 };
    }
    case 'profit': {
      const p = periodTotals(txs).profit;
      return { id, title: `Realize ${n.toLocaleString()} CR of profit`, target: n, current: Math.max(0, Math.floor(p)), xp: 70, credits: 150, unit: 'CR' };
    }
    case 'revenue': {
      const r = periodTotals(txs).revenue;
      return { id, title: `Earn ${n.toLocaleString()} CR in gross revenue`, target: n, current: Math.floor(r), xp: 50, credits: 100, unit: 'CR' };
    }
    case 'supplier': {
      const c = s.orders.filter((o) => o.kind === 'supplier' && o.placedAt >= from).length;
      return { id, title: 'Place a supplier order', target: 1, current: c, xp: 40, credits: 75 };
    }
    case 'buy_cat': {
      const cat = param as CategoryId;
      const bought =
        txs.some((t) => t.type === 'purchase' && t.productId && PRODUCT_BY_ID[t.productId]?.category === cat) ||
        s.orders.some((o) => o.kind === 'supplier' && o.placedAt >= from && o.lines.some((l) => PRODUCT_BY_ID[l.productId]?.category === cat));
      return { id, title: `Buy any ${CATEGORY_BY_ID[cat].label} product`, target: 1, current: bought ? 1 : 0, xp: 40, credits: 60 };
    }
    case 'sell_uncommon': {
      const ok = txs.some(
        (t) => (t.type === 'sale' || t.type === 'store_sale') && t.productId && RARITY_RANK[PRODUCT_BY_ID[t.productId].rarity] >= RARITY_RANK.uncommon,
      );
      return { id, title: 'Sell an Uncommon-or-better item', target: 1, current: ok ? 1 : 0, xp: 50, credits: 80 };
    }
    case 'growth': {
      const open = s.dailySnapshots.length ? s.dailySnapshots[s.dailySnapshots.length - 1].netWorth : s.wallet.startingBalance;
      const g = open > 0 ? (netWorth(s) / open - 1) * 100 : 0;
      return { id, title: `Grow net worth by ${n}% today`, target: n, current: Math.max(0, Math.round(g * 10) / 10), xp: 80, credits: 150, unit: '%' };
    }
  }
}

export function refreshDailies(s: GameState) {
  const day = dayOf(s.clock.t);
  if (s.progression.daily.day !== day) {
    s.progression.daily = { day, ids: rollDailies(s, day), claimed: [] };
  }
}

// ───────────────────────────── Checks & claims ─────────────────────────────

/** Mark newly satisfied missions complete and grant achievements. */
export function checkProgress(s: GameState) {
  for (const m of MISSIONS) {
    const st = s.progression.missions[m.id] ?? {};
    if (st.completedAt !== undefined) continue;
    const [cur, target] = m.progress(s);
    if (cur >= target) {
      s.progression.missions[m.id] = { ...st, completedAt: s.clock.t };
      notify(s, 'mission', `Mission complete: ${m.title}`, `Claim your reward: ${rewardText(m.xp, m.credits)}.`, '/missions');
    }
  }
  for (const a of ACHIEVEMENTS) {
    if (s.progression.achievements[a.id] !== undefined) continue;
    if (a.check(s)) {
      s.progression.achievements[a.id] = s.clock.t;
      notify(s, 'achievement', `Achievement unlocked: ${a.title}`, `${a.description} +${a.xp} XP`, '/missions');
      addXp(s, a.xp, `the ${a.title} achievement`);
    }
  }
}

export function rewardText(xp: number, credits: number): string {
  return [xp ? `${xp} XP` : '', credits ? `${credits.toLocaleString()} CR` : ''].filter(Boolean).join(' + ');
}

export function claimMission(s: GameState, id: string) {
  const m = MISSION_BY_ID[id];
  if (!m) fail('Unknown mission.');
  const st = s.progression.missions[id];
  if (st?.completedAt === undefined) {
    const [cur, target] = m.progress(s);
    if (cur < target) fail(`Mission not complete yet (${cur.toLocaleString()} / ${target.toLocaleString()}).`);
  }
  if (st?.claimedAt !== undefined) fail('Reward already claimed.');
  s.progression.missions[id] = { completedAt: st?.completedAt ?? s.clock.t, claimedAt: s.clock.t };
  if (m.credits > 0) recordTx(s, { type: 'reward', total: m.credits, memo: `Mission reward: ${m.title}` });
  addXp(s, m.xp, `the ${m.title} mission`);
}

export function claimDaily(s: GameState, id: string) {
  refreshDailies(s);
  const d = s.progression.daily;
  if (!d.ids.includes(id)) fail('That challenge is not available today.');
  if (d.claimed.includes(id)) fail('Challenge reward already claimed.');
  const inst = evaluateDaily(s, id);
  if (inst.current < inst.target) fail(`Challenge not complete yet (${inst.current} / ${inst.target}).`);
  d.claimed.push(id);
  recordTx(s, { type: 'reward', total: inst.credits, memo: `Daily challenge: ${inst.title}` });
  addXp(s, inst.xp, 'a daily challenge');
}

/** Called at each day rollover with the just-finished day's ledger. */
export function closeDay(s: GameState, dayStart: number) {
  const txs = txBetween(s, dayStart, dayStart + MINUTES_PER_DAY);
  const net = periodTotals(txs).netCash;
  if (net > 0) {
    s.counters.consecutivePositiveDays += 1;
    s.counters.bestPositiveStreak = Math.max(s.counters.bestPositiveStreak, s.counters.consecutivePositiveDays);
  } else {
    s.counters.consecutivePositiveDays = 0;
  }
}

