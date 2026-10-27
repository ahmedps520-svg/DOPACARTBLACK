import { useMemo, useState } from 'react';
import { Play, Plus, ShieldCheck, Loader2 } from 'lucide-react';
import { useGame } from '../state/gameStore';
import { PRODUCTS } from '../engine/catalog';
import { ProductImage } from '../components/ProductCard';
import { LogoMark } from '../components/Logo';
import { CATEGORIES } from '../engine/categories';
import { SCENARIOS, STARTING_BALANCE_OPTIONS, DEFAULT_STARTING_BALANCE, BASE_STORE_CATEGORIES } from '../engine/constants';
import type { CategoryId, ScenarioId } from '../engine/types';
import { Modal, Notice, Switch } from '../components/ui';
import { cr } from '../lib/format';
import { dayOf } from '../engine/time';
import { netWorth } from '../engine/selectors';

const WALL = ['strada-nocturne-hi', 'novacore-x12-pro', 'valcourt-squelette-tourbillon', 'sonorra-aria', 'ardent-monarch', 'curio-vault-aurum-sentinel', 'tempus-noir-atelier-eclipse-chrono', 'noir-atelier-vault-bag-carbon', 'kryon-helix-h9', 'hexforge-magnetar-he', 'throne-labs-sovereign', 'aurelian-circuit-cup'];

export function Welcome() {
  const hasSave = useGame((s) => s.hasSave);
  const saved = useGame((s) => s.game);
  const continueGame = useGame((s) => s.continueGame);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(false);

  const wall = useMemo(() => {
    const picked = WALL.filter((id) => PRODUCTS.some((p) => p.id === id));
    const extra = PRODUCTS.filter((p) => !picked.includes(p.id) && (p.rarity === 'epic' || p.rarity === 'legendary' || p.rarity === 'rare')).map((p) => p.id);
    return [...picked, ...extra].slice(0, 12);
  }, []);

  return (
    <div className="welcome">
      <div className="welcome-wall" aria-hidden>
        {wall.map((id, i) => (
          <div key={id} className="welcome-tile" style={{ animationDelay: `${i * 70}ms` }}>
            <ProductImage id={id} />
          </div>
        ))}
      </div>
      <div className="welcome-veil" />
      <div className="welcome-content">
        <div className="row" style={{ gap: 12, marginBottom: 28 }}>
          <LogoMark size={44} />
          <div>
            <div className="logo-word" style={{ fontSize: 30 }}>
              DOPA<b style={{ color: 'var(--accent)', fontWeight: 400 }}>CART</b>
            </div>
            <span className="logo-sub">BLACK MARKET</span>
          </div>
        </div>
        <h1 className="display welcome-title">
          DOPACART
          <br />
          <span>AWAITS.</span>
        </h1>
        <p className="welcome-sub">Build your store. Master the market. Make your fortune.</p>
        <div className="welcome-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setSetup(true)}>
            <Plus size={18} /> Start New Game
          </button>
          <button
            className="btn btn-lg"
            disabled={!hasSave || loading}
            onClick={() => {
              setLoading(true);
              void continueGame().finally(() => setLoading(false));
            }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : <Play size={18} />} Continue Game
          </button>
        </div>
        {hasSave && saved && (
          <div className="welcome-save">
            <span className="dim">Saved game</span>
            <strong>{saved.profile.name}</strong>
            <span className="dim">·</span>
            <span>{saved.stores[0]?.name}</span>
            <span className="dim">·</span>
            <span className="num">Day {dayOf(saved.clock.t)}</span>
            <span className="dim">·</span>
            <span className="num">Net worth {cr(netWorth(saved))} CR</span>
          </div>
        )}
        {!hasSave && <div className="welcome-save dim">No saved game on this device yet.</div>}
        <p className="welcome-legal">
          <ShieldCheck size={14} /> DOPACART is a simulation game. Every product, brand, price, store and delivery is fictional, and credits are virtual game currency with no real-world value.
          Nothing is ever charged or shipped.
        </p>
      </div>
      <NewGameModal open={setup} onClose={() => setSetup(false)} overwrite={hasSave} />
    </div>
  );
}

