import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MonitorSmartphone } from 'lucide-react';
import { useGame } from './state/gameStore';
import { Layout } from './components/Layout';
import { Welcome } from './pages/Welcome';
import { Dashboard } from './pages/Dashboard';
import { Market } from './pages/Market';
import { ProductPage } from './pages/Product';
import { Cart } from './pages/Cart';
import { Inventory } from './pages/Inventory';
import { WalletPage } from './pages/Wallet';
import { StorePage } from './pages/Store';
import { Suppliers } from './pages/Suppliers';
import { Orders, OrderDetail } from './pages/Orders';
import { Trading } from './pages/Trading';
import { News, NewsArticle } from './pages/News';
import { Missions } from './pages/Missions';
import { Analytics } from './pages/Analytics';
import { Leaderboard } from './pages/Leaderboard';
import { Collection } from './pages/Collection';
import { SettingsPage } from './pages/Settings';
import { Storefront } from './pages/Storefront';
import { NotFound } from './pages/NotFound';
import { LogoMark } from './components/Logo';

const ArtGallery = lazy(() => import('./art/ArtGallery').then((m) => ({ default: m.ArtGallery })));

function Splash({ text = 'Loading the market…' }: { text?: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div className="col" style={{ alignItems: 'center', gap: 16 }}>
        <LogoMark size={56} />
        <div className="dim">{text}</div>
      </div>
    </div>
  );
}

function Elsewhere() {
  const takeOver = useGame((s) => s.takeOver);
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card card-pad" style={{ maxWidth: 440, textAlign: 'center' }}>
        <MonitorSmartphone size={36} style={{ margin: '0 auto 12px', color: 'var(--accent-2)' }} />
        <h2 className="display" style={{ fontSize: 34 }}>Open in another tab</h2>
        <p className="muted" style={{ margin: '10px 0 18px' }}>
          DOPACART is running in another tab. To keep your economy consistent (no duplicated transactions), only one tab can play at a time.
        </p>
        <button className="btn btn-primary" onClick={() => void takeOver()}>
          Play in this tab
        </button>
      </div>
    </div>
  );
}

export function App() {
  const status = useGame((s) => s.status);
  const init = useGame((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  if (status === 'loading') return <Splash />;
  if (status === 'elsewhere') return <Elsewhere />;

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {status === 'welcome' ? (
        <Routes>
          <Route path="/dev/art" element={<Suspense fallback={<Splash />}><ArtGallery /></Suspense>} />
          <Route path="*" element={<Welcome />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="market" element={<Market />} />
            <Route path="product/:id" element={<ProductPage />} />
            <Route path="cart" element={<Cart />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="store" element={<StorePage />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="trading" element={<Trading />} />
            <Route path="news" element={<News />} />
            <Route path="news/:id" element={<NewsArticle />} />
            <Route path="missions" element={<Missions />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="collection" element={<Collection />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="storefront" element={<Storefront />} />
            <Route path="dev/art" element={<Suspense fallback={<Splash />}><ArtGallery /></Suspense>} />
            <Route path="welcome" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      )}
    </HashRouter>
  );
}
