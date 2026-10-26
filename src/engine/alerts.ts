import type { AlertKind, GameState, MarketProduct, PriceAlert } from './types';
import { PRODUCT_BY_ID } from './catalog';
import { MAX_ALERTS } from './constants';
import { fail, nextId, notify } from './ledger';
import { isSupplyLimited } from './market';

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  below: 'Price falls below',
  above: 'Price rises above',
  rise_pct: 'Price rises by %',
  fall_pct: 'Price falls by %',
  supply_limited: 'Supply becomes limited',
};

export function alertTriggered(a: PriceAlert, mp: MarketProduct): boolean {
  switch (a.kind) {
    case 'below':
      return mp.price <= a.threshold;
    case 'above':
      return mp.price >= a.threshold;
    case 'rise_pct':
      return mp.price >= a.basePrice * (1 + a.threshold / 100);
    case 'fall_pct':
      return mp.price <= a.basePrice * (1 - a.threshold / 100);
    case 'supply_limited':
      return isSupplyLimited(mp);
  }
}

export function describeAlert(a: PriceAlert): string {
  const name = PRODUCT_BY_ID[a.productId]?.name ?? a.productId;
  switch (a.kind) {
    case 'below':
      return `${name} at or below ${a.threshold.toLocaleString()} CR`;
    case 'above':
      return `${name} at or above ${a.threshold.toLocaleString()} CR`;
    case 'rise_pct':
      return `${name} up ${a.threshold}% from ${a.basePrice.toLocaleString()} CR`;
    case 'fall_pct':
      return `${name} down ${a.threshold}% from ${a.basePrice.toLocaleString()} CR`;
    case 'supply_limited':
      return `${name} supply becomes limited`;
  }
}

/** Check every active alert against the latest simulated prices. */
export function evaluateAlerts(s: GameState) {
  for (const a of s.alerts) {
    if (!a.active) continue;
    const mp = s.market[a.productId];
    if (!mp?.listed) continue;
    if (alertTriggered(a, mp)) {
      a.active = false;
      a.triggeredAt = s.clock.t;
      a.triggeredPrice = mp.price;
      notify(s, 'alert', `Price alert: ${PRODUCT_BY_ID[a.productId].name}`, `${describeAlert(a)} — now ${mp.price.toLocaleString()} CR.`, `/product/${a.productId}`);
    }
  }
}

export function createAlert(s: GameState, productId: string, kind: AlertKind, threshold: number): PriceAlert {
  const mp = s.market[productId];
  if (!mp?.listed) fail('That product is not on the market.');
  if (s.alerts.filter((a) => a.active).length >= MAX_ALERTS) fail(`You can keep up to ${MAX_ALERTS} active alerts.`);
  if (kind !== 'supply_limited') {
    if (!Number.isFinite(threshold) || threshold <= 0) fail('Enter a positive threshold.');
    if ((kind === 'rise_pct' || kind === 'fall_pct') && threshold > 500) fail('Percentage must be 500 or less.');
    if (kind === 'fall_pct' && threshold >= 100) fail('A price cannot fall by 100% or more.');
    if (kind === 'below' && mp.price <= threshold) fail(`The price is already at or below ${threshold.toLocaleString()} CR.`);
    if (kind === 'above' && mp.price >= threshold) fail(`The price is already at or above ${threshold.toLocaleString()} CR.`);
  } else if (isSupplyLimited(mp)) {
    fail('Supply is already limited for this product.');
  }
  const a: PriceAlert = {
    id: nextId(s, 'alert'),
    productId,
    kind,
    threshold: kind === 'supply_limited' ? 0 : Math.round(threshold * 100) / 100,
    basePrice: mp.price,
    createdAt: s.clock.t,
    active: true,
  };
  s.alerts.unshift(a);
  s.counters.alertsCreated++;
  return a;
}
