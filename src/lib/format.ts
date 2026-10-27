const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "12,345.67" */
export function cr(x: number): string {
  return nf2.format(Math.round(x * 100) / 100);
}

/** Compact credits: 1.2K, 3.45M. */
export function crCompact(x: number): string {
  const a = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${nf0.format(a)}`;
}

export function int(x: number): string {
  return nf0.format(Math.round(x));
}

/** Signed credits: "+1,234.00" / "−56.20". */
export function crSigned(x: number): string {
  const v = Math.round(x * 100) / 100;
  if (v === 0) return '0.00';
  return `${v > 0 ? '+' : '−'}${nf2.format(Math.abs(v))}`;
}

/** Fraction → "+12.3%". */
export function pct(frac: number, digits = 1): string {
  const v = frac * 100;
  if (!Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(digits));
  if (r === 0) return `${(0).toFixed(digits)}%`;
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(digits)}%`;
}

export function tone(x: number, eps = 0.0005): 'up' | 'down' | 'flat' {
  return x > eps ? 'up' : x < -eps ? 'down' : 'flat';
}

export function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${int(n)} ${n === 1 ? word : pluralWord}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
