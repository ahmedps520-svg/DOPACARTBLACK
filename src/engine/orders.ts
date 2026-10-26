/**
 * Supplier orders and simulated delivery. An order's status is a real state
 * machine driven by the game clock: inventory is only added when the
 * delivery time has elapsed, including after the game was closed.
 */
import type { GameState, Order, OrderLine, OrderStatus } from './types';
import { MAX_ORDER_QTY, CANCEL_RESTOCKING_FEE, TICK_MINUTES, MINUTES_PER_DAY } from './constants';
import { SUPPLIER_BY_ID, supplierCatalog, specialOffer, volumeDiscount, type SupplierDef } from './suppliers';
import { PRODUCT_BY_ID } from './catalog';
import { fail, money, nextId, notify, recordTx } from './ledger';
import { addHolding } from './inventory';
import { capacity, capacityUsed } from './selectors';
import { upgradeValue } from './upgrades';
import { deliveryMultiplier } from './events';
import { chance, randRange } from './rng';
import { dayOf } from './time';
import { addXp, rarityUnlockLevel } from './progression';
import { RARITY_LABEL } from './categories';

export const STATUS_FLOW: OrderStatus[] = ['placed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  processing: 'Processing',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Scheduled in-game time of each status for a supplier order. */
export function statusSchedule(o: Order): Record<Exclude<OrderStatus, 'cancelled'>, number> {
  const p = o.plannedDuration;
  const at = (x: number) => o.placedAt + Math.round(x / TICK_MINUTES) * TICK_MINUTES;
  return {
    placed: o.placedAt,
    processing: at(p * 0.08),
    packed: at(p * 0.25),
    shipped: at(p * 0.4),
    out_for_delivery: at(p * 0.85 + o.delay),
    delivered: at(p + o.delay),
  };
}

export function eta(o: Order): number {
  return statusSchedule(o).delivered;
}

/** True once the order is past its originally promised time. */
export function isDelayed(o: Order, t: number): boolean {
  return o.delay > 0 && t > o.placedAt + o.plannedDuration && o.status !== 'delivered' && o.status !== 'cancelled';
}

export interface CancelTerms {
  allowed: boolean;
  refund: number;
  fee: number;
  rule: string;
}

/**
 * Refund rules:
 *  • Placed / Processing → full refund including freight.
 *  • Packed / Shipped → goods refunded minus a 15% restocking fee; freight is not refunded.
 *  • Out for delivery / Delivered → cannot be cancelled.
 */
export function cancelTerms(o: Order): CancelTerms {
  if (o.kind !== 'supplier') return { allowed: false, refund: 0, fee: 0, rule: 'Instant market purchases are final.' };
  switch (o.status) {
    case 'placed':
    case 'processing':
      return { allowed: true, refund: o.total, fee: 0, rule: 'Not yet packed: full refund including freight.' };
    case 'packed':
    case 'shipped': {
      const fee = money(o.subtotal * CANCEL_RESTOCKING_FEE);
      return {
        allowed: true,
        refund: money(o.subtotal - fee),
        fee: money(fee + o.shipping),
        rule: 'Already packed: 15% restocking fee and freight are not refunded.',
      };
    }
    default:
      return { allowed: false, refund: 0, fee: 0, rule: 'Orders out for delivery or delivered cannot be cancelled.' };
  }
}

export interface QuoteLine extends OrderLine {
  marketPrice: number;
  discount: number;
  lineTotal: number;
  offer: boolean;
}

export interface SupplierQuote {
  lines: QuoteLine[];
  units: number;
  subtotal: number;
  shipping: number;
  total: number;
  plannedDuration: number;
  errors: string[];
}

/** Price, timing and validity of a prospective order (no state change). */
export function quoteSupplierOrder(s: GameState, sup: SupplierDef, lines: { productId: string; qty: number }[]): SupplierQuote {
  const errors: string[] = [];
  const stock = new Set(supplierCatalog(sup).map((p) => p.id));
  const offer = specialOffer(s, sup);
  const out: QuoteLine[] = [];
  let units = 0;
  let deliveryMult = 1;
  for (const l of lines) {
    const def = PRODUCT_BY_ID[l.productId];
    const mp = s.market[l.productId];
    if (!def || !mp) {
      errors.push('Unknown product in order.');
      continue;
    }
    if (!Number.isInteger(l.qty) || l.qty <= 0) {
      errors.push(`${def.name}: enter a whole number of units.`);
      continue;
    }
    if (!stock.has(def.id) || !mp.listed) errors.push(`${sup.name} does not stock ${def.name}.`);
    if (l.qty < sup.moq) errors.push(`${def.name}: minimum order is ${sup.moq} units.`);
    if (l.qty > MAX_ORDER_QTY) errors.push(`${def.name}: maximum ${MAX_ORDER_QTY} units per line.`);
    if (s.progression.level < rarityUnlockLevel(def.rarity))
      errors.push(`${def.name}: ${RARITY_LABEL[def.rarity]} items unlock at level ${rarityUnlockLevel(def.rarity)}.`);
    const isOffer = offer?.productId === def.id;
    const discount = volumeDiscount(sup, l.qty) + (isOffer ? offer!.discount : 0);
    const unitPrice = money(mp.price * sup.priceRate * (1 - discount));
    out.push({ productId: def.id, qty: l.qty, unitPrice, marketPrice: mp.price, discount, lineTotal: money(unitPrice * l.qty), offer: isOffer });
    units += l.qty;
    deliveryMult = Math.max(deliveryMult, deliveryMultiplier(s, def.category));
  }
  if (out.length === 0 && errors.length === 0) errors.push('Add at least one product to the order.');
  const subtotal = money(out.reduce((a, l) => a + l.lineTotal, 0));
  const shipping = out.length ? sup.shipping : 0;
  const total = money(subtotal + shipping);

  const usage = s.supplierUsage[sup.id];
  const usedToday = usage && usage.day === dayOf(s.clock.t) ? usage.units : 0;
  if (units > sup.capacityPerDay - usedToday)
    errors.push(`${sup.name} can only ship ${Math.max(0, sup.capacityPerDay - usedToday)} more units today.`);
  const free = capacity(s) - capacityUsed(s);
  if (units > free) errors.push(`Warehouse full: ${free} unit${free === 1 ? '' : 's'} of space left (in-transit goods reserve space).`);
  if (total > s.wallet.cash) errors.push(`Insufficient funds: order costs ${total.toLocaleString()} CR.`);
  if (s.progression.level < sup.unlockLevel) errors.push(`${sup.name} unlocks at level ${sup.unlockLevel}.`);

  const raw = sup.deliveryDays * MINUTES_PER_DAY * upgradeValue(s, 'logistics') * deliveryMult;
  const plannedDuration = Math.max(TICK_MINUTES * 3, Math.ceil(raw / TICK_MINUTES) * TICK_MINUTES);
  return { lines: out, units, subtotal, shipping, total, plannedDuration, errors };
}

export function placeSupplierOrder(s: GameState, supplierId: string, lines: { productId: string; qty: number }[], key: string): Order {
  const sup = SUPPLIER_BY_ID[supplierId];
  if (!sup) fail('Unknown supplier.');
  const q = quoteSupplierOrder(s, sup, lines);
  if (q.errors.length) fail(q.errors[0]);

  const delay = chance(s, 1 - sup.reliability)
    ? Math.round((q.plannedDuration * randRange(s, 0.25, 0.75)) / TICK_MINUTES) * TICK_MINUTES
    : 0;
  const order: Order = {
    id: nextId(s, 'order'),
    kind: 'supplier',
    supplierId,
    lines: q.lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
    subtotal: q.subtotal,
    shipping: q.shipping,
    total: q.total,
    placedAt: s.clock.t,
    plannedDuration: q.plannedDuration,
    delay,
    status: 'placed',
    history: [{ status: 'placed', t: s.clock.t }],
    idempotencyKey: key,
  };
  recordTx(s, {
    type: 'supplier_order',
    total: -q.total,
    qty: q.units,
    memo: `Supplier order ${order.id} · ${sup.name} · ${q.units} units (incl. ${q.shipping} CR freight)`,
    orderId: order.id,
  });
  const day = dayOf(s.clock.t);
  const usage = s.supplierUsage[sup.id];
  s.supplierUsage[sup.id] = { day, units: (usage && usage.day === day ? usage.units : 0) + q.units };
  s.orders.unshift(order);
  s.counters.supplierOrdersPlaced++;
  return order;
}

function receive(s: GameState, o: Order) {
  const units = o.lines.reduce((a, l) => a + l.qty, 0);
  const freightPerUnit = units > 0 ? o.shipping / units : 0;
  for (const l of o.lines) addHolding(s, l.productId, l.qty, l.unitPrice + freightPerUnit);
  s.counters.supplierOrdersDelivered++;
  const sup = o.supplierId ? SUPPLIER_BY_ID[o.supplierId] : undefined;
  notify(s, 'order', `Order ${o.id} delivered`, `${units} units from ${sup?.name ?? 'supplier'} are now in your inventory.`, `/orders/${o.id}`);
  addXp(s, 15, 'a completed supplier order');
}

/** Move every active supplier order through its schedule up to time `t`. */
export function advanceOrders(s: GameState, t: number) {
  for (const o of s.orders) {
    if (o.kind !== 'supplier' || o.status === 'delivered' || o.status === 'cancelled') continue;
    const sched = statusSchedule(o);
    let idx = STATUS_FLOW.indexOf(o.status);
    while (idx < STATUS_FLOW.length - 1) {
      const next = STATUS_FLOW[idx + 1] as Exclude<OrderStatus, 'cancelled'>;
      if (sched[next] > t) break;
      o.status = next;
      o.history.push({ status: next, t: sched[next] });
      idx++;
      if (next === 'shipped' && o.delay > 0) {
        notify(s, 'order', `Order ${o.id} delayed`, 'The supplier reported a delay in transit. A new delivery estimate is on the tracking page.', `/orders/${o.id}`);
      }
      if (next === 'delivered') receive(s, o);
    }
  }
}

export function cancelOrder(s: GameState, orderId: string) {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) fail('Order not found.');
  if (o.status === 'cancelled') fail('This order is already cancelled.');
  const terms = cancelTerms(o);
  if (!terms.allowed) fail(terms.rule);
  o.status = 'cancelled';
  o.history.push({ status: 'cancelled', t: s.clock.t });
  o.refund = terms.refund;
  o.cancelFee = terms.fee;
  recordTx(s, {
    type: 'refund',
    total: terms.refund,
    memo: `Refund for cancelled order ${o.id}${terms.fee > 0 ? ` (${terms.fee.toLocaleString()} CR non-refundable)` : ''}`,
    orderId: o.id,
  });
  if (terms.fee > 0) s.wallet.operatingExpenses = money(s.wallet.operatingExpenses + terms.fee);
}
