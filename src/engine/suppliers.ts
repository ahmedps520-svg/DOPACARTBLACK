import type { CategoryId, GameState, ProductDef, Rarity } from './types';
import { PRODUCTS } from './catalog';
import { RARITY_RANK } from './categories';
import { hashRand } from './rng';
import { dayOf } from './time';

export interface SupplierDef {
  id: string;
  name: string;
  tagline: string;
  categories: CategoryId[];
  /** Highest rarity this supplier can source. */
  maxRarity: Rarity;
  /** Wholesale price as a fraction of the market price at order time. */
  priceRate: number;
  /** Planned delivery time in in-game days (before upgrades / events). */
  deliveryDays: number;
  /** Probability an order arrives on time. */
  reliability: number;
  /** Minimum units per product line. */
  moq: number;
  /** Units this supplier can ship to you per in-game day. */
  capacityPerDay: number;
  /** Flat freight charge per order. */
  shipping: number;
  unlockLevel: number;
  /** Share of eligible catalog this supplier stocks. */
  stockShare: number;
  strengths: string[];
  weaknesses: string[];
  monogram: string;
}

export const SUPPLIERS: SupplierDef[] = [
  {
    id: 'quickship',
    name: 'Quickship Express',
    tagline: 'Same-day freight for everyday stock.',
    categories: ['electronics', 'fashion', 'gaming', 'lifestyle'],
    maxRarity: 'uncommon',
    priceRate: 0.84,
    deliveryDays: 0.25,
    reliability: 0.99,
    moq: 2,
    capacityPerDay: 60,
    shipping: 45,
    unlockLevel: 1,
    stockShare: 0.85,
    strengths: ['6-hour delivery', '99% on-time', 'Tiny minimums'],
    weaknesses: ['Thin margins', 'Commons & uncommons only'],
    monogram: 'QX',
  },
  {
    id: 'northgate',
    name: 'Northgate Distribution',
    tagline: 'Reliable regional wholesale for tech and home.',
    categories: ['electronics', 'lifestyle'],
    maxRarity: 'rare',
    priceRate: 0.74,
    deliveryDays: 1.5,
    reliability: 0.94,
    moq: 5,
    capacityPerDay: 120,
    shipping: 30,
    unlockLevel: 1,
    stockShare: 0.8,
    strengths: ['Balanced pricing', 'High reliability'],
    weaknesses: ['No fashion or gaming'],
    monogram: 'NG',
  },
  {
    id: 'apex',
    name: 'Apex Gaming Wholesale',
    tagline: 'Peripherals and consoles by the pallet.',
    categories: ['gaming', 'electronics'],
    maxRarity: 'rare',
    priceRate: 0.71,
    deliveryDays: 1,
    reliability: 0.9,
    moq: 4,
    capacityPerDay: 100,
    shipping: 35,
    unlockLevel: 2,
    stockShare: 0.75,
    strengths: ['Fast for wholesale', 'Strong gaming range'],
    weaknesses: ['Occasional delays'],
    monogram: 'AG',
  },
  {
    id: 'shenwa',
    name: 'Shenwa Bulk Trading Co.',
    tagline: 'Rock-bottom prices if you can wait.',
    categories: ['electronics', 'gaming', 'lifestyle'],
    maxRarity: 'uncommon',
    priceRate: 0.6,
    deliveryDays: 3,
    reliability: 0.72,
    moq: 10,
    capacityPerDay: 250,
    shipping: 20,
    unlockLevel: 3,
    stockShare: 0.7,
    strengths: ['Lowest unit cost', 'Huge capacity'],
    weaknesses: ['Slow', '28% chance of delay', 'High minimums'],
    monogram: 'SW',
  },
  {
    id: 'velour',
    name: 'Velour Atelier Supply',
    tagline: 'Runway fashion, sourced direct.',
    categories: ['fashion'],
    maxRarity: 'rare',
    priceRate: 0.68,
    deliveryDays: 2,
    reliability: 0.88,
    moq: 6,
    capacityPerDay: 90,
    shipping: 30,
    unlockLevel: 4,
    stockShare: 0.85,
    strengths: ['Deep fashion discounts', 'Rare sneakers'],
    weaknesses: ['Fashion only'],
    monogram: 'VA',
  },
  {
    id: 'meridian',
    name: 'Meridian Home Collective',
    tagline: 'Furniture, fitness and everyday premium.',
    categories: ['lifestyle'],
    maxRarity: 'rare',
    priceRate: 0.66,
    deliveryDays: 2.5,
    reliability: 0.85,
    moq: 8,
    capacityPerDay: 120,
    shipping: 40,
    unlockLevel: 5,
    stockShare: 0.9,
    strengths: ['Strong lifestyle margins'],
    weaknesses: ['Bulky, slow freight'],
    monogram: 'MH',
  },
  {
    id: 'vanta',
    name: 'Vanta Luxe Imports',
    tagline: 'Discreet access to prestige goods.',
    categories: ['luxury', 'fashion', 'lifestyle'],
    maxRarity: 'epic',
    priceRate: 0.8,
    deliveryDays: 1,
    reliability: 0.98,
    moq: 1,
    capacityPerDay: 12,
    shipping: 120,
    unlockLevel: 10,
    stockShare: 0.7,
    strengths: ['Sources Rare & Epic luxury', 'White-glove reliability'],
    weaknesses: ['Premium pricing', 'Very limited capacity'],
    monogram: 'VL',
  },
];

export const SUPPLIER_BY_ID: Record<string, SupplierDef> = Object.fromEntries(SUPPLIERS.map((s) => [s.id, s]));

/** Products a supplier stocks (deterministic per supplier; limited editions never). */
export function supplierCatalog(sup: SupplierDef): ProductDef[] {
  return PRODUCTS.filter(
    (p) =>
      !p.limited &&
      sup.categories.includes(p.category) &&
      RARITY_RANK[p.rarity] <= RARITY_RANK[sup.maxRarity] &&
      hashRand('stock', sup.id, p.id) < sup.stockShare,
  );
}

/** Today's special offer: one stocked, listed product at an extra discount. */
export function specialOffer(
  s: Pick<GameState, 'seed' | 'clock' | 'market'>,
  sup: SupplierDef,
): { productId: string; discount: number } | undefined {
  const day = dayOf(s.clock.t);
  const stock = supplierCatalog(sup).filter((p) => s.market[p.id]?.listed);
  if (stock.length === 0) return undefined;
  const idx = Math.floor(hashRand(s.seed, 'offer', sup.id, day) * stock.length);
  return { productId: stock[idx].id, discount: 0.12 };
}

/** Volume discount for a line, given the supplier's minimum order. */
export function volumeDiscount(sup: SupplierDef, qty: number): number {
  if (qty >= sup.moq * 8) return 0.08;
  if (qty >= sup.moq * 3) return 0.04;
  return 0;
}
