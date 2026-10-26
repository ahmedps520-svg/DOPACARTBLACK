import type { GameState, UpgradeId } from './types';
import { MARKET_FEE_BASE, BASE_STORE_CATEGORIES } from './constants';

export interface UpgradeLevel {
  cost: number;
  /** Player level required to buy this tier. */
  requiredLevel: number;
  value: number;
  benefit: string;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  summary: string;
  /** Value with no upgrade purchased. */
  base: number;
  format: (v: number) => string;
  levels: UpgradeLevel[];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const mult = (v: number) => `×${v.toFixed(2)}`;

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'warehouse',
    name: 'Warehouse Expansion',
    summary: 'Raises the total units you can hold, including goods in transit.',
    base: 60,
    format: (v) => `${v.toLocaleString()} units`,
    levels: [
      { cost: 900, requiredLevel: 1, value: 150, benefit: 'Capacity 60 → 150 units' },
      { cost: 3_000, requiredLevel: 4, value: 300, benefit: 'Capacity 150 → 300 units' },
      { cost: 8_000, requiredLevel: 8, value: 600, benefit: 'Capacity 300 → 600 units' },
      { cost: 20_000, requiredLevel: 15, value: 1_200, benefit: 'Capacity 600 → 1,200 units' },
      { cost: 50_000, requiredLevel: 25, value: 2_500, benefit: 'Capacity 1,200 → 2,500 units' },
    ],
  },
  {
    id: 'photography',
    name: 'Studio Photography',
    summary: 'Better product shots convert more store visitors into buyers.',
    base: 1,
    format: (v) => `${mult(v)} conversion`,
    levels: [
      { cost: 600, requiredLevel: 1, value: 1.15, benefit: 'Store conversion +15%' },
      { cost: 2_500, requiredLevel: 5, value: 1.3, benefit: 'Store conversion +30%' },
      { cost: 7_000, requiredLevel: 12, value: 1.45, benefit: 'Store conversion +45%' },
    ],
  },
  {
    id: 'visibility',
    name: 'Storefront Visibility',
    summary: 'Featured placement and ads bring more visitors to every store.',
    base: 1,
    format: (v) => `${mult(v)} traffic`,
    levels: [
      { cost: 1_200, requiredLevel: 2, value: 1.3, benefit: 'Store traffic +30%' },
      { cost: 3_500, requiredLevel: 6, value: 1.6, benefit: 'Store traffic +60%' },
      { cost: 9_000, requiredLevel: 12, value: 1.9, benefit: 'Store traffic +90%' },
      { cost: 22_000, requiredLevel: 20, value: 2.2, benefit: 'Store traffic +120%' },
    ],
  },
  {
    id: 'logistics',
    name: 'Express Logistics',
    summary: 'Priority freight contracts shorten every supplier delivery.',
    base: 1,
    format: (v) => `${pct(1 - v)} faster`,
    levels: [
      { cost: 1_500, requiredLevel: 3, value: 0.85, benefit: 'Supplier deliveries 15% faster' },
      { cost: 4_500, requiredLevel: 8, value: 0.72, benefit: 'Supplier deliveries 28% faster' },
      { cost: 12_000, requiredLevel: 16, value: 0.6, benefit: 'Supplier deliveries 40% faster' },
    ],
  },
  {
    id: 'listings',
    name: 'Listing Slots',
    summary: 'More simultaneous product listings in each of your stores.',
    base: 3,
    format: (v) => `${v} listings per store`,
    levels: [
      { cost: 1_000, requiredLevel: 1, value: 6, benefit: 'Listings per store 3 → 6' },
      { cost: 4_000, requiredLevel: 6, value: 10, benefit: 'Listings per store 6 → 10' },
      { cost: 11_000, requiredLevel: 14, value: 16, benefit: 'Listings per store 10 → 16' },
      { cost: 26_000, requiredLevel: 24, value: 24, benefit: 'Listings per store 16 → 24' },
    ],
  },
  {
    id: 'operations',
    name: 'Lean Operations',
    summary: 'Automation and better leases cut the daily operating cost of stores.',
    base: 1,
    format: (v) => `${pct(1 - v)} lower costs`,
    levels: [
      { cost: 1_500, requiredLevel: 4, value: 0.8, benefit: 'Operating costs −20%' },
      { cost: 5_000, requiredLevel: 10, value: 0.62, benefit: 'Operating costs −38%' },
      { cost: 14_000, requiredLevel: 20, value: 0.45, benefit: 'Operating costs −55%' },
    ],
  },
  {
    id: 'seller',
    name: 'Trusted Seller Program',
    summary: 'Verified status lowers the marketplace fee on instant market sales.',
    base: MARKET_FEE_BASE,
    format: (v) => `${(v * 100).toFixed(2).replace(/\.?0+$/, '')}% market fee`,
    levels: [
      { cost: 2_000, requiredLevel: 5, value: 0.03, benefit: 'Market sale fee 4% → 3%' },
      { cost: 7_000, requiredLevel: 14, value: 0.02, benefit: 'Market sale fee 3% → 2%' },
      { cost: 18_000, requiredLevel: 30, value: 0.0125, benefit: 'Market sale fee 2% → 1.25%' },
    ],
  },
  {
    id: 'analytics',
    name: 'Advanced Analytics',
    summary: 'Deeper business intelligence for sharper decisions.',
    base: 0,
    format: (v) => (v >= 2 ? 'Market intelligence' : v >= 1 ? 'Advanced analytics' : 'Basic analytics'),
    levels: [
      {
        cost: 1_800,
        requiredLevel: 3,
        value: 1,
        benefit: 'Unlocks margins, inventory turnover, slow-mover detection and recommendations',
      },
      {
        cost: 6_000,
        requiredLevel: 12,
        value: 2,
        benefit: 'Unlocks the fair-value gauge on product pages and the rival activity feed',
      },
    ],
  },
  {
    id: 'licenses',
    name: 'Category Licenses',
    summary: 'Each license lets your stores sell one more product category.',
    base: BASE_STORE_CATEGORIES,
    format: (v) => `${v} store categories`,
    levels: [
      { cost: 1_500, requiredLevel: 2, value: 3, benefit: 'Store categories 2 → 3' },
      { cost: 4_500, requiredLevel: 7, value: 4, benefit: 'Store categories 3 → 4' },
      { cost: 10_000, requiredLevel: 12, value: 5, benefit: 'Store categories 4 → 5 (all)' },
    ],
  },
];

export const UPGRADE_BY_ID: Record<UpgradeId, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, UpgradeDef>;

/** Current effective value of an upgrade for a player. */
export function upgradeValue(s: Pick<GameState, 'upgrades'>, id: UpgradeId): number {
  const def = UPGRADE_BY_ID[id];
  const lvl = s.upgrades[id] ?? 0;
  return lvl <= 0 ? def.base : def.levels[Math.min(lvl, def.levels.length) - 1].value;
}

export function nextUpgradeLevel(s: Pick<GameState, 'upgrades'>, id: UpgradeId): UpgradeLevel | undefined {
  return UPGRADE_BY_ID[id].levels[s.upgrades[id] ?? 0];
}

export function emptyUpgrades(): Record<UpgradeId, number> {
  return Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Record<UpgradeId, number>;
}
