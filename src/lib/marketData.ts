/**
 * Market-wide derived views (trending, movers, recommendations). All of it
 * is computed from recorded market data — nothing here is invented.
 */
import type { GameState, ProductDef } from '../engine/types';
import { PRODUCTS, PRODUCT_BY_ID } from '../engine/catalog';
import { averagePrice, changeOver, demandAgo, volume24h } from '../engine/history';
import { RARITY_PARAMS, MINUTES_PER_DAY } from '../engine/constants';
import { availableUnits, isSupplyLimited, supplyRatio } from '../engine/market';
import { isActive } from '../engine/events';
import { rarityUnlockLevel } from '../engine/progression';

export function listedDefs(s: GameState): ProductDef[] {
  return PRODUCTS.filter((p) => s.market[p.id]?.listed);
}

/** Popularity: units traded in the last in-game day. */
export function popularity(s: GameState, id: string): number {
  return volume24h(s.market[id]);
}

/** Trending: activity relative to the product's normal volume, weighted by demand. */
export function trendScore(s: GameState, id: string): number {
  const mp = s.market[id];
  const def = PRODUCT_BY_ID[id];
  const normal = Math.max(1, (def.limited ? mp.supplyTarget * 0.1 : RARITY_PARAMS[def.rarity].supplyTarget * 0.6));
  return (volume24h(mp) / normal) * (mp.demand / 100) * (1 + Math.abs(changeOver(mp, MINUTES_PER_DAY)) * 3);
}

export function topBy(s: GameState, score: (id: string) => number, n: number, filter?: (p: ProductDef) => boolean): string[] {
  return listedDefs(s)
    .filter((p) => (filter ? filter(p) : true))
    .map((p) => ({ id: p.id, v: score(p.id) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => x.id);
}

export interface Signal {
  id: string;
  score: number;
  reasons: string[];
}

/**
 * "Recommended investments": products with several favourable signals in
 * the recorded data. Explicitly advisory — the market is noisy.
 */
export function investmentSignals(s: GameState, n = 8): Signal[] {
  const out: Signal[] = [];
  const level = s.progression.level;
  for (const p of listedDefs(s)) {
    if (rarityUnlockLevel(p.rarity) > level) continue;
    const mp = s.market[p.id];
    if (availableUnits(mp) <= 0) continue;
    const reasons: string[] = [];
    let score = 0;
    const avg7 = averagePrice(mp, 7 * 24);
    const disc = mp.price / avg7 - 1;
    if (disc < -0.05) {
      score += Math.min(3, -disc * 20);
      reasons.push(`${Math.round(-disc * 100)}% below 7-day average`);
    }
    const past = demandAgo(mp, 24);
    const dTrend = past > 0 ? mp.demand / past - 1 : 0;
    if (dTrend > 0.08) {
      score += Math.min(3, dTrend * 10);
      reasons.push(`Demand +${Math.round(dTrend * 100)}% in 24h`);
    }
    const ratio = supplyRatio(mp);
    if (ratio < 0.75) {
      score += (0.75 - ratio) * 3;
      reasons.push('Supply tightening');
    }
    const ev = s.events.find((e) => isActive(e, s.clock.t) && e.bias === 'up' && e.productIds.includes(p.id));
    if (ev) {
      score += 1.2;
      reasons.push('Positive market event');
    }
    if (reasons.length >= 2) out.push({ id: p.id, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}

export function limitedStock(s: GameState, n: number): string[] {
  return listedDefs(s)
    .filter((p) => isSupplyLimited(s.market[p.id]) && availableUnits(s.market[p.id]) > 0)
    .sort((a, b) => supplyRatio(s.market[a.id]) - supplyRatio(s.market[b.id]))
    .slice(0, n)
    .map((p) => p.id);
}

export function newlyListed(s: GameState, n: number): string[] {
  return listedDefs(s)
    .filter((p) => p.releaseDay && p.releaseDay > 1)
    .sort((a, b) => s.market[b.id].listedAt - s.market[a.id].listedAt)
    .slice(0, n)
    .map((p) => p.id);
}

export function upcomingReleases(s: GameState): ProductDef[] {
  return PRODUCTS.filter((p) => p.releaseDay && p.releaseDay > 1 && !s.market[p.id]?.listed).sort((a, b) => (a.releaseDay ?? 0) - (b.releaseDay ?? 0));
}

export function releaseTime(p: ProductDef): number {
  return ((p.releaseDay ?? 1) - 1) * MINUTES_PER_DAY + 9 * 60;
}
