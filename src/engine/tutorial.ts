import type { GameState } from './types';
import { notify } from './ledger';
import { addXp } from './progression';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  route: string;
  routeLabel: string;
  /** manual = "Next" button; visit = open a page; state = real game action. */
  kind: 'manual' | 'visit' | 'state';
  page?: string;
  done?: (s: GameState) => boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'capital',
    title: 'Your starting capital',
    body: 'Your wallet holds virtual credits (CR). They are game currency only — nothing here costs or pays real money. Spend them wisely: cash is the only thing that buys stock.',
    route: '/wallet',
    routeLabel: 'View wallet',
    kind: 'manual',
  },
  {
    id: 'browse',
    title: 'Browse the marketplace',
    body: 'Open the Market to see every product, its live price, demand and supply. Prices move every 10 in-game minutes.',
    route: '/market',
    routeLabel: 'Open the Market',
    kind: 'visit',
    page: 'market',
  },
  {
    id: 'buy',
    title: 'Buy your first product',
    body: 'Pick an affordable Common or Uncommon item, open it and press BUY PRODUCT. Your balance, inventory and transaction history update instantly.',
    route: '/market',
    routeLabel: 'Find a product',
    kind: 'state',
    done: (s) => s.counters.purchases >= 1,
  },
  {
    id: 'inventory',
    title: 'Inspect your inventory',
    body: 'Your inventory shows what you own, what you paid on average and what it is worth at today’s market price.',
    route: '/inventory',
    routeLabel: 'Open inventory',
    kind: 'visit',
    page: 'inventory',
  },
  {
    id: 'sell',
    title: 'Sell a product',
    body: 'Sell a unit instantly to the market. Market buyers pay the bid price (a small spread under market) minus a marketplace fee — your store can do better, but more slowly.',
    route: '/inventory',
    routeLabel: 'Sell from inventory',
    kind: 'state',
    done: (s) => s.counters.unitsSold >= 1,
  },
  {
    id: 'review',
    title: 'Review your profit or loss',
    body: 'Open the Wallet: realized profit is what you actually banked. An instant flip usually loses a little to spread and fees — profit comes from cheaper sourcing, store margins and good timing.',
    route: '/wallet',
    routeLabel: 'Open wallet',
    kind: 'visit',
    page: 'wallet',
  },
  {
    id: 'charts',
    title: 'Explore the market charts',
    body: 'The Trading Floor charts recorded price history, compares products and lets you set alerts. Events in the Newsroom change supply and demand.',
    route: '/trading',
    routeLabel: 'Open Trading Floor',
    kind: 'visit',
    page: 'trading',
  },
  {
    id: 'upgrade',
    title: 'Unlock your first business upgrade',
    body: 'Upgrades change real mechanics — Studio Photography, for example, lifts store conversion by 15%. Buy any upgrade in your Store.',
    route: '/store?tab=upgrades',
    routeLabel: 'View upgrades',
    kind: 'state',
    done: (s) => s.counters.upgradesBought >= 1,
  },
];

function finish(s: GameState) {
  s.tutorial.done = true;
  s.tutorial.active = false;
  notify(s, 'system', 'Tutorial complete', 'You know the core loop. Next: open your store, source stock from suppliers and grow your net worth.', '/missions');
  addXp(s, 100, 'finishing the tutorial');
}

/** Advance past any steps whose real-game condition is already satisfied. */
export function tutorialCheck(s: GameState) {
  const tu = s.tutorial;
  while (tu.active && !tu.done) {
    const step = TUTORIAL_STEPS[tu.step];
    if (!step) {
      finish(s);
      return;
    }
    if (step.kind === 'state' && step.done?.(s)) tu.step++;
    else return;
  }
}

export function tutorialVisit(s: GameState, page: string) {
  if (!s.visited.includes(page)) s.visited.push(page);
  const tu = s.tutorial;
  if (!tu.active) return;
  const step = TUTORIAL_STEPS[tu.step];
  if (step?.kind === 'visit' && step.page === page) {
    tu.step++;
    if (tu.step >= TUTORIAL_STEPS.length) finish(s);
  }
}

export function tutorialNext(s: GameState) {
  const tu = s.tutorial;
  const step = TUTORIAL_STEPS[tu.step];
  if (!tu.active || step?.kind !== 'manual') return;
  tu.step++;
  if (tu.step >= TUTORIAL_STEPS.length) finish(s);
}
