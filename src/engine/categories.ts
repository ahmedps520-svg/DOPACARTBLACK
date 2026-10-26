import type { CategoryDef, CategoryId, Rarity, SubcategoryId } from './types';

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'electronics',
    label: 'Electronics',
    tagline: 'Flagship devices with fast-moving prices.',
    subcategories: [
      { id: 'smartphones', label: 'Smartphones' },
      { id: 'laptops', label: 'Laptops' },
      { id: 'consoles', label: 'Gaming Consoles' },
      { id: 'headphones', label: 'Headphones' },
      { id: 'cameras', label: 'Cameras' },
      { id: 'components', label: 'Computer Components' },
      { id: 'smartwatches', label: 'Smartwatches' },
    ],
  },
  {
    id: 'fashion',
    label: 'Fashion',
    tagline: 'Hype cycles, drops and collector frenzies.',
    subcategories: [
      { id: 'sneakers', label: 'Sneakers' },
      { id: 'clothing', label: 'Clothing' },
      { id: 'bags', label: 'Bags' },
      { id: 'accessories', label: 'Accessories' },
      { id: 'watches', label: 'Watches' },
    ],
  },
  {
    id: 'gaming',
    label: 'Gaming',
    tagline: 'Gear that surges with every tournament.',
    subcategories: [
      { id: 'controllers', label: 'Controllers' },
      { id: 'headsets', label: 'Gaming Headsets' },
      { id: 'keyboards', label: 'Gaming Keyboards' },
      { id: 'mice', label: 'Gaming Mice' },
      { id: 'monitors', label: 'Monitors' },
      { id: 'chairs', label: 'Gaming Chairs' },
    ],
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    tagline: 'Steady demand, dependable margins.',
    subcategories: [
      { id: 'furniture', label: 'Furniture' },
      { id: 'home', label: 'Home Accessories' },
      { id: 'fitness', label: 'Fitness Equipment' },
      { id: 'collectibles', label: 'Collectibles' },
      { id: 'everyday', label: 'Premium Everyday' },
    ],
  },
  {
    id: 'luxury',
    label: 'Luxury',
    tagline: 'Scarce, volatile, unforgiving.',
    subcategories: [
      { id: 'luxury-watches', label: 'Prestige Watches' },
      { id: 'luxury-accessories', label: 'Designer Accessories' },
      { id: 'luxury-collectibles', label: 'Collectible Pieces' },
      { id: 'limited-editions', label: 'Limited Editions' },
    ],
  },
];

export const CATEGORY_BY_ID: Record<CategoryId, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryDef>;

export const SUBCATEGORY_LABEL: Record<SubcategoryId, string> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.subcategories.map((s) => [s.id, s.label])),
) as Record<SubcategoryId, string>;

export const SUBCATEGORY_PARENT: Record<SubcategoryId, CategoryId> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.subcategories.map((s) => [s.id, c.id])),
) as Record<SubcategoryId, CategoryId>;

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'exclusive'];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  exclusive: 'Exclusive',
};

export const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  exclusive: 5,
};
