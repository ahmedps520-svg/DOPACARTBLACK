import type { GameState } from './types';
import { fail, money } from './ledger';
import { availableQty } from './selectors';

/** Add units to the warehouse at a unit cost (weighted-average costing). */
export function addHolding(s: GameState, productId: string, qty: number, unitCost: number) {
  const h = s.holdings[productId];
  if (h) {
    const total = h.qty * h.avgCost + qty * unitCost;
    h.qty += qty;
    h.avgCost = money(total / h.qty);
    h.lastAcquiredAt = s.clock.t;
  } else {
    s.holdings[productId] = {
      productId,
      qty,
      avgCost: money(unitCost),
      firstAcquiredAt: s.clock.t,
      lastAcquiredAt: s.clock.t,
    };
  }
}

/**
 * Remove units and return their cost basis. `fromListing` skips the
 * "not reserved by a listing" check because the units come from that listing.
 */
export function removeHolding(s: GameState, productId: string, qty: number, fromListing = false): number {
  const h = s.holdings[productId];
  if (!h || h.qty < qty) fail(`You only own ${h?.qty ?? 0} unit${h?.qty === 1 ? '' : 's'}.`);
  if (!fromListing) {
    const avail = availableQty(s, productId);
    if (avail < qty) fail(`Only ${avail} unit${avail === 1 ? ' is' : 's are'} free — the rest are reserved by store listings.`);
  }
  const basis = money(h.avgCost * qty);
  h.qty -= qty;
  if (h.qty === 0) delete s.holdings[productId];
  return basis;
}
