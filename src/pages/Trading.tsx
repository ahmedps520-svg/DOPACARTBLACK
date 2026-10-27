import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, BellPlus, Trash2, Plus, LineChart, Bell, Activity, Search } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { PRODUCT_BY_ID } from '../engine/catalog';
import { RANGES, changeOver, priceSeries, volume24h, volumeSeries, type RangeId } from '../engine/history';
import { MINUTES_PER_DAY } from '../engine/constants';
import { Chart, Sparkline } from '../components/Chart';
import { Change, DemandIndicator, Empty, Modal, Segmented, SupplyIndicator } from '../components/ui';
import { ProductThumb } from '../components/ProductCard';
import { AlertModal } from '../components/TradeModals';
import { SERIES_COLORS } from '../components/CompareView';
import { deleteAlert, toggleWatchlist } from '../engine/commands';
import { describeAlert } from '../engine/alerts';
import { activeEvents, eventImpact } from '../engine/events';
import { useAction } from '../lib/hooks';
import { cr, int, crCompact } from '../lib/format';
import { formatAgo, formatDuration, formatGameTime } from '../engine/time';
import { listedDefs } from '../lib/marketData';
import { STRATEGY_INFO } from '../engine/competitors';
import { upgradeValue } from '../engine/upgrades';

export function Trading() {
  const s = useGameState((st) => st);
  const { run } = useAction();
  const watch = s.watchlist.filter((id) => s.market[id]);
  const [selected, setSelected] = useState<string[]>(() => (watch.length ? watch.slice(0, 1) : [listedDefs(s)[0].id]));
  const [range, setRange] = useState<RangeId>('1D');
  const [mode, setMode] = useState<'value' | 'percent'>('value');
  const [alertFor, setAlertFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');

  const effectiveMode = selected.length > 1 ? 'percent' : mode;
  const series = useMemo(
    () =>
      selected.map((id, i) => {
        const ps = priceSeries(s.market[id], range, s.clock.t);
        return { id, label: PRODUCT_BY_ID[id].name, color: SERIES_COLORS[i % 4], t: ps.t, v: ps.p };
      }),
    [selected, s.market, range, s.clock.t],
  );
  const vol = selected.length === 1 && (range === '1H' || range === '1D') ? volumeSeries(s.market[selected[0]], range === '1H' ? 7 : 145) : undefined;

  const toggleSel = (id: string) => {
    if (selected.includes(id)) setSelected(selected.length > 1 ? selected.filter((x) => x !== id) : selected);
    else setSelected([...selected, id].slice(-4));
  };

  const totals = useMemo(() => {
    const defs = listedDefs(s);
    let up = 0;
    let down = 0;
    let vol24 = 0;
    let wsum = 0;
    let w = 0;
    for (const p of defs) {
      const ch = changeOver(s.market[p.id], MINUTES_PER_DAY);
      if (ch > 0.002) up++;
      else if (ch < -0.002) down++;
      vol24 += volume24h(s.market[p.id]);
      wsum += ch * s.market[p.id].price;
      w += s.market[p.id].price;
    }
    return { up, down, flat: defs.length - up - down, vol24, index: w ? wsum / w : 0 };
  }, [s.market]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchResults = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listedDefs(s)
      .filter((p) => !s.watchlist.includes(p.id))
      .filter((p) => !needle || `${p.name} ${p.brand}`.toLowerCase().includes(needle))
      .slice(0, 30);
  }, [q, s.watchlist, s.market]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = activeEvents(s);
  const alerts = s.alerts;
  const intel = upgradeValue(s, 'analytics') >= 2;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Market terminal</div>
          <h1>Trading Floor</h1>
          <p className="sub">Recorded price history, watchlists, comparisons and alerts. Select up to four products to overlay them on one chart.</p>
        </div>
      </div>

      <div className="ticker-tape">
        <div>
          <div className="label" title="Average 24h change of all listed products, weighted by price">Price-weighted index 24h</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 650 }}>
            <Change value={totals.index} digits={2} />
          </div>
        </div>
        <div>
          <div className="label">Advancers / decliners</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 650 }}>
            <span className="up">{totals.up}</span> / <span className="down">{totals.down}</span> <span className="dim" style={{ fontSize: 12 }}>{totals.flat} flat</span>
          </div>
        </div>
        <div>
          <div className="label">24h market volume</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 650 }}>{int(totals.vol24)} units</div>
        </div>
        <div>
          <div className="label">Active events</div>
          <div className="num" style={{ fontSize: 18, fontWeight: 650 }}>{events.length}</div>
        </div>
      </div>

      <div className="trade-layout">
        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head" style={{ flexWrap: 'wrap' }}>
              <div className="chart-legend">
                {series.map((x) => (
                  <span key={x.id}>
                    <i style={{ background: selected.length > 1 ? x.color : 'var(--accent)' }} />
                    <Link to={`/product/${x.id}`}>{x.label}</Link> <span className="num dim">{cr(s.market[x.id].price)}</span>
                  </span>
                ))}
              </div>
              <div className="row-wrap">
                <Segmented
                  value={effectiveMode}
                  onChange={(v) => setMode(v)}
                  options={[
                    { value: 'value', label: 'Price' },
                    { value: 'percent', label: '% change' },
                  ]}
                  label="Chart mode"
                />
                <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} label="Time range" />
              </div>
            </div>
            <div className="card-body">
              <Chart series={series} mode={effectiveMode} height={360} volume={vol ? { t: vol.t, v: vol.p } : undefined} />
              {selected.length > 1 && <p className="hint" style={{ marginTop: 6 }}>Multiple products are shown as % change from the start of the range so they share one scale.</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Selected products</h2>
              <span className="dim" style={{ fontSize: 12 }}>Indicators from the latest tick</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Price</th>
                    <th className="num">1H</th>
                    <th className="num">24H</th>
                    <th className="num">7D</th>
                    <th className="num">Volume 24h</th>
                    <th>Demand</th>
                    <th>Supply</th>
                    <th className="num" />
                  </tr>
                </thead>
                <tbody>
                  {selected.map((id) => {
                    const mp = s.market[id];
                    return (
                      <tr key={id}>
                        <td>
                          <Link to={`/product/${id}`} className="row" style={{ gap: 10, minWidth: 180 }}>
                            <ProductThumb id={id} />
                            <span className="ellipsis" style={{ fontWeight: 600, maxWidth: 200 }}>{PRODUCT_BY_ID[id].name}</span>
                          </Link>
                        </td>
                        <td className="num">{cr(mp.price)}</td>
                        <td className="num"><Change value={changeOver(mp, 60)} /></td>
                        <td className="num"><Change value={changeOver(mp, MINUTES_PER_DAY)} /></td>
                        <td className="num"><Change value={changeOver(mp, 7 * MINUTES_PER_DAY)} /></td>
                        <td className="num">{int(volume24h(mp))}</td>
                        <td><DemandIndicator mp={mp} compact /></td>
                        <td><SupplyIndicator mp={mp} compact /></td>
                        <td className="num">
                          <button className="btn btn-xs" onClick={() => setAlertFor(id)}>
                            <BellPlus size={12} /> Alert
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="row" style={{ gap: 8 }}>
                <Activity size={16} /> Recent market events
              </h2>
              <Link to="/news" className="dim" style={{ fontSize: 12 }}>
                Newsroom →
              </Link>
            </div>
            <div className="card-body">
              {events.length === 0 && <div className="dim">The market is quiet. Events will appear here when they start.</div>}
              {events.map((e) => (
                <Link key={e.id} to={`/news/${e.id}`} className="list-row">
                  <span className={`badge ${e.bias === 'down' ? 'badge-down' : e.bias === 'up' ? 'badge-up' : 'badge-warn'}`}>{e.bias === 'down' ? 'Bearish' : e.bias === 'up' ? 'Bullish' : 'Mixed'}</span>
                  <span className="grow" style={{ fontWeight: 600 }}>{e.headline}</span>
                  <span className="dim nowrap" style={{ fontSize: 12 }}>
                    impact <Change value={eventImpact(s, e)} /> · {formatDuration(e.end - s.clock.t)} left
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {intel && (
            <div className="card">
              <div className="card-head">
                <h2>Rival activity (Market Intelligence)</h2>
                <span className="badge badge-sim">Simulated rivals</span>
              </div>
              <div className="card-body">
                {s.competitors.map((c) => (
                  <div key={c.id} className="list-row">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                    <span style={{ fontWeight: 600, minWidth: 130 }}>{c.name}</span>
                    <span className="dim grow" style={{ fontSize: 12 }}>{STRATEGY_INFO[c.strategy].label} · {c.lastAction}</span>
                    <span className="dim nowrap" style={{ fontSize: 12 }}>{formatAgo(s.clock.t, c.lastActionAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h2 className="row" style={{ gap: 8 }}>
                <Eye size={16} /> Watchlist
              </h2>
              <button className="btn btn-xs" onClick={() => setAdding(true)}>
                <Plus size={12} /> Add
              </button>
            </div>
            <div style={{ padding: 8 }}>
              {watch.length === 0 && (
                <Empty icon={<LineChart size={26} />} title="No products watched">
                  Add products to follow their price, change and market indicators.
                </Empty>
              )}
              {watch.map((id) => {
                const mp = s.market[id];
                const sel = selected.includes(id);
                const spark = mp.history.ticks.slice(-36);
                return (
                  <div key={id} className="watch-row" role="button" tabIndex={0} aria-pressed={sel} onClick={() => toggleSel(id)} onKeyDown={(e) => e.key === 'Enter' && toggleSel(id)}>
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      {sel && <i style={{ width: 4, height: 30, borderRadius: 2, background: selected.length > 1 ? SERIES_COLORS[selected.indexOf(id) % 4] : 'var(--accent)' }} />}
                      <ProductThumb id={id} />
                      <div style={{ minWidth: 0 }}>
                        <div className="ellipsis" style={{ fontWeight: 600, fontSize: 13 }}>{PRODUCT_BY_ID[id].name}</div>
                        <div className="row" style={{ gap: 8, fontSize: 11 }}>
                          <span className="num">{cr(mp.price)}</span>
                          <Change value={changeOver(mp, MINUTES_PER_DAY)} />
                        </div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <Sparkline values={spark} width={60} height={26} />
                      <button
                        className="icon-btn"
                        style={{ width: 28, height: 28 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected((cur) => (cur.length > 1 ? cur.filter((x) => x !== id) : cur));
                          run((st) => toggleWatchlist(st, id), { quiet: true });
                        }}
                        aria-label={`Remove ${PRODUCT_BY_ID[id].name} from watchlist`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2 className="row" style={{ gap: 8 }}>
                <Bell size={16} /> Price alerts
              </h2>
              <span className="dim" style={{ fontSize: 12 }}>{alerts.filter((a) => a.active).length} active</span>
            </div>
            <div className="card-body" style={{ paddingTop: 6 }}>
              {alerts.length === 0 && <div className="dim" style={{ fontSize: 13 }}>Create alerts from a product row above or any product page.</div>}
              {alerts.slice(0, 20).map((a) => (
                <div key={a.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <span className={`badge ${a.active ? 'badge-warn' : 'badge-up'}`}>{a.active ? 'Watching' : 'Triggered'}</span>
                  <div className="grow" style={{ fontSize: 12 }}>
                    <Link to={`/product/${a.productId}`} style={{ fontWeight: 600 }}>
                      {describeAlert(a)}
                    </Link>
                    <div className="dim">
                      {a.triggeredAt !== undefined ? `Hit at ${cr(a.triggeredPrice ?? 0)} CR · ${formatGameTime(a.triggeredAt)}` : `Now ${cr(s.market[a.productId].price)} CR · set ${formatAgo(s.clock.t, a.createdAt)}`}
                    </div>
                  </div>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={() => run((st) => deleteAlert(st, a.id), { quiet: true })} aria-label="Delete alert">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="label" style={{ marginBottom: 8 }}>Quick add to chart</div>
            <select
              className="select"
              style={{ width: '100%' }}
              value=""
              onChange={(e) => e.target.value && toggleSel(e.target.value)}
              aria-label="Add a product to the chart"
            >
              <option value="">Choose a product…</option>
              {listedDefs(s).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {crCompact(s.market[p.id].price)} CR
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add to watchlist">
        <div className="header-search" style={{ maxWidth: 'none', marginBottom: 12 }}>
          <Search size={15} />
          <input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search products" />
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {searchResults.map((p) => (
            <button
              key={p.id}
              className="dropdown-item"
              onClick={() => {
                run((st) => toggleWatchlist(st, p.id), { success: `Watching ${p.name}` });
              }}
            >
              <ProductThumb id={p.id} />
              <span className="grow">
                <span style={{ display: 'block', color: 'var(--text)', fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12 }}>
                  {cr(s.market[p.id].price)} CR · demand {Math.round(s.market[p.id].demand)}
                </span>
              </span>
              <Change value={changeOver(s.market[p.id], MINUTES_PER_DAY)} />
            </button>
          ))}
          {searchResults.length === 0 && <div className="dim" style={{ padding: 12 }}>No products found.</div>}
        </div>
      </Modal>
      {alertFor && <AlertModal productId={alertFor} open onClose={() => setAlertFor(null)} />}
    </div>
  );
}
