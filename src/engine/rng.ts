/**
 * Deterministic pseudo-random numbers. The generator state lives inside the
 * GameState (`rng`) so a save always continues the same sequence.
 */

export interface RngHolder {
  rng: number;
}

/** mulberry32 step: returns a float in [0, 1) and advances the holder. */
export function rand(h: RngHolder): number {
  let a = (h.rng + 0x6d2b79f5) | 0;
  h.rng = a;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

export function randRange(h: RngHolder, min: number, max: number): number {
  return min + (max - min) * rand(h);
}

export function randInt(h: RngHolder, min: number, max: number): number {
  return Math.floor(randRange(h, min, max + 1));
}

export function chance(h: RngHolder, p: number): boolean {
  return rand(h) < p;
}

/** Standard normal via Box–Muller. */
export function gauss(h: RngHolder): number {
  let u = rand(h);
  if (u < 1e-12) u = 1e-12;
  const v = rand(h);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson sample (Knuth for small lambda, normal approximation above 30). */
export function poisson(h: RngHolder, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(h)));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand(h);
  } while (p > L);
  return k - 1;
}

export function pick<T>(h: RngHolder, items: readonly T[]): T {
  return items[Math.floor(rand(h) * items.length)];
}

export function pickWeighted<T>(h: RngHolder, items: readonly T[], weight: (item: T) => number): T | undefined {
  const total = items.reduce((sum, i) => sum + Math.max(0, weight(i)), 0);
  if (total <= 0) return undefined;
  let r = rand(h) * total;
  for (const item of items) {
    r -= Math.max(0, weight(item));
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/** Stateless hash → [0,1). Used for deterministic per-day choices. */
export function hashRand(...parts: (string | number)[]): number {
  let h = 2166136261;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
