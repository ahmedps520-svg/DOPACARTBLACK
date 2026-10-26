import type { MarketProduct, PriceHistory } from './types';
import {
  HISTORY_DAYS,
  HISTORY_DEMAND_HOURS,
  HISTORY_HOURS,
  HISTORY_TICKS,
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  TICK_MINUTES,
} from './constants';

const r2 = (x: number) => Math.round(x * 100) / 100;

export function emptyHistory(t: number, price: number, demand: number): PriceHistory {
  return {
    ticks: [r2(price)],
    ticksEnd: t,
    vol: [0],
    hourly: [r2(price)],
    hourlyEnd: Math.floor(t / MINUTES_PER_HOUR) * MINUTES_PER_HOUR,
    daily: [r2(price)],
    dailyEnd: Math.floor(t / MINUTES_PER_DAY) * MINUTES_PER_DAY,
    demand: [Math.round(demand)],
  };
}

function pushCapped(arr: number[], v: number, cap: number) {
  arr.push(v);
  if (arr.length > cap) arr.splice(0, arr.length - cap);
}

/** Record the state of a product at the end of the tick that finished at `t`. */
export function recordTick(h: PriceHistory, t: number, price: number, vol: number, demand: number) {
  pushCapped(h.ticks, r2(price), HISTORY_TICKS);
  pushCapped(h.vol, vol, HISTORY_TICKS);
  h.ticksEnd = t;
  if (t % MINUTES_PER_HOUR === 0) {
    pushCapped(h.hourly, r2(price), HISTORY_HOURS);
    pushCapped(h.demand, Math.round(demand), HISTORY_DEMAND_HOURS);
    h.hourlyEnd = t;
  }
  if (t % MINUTES_PER_DAY === 0) {
    pushCapped(h.daily, r2(price), HISTORY_DAYS);
    h.dailyEnd = t;
  }
}

export type RangeId = '1H' | '1D' | '1W' | '1M' | 'ALL';

export const RANGES: { id: RangeId; label: string; minutes: number }[] = [
  { id: '1H', label: '1H', minutes: 60 },
  { id: '1D', label: '1D', minutes: MINUTES_PER_DAY },
  { id: '1W', label: '1W', minutes: 7 * MINUTES_PER_DAY },
  { id: '1M', label: '1M', minutes: 30 * MINUTES_PER_DAY },
  { id: 'ALL', label: 'ALL', minutes: Infinity },
];

export interface Series {
  t: number[];
  p: number[];
}

function tail(values: number[], end: number, step: number, count: number, stride = 1): Series {
  const n = Math.min(values.length, count);
  const start = values.length - n;
  const t: number[] = [];
  const p: number[] = [];
  for (let i = start; i < values.length; i++) {
    const back = values.length - 1 - i;
    if (stride > 1 && back % stride !== 0 && i !== start) continue;
    t.push(end - back * step);
    p.push(values[i]);
  }
  return { t, p };
}

/**
 * Recorded price series for a range. Every point is a stored sample; the
 * live price is appended so the chart ends at "now".
 */
export function priceSeries(mp: MarketProduct, range: RangeId, now: number): Series {
  const h = mp.history;
  let s: Series;
  switch (range) {
    case '1H':
      s = tail(h.ticks, h.ticksEnd, TICK_MINUTES, 60 / TICK_MINUTES + 1);
      break;
    case '1D':
      s = tail(h.ticks, h.ticksEnd, TICK_MINUTES, HISTORY_TICKS);
      break;
    case '1W':
      s = tail(h.hourly, h.hourlyEnd, MINUTES_PER_HOUR, 7 * 24 + 1);
      break;
    case '1M':
      s = tail(h.hourly, h.hourlyEnd, MINUTES_PER_HOUR, HISTORY_HOURS, 4);
      break;
    default:
      s = h.daily.length >= 3 ? tail(h.daily, h.dailyEnd, MINUTES_PER_DAY, HISTORY_DAYS) : tail(h.hourly, h.hourlyEnd, MINUTES_PER_HOUR, HISTORY_HOURS, 4);
  }
  if (s.t.length === 0 || s.t[s.t.length - 1] < now) {
    s.t.push(now);
    s.p.push(r2(mp.price));
  }
  return s;
}

export function volumeSeries(mp: MarketProduct, points: number): Series {
  return tail(mp.history.vol, mp.history.ticksEnd, TICK_MINUTES, points);
}

/** Price `minutes` ago using the finest stored series that covers it. */
export function priceAgo(mp: MarketProduct, minutes: number): number {
  const h = mp.history;
  if (minutes <= (h.ticks.length - 1) * TICK_MINUTES) {
    return h.ticks[h.ticks.length - 1 - Math.round(minutes / TICK_MINUTES)];
  }
  const hoursBack = Math.ceil((h.ticksEnd - minutes - h.hourlyEnd) / -MINUTES_PER_HOUR);
  if (hoursBack < h.hourly.length) return h.hourly[Math.max(0, h.hourly.length - 1 - hoursBack)];
  const daysBack = Math.ceil((h.ticksEnd - minutes - h.dailyEnd) / -MINUTES_PER_DAY);
  if (daysBack < h.daily.length) return h.daily[Math.max(0, h.daily.length - 1 - daysBack)];
  // Not enough history (recently listed): earliest recorded price.
  return h.daily[0] ?? h.hourly[0] ?? h.ticks[0];
}

/** Fractional change over the trailing window, e.g. 0.12 = +12%. */
export function changeOver(mp: MarketProduct, minutes: number): number {
  const past = priceAgo(mp, minutes);
  if (!past) return 0;
  return mp.price / past - 1;
}

/** Demand index `hours` ago (hourly samples). */
export function demandAgo(mp: MarketProduct, hours: number): number {
  const d = mp.history.demand;
  if (d.length === 0) return mp.demand;
  return d[Math.max(0, d.length - 1 - hours)];
}

/** Units traded in the trailing in-game day. */
export function volume24h(mp: MarketProduct): number {
  let v = 0;
  for (const x of mp.history.vol) v += x;
  return v;
}

/** Simple average of hourly closes over the trailing window. */
export function averagePrice(mp: MarketProduct, hours: number): number {
  const arr = mp.history.hourly;
  const n = Math.min(arr.length, hours);
  if (n === 0) return mp.price;
  let sum = 0;
  for (let i = arr.length - n; i < arr.length; i++) sum += arr[i];
  return sum / n;
}