function NewGameModal({ open, onClose, overwrite }: { open: boolean; onClose: () => void; overwrite: boolean }) {
  const newGame = useGame((s) => s.newGame);
  const [name, setName] = useState('');
  const [store, setStore] = useState('');
  const [balance, setBalance] = useState<number>(DEFAULT_STARTING_BALANCE);
  const [custom, setCustom] = useState('');
  const [scenario, setScenario] = useState<ScenarioId>('standard');
  const [cats, setCats] = useState<CategoryId[]>(['electronics', 'gaming']);
  const [tutorial, setTutorial] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const effectiveBalance = custom ? Number(custom) : balance;
  const valid = name.trim().length >= 2 && store.trim().length >= 2 && Number.isFinite(effectiveBalance) && effectiveBalance >= 500 && effectiveBalance <= 10_000_000 && cats.length > 0;

  const start = () => {
    if (!valid) {
      setError('Enter a name (2+ characters), a store name, a starting balance between 500 and 10,000,000 CR and at least one category.');
      return;
    }
    setBusy(true);
    setError('');
    // Let the spinner paint before simulating 30 days of market history.
    setTimeout(() => {
      void newGame({ playerName: name, storeName: store, startingBalance: effectiveBalance, scenario, categories: cats, tutorial }).catch((e) => {
        setBusy(false);
        setError(String(e));
      });
    }, 50);
  };

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      size="lg"
      kicker="New game"
      title="Set up your empire"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={start} disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" /> Simulating 30 days of market history…
              </>
            ) : (
              'Enter the market'
            )}
          </button>
        </>
      }
    >
      <div className="grid grid-2" style={{ gap: 14 }}>
        <div className="field">
          <label htmlFor="ng-name">Your name</label>
          <input id="ng-name" className="input" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morgan Vale" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="ng-store">Store name</label>
          <input id="ng-store" className="input" maxLength={32} value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Midnight Supply Co." />
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Starting capital (virtual credits)</label>
        <div className="row-wrap">
          {STARTING_BALANCE_OPTIONS.map((b) => (
            <button
              key={b}
              className="chip"
              aria-pressed={!custom && balance === b}
              onClick={() => {
                setBalance(b);
                setCustom('');
              }}
            >
              {b.toLocaleString()} CR{b === DEFAULT_STARTING_BALANCE ? ' · default' : ''}
            </button>
          ))}
          <div className="input-suffix" style={{ width: 170 }}>
            <input className="input" inputMode="numeric" placeholder="Custom (testing)" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} aria-label="Custom starting balance" />
            <span>CR</span>
          </div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Market scenario</label>
        <div className="grid grid-2" style={{ gap: 10 }}>
          {Object.values(SCENARIOS).map((sc) => (
            <button key={sc.id} className={`scenario ${scenario === sc.id ? 'on' : ''}`} onClick={() => setScenario(sc.id)} aria-pressed={scenario === sc.id}>
              <strong>{sc.label}</strong>
              <span>{sc.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <label>Store categories (choose up to {BASE_STORE_CATEGORIES})</label>
        <div className="row-wrap">
          {CATEGORIES.map((c) => {
            const on = cats.includes(c.id);
            return (
              <button
                key={c.id}
                className="chip"
                aria-pressed={on}
                onClick={() => setCats(on ? cats.filter((x) => x !== c.id) : cats.length >= BASE_STORE_CATEGORIES ? [...cats.slice(1), c.id] : [...cats, c.id])}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <span className="hint">Your store can only sell these categories. Category Licenses unlock more later.</span>
      </div>

      <div className="spread" style={{ marginTop: 18 }}>
        <div>
          <div style={{ fontWeight: 650 }}>Interactive tutorial</div>
          <div className="hint">Eight short steps on the real game systems. Skip any time.</div>
        </div>
        <Switch checked={tutorial} onChange={setTutorial} label="Interactive tutorial" />
      </div>

      {overwrite && (
        <div style={{ marginTop: 16 }}>
          <Notice tone="warn">Starting a new game replaces the saved game on this device. Export it from Settings first if you want to keep it.</Notice>
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
    </Modal>
  );
}
