import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Newspaper, Clock, Gauge } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { CATEGORY_BY_ID, SUBCATEGORY_LABEL } from '../engine/categories';
import { ProductCard, ProductImage } from '../components/ProductCard';
import { Change, Empty } from '../components/ui';
import { eventImpact, isActive } from '../engine/events';
import { formatAgo, formatDuration, formatGameTime } from '../engine/time';
import { cr, pct } from '../lib/format';
import type { EventEffects, MarketEvent } from '../engine/types';
import { NotFound } from './NotFound';

type Filter = 'all' | 'active' | 'event' | 'release' | 'report';

export function effectLines(e: EventEffects): string[] {
  const out: string[] = [];
  const p = (m: number) => pct(m - 1, 0);
  if (e.demandMult) out.push(`Demand target ${p(e.demandMult)}`);
  if (e.supplyMult) out.push(`Supply equilibrium ${p(e.supplyMult)}`);
  if (e.supplyShock) out.push(`Immediate supply shock ${pct(e.supplyShock, 0)}`);
  if (e.volatilityMult) out.push(`Volatility ${p(e.volatilityMult)}`);
  if (e.deliveryMult) out.push(`Supplier delivery time ${p(e.deliveryMult)}`);
  if (e.trafficMult) out.push(`Store visitors ${p(e.trafficMult)}`);
  if (e.lifecycleMult) out.push(`Long-run demand baseline ${p(e.lifecycleMult)} (permanent)`);
  return out;
}

function kindLabel(e: MarketEvent) {
  return e.kind === 'release' ? 'New release' : e.kind === 'report' ? 'Market wrap' : 'Market event';
}

