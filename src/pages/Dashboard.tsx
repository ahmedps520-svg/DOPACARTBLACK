import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame, TrendingUp, TrendingDown, Sparkles, Clock3, Boxes, Eye, Compass, Truck, Activity, Zap, Info } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { ProductCard, ProductImage, ProductThumb } from '../components/ProductCard';
import { Change, Credits, Empty, Stat, Meter } from '../components/ui';
import { Chart } from '../components/Chart';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { changeOver } from '../engine/history';
import { MINUTES_PER_DAY } from '../engine/constants';
import { investmentSignals, limitedStock, newlyListed, popularity, topBy, trendScore, upcomingReleases, releaseTime } from '../lib/marketData';
import { inventoryCost, inventoryValue, netWorth, periodTotals, txToday, storeRevenueTotal } from '../engine/selectors';
import { activeEvents, eventImpact } from '../engine/events';
import { STATUS_LABEL } from '../engine/orders';
import { formatAgo, formatDuration } from '../engine/time';
import { cr, int } from '../lib/format';
import { titleForLevel, xpForLevel } from '../engine/progression';
import type { GameState } from '../engine/types';

const HERO_KINDS = new Set(['sneaker', 'watch', 'headphones', 'phone', 'console', 'bag', 'camera', 'laptop', 'headset', 'controller', 'drone', 'smartwatch', 'figure', 'chair', 'gpu']);

function Rail({ ids, empty }: { ids: string[]; empty?: string }) {
  if (ids.length === 0) return <div className="card"><Empty title={empty ?? 'Nothing here yet'} /></div>;
  return (
    <div className="rail">
      {ids.map((id) => (
        <ProductCard key={id} id={id} />
      ))}
    </div>
  );
}

