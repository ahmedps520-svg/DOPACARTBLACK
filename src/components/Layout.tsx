import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ShoppingCart,
  Search,
  LayoutDashboard,
  Store,
  Package,
  Truck,
  BarChart3,
  LineChart,
  Newspaper,
  Wallet,
  Target,
  Trophy,
  Settings as SettingsIcon,
  Gem,
  Factory,
  ShoppingBag,
  Menu,
  ChevronDown,
  Pause,
  Play,
  Check,
  Plus,
  X,
  Share2,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from './Logo';
import { useGame, useGameState } from '../state/gameStore';
import { useT, type I18nKey } from '../i18n';
import { PRODUCTS } from '../engine/catalog';
import { CATEGORY_BY_ID, SUBCATEGORY_LABEL } from '../engine/categories';
import { formatClock, dayOf, formatAgo } from '../engine/time';
import { cr, initials } from '../lib/format';
import { ProductThumb } from './ProductCard';
import { markNotificationsRead, clearNotifications, setActiveStore, updateSettings, visitPage } from '../engine/commands';
import { MISSIONS, evaluateDaily, titleForLevel, xpForLevel } from '../engine/progression';
import { useAction } from '../lib/hooks';
import { Toasts } from './Toasts';
import { TutorialCoach } from './TutorialCoach';
import { OfflineReportModal } from './OfflineReport';
import { STORE_THEMES } from '../engine/progression';
import type { Speed } from '../engine/types';
import { Meter } from './ui';

interface NavItem {
  to: string;
  key: I18nKey;
  icon: typeof Bell;
  pill?: 'orders' | 'missions' | 'cart';
}

