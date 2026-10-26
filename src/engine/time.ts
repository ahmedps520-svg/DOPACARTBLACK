import { MINUTES_PER_DAY, MINUTES_PER_HOUR } from './constants';

/** Day number (Day 1 starts at t = 0; pre-game history has days ≤ 0). */
export function dayOf(t: number): number {
  return Math.floor(t / MINUTES_PER_DAY) + 1;
}

export function startOfDay(t: number): number {
  return Math.floor(t / MINUTES_PER_DAY) * MINUTES_PER_DAY;
}

export function minuteOfDay(t: number): number {
  return ((t % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function formatClock(t: number): string {
  const m = minuteOfDay(t);
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = Math.floor(m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatGameTime(t: number): string {
  return `Day ${dayOf(t)} · ${formatClock(t)}`;
}

/** Human duration for in-game minutes, e.g. "1d 4h", "35m". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < MINUTES_PER_HOUR) return `${m}m`;
  const d = Math.floor(m / MINUTES_PER_DAY);
  const h = Math.floor((m % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const mm = m % MINUTES_PER_HOUR;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  return mm > 0 && h < 6 ? `${h}h ${mm}m` : `${h}h`;
}

/** "3h ago", "2d ago", "just now". */
export function formatAgo(now: number, t: number): string {
  const diff = now - t;
  if (diff < 10) return 'just now';
  return `${formatDuration(diff)} ago`;
}