function Section({ title, sub, icon, to, children }: { title: string; sub?: string; icon?: React.ReactNode; to?: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2 className="row" style={{ gap: 10 }}>
            {icon}
            {title}
          </h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {to && (
          <Link to={to} className="more">
            View all <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Hero({ s, heroId, sideIds }: { s: GameState; heroId: string; sideIds: string[] }) {
  const movers = useMemo(
    () =>
      topBy(s, (id) => Math.abs(changeOver(s.market[id], MINUTES_PER_DAY)), 10).map((id) => ({
        id,
        ch: changeOver(s.market[id], MINUTES_PER_DAY),
      })),
    [s],
  );
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-kicker">
          <Zap size={13} /> Live fictional economy · Day {Math.floor(s.clock.t / MINUTES_PER_DAY) + 1}
        </span>
        <h1 className="hero-title">
          THE MARKET
          <br />
          IS <span>YOURS.</span>
        </h1>
        <p className="hero-quote">“Every product has a price. Every decision has consequences.”</p>
        <div className="hero-cta">
          <Link to="/market" className="btn btn-primary btn-lg">
            Enter the Market <ArrowRight size={18} />
          </Link>
          <Link to="/trading" className="btn btn-lg btn-outline">
            Trading Floor
          </Link>
        </div>
      </div>
      <div className="hero-art">
        <Link to={`/product/${heroId}`} className="main-item" aria-label={PRODUCT_BY_ID[heroId]?.name}>
          <ProductImage id={heroId} backdrop={false} />
        </Link>
        {sideIds[0] && (
          <Link to={`/product/${sideIds[0]}`} className="float" style={{ right: '6%', top: '8%', transform: 'rotate(4deg)' }} aria-label={PRODUCT_BY_ID[sideIds[0]].name}>
            <ProductImage id={sideIds[0]} />
          </Link>
        )}
        {sideIds[1] && (
          <Link to={`/product/${sideIds[1]}`} className="float" style={{ left: '2%', bottom: '18%', width: '26%', transform: 'rotate(-5deg)' }} aria-label={PRODUCT_BY_ID[sideIds[1]].name}>
            <ProductImage id={sideIds[1]} />
          </Link>
        )}
      </div>
      <div className="hero-ticker" aria-label="Biggest movers in the last 24 in-game hours">
        {movers.map((m) => (
          <Link key={m.id} to={`/product/${m.id}`} className="tick-item">
            <span className="dim">{PRODUCT_BY_ID[m.id].name}</span>
            <span className="num">{cr(s.market[m.id].price)}</span>
            <Change value={m.ch} />
          </Link>
        ))}
      </div>
    </section>
  );
}

function Performance({ s }: { s: GameState }) {
  const nw = netWorth(s);
  const snaps = s.snapshots;
  const dayAgo = snaps.find((x) => x.t >= s.clock.t - MINUTES_PER_DAY) ?? snaps[0];
  const nwChange = dayAgo && dayAgo.netWorth > 0 ? nw / dayAgo.netWorth - 1 : 0;
  const invValue = inventoryValue(s);
  const unreal = invValue - inventoryCost(s);
  const today = periodTotals(txToday(s));
  const series = useMemo(() => {
    const pts = s.snapshots.slice(-72);
    return [{ id: 'nw', label: 'Net worth', color: 'var(--accent)', t: [...pts.map((p) => p.t), s.clock.t], v: [...pts.map((p) => p.netWorth), nw] }];
  }, [s.snapshots, s.clock.t, nw]);
  const lvl = s.progression.level;
  const cur = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2 className="row" style={{ gap: 10 }}>
            <Activity size={22} className="accent" /> Your business performance
          </h2>
          <div className="sub">From your ledger and hourly snapshots. Inventory is valued at market price and never counted as cash.</div>
        </div>
        <Link to="/analytics" className="more">
          Analytics <ArrowRight size={14} />
        </Link>
      </div>
      <div className="perf-grid">
        <div className="card card-pad">
          <div className="spread" style={{ alignItems: 'flex-start' }}>
            <Stat label="Net worth" large foot={<span>Cash + inventory at market + goods in transit</span>}>
              <Credits value={nw} />
            </Stat>
            <div className="right">
              <div className="label">24h</div>
              <Change value={nwChange} className="num" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            {series[0].t.length > 2 ? <Chart series={series} height={170} compactAxis /> : <div className="dim" style={{ padding: 30 }}>Net worth history builds every in-game hour.</div>}
          </div>
        </div>
        <div className="card">
          <div className="stats-row" style={{ border: 0, borderRadius: 0, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <Stat label="Available cash">
              <Credits value={s.wallet.cash} />
            </Stat>
            <Stat label="Inventory value" foot={<span className={unreal >= 0 ? 'up' : 'down'}>{unreal >= 0 ? '+' : '−'}{cr(Math.abs(unreal))} unrealized</span>}>
              <Credits value={invValue} />
            </Stat>
            <Stat label="Realized profit" foot="All-time, net of fees">
              <Credits value={s.wallet.realizedProfit} className={s.wallet.realizedProfit >= 0 ? '' : 'down'} />
            </Stat>
            <Stat label="Revenue today" foot={`${int(today.unitsSold)} units sold`}>
              <Credits value={today.revenue} />
            </Stat>
            <Stat label="Store revenue" foot="All stores, all-time">
              <Credits value={storeRevenueTotal(s)} />
            </Stat>
            <Stat label={`Level ${lvl}`} foot={lvl >= 50 ? 'Max level' : `${int(next - s.progression.xp)} XP to level ${lvl + 1}`}>
              <span style={{ fontSize: 16, fontFamily: 'var(--font)' }}>{titleForLevel(lvl)}</span>
              <div style={{ marginTop: 6 }}>
                <Meter value={s.progression.xp - cur} max={next - cur} tone="gold" />
              </div>
            </Stat>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Dashboard() {
  const s = useGameState((st) => st);
  const market = s.market;
  const level = s.progression.level;

  const data = useMemo(() => {
    const trending = topBy(s, (id) => trendScore(s, id), 10);
    const rising = topBy(s, (id) => changeOver(market[id], MINUTES_PER_DAY), 10);
    const falling = topBy(s, (id) => -changeOver(market[id], MINUTES_PER_DAY), 10);
    const best = topBy(s, (id) => popularity(s, id), 10);
    return {
      trending,
      rising: rising.filter((id) => changeOver(market[id], MINUTES_PER_DAY) > 0),
      falling: falling.filter((id) => changeOver(market[id], MINUTES_PER_DAY) < 0),
      best,
      limited: limitedStock(s, 10),
      fresh: newlyListed(s, 10),
      upcoming: upcomingReleases(s).slice(0, 4),
      signals: investmentSignals(s, 8),
    };
    // Market data changes every tick; level gates recommendations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, level, s.events]);

  const heroId = data.trending.find((id) => PRODUCT_BY_ID[id].rarity !== 'common' && HERO_KINDS.has(PRODUCT_BY_ID[id].art.kind)) ?? data.trending[0];
  const events = activeEvents(s).slice(0, 3);
  const latestOrders = s.orders.slice(0, 5);

  return (
    <div className="page">
      <Hero s={s} heroId={heroId} sideIds={data.trending.filter((id) => id !== heroId).slice(0, 2)} />

      {events.length > 0 && (
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          {events.map((e) => {
            const imp = eventImpact(s, e);
            return (
              <Link key={e.id} to={`/news/${e.id}`} className="card card-pad" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span className={`badge ${e.bias === 'down' ? 'badge-down' : e.bias === 'up' ? 'badge-up' : 'badge-warn'}`}>{e.kind === 'release' ? 'Release' : 'Event'}</span>
                <div className="grow">
                  <div style={{ fontWeight: 650, lineHeight: 1.3 }}>{e.headline}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                    {e.productIds.length} products · ends in {formatDuration(e.end - s.clock.t)} · impact <Change value={imp} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Performance s={s} />

      <Section title="Trending now" sub="Most active relative to normal volume, weighted by demand" icon={<Flame size={22} className="accent" />} to="/market?sort=trending">
        <Rail ids={data.trending} />
      </Section>

      <Section title="Recommended investments" sub="Products where several recorded signals line up. Signals, not guarantees — prices can and do fall." icon={<Compass size={22} className="accent" />} to="/trading">
        {data.signals.length === 0 ? (
          <div className="card">
            <Empty title="No strong signals right now">Check back after the next market move or event.</Empty>
          </div>
        ) : (
          <div className="rail">
            {data.signals.map((sig) => (
              <ProductCard
                key={sig.id}
                id={sig.id}
                note={
                  <span className="signal">
                    {sig.reasons.slice(0, 2).map((r) => (
                      <span key={r} className="badge badge-up" style={{ textTransform: 'none', letterSpacing: 0 }}>
                        {r}
                      </span>
                    ))}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-2 section" style={{ marginTop: 34 }}>
        <MoverList title="Rising prices" icon={<TrendingUp size={20} className="up" />} ids={data.rising.slice(0, 6)} s={s} />
        <MoverList title="Falling prices" icon={<TrendingDown size={20} className="down" />} ids={data.falling.slice(0, 6)} s={s} />
      </div>

      <Section title="Newly listed" sub="Fresh releases put demand pressure on older models" icon={<Sparkles size={22} className="gold" />}>
        {data.fresh.length > 0 && <Rail ids={data.fresh} />}
        {data.upcoming.length > 0 && (
          <div className="card card-pad" style={{ marginTop: data.fresh.length ? 14 : 0 }}>
            <div className="label" style={{ marginBottom: 10 }}>
              <Clock3 size={12} style={{ display: 'inline', verticalAlign: -1 }} /> Upcoming releases (scheduled)
            </div>
            <div className="grid grid-4" style={{ gap: 12 }}>
              {data.upcoming.map((p) => (
                <div key={p.id} className="row" style={{ gap: 10 }}>
                  <ProductThumb id={p.id} />
                  <div className="grow">
                    <div className="ellipsis" style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                    <div className="dim" style={{ fontSize: 12 }}>
                      Day {p.releaseDay} · in {formatDuration(releaseTime(p) - s.clock.t)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Best sellers" sub="Units traded in the last in-game day" icon={<TrendingUp size={22} className="accent" />} to="/market?sort=popular">
        <Rail ids={data.best} />
      </Section>

      <Section title="Limited-stock opportunities" sub="Supply is running thin — scarcity can lift prices, or vanish" icon={<Boxes size={22} className="warn" />}>
        <Rail ids={data.limited} empty="No products are short on supply right now." />
      </Section>

      {s.recentlyViewed.length > 0 && (
        <Section title="Recently viewed" icon={<Eye size={22} className="dim" />}>
          <Rail ids={s.recentlyViewed.filter((id) => market[id]).slice(0, 10)} />
        </Section>
      )}

      <Section title="Your latest orders" icon={<Truck size={22} className="dim" />} to="/orders">
        <div className="card">
          {latestOrders.length === 0 ? (
            <Empty title="No orders yet" action={<Link to="/market" className="btn btn-primary btn-sm">Browse the market</Link>}>
              Buy from the market for instant delivery, or order wholesale from suppliers.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Items</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                    <th className="num">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {latestOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="num" style={{ fontWeight: 600 }}>
                          {o.id}
                        </Link>
                      </td>
                      <td>
                        <div className="row">
                          {o.lines.slice(0, 3).map((l) => (
                            <ProductThumb key={l.productId} id={l.productId} />
                          ))}
                          <span className="dim" style={{ fontSize: 12 }}>
                            {int(o.lines.reduce((a, l) => a + l.qty, 0))} units
                          </span>
                        </div>
                      </td>
                      <td>{o.kind === 'market' ? 'Market (instant)' : 'Supplier'}</td>
                      <td>
                        <span className={`badge ${o.status === 'delivered' ? 'badge-up' : o.status === 'cancelled' ? 'badge-down' : 'badge-warn'}`}>{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td className="num">{cr(o.total)}</td>
                      <td className="num dim">{formatAgo(s.clock.t, o.placedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      <p className="dim row" style={{ marginTop: 30, fontSize: 12 }}>
        <Info size={13} /> All figures are simulated. Credits are virtual game currency; no item is real or deliverable.
      </p>
    </div>
  );
}

function MoverList({ title, icon, ids, s }: { title: string; icon: React.ReactNode; ids: string[]; s: GameState }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="row" style={{ gap: 8 }}>
          {icon} {title}
        </h3>
        <span className="dim" style={{ fontSize: 11 }}>24h</span>
      </div>
      <div className="card-body mini-list" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {ids.length === 0 && <div className="dim" style={{ padding: 16 }}>No products moving this way today.</div>}
        {ids.map((id) => {
          const mp = s.market[id];
          return (
            <Link key={id} to={`/product/${id}`} className="mini-row">
              <ProductThumb id={id} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="mini-name ellipsis">{PRODUCT_BY_ID[id].name}</div>
                <div className="dim" style={{ fontSize: 11 }}>{PRODUCT_BY_ID[id].brand}</div>
              </div>
              <div className="right">
                <div className="num" style={{ fontWeight: 600 }}>{cr(mp.price)}</div>
                <Change value={changeOver(mp, MINUTES_PER_DAY)} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
