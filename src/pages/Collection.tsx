import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gem, Download } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCTS } from '../engine/catalog';
import { RARITIES, RARITY_LABEL } from '../engine/categories';
import { ProductImage } from '../components/ProductCard';
import { Change, Meter, Segmented, Stat, Credits } from '../components/ui';
import { cr, crSigned, int, pct } from '../lib/format';
import type { Rarity } from '../engine/types';

export function Collection() {
  const s = useGameState((st) => st);
  const [show, setShow] = useState<'all' | 'owned' | 'missing'>('all');

  const stats = useMemo(() => {
    const per: Record<Rarity, { total: number; owned: number; value: number; cost: number }> = Object.fromEntries(
      RARITIES.map((r) => [r, { total: 0, owned: 0, value: 0, cost: 0 }]),
    ) as never;
    for (const p of PRODUCTS) {
      const t = per[p.rarity];
      t.total++;
      const h = s.holdings[p.id];
      if (h) {
        t.owned++;
        t.value += h.qty * s.market[p.id].price;
        t.cost += h.qty * h.avgCost;
      }
    }
    return per;
  }, [s.holdings, s.market]);

  const owned = Object.keys(s.holdings).length;
  const totalValue = RARITIES.reduce((a, r) => a + stats[r].value, 0);
  const totalCost = RARITIES.reduce((a, r) => a + stats[r].cost, 0);

  const exportCollection = () => {
    const lines = PRODUCTS.filter((p) => s.holdings[p.id]).map((p) => {
      const h = s.holdings[p.id];
      return { id: p.id, name: p.name, brand: p.brand, rarity: p.rarity, qty: h.qty, avgCost: h.avgCost, marketPrice: s.market[p.id].price };
    });
    const blob = new Blob([JSON.stringify({ game: 'DOPACART: BLACK MARKET (fictional)', player: s.profile.name, items: lines }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dopacart-collection.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Collection</div>
          <h1>Your Collection</h1>
          <p className="sub">
            Every product you own, grouped by rarity. Values come from the live market — rare items can fall as fast as they rise. No loot boxes, no random packs: everything is bought at a visible price.
          </p>
        </div>
        <div className="row-wrap">
          <Segmented
            value={show}
            onChange={setShow}
            label="Show"
            options={[
              { value: 'all', label: 'All' },
              { value: 'owned', label: 'Owned' },
              { value: 'missing', label: 'Missing' },
            ]}
          />
          <button className="btn btn-sm" onClick={exportCollection} disabled={owned === 0}>
            <Download size={14} /> Share list
          </button>
        </div>
      </div>

      <div className="stats-row">
        <Stat label="Products collected" foot={`${pct(owned / PRODUCTS.length, 0).replace('+', '')} of the catalog`}>
          {owned} / {PRODUCTS.length}
        </Stat>
        <Stat label="Collection value">
          <Credits value={totalValue} />
        </Stat>
        <Stat label="Change vs cost">
          <span className={totalValue - totalCost >= 0 ? 'up' : 'down'}>{crSigned(totalValue - totalCost)}</span>
        </Stat>
      </div>

      {RARITIES.map((r) => {
        const st = stats[r];
        const items = PRODUCTS.filter((p) => p.rarity === r).filter((p) => (show === 'owned' ? s.holdings[p.id] : show === 'missing' ? !s.holdings[p.id] : true));
        if (items.length === 0) return null;
        return (
          <section key={r} className="collection-tier">
            <div className="section-head">
              <div>
                <h2 className={`row rarity-${r}`} style={{ gap: 10, color: `var(--r-${r})` }}>
                  <Gem size={20} /> {RARITY_LABEL[r]}
                </h2>
                <div className="sub">
                  {st.owned}/{st.total} collected · value {cr(st.value)} CR
                  {st.cost > 0 && (
                    <>
                      {' '}
                      · <Change value={st.value / st.cost - 1} />
                    </>
                  )}
                </div>
              </div>
              <div style={{ width: 160 }}>
                <Meter value={st.owned} max={st.total} />
              </div>
            </div>
            <div className="product-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
              {items.map((p) => {
                const h = s.holdings[p.id];
                const mp = s.market[p.id];
                return (
                  <Link key={p.id} to={`/product/${p.id}`} className={`ctile ${h ? '' : 'missing'}`} title={p.name}>
                    <ProductImage id={p.id} lazy />
                    <div className="cinfo">
                      <div className="ellipsis" style={{ fontWeight: 600 }}>{p.name}</div>
                      {h ? (
                        <div className="spread">
                          <span className="num">×{int(h.qty)}</span>
                          <Change value={mp.price / h.avgCost - 1} />
                        </div>
                      ) : (
                        <div className="dim num">{mp.listed ? `${cr(mp.price)} CR` : `Day ${p.releaseDay}`}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
