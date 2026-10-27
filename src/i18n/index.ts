import { useGame } from '../state/gameStore';

/**
 * Lightweight UI dictionary. Navigation, header and primary actions are
 * translated; long-form game text (product descriptions, news) stays in
 * English.
 */
const DICT = {
  en: {
    dashboard: 'Dashboard',
    market: 'Market',
    collection: 'Collection',
    cart: 'Cart',
    inventory: 'Inventory',
    store: 'My Store',
    suppliers: 'Suppliers',
    orders: 'Orders',
    analytics: 'Analytics',
    trading: 'Trading Floor',
    news: 'Newsroom',
    wallet: 'Wallet',
    missions: 'Missions',
    leaderboard: 'Leaderboard',
    settings: 'Settings',
    shop: 'Shop',
    business: 'Business',
    markets: 'Markets',
    player: 'Player',
    balance: 'Balance',
    search: 'Search products, brands, categories…',
    notifications: 'Notifications',
    more: 'More',
    home: 'Home',
    buy: 'Buy product',
    sell: 'Sell',
    addToCart: 'Add to cart',
    enterMarket: 'Enter the market',
    virtual: 'Virtual credits · game only',
  },
  es: {
    dashboard: 'Panel',
    market: 'Mercado',
    collection: 'Colección',
    cart: 'Carrito',
    inventory: 'Inventario',
    store: 'Mi tienda',
    suppliers: 'Proveedores',
    orders: 'Pedidos',
    analytics: 'Analítica',
    trading: 'Sala de trading',
    news: 'Noticias',
    wallet: 'Cartera',
    missions: 'Misiones',
    leaderboard: 'Clasificación',
    settings: 'Ajustes',
    shop: 'Comprar',
    business: 'Negocio',
    markets: 'Mercados',
    player: 'Jugador',
    balance: 'Saldo',
    search: 'Buscar productos, marcas, categorías…',
    notifications: 'Notificaciones',
    more: 'Más',
    home: 'Inicio',
    buy: 'Comprar producto',
    sell: 'Vender',
    addToCart: 'Añadir al carrito',
    enterMarket: 'Entrar al mercado',
    virtual: 'Créditos virtuales · solo juego',
  },
} as const;

export type I18nKey = keyof (typeof DICT)['en'];

export function useT() {
  const lang = useGame((s) => s.game?.settings.language ?? 'en');
  return (k: I18nKey) => DICT[lang][k] ?? DICT.en[k];
}