export function News() {
  const s = useGameState((st) => st);
  const [filter, setFilter] = useState<Filter>('all');
  const items = useMemo(() => {
    const list = [...s.events].sort((a, b) => b.start - a.start || b.id.localeCompare(a.id));
    return list.filter((e) => (filter === 'all' ? true : filter === 'active' ? isActive(e, s.clock.t) : e.kind === filter));
  }, [s.events, filter, s.clock.t]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">The Market Newsroom</div>
          <h1>Newsroom</h1>
          <p className="sub">Every story is generated from the simulation: events change demand, supply, volatility or delivery times by the rules listed in each article, and market wraps summarise recorded prices.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {(
          [
            ['all', 'All stories'],
            ['active', 'In effect now'],
            ['event', 'Events'],
            ['release', 'Releases'],
            ['report', 'Market wraps'],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button key={id} className="tab" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="card card-pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {items.length === 0 && <Empty icon={<Newspaper size={28} />} title="No stories yet" />}
        {items.map((e) => {
          const active = isActive(e, s.clock.t);
          const imp = eventImpact(s, e);
          return (
            <Link key={e.id} to={`/news/${e.id}`} className="news-item">
              <div className="news-thumbs">
                <ProductImage id={e.productIds[0]} lazy />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="row-wrap" style={{ gap: 8, marginBottom: 6 }}>
                  <span className={`badge ${e.kind === 'report' ? '' : e.bias === 'down' ? 'badge-down' : e.bias === 'up' ? 'badge-up' : 'badge-warn'}`}>{kindLabel(e)}</span>
                  {active && <span className="badge badge-accent">In effect · {formatDuration(e.end - s.clock.t)} left</span>}
                  <span className="dim" style={{ fontSize: 12 }}>
                    {formatGameTime(e.start)} · {formatAgo(s.clock.t, e.start)}
                  </span>
                </div>
                <h2 className="news-headline">{e.headline}</h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{e.body}</p>
                <div className="row-wrap dim" style={{ fontSize: 12, marginTop: 8, gap: 12 }}>
                  <span>{e.categories.map((c) => CATEGORY_BY_ID[c].label).join(' · ')}</span>
                  <span>{e.productIds.length} related products</span>
                  {e.kind !== 'report' && (
                    <span>
                      Price impact so far <Change value={imp} />
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function NewsArticle() {
  const { id } = useParams();
  const s = useGameState((st) => st);
  const e = s.events.find((x) => x.id === id);
  if (!e) return <NotFound />;
  const active = isActive(e, s.clock.t);
  const effects = effectLines(e.effects);
  const rows = e.productIds
    .map((pid) => ({ pid, start: e.startPrices[pid], now: s.market[pid].price }))
    .sort((a, b) => (b.start ? b.now / b.start : 0) - (a.start ? a.now / a.start : 0));

  return (
    <div className="page">
      <Link to="/news" className="row dim" style={{ fontSize: 12, marginBottom: 12 }}>
        <ChevronLeft size={14} /> Newsroom
      </Link>
      <article className="card" style={{ overflow: 'hidden' }}>
        <div className="grid grid-2" style={{ gap: 0 }}>
          <div className="card-pad" style={{ padding: 30 }}>
            <div className="row-wrap" style={{ gap: 8 }}>
              <span className={`badge ${e.bias === 'down' ? 'badge-down' : e.bias === 'up' ? 'badge-up' : 'badge-warn'}`}>{kindLabel(e)}</span>
              {active ? <span className="badge badge-accent">In effect</span> : e.kind !== 'report' && <span className="badge">Ended</span>}
            </div>
            <h1 className="pdp-title" style={{ fontSize: 'clamp(34px, 3.6vw, 52px)', marginTop: 14 }}>{e.headline}</h1>
            <p className="muted" style={{ fontSize: 15, marginTop: 10 }}>{e.body}</p>
            <dl className="kv" style={{ marginTop: 20 }}>
              <dt>
                <Clock size={12} style={{ display: 'inline', verticalAlign: -1 }} /> Published
              </dt>
              <dd>{formatGameTime(e.start)}</dd>
              {e.kind !== 'report' && (
                <>
                  <dt>{active ? 'Ends' : 'Ended'}</dt>
                  <dd>
                    {formatGameTime(e.end)} {active && <span className="dim">({formatDuration(e.end - s.clock.t)})</span>}
                  </dd>
                </>
              )}
              <dt>Categories</dt>
              <dd style={{ fontFamily: 'var(--font)' }}>
                {e.subcategories.length ? e.subcategories.map((x) => SUBCATEGORY_LABEL[x]).join(', ') : e.categories.map((c) => CATEGORY_BY_ID[c].label).join(', ')}
              </dd>
              {e.kind !== 'report' && (
                <>
                  <dt>
                    <Gauge size={12} style={{ display: 'inline', verticalAlign: -1 }} /> Avg price impact since start
                  </dt>
                  <dd>
                    <Change value={eventImpact(s, e)} />
                  </dd>
                </>
              )}
            </dl>
          </div>
          <div style={{ background: '#0b0b0d', minHeight: 280 }}>
            <ProductImage id={e.productIds[0]} />
          </div>
        </div>
      </article>

      {effects.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Rules applied by this event</h2>
          </div>
          <div className="card card-pad">
            <div className="row-wrap">
              {effects.map((x) => (
                <span key={x} className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 12, height: 28 }}>
                  {x}
                </span>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              The price model reads these multipliers every tick for the affected products. Prices move toward the new equilibrium gradually and still carry random noise.
            </p>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Affected products ({rows.length})</h2>
        </div>
        {rows.length <= 8 ? (
          <div className="product-grid">
            {rows.map((r) => (
              <ProductCard
                key={r.pid}
                id={r.pid}
                note={
                  r.start ? (
                    <span>
                      Since story: {cr(r.start)} → {cr(r.now)} <Change value={r.now / r.start - 1} />
                    </span>
                  ) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">At start</th>
                    <th className="num">Now</th>
                    <th className="num">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pid}>
                      <td>
                        <Link to={`/product/${r.pid}`} style={{ fontWeight: 600 }}>
                          {PRODUCT_BY_ID[r.pid].name}
                        </Link>
                      </td>
                      <td className="num">{r.start ? cr(r.start) : '—'}</td>
                      <td className="num">{cr(r.now)}</td>
                      <td className="num">{r.start ? <Change value={r.now / r.start - 1} /> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
