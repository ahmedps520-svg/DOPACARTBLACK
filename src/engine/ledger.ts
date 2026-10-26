/**
 * Centralised transaction system. Every change to the player's cash goes
 * through `recordTx`, which validates the balance, applies the delta,
 * updates the wallet aggregates and appends an auditable record.
 */
import type { GameNotification, GameState, NotificationKind, Transaction, TxType } from './types';

export class GameError extends Error {}

/** Abort the current command with a player-facing message. */
export function fail(message: string): never {
  throw new GameError(message);
}

export const money = (x: number) => Math.round(x * 100) / 100;

export const MAX_TRANSACTIONS = 20_000;
export const MAX_NOTIFICATIONS = 150;

type Seq = keyof GameState['seq'];

export function nextId(s: GameState, kind: Seq): string {
  const n = ++s.seq[kind];
  switch (kind) {
    case 'tx':
      return `TX-${String(n).padStart(6, '0')}`;
    case 'order':
      return `DC-${100000 + n}`;
    case 'note':
      return `N-${n}`;
    case 'event':
      return `EV-${n}`;
    case 'alert':
      return `AL-${n}`;
    case 'listing':
      return `LS-${n}`;
  }
}

export interface TxInput {
  type: TxType;
  total: number;
  memo: string;
  productId?: string;
  qty?: number;
  unitPrice?: number;
  costBasis?: number;
  realizedPnl?: number;
  orderId?: string;
  storeId?: string;
  relatedTx?: string;
}

export function recordTx(s: GameState, input: TxInput): Transaction {
  const total = money(input.total);
  if (!Number.isFinite(total)) fail('Invalid transaction amount.');
  const next = money(s.wallet.cash + total);
  if (next < 0) fail(`Insufficient funds: this needs ${fmt(-total)} but you have ${fmt(s.wallet.cash)}.`);
  s.wallet.cash = next;

  const w = s.wallet;
  switch (input.type) {
    case 'purchase':
    case 'supplier_order':
      w.lifetimeSpending = money(w.lifetimeSpending - total);
      break;
    case 'sale':
    case 'store_sale':
      w.lifetimeRevenue = money(w.lifetimeRevenue + total);
      w.realizedProfit = money(w.realizedProfit + (input.realizedPnl ?? 0));
      break;
    case 'fee':
      w.lifetimeSpending = money(w.lifetimeSpending - total);
      w.sellingFees = money(w.sellingFees - total);
      break;
    case 'operating_cost':
      w.lifetimeSpending = money(w.lifetimeSpending - total);
      w.operatingExpenses = money(w.operatingExpenses - total);
      break;
    case 'upgrade':
    case 'store_open':
      w.lifetimeSpending = money(w.lifetimeSpending - total);
      w.investments = money(w.investments - total);
      break;
    case 'refund':
      w.lifetimeSpending = money(w.lifetimeSpending - total);
      break;
    case 'reward':
      w.rewards = money(w.rewards + total);
      break;
    case 'starting_balance':
      break;
  }

  const tx: Transaction = {
    id: nextId(s, 'tx'),
    t: s.clock.t,
    real: Date.now(),
    type: input.type,
    productId: input.productId,
    qty: input.qty,
    unitPrice: input.unitPrice !== undefined ? money(input.unitPrice) : undefined,
    total,
    balanceAfter: next,
    memo: input.memo,
    costBasis: input.costBasis !== undefined ? money(input.costBasis) : undefined,
    realizedPnl: input.realizedPnl !== undefined ? money(input.realizedPnl) : undefined,
    orderId: input.orderId,
    storeId: input.storeId,
    relatedTx: input.relatedTx,
  };
  s.transactions.push(tx);
  if (s.transactions.length > MAX_TRANSACTIONS) s.transactions.splice(0, s.transactions.length - MAX_TRANSACTIONS);
  return tx;
}

export function notify(
  s: GameState,
  kind: NotificationKind,
  title: string,
  body: string,
  link?: string,
): GameNotification | undefined {
  if (kind !== 'system' && s.settings.notify[kind] === false) return undefined;
  const n: GameNotification = { id: nextId(s, 'note'), t: s.clock.t, real: Date.now(), kind, title, body, link, read: false };
  s.notifications.unshift(n);
  if (s.notifications.length > MAX_NOTIFICATIONS) s.notifications.length = MAX_NOTIFICATIONS;
  return n;
}

export function fmt(x: number): string {
  return `${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CR`;
}