const NAV: { title: I18nKey; items: NavItem[] }[] = [
  {
    title: 'shop',
    items: [
      { to: '/', key: 'dashboard', icon: LayoutDashboard },
      { to: '/market', key: 'market', icon: ShoppingBag },
      { to: '/collection', key: 'collection', icon: Gem },
      { to: '/cart', key: 'cart', icon: ShoppingCart, pill: 'cart' },
    ],
  },
  {
    title: 'business',
    items: [
      { to: '/inventory', key: 'inventory', icon: Package },
      { to: '/store', key: 'store', icon: Store },
      { to: '/suppliers', key: 'suppliers', icon: Factory },
      { to: '/orders', key: 'orders', icon: Truck, pill: 'orders' },
      { to: '/analytics', key: 'analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'markets',
    items: [
      { to: '/trading', key: 'trading', icon: LineChart },
      { to: '/news', key: 'news', icon: Newspaper },
    ],
  },
  {
    title: 'player',
    items: [
      { to: '/wallet', key: 'wallet', icon: Wallet },
      { to: '/missions', key: 'missions', icon: Target, pill: 'missions' },
      { to: '/leaderboard', key: 'leaderboard', icon: Trophy },
      { to: '/settings', key: 'settings', icon: SettingsIcon },
    ],
  },
];

const PAGE_IDS: Record<string, string> = {
  '/market': 'market',
  '/inventory': 'inventory',
  '/wallet': 'wallet',
  '/trading': 'trading',
  '/store': 'store',
  '/news': 'news',
};

export const AVATAR_COLORS = ['#e5132f', '#d4af37', '#5ab0ff', '#3ddc97', '#b36bff', '#ff7a59', '#9ca3af', '#f4f4f5'];

function usePills() {
  const activeOrders = useGameState((s) => s.orders.filter((o) => o.kind === 'supplier' && o.status !== 'delivered' && o.status !== 'cancelled').length);
  const cart = useGameState((s) => s.cart.reduce((a, l) => a + l.qty, 0));
  const game = useGameState((s) => s);
  const claimable = useMemo(() => {
    let n = 0;
    for (const m of MISSIONS) {
      const st = game.progression.missions[m.id];
      if (st?.completedAt !== undefined && st.claimedAt === undefined) n++;
    }
    for (const id of game.progression.daily.ids) {
      if (!game.progression.daily.claimed.includes(id)) {
        const d = evaluateDaily(game, id);
        if (d.current >= d.target) n++;
      }
    }
    return n;
    // Recompute when progression or ledger changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.progression, game.transactions, game.orders]);
  return { orders: activeOrders, missions: claimable, cart };
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const pills = usePills();
  return (
    <nav aria-label="Main">
      {NAV.map((g) => (
        <div className="nav-group" key={g.title}>
          <div className="nav-title">{t(g.title)}</div>
          {g.items.map((it) => {
            const Icon = it.icon;
            const pill = it.pill ? pills[it.pill] : 0;
            return (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onNavigate} title={t(it.key)}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(it.key)}</span>
                {pill > 0 && <em className="pill" style={{ fontStyle: 'normal' }}>{pill}</em>}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SearchBox() {
  const t = useT();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const market = useGameState((s) => s.market);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return PRODUCTS.filter((p) =>
      `${p.name} ${p.brand} ${CATEGORY_BY_ID[p.category].label} ${SUBCATEGORY_LABEL[p.subcategory]} ${p.rarity}`.toLowerCase().includes(needle),
    ).slice(0, 8);
  }, [q]);
  const go = (path: string) => {
    setOpen(false);
    setQ('');
    nav(path);
  };
  return (
    <div className="header-search" onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <Search size={16} />
      <input
        type="search"
        placeholder={t('search')}
        value={q}
        aria-label="Search products"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(results.length - 1, a + 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
          if (e.key === 'Enter') {
            if (results[active]) go(`/product/${results[active].id}`);
            else if (q.trim()) go(`/market?q=${encodeURIComponent(q.trim())}`);
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && q.trim().length >= 2 && (
        <div className="search-results" role="listbox">
          {results.length === 0 && <div className="dim" style={{ padding: 12 }}>No products match “{q}”.</div>}
          {results.map((p, i) => (
            <button key={p.id} className="search-item" data-active={i === active} onMouseDown={() => go(`/product/${p.id}`)} role="option" aria-selected={i === active}>
              <ProductThumb id={p.id} />
              <div className="grow">
                <div className="ellipsis" style={{ fontWeight: 600 }}>{p.name}</div>
                <div className="dim" style={{ fontSize: 11 }}>
                  {p.brand} · {SUBCATEGORY_LABEL[p.subcategory]}
                </div>
              </div>
              <span className="num">{market[p.id]?.listed ? cr(market[p.id].price) : 'Soon'}</span>
            </button>
          ))}
          {results.length > 0 && (
            <button className="search-item" onMouseDown={() => go(`/market?q=${encodeURIComponent(q.trim())}`)}>
              <Search size={14} /> <span className="dim">See all results in the Market</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ClockChip() {
  const t = useGameState((s) => s.clock.t);
  const speed = useGameState((s) => s.settings.speed);
  const { run } = useAction();
  const setSpeed = (v: Speed) => run((s) => updateSettings(s, { speed: v }), { quiet: true });
  return (
    <div className="clock-chip" title="In-game time. 1 in-game day ≈ 12 real minutes at 1×.">
      <span className={`live ${speed === 0 ? 'paused' : ''}`} />
      <span>
        <span className="clock-text-long">Day </span>
        {dayOf(t)} · {formatClock(t)}
      </span>
      <button className="speed-btn" aria-label={speed === 0 ? 'Resume market' : 'Pause market'} aria-pressed={speed === 0} onClick={() => setSpeed(speed === 0 ? 1 : 0)}>
        {speed === 0 ? <Play size={12} /> : <Pause size={12} />}
      </button>
      {([1, 2, 4] as Speed[]).map((v) => (
        <button key={v} className="speed-btn" aria-pressed={speed === v} onClick={() => setSpeed(v)} aria-label={`Speed ${v}x`}>
          {v}×
        </button>
      ))}
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut, active]);
}

function NotificationsBell() {
  const notes = useGameState((s) => s.notifications);
  const now = useGameState((s) => s.clock.t);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const { run } = useAction();
  const nav = useNavigate();
  const unread = notes.filter((n) => !n.read).length;
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="icon-btn" aria-label={`Notifications (${unread} unread)`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ width: 'min(380px, calc(100vw - 24px))', right: -60 }}>
          <div className="spread" style={{ padding: '4px 6px 8px' }}>
            <strong>Notifications</strong>
            <div className="row">
              <button className="btn btn-xs btn-ghost" onClick={() => run((s) => markNotificationsRead(s), { quiet: true })} disabled={unread === 0}>
                <Check size={12} /> Mark read
              </button>
              <button className="btn btn-xs btn-ghost" onClick={() => run((s) => clearNotifications(s), { quiet: true })} disabled={notes.length === 0}>
                Clear
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notes.length === 0 && <div className="dim" style={{ padding: 16 }}>You’re all caught up.</div>}
            {notes.slice(0, 40).map((n) => (
              <button
                key={n.id}
                className="dropdown-item"
                style={{ alignItems: 'flex-start', opacity: n.read ? 0.6 : 1 }}
                onClick={() => {
                  run((s) => markNotificationsRead(s, [n.id]), { quiet: true });
                  setOpen(false);
                  if (n.link) nav(n.link);
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 4, marginTop: 6, flex: 'none', background: n.read ? 'transparent' : 'var(--accent)' }} />
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 650, color: 'var(--text)', fontSize: 13 }}>{n.title}</span>
                  <span style={{ display: 'block', fontSize: 12 }}>{n.body}</span>
                  <span className="dim" style={{ fontSize: 11 }}>{formatAgo(now, n.t)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function StoreBadge({ name, logo, theme, size = 26 }: { name: string; logo?: string; theme: string; size?: number }) {
  const th = STORE_THEMES.find((x) => x.id === theme) ?? STORE_THEMES[0];
  return (
    <span
      className="store-badge"
      style={{
        width: size,
        height: size,
        backgroundColor: th.surface,
        color: th.accent,
        backgroundImage: logo ? `url(${logo})` : undefined,
        border: `1px solid ${th.accent}55`,
        fontSize: size * 0.58,
      }}
      aria-hidden
    >
      {!logo && initials(name)}
    </span>
  );
}

function StoreSelector() {
  const stores = useGameState((s) => s.stores);
  const activeId = useGameState((s) => s.activeStoreId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const { run } = useAction();
  const nav = useNavigate();
  const active = stores.find((s) => s.id === activeId) ?? stores[0];
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="store-select" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Select store">
        <StoreBadge name={active.name} logo={active.logo} theme={active.theme} />
        <span className="ellipsis" style={{ fontWeight: 600, fontSize: 13 }}>{active.name}</span>
        <ChevronDown size={14} className="dim" />
      </button>
      {open && (
        <div className="dropdown" style={{ left: 0, right: 'auto' }}>
          <div className="label" style={{ padding: '4px 8px 8px' }}>Your stores</div>
          {stores.map((st) => (
            <button
              key={st.id}
              className="dropdown-item"
              onClick={() => {
                run((s) => setActiveStore(s, st.id), { quiet: true });
                setOpen(false);
                nav('/store');
              }}
            >
              <StoreBadge name={st.name} logo={st.logo} theme={st.theme} />
              <span className="grow">
                <span style={{ display: 'block', color: 'var(--text)', fontWeight: 600 }}>{st.name}</span>
                <span style={{ fontSize: 11 }}>
                  {st.open ? 'Open' : 'Closed'} · {st.listings.length} listings
                </span>
              </span>
              {st.id === active.id && <Check size={14} />}
            </button>
          ))}
          <div className="dropdown-sep" />
          <button
            className="dropdown-item"
            onClick={() => {
              setOpen(false);
              nav('/store?tab=expand');
            }}
          >
            <Plus size={16} /> Open another store
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const profile = useGameState((s) => s.profile);
  const prog = useGameState((s) => s.progression);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const nav = useNavigate();
  const cur = xpForLevel(prog.level);
  const next = xpForLevel(prog.level + 1);
  const go = (p: string) => {
    setOpen(false);
    nav(p);
  };
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="avatar" onClick={() => setOpen((o) => !o)} aria-label="Profile menu" aria-expanded={open}>
        <span className="face" style={{ background: AVATAR_COLORS[profile.avatar % AVATAR_COLORS.length], color: '#0a0a0b' }}>
          {initials(profile.name)}
        </span>
        <span className="lvl">{prog.level}</span>
      </button>
      {open && (
        <div className="dropdown" style={{ width: 280 }}>
          <div style={{ padding: '6px 8px 10px' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.name}</div>
            <div className="dim" style={{ fontSize: 12 }}>
              Level {prog.level} · {titleForLevel(prog.level)}
            </div>
            <div style={{ marginTop: 10 }}>
              <Meter value={prog.xp - cur} max={Math.max(1, next - cur)} tone="gold" />
              <div className="dim num" style={{ fontSize: 11, marginTop: 4 }}>
                {prog.level >= 50 ? 'Max level' : `${(prog.xp - cur).toLocaleString()} / ${(next - cur).toLocaleString()} XP to level ${prog.level + 1}`}
              </div>
            </div>
          </div>
          <div className="dropdown-sep" />
          <button className="dropdown-item" onClick={() => go('/missions')}>
            <Target size={16} /> Missions & progression
          </button>
          <button className="dropdown-item" onClick={() => go('/storefront')}>
            <Share2 size={16} /> Public storefront & sharing
          </button>
          <button className="dropdown-item" onClick={() => go('/leaderboard')}>
            <Trophy size={16} /> Leaderboard
          </button>
          <button className="dropdown-item" onClick={() => go('/settings')}>
            <SettingsIcon size={16} /> Settings
          </button>
        </div>
      )}
    </div>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const t = useT();
  const cash = useGameState((s) => s.wallet.cash);
  const cartCount = useGameState((s) => s.cart.reduce((a, l) => a + l.qty, 0));
  return (
    <header className="header">
      <Link to="/" aria-label="DOPACART home">
        <Logo />
      </Link>
      <div className="desktop-only">
        <StoreSelector />
      </div>
      <SearchBox />
      <div className="header-right">
        <ClockChip />
        <Link to="/wallet" className="wallet-chip" title="Virtual game credits — not real money">
          <span className="lbl">{t('balance')} · CR</span>
          <span className="val">{cr(cash)}</span>
        </Link>
        <NotificationsBell />
        <Link to="/cart" className="icon-btn" aria-label={`Cart (${cartCount} items)`}>
          <ShoppingCart size={18} />
          {cartCount > 0 && <span className="count">{cartCount}</span>}
        </Link>
        <span className="desktop-only">
          <ProfileMenu />
        </span>
        <button className="icon-btn mobile-only" aria-label="Open menu" onClick={onMenu}>
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const t = useT();
  const items = [
    { to: '/', key: 'home' as const, icon: LayoutDashboard },
    { to: '/market', key: 'market' as const, icon: ShoppingBag },
    { to: '/inventory', key: 'inventory' as const, icon: Package },
    { to: '/trading', key: 'trading' as const, icon: LineChart },
  ];
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <it.icon size={20} strokeWidth={1.8} />
          {it.key === 'trading' ? 'Trade' : t(it.key)}
        </NavLink>
      ))}
      <button onClick={onMore}>
        <Menu size={20} strokeWidth={1.8} />
        {t('more')}
      </button>
    </nav>
  );
}

function MobileDrawer({ onClose }: { onClose: () => void }) {
  const profile = useGameState((s) => s.profile);
  const level = useGameState((s) => s.progression.level);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Menu">
        <div className="spread" style={{ marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{profile.name}</div>
            <div className="dim" style={{ fontSize: 12 }}>
              Level {level} · {titleForLevel(level)}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <ClockChipMobile />
        </div>
        <NavLinks onNavigate={onClose} />
      </aside>
    </>
  );
}

function ClockChipMobile() {
  return (
    <div style={{ display: 'flex' }}>
      <div className="clock-chip" style={{ display: 'flex' }}>
        <ClockInner />
      </div>
    </div>
  );
}

function ClockInner() {
  const t = useGameState((s) => s.clock.t);
  const speed = useGameState((s) => s.settings.speed);
  const { run } = useAction();
  return (
    <>
      <span className={`live ${speed === 0 ? 'paused' : ''}`} />
      <span>
        Day {dayOf(t)} · {formatClock(t)}
      </span>
      {([0, 1, 2, 4] as Speed[]).map((v) => (
        <button key={v} className="speed-btn" aria-pressed={speed === v} onClick={() => run((s) => updateSettings(s, { speed: v }), { quiet: true })}>
          {v === 0 ? <Pause size={12} /> : `${v}×`}
        </button>
      ))}
    </>
  );
}

export function Layout() {
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  const dispatch = useGame((s) => s.dispatch);
  const saveError = useGame((s) => s.saveError);
  const reportedVisit = useRef('');

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawer(false);
    const page = PAGE_IDS[loc.pathname];
    if (page && reportedVisit.current !== loc.pathname) {
      reportedVisit.current = loc.pathname;
      dispatch((s) => visitPage(s, page), { quiet: true });
    }
    if (!page) reportedVisit.current = '';
  }, [loc.pathname, dispatch]);

  return (
    <div className="app">
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header onMenu={() => setDrawer(true)} />
      <aside className="sidebar">
        <NavLinks />
        <div className="sidebar-foot">
          All products, brands, currency and deliveries in DOPACART are fictional. Nothing is ever charged or shipped.
        </div>
      </aside>
      <main className="main" id="main">
        {saveError && (
          <div className="notice notice-error" style={{ marginBottom: 16 }}>
            <AlertTriangle size={16} /> {saveError} Export your save from Settings to avoid losing progress.
          </div>
        )}
        <Outlet />
      </main>
      <BottomNav onMore={() => setDrawer(true)} />
      {drawer && <MobileDrawer onClose={() => setDrawer(false)} />}
      <TutorialCoach />
      <OfflineReportModal />
      <Toasts />
    </div>
  );
}
