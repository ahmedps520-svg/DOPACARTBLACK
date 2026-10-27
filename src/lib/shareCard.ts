/**
 * Shareable PNG cards drawn on a canvas (no network, no server). Players can
 * download them to show off fictional achievements and storefronts.
 */
import type { GameState } from '../engine/types';
import { netWorth, storeRevenueTotal } from '../engine/selectors';
import { titleForLevel } from '../engine/progression';
import { cr } from './format';
import { dayOf } from '../engine/time';

function base(title: string): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 630;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(1000, 80, 40, 900, 200, 900);
  g.addColorStop(0, '#2a0a0f');
  g.addColorStop(0.5, '#0f0f12');
  g.addColorStop(1, '#08080a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#e5132f';
  ctx.fillRect(0, 0, 12, c.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeRect(40, 40, c.width - 80, c.height - 80);
  ctx.fillStyle = '#f4f4f5';
  ctx.font = '64px "Bebas Neue", Impact, sans-serif';
  ctx.fillText('DOPA', 80, 130);
  const w = ctx.measureText('DOPA').width;
  ctx.fillStyle = '#e5132f';
  ctx.fillText('CART', 80 + w, 130);
  ctx.fillStyle = '#7c7c87';
  ctx.font = '600 18px "Inter Variable", Inter, sans-serif';
  ctx.fillText(`BLACK MARKET · ${title}`, 82, 162);
  return [c, ctx];
}

function footer(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = '#7c7c87';
  ctx.font = '500 18px "Inter Variable", Inter, sans-serif';
  ctx.fillText(`${s.profile.name} · Level ${s.progression.level} ${titleForLevel(s.progression.level)} · Day ${dayOf(s.clock.t)}`, 80, 540);
  ctx.fillText('A fictional business simulation. Virtual credits only — nothing here is real or for sale.', 80, 572);
}

function save(c: HTMLCanvasElement, name: string) {
  c.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

export async function downloadAchievementCard(s: GameState, title: string, description: string) {
  await document.fonts?.ready;
  const [c, ctx] = base('ACHIEVEMENT UNLOCKED');
  ctx.fillStyle = '#f3d27a';
  ctx.font = '700 22px "Inter Variable", Inter, sans-serif';
  ctx.fillText('★ ACHIEVEMENT', 80, 260);
  ctx.fillStyle = '#f4f4f5';
  ctx.font = '120px "Bebas Neue", Impact, sans-serif';
  ctx.fillText(title.toUpperCase(), 76, 380);
  ctx.fillStyle = '#b4b4bd';
  ctx.font = '500 28px "Inter Variable", Inter, sans-serif';
  wrap(ctx, description, 80, 440, 1000, 36);
  footer(ctx, s);
  save(c, `dopacart-${title.toLowerCase().replace(/\W+/g, '-')}.png`);
}

export async function downloadBusinessCard(s: GameState, storeName: string) {
  await document.fonts?.ready;
  const [c, ctx] = base('BUSINESS CARD');
  ctx.fillStyle = '#f4f4f5';
  ctx.font = '110px "Bebas Neue", Impact, sans-serif';
  ctx.fillText(storeName.toUpperCase(), 76, 300);
  const stats: [string, string][] = [
    ['NET WORTH', `${cr(netWorth(s))} CR`],
    ['STORE REVENUE', `${cr(storeRevenueTotal(s))} CR`],
    ['REALIZED PROFIT', `${cr(s.wallet.realizedProfit)} CR`],
    ['UNITS SOLD', `${s.counters.unitsSold}`],
  ];
  stats.forEach(([k, v], i) => {
    const x = 80 + i * 270;
    ctx.fillStyle = '#7c7c87';
    ctx.font = '700 16px "Inter Variable", Inter, sans-serif';
    ctx.fillText(k, x, 380);
    ctx.fillStyle = '#f4f4f5';
    ctx.font = '600 30px "JetBrains Mono Variable", monospace';
    ctx.fillText(v, x, 420);
  });
  footer(ctx, s);
  save(c, `dopacart-${storeName.toLowerCase().replace(/\W+/g, '-')}.png`);
}
