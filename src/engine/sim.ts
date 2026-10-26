/**
 * Tick orchestration. One tick = 10 in-game minutes. Everything time-based
 * (prices, events, deliveries, store customers, rivals, alerts, operating
 * costs) advances here, so closing the game and coming back simply runs the
 * missed ticks — deliveries and sales are handled identically either way.
 */
import type { GameState } from './types';
import {
  MAX_OFFLINE_MINUTES,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  REAL_MS_PER_TICK,
  SNAPSHOT_HOURS,
  TICK_MINUTES,
  HISTORY_DAYS,
} from './constants';
import { marketTick } from './market';
import { dailyReport, processEvents, processReleases, pruneEvents } from './events';
import { advanceOrders } from './orders';
import { chargeOperatingCosts, storeTick } from './storefront';
import { competitorsTick } from './competitors';
import { evaluateAlerts } from './alerts';
import { checkProgress, closeDay, refreshDailies } from './progression';
import { inTransitValue, inventoryCost, inventoryValue } from './selectors';
import { money } from './ledger';

export function takeSnapshot(s: GameState) {
  const inv = inventoryValue(s);
  const inTransit = inTransitValue(s);
  return {
    t: s.clock.t,
    cash: s.wallet.cash,
    inventoryValue: inv,
    inventoryCost: inventoryCost(s),
    inTransit,
    netWorth: money(s.wallet.cash + inv + inTransit),
    visitors: s.stores.reduce((a, st) => a + st.stats.visitors, 0),
  };
}

/** Market-only tick used to generate pre-game history. */
export function worldTick(s: GameState) {
  const t = s.clock.t + TICK_MINUTES;
  s.clock.t = t;
  s.clock.tick++;
  processReleases(s, t);
  processEvents(s, t);
  marketTick(s, t);
  if (t % MINUTES_PER_DAY === 0) {
    dailyReport(s, t);
    pruneEvents(s);
  }
}

/** Full game tick. */
export function gameTick(s: GameState) {
  worldTick(s);
  const t = s.clock.t;
  advanceOrders(s, t);
  storeTick(s);
  if (t % MINUTES_PER_HOUR === 0) {
    competitorsTick(s);
    s.snapshots.push(takeSnapshot(s));
    if (s.snapshots.length > SNAPSHOT_HOURS) s.snapshots.splice(0, s.snapshots.length - SNAPSHOT_HOURS);
  }
  evaluateAlerts(s);
  if (t % MINUTES_PER_DAY === 0) {
    closeDay(s, t - MINUTES_PER_DAY);
    chargeOperatingCosts(s);
    s.dailySnapshots.push(takeSnapshot(s));
    if (s.dailySnapshots.length > HISTORY_DAYS) s.dailySnapshots.splice(0, s.dailySnapshots.length - HISTORY_DAYS);
    refreshDailies(s);
  }
  checkProgress(s);
}

export function runTicks(s: GameState, n: number) {
  for (let i = 0; i < n; i++) gameTick(s);
  if (s.processedKeys.length > 300) s.processedKeys.splice(0, s.processedKeys.length - 300);
}

/**
 * Convert elapsed real time into ticks at the current speed. Returns the
 * number of ticks run. Offline gaps are capped at MAX_OFFLINE_MINUTES.
 */
export function advanceRealTime(s: GameState, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - s.clock.lastReal);
  s.clock.lastReal = nowMs;
  if (s.settings.speed === 0) {
    s.clock.carryMs = 0;
    return 0;
  }
  const maxMs = (MAX_OFFLINE_MINUTES / TICK_MINUTES) * REAL_MS_PER_TICK;
  s.clock.carryMs += Math.min(elapsed * s.settings.speed, maxMs);
  const n = Math.floor(s.clock.carryMs / REAL_MS_PER_TICK);
  if (n <= 0) return 0;
  s.clock.carryMs -= n * REAL_MS_PER_TICK;
  runTicks(s, n);
  return n;
}
