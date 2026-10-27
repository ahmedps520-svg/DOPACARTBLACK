import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, GitCompare, X, Heart } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCTS } from '../engine/catalog';
import { CATEGORIES, CATEGORY_BY_ID, RARITIES, RARITY_LABEL, RARITY_RANK, SUBCATEGORY_LABEL } from '../engine/categories';
import { ProductCard, ProductThumb } from '../components/ProductCard';
import { Empty, Modal } from '../components/ui';
import { CompareView } from '../components/CompareView';
import { changeOver } from '../engine/history';
import { availableUnits, isSupplyLimited } from '../engine/market';
import { MINUTES_PER_DAY } from '../engine/constants';
import { popularity, trendScore } from '../lib/marketData';
import { isActive } from '../engine/events';
import { clearCompare, toggleCompare } from '../engine/commands';
import { useAction } from '../lib/hooks';
import type { CategoryId, Rarity, SubcategoryId } from '../engine/types';
import { int } from '../lib/format';

type SortId = 'trending' | 'popular' | 'price-asc' | 'price-desc' | 'change-desc' | 'change-asc' | 'newest' | 'rarity';
type TrendId = 'all' | 'rising' | 'falling' | 'stable' | 'event';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Popularity (24h volume)' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'change-desc', label: '24h change: biggest gains' },
  { id: 'change-asc', label: '24h change: biggest losses' },
  { id: 'newest', label: 'Newest listings' },
  { id: 'rarity', label: 'Rarity: rarest first' },
];

const TRENDS: { id: TrendId; label: string }[] = [
  { id: 'all', label: 'Any trend' },
  { id: 'rising', label: 'Rising (> +2% 24h)' },
  { id: 'falling', label: 'Falling (< −2% 24h)' },
  { id: 'stable', label: 'Stable (±2%)' },
  { id: 'event', label: 'Affected by an event' },
];

