import { useMemo, useState } from 'react';
import { Trophy, Bot, User, Info } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { competitorInventoryValue, competitorNetWorth, STRATEGY_INFO } from '../engine/competitors';
import { inventoryValue, netWorth, storeRevenueTotal } from '../engine/selectors';
import { Segmented } from '../components/ui';
import { cr, int, crSigned, initials } from '../lib/format';
import { titleForLevel } from '../engine/progression';
import { formatAgo } from '../engine/time';
import { AVATAR_COLORS } from '../components/Layout';

type Metric = 'netWorth' | 'revenue' | 'profit' | 'sales' | 'level' | 'inventory';

const METRICS: { id: Metric; label: string }[] = [
  { id: 'netWorth', label: 'Net worth' },
  { id: 'revenue', label: 'Store revenue' },
  { id: 'profit', label: 'Realized profit' },
  { id: 'sales', label: 'Units sold' },
  { id: 'level', label: 'Level' },
  { id: 'inventory', label: 'Inventory value' },
];

interface Row {
  id: string;
  name: string;
  owner: string;
  sim: boolean;
  color: string;
  netWorth: number;
  revenue: number;
  profit: number;
  sales: number;
  level: number;
  inventory: number;
  detail: string;
}

export function Leaderboard() {
  const s = useGameState((st) => st);
  const [metric, setMetric] = useState<Metric>('netWorth');

  const rows = useMemo(() => {
    const list: Row[] = s.competitors.map((c) => ({
      id: c.id,
      name: c.name,
      owner: `${STRATEGY_INFO[c.strategy].label}`,
      sim: true,
      color: c.color,
      netWorth: competitorNetWorth(s, c),
      revenue: c.revenue,
      profit: c.realizedProfit,
      sales: c.sales,
      level: c.level,
      inventory: competitorInventoryValue(s, c),
      detail: `${c.lastAction} · ${formatAgo(s.clock.t, c.lastActionAt)}`,
    }));
    if (s.settings.showOnLeaderboard) {
      list.push({
        id: 'me',
        name: s.stores[0].name,
        owner: s.profile.name,
        sim: false,
        color: AVATAR_COLORS[s.profile.avatar % AVATAR_COLORS.length],
        netWorth: netWorth(s),
        revenue: storeRevenueTotal(s),
        profit: s.wallet.realizedProfit,
        sales: s.counters.unitsSold,
        level: s.progression.level,
        inventory: inventoryValue(s),
        detail: `${titleForLevel(s.progression.level)} · ${s.stores.length} store${s.stores.length > 1 ? 's' : ''}`,
      });
    }
    return list.sort((a, b) => b[metric] - a[metric]);
  }, [s, metric]);

  const fmt = (r: Row) => (metric === 'sales' || metric === 'level' ? int(r[metric]) : metric === 'profit' ? `${crSigned(r.profit)} CR` : `${cr(r[metric])} CR`);
  const myRank = rows.findIndex((r) => r.id === 'me') + 1;
  // Secondary columns never repeat the ranking metric.
  const col2: Metric = metric === 'netWorth' ? 'profit' : 'netWorth';
  const col3: Metric = metric === 'sales' ? 'level' : 'sales';
  const label = (m: Metric) => METRICS.find((x) => x.id === m)!.label;
  const cell = (r: Row, m: Metric) => (m === 'sales' || m === 'level' ? int(r[m]) : m === 'profit' ? crSigned(r.profit) : cr(r[m]));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Competitive economy</div>
          <h1>Leaderboard</h1>
          <p className="sub">
            You compete against five <strong>simulated rival businesses</strong>. They are not real players: each follows a published rule set, trades on the same market (their buying and selling really moves supply and
            prices) and runs a storefront.
          </p>
        </div>
        {myRank > 0 && (
          <div className="card card-pad" style={{ minWidth: 180 }}>
            <div className="label">Your rank</div>
            <div className="display" style={{ fontSize: 46 }}>
              #{myRank} <span className="dim" style={{ fontSize: 20 }}>/ {rows.length}</span>
            </div>
          </div>
        )}
      </div>

      <div className="row-wrap" style={{ marginBottom: 14 }}>
        <Segmented value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.id, label: m.label }))} label="Ranking metric" />
      </div>

      {!s.settings.showOnLeaderboard && (
        <div className="notice notice-info" style={{ marginBottom: 14 }}>
          <Info size={16} />
          <div>You’ve hidden yourself from the leaderboard in Settings → Privacy.</div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="lb-row dim" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', paddingTop: 10, paddingBottom: 10 }}>
          <span>#</span>
          <span>Business</span>
          <span className="right">{METRICS.find((m) => m.id === metric)!.label}</span>
          <span className="right hide-sm">{label(col2)}</span>
          <span className="right hide-sm">{label(col3)}</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.id} className={`lb-row ${r.sim ? '' : 'me'}`}>
            <span className="lb-rank" style={{ color: i === 0 ? 'var(--gold-2)' : undefined }}>
              {i === 0 ? <Trophy size={22} /> : i + 1}
            </span>
            <div className="row" style={{ gap: 12, minWidth: 0 }}>
              <span className="avatar" style={{ width: 36, height: 36 }}>
                <span className="face" style={{ width: 34, height: 34, background: r.color, color: '#0a0a0b' }}>
                  {r.sim ? <Bot size={16} /> : initials(r.owner)}
                </span>
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="ellipsis" style={{ fontWeight: 700 }}>{r.name}</span>
                  {r.sim ? (
                    <span className="badge badge-sim">
                      <Bot size={10} /> Simulated
                    </span>
                  ) : (
                    <span className="badge badge-accent">
                      <User size={10} /> You
                    </span>
                  )}
                </div>
                <div className="dim ellipsis" style={{ fontSize: 12 }}>
                  {r.sim ? r.owner : r.owner} · Lv {r.level} · {r.detail}
                </div>
              </div>
            </div>
            <span className="right num" style={{ fontWeight: 650 }}>{fmt(r)}</span>
            <span className="right num hide-sm">{cell(r, col2)}</span>
            <span className="right num hide-sm">{cell(r, col3)}</span>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <h2>How the rivals play</h2>
        </div>
        <div className="grid grid-3">
          {s.competitors.map((c) => (
            <div key={c.id} className="card card-pad">
              <div className="row" style={{ gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
                <strong>{c.name}</strong>
                <span className="badge badge-sim" style={{ marginLeft: 'auto' }}>
                  {STRATEGY_INFO[c.strategy].label}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{STRATEGY_INFO[c.strategy].rule}</p>
              <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
                Started with {cr(c.startingCash)} CR · holds {Object.keys(c.holdings).length} positions
              </p>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 14 }}>
          Multiplayer is not part of this single-player release: there are no real opponents, no shared server and nothing to trade with other people. Rivals start on Day 1 with cash only, just like you.
        </p>
      </section>
    </div>
  );
}