export function Market() {
  const [params, setParams] = useSearchParams();
  const s = useGameState((st) => st);
  const market = s.market;
  const [showFilters, setShowFilters] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const { run } = useAction();

  const q = params.get('q') ?? '';
  const cat = (params.get('cat') as CategoryId | null) ?? null;
  const sub = (params.get('sub') as SubcategoryId | null) ?? null;
  const rarities = (params.get('rarity')?.split(',').filter(Boolean) ?? []) as Rarity[];
  const trend = (params.get('trend') as TrendId) ?? 'all';
  const sort = (params.get('sort') as SortId) ?? 'trending';
  const flags = new Set(params.get('f')?.split(',').filter(Boolean) ?? []);
  const minP = Number(params.get('min') ?? '') || 0;
  const maxP = Number(params.get('max') ?? '') || 0;

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };
  const toggleFlag = (f: string) => {
    const n = new Set(flags);
    if (n.has(f)) n.delete(f);
    else n.add(f);
    set({ f: [...n].join(',') || null });
  };

  const eventIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of s.events) if (isActive(e, s.clock.t)) e.productIds.forEach((id) => ids.add(id));
    return ids;
  }, [s.events, s.clock.t]);

  const base = useMemo(() => PRODUCTS.filter((p) => market[p.id]?.listed || flags.has('upcoming')), [market, params]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = base.filter((p) => {
      const mp = market[p.id];
      if (needle && !`${p.name} ${p.brand} ${SUBCATEGORY_LABEL[p.subcategory]} ${CATEGORY_BY_ID[p.category].label} ${p.description}`.toLowerCase().includes(needle)) return false;
      if (cat && p.category !== cat) return false;
      if (sub && p.subcategory !== sub) return false;
      if (rarities.length && !rarities.includes(p.rarity)) return false;
      if (minP && mp.price < minP) return false;
      if (maxP && mp.price > maxP) return false;
      if (flags.has('instock') && availableUnits(mp) === 0) return false;
      if (flags.has('limited') && !p.limited) return false;
      if (flags.has('owned') && !s.holdings[p.id]) return false;
      if (flags.has('favorites') && !s.favorites.includes(p.id)) return false;
      if (flags.has('scarce') && !isSupplyLimited(mp)) return false;
      if (trend !== 'all' && mp.listed) {
        const ch = changeOver(mp, MINUTES_PER_DAY);
        if (trend === 'rising' && ch <= 0.02) return false;
        if (trend === 'falling' && ch >= -0.02) return false;
        if (trend === 'stable' && Math.abs(ch) > 0.02) return false;
        if (trend === 'event' && !eventIds.has(p.id)) return false;
      }
      return true;
    });
    const ch = (id: string) => (market[id].listed ? changeOver(market[id], MINUTES_PER_DAY) : 0);
    const sorters: Record<SortId, (a: string, b: string) => number> = {
      trending: (a, b) => trendScore(s, b) - trendScore(s, a),
      popular: (a, b) => popularity(s, b) - popularity(s, a),
      'price-asc': (a, b) => market[a].price - market[b].price,
      'price-desc': (a, b) => market[b].price - market[a].price,
      'change-desc': (a, b) => ch(b) - ch(a),
      'change-asc': (a, b) => ch(a) - ch(b),
      newest: (a, b) => market[b].listedAt - market[a].listedAt,
      rarity: (a, b) => RARITY_RANK[PRODUCTS.find((p) => p.id === b)!.rarity] - RARITY_RANK[PRODUCTS.find((p) => p.id === a)!.rarity] || market[b].price - market[a].price,
    };
    return list.map((p) => p.id).sort(sorters[sort] ?? sorters.trending);
  }, [base, market, q, cat, sub, rarities.join(), trend, sort, minP, maxP, params, eventIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const countFor = (pred: (p: (typeof PRODUCTS)[number]) => boolean) => base.filter(pred).length;
  const activeFilterCount = (cat ? 1 : 0) + (sub ? 1 : 0) + rarities.length + (trend !== 'all' ? 1 : 0) + flags.size + (minP ? 1 : 0) + (maxP ? 1 : 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">The Marketplace</div>
          <h1>{sub ? SUBCATEGORY_LABEL[sub] : cat ? CATEGORY_BY_ID[cat].label : 'All Products'}</h1>
          <p className="sub">{cat ? CATEGORY_BY_ID[cat].tagline : 'Every listing is a fictional product priced live by the simulation. Purchases use virtual credits only.'}</p>
        </div>
      </div>

      <div className="market-layout">
        <aside className={`filters ${showFilters ? '' : 'collapsed'}`} aria-label="Filters">
          <div className="filter-block">
            <h4>Category</h4>
            <button className="filter-opt" aria-pressed={!cat} onClick={() => set({ cat: null, sub: null })}>
              All categories <span className="n">{base.length}</span>
            </button>
            {CATEGORIES.map((c) => (
              <div key={c.id}>
                <button className="filter-opt" aria-pressed={cat === c.id && !sub} onClick={() => set({ cat: c.id, sub: null })}>
                  {c.label} <span className="n">{countFor((p) => p.category === c.id)}</span>
                </button>
                {cat === c.id && (
                  <div className="filter-sub">
                    {c.subcategories.map((sc) => (
                      <button key={sc.id} className="filter-opt" aria-pressed={sub === sc.id} onClick={() => set({ sub: sub === sc.id ? null : sc.id })}>
                        {sc.label} <span className="n">{countFor((p) => p.subcategory === sc.id)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="filter-block">
            <h4>Rarity</h4>
            <div className="row-wrap">
              {RARITIES.map((r) => {
                const on = rarities.includes(r);
                return (
                  <button
                    key={r}
                    className="chip"
                    aria-pressed={on}
                    onClick={() => set({ rarity: (on ? rarities.filter((x) => x !== r) : [...rarities, r]).join(',') || null })}
                    style={on ? undefined : { color: `var(--r-${r})` }}
                  >
                    {RARITY_LABEL[r]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="filter-block">
            <h4>Market trend</h4>
            {TRENDS.map((t) => (
              <button key={t.id} className="filter-opt" aria-pressed={trend === t.id} onClick={() => set({ trend: t.id === 'all' ? null : t.id })}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="filter-block">
            <h4>Price (CR)</h4>
            <div className="row">
              <input className="input" style={{ width: '100%' }} inputMode="numeric" placeholder="Min" value={minP || ''} onChange={(e) => set({ min: e.target.value.replace(/\D/g, '') || null })} aria-label="Minimum price" />
              <span className="dim">–</span>
              <input className="input" style={{ width: '100%' }} inputMode="numeric" placeholder="Max" value={maxP || ''} onChange={(e) => set({ max: e.target.value.replace(/\D/g, '') || null })} aria-label="Maximum price" />
            </div>
          </div>
          <div className="filter-block">
            <h4>Show</h4>
            {[
              ['instock', 'In stock only'],
              ['scarce', 'Limited supply'],
              ['limited', 'Limited editions'],
              ['owned', 'Products I own'],
              ['favorites', 'My favorites'],
              ['upcoming', 'Include upcoming releases'],
            ].map(([k, label]) => (
              <button key={k} className="filter-opt" aria-pressed={flags.has(k)} onClick={() => toggleFlag(k)}>
                {label} {k === 'favorites' && <Heart size={12} />}
              </button>
            ))}
          </div>
          {activeFilterCount > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setParams(new URLSearchParams(q ? { q } : {}), { replace: true })}>
              <X size={14} /> Clear filters
            </button>
          )}
        </aside>

        <div>
          <div className="market-toolbar">
            <div className="row grow" style={{ maxWidth: 520 }}>
              <div className="header-search" style={{ maxWidth: 'none', display: 'block' }}>
                <Search size={16} />
                <input type="search" placeholder="Search by name, brand or category…" value={q} onChange={(e) => set({ q: e.target.value || null })} aria-label="Search the market" />
              </div>
            </div>
            <div className="row-wrap">
              <button className="btn btn-sm filters-toggle" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
                <SlidersHorizontal size={14} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </button>
              <select className="select" value={sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort products">
                {SORTS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="dim nowrap" style={{ fontSize: 12 }}>{int(results.length)} products</span>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="card">
              <Empty icon={<Search size={28} />} title="No products match these filters">
                Try a broader search or clear some filters.
              </Empty>
            </div>
          ) : (
            <div className="product-grid">
              {results.map((id) => (
                <ProductCard key={id} id={id} showCompare />
              ))}
            </div>
          )}

          {s.compare.length > 0 && (
            <div className="compare-bar">
              <GitCompare size={18} className="accent" />
              <div className="row grow" style={{ overflow: 'hidden' }}>
                {s.compare.map((id) => (
                  <ProductThumb key={id} id={id} />
                ))}
                <span className="dim" style={{ fontSize: 12 }}>{s.compare.length}/4 selected</span>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => run((st) => clearCompare(st), { quiet: true })}>
                Clear
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => setCompareOpen(true)} disabled={s.compare.length < 2}>
                Compare
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Compare products" kicker="Side by side" size="lg">
        <CompareView ids={s.compare} onRemove={(id) => run((st) => toggleCompare(st, id), { quiet: true })} />
      </Modal>
    </div>
  );
}
