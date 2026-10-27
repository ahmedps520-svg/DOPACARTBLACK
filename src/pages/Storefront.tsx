import { Link } from 'react-router-dom';
import { Download, Share2, Medal, Copy } from 'lucide-react';
import { useGame, useGameState } from '../state/gameStore';
import { StorefrontPreview } from './Store';
import { ACHIEVEMENTS, titleForLevel } from '../engine/progression';
import { netWorth, storeRevenueTotal } from '../engine/selectors';
import { Credits, Notice, Stat } from '../components/ui';
import { downloadAchievementCard, downloadBusinessCard } from '../lib/shareCard';
import { cr, int } from '../lib/format';
import { dayOf } from '../engine/time';

export function Storefront() {
  const s = useGameState((st) => st);
  const toast = useGame((st) => st.toast);
  const unlocked = ACHIEVEMENTS.filter((a) => s.progression.achievements[a.id] !== undefined);
  const enabled = s.settings.publicStorefront;

  const copySummary = async () => {
    const text = `${s.stores.map((x) => x.name).join(' & ')} on DOPACART: BLACK MARKET (a fictional business game) — Level ${s.progression.level} ${titleForLevel(
      s.progression.level,
    )}, net worth ${cr(netWorth(s))} CR, ${int(s.counters.unitsSold)} units sold by Day ${dayOf(s.clock.t)}.`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: 'Summary copied', body: 'Paste it anywhere to share your progress.' });
    } catch {
      toast({ tone: 'error', title: 'Clipboard unavailable', body: text });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Social</div>
          <h1>Storefront & Sharing</h1>
          <p className="sub">Your public-facing storefront and shareable cards. Sharing works offline: download an image or copy a summary — nothing is uploaded anywhere.</p>
        </div>
      </div>

      {!enabled && (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="info">
            Storefront sharing is turned off in <Link to="/settings" className="accent">Settings → Privacy</Link>.
          </Notice>
        </div>
      )}

      <div className="stats-row" style={{ marginBottom: 16 }}>
        <Stat label="Owner">{s.profile.name}</Stat>
        <Stat label="Level">
          {s.progression.level} · <span style={{ fontFamily: 'var(--font)', fontSize: 16 }}>{titleForLevel(s.progression.level)}</span>
        </Stat>
        <Stat label="Net worth">
          <Credits value={netWorth(s)} />
        </Stat>
        <Stat label="Store revenue">
          <Credits value={storeRevenueTotal(s)} />
        </Stat>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          {s.stores.map((st) => (
            <div key={st.id} className="col" style={{ gap: 10 }}>
              <StorefrontPreview store={st} />
              <div className="row-wrap">
                <button className="btn btn-sm" disabled={!enabled} onClick={() => downloadBusinessCard(s, st.name)}>
                  <Download size={14} /> Download business card
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="col" style={{ gap: 16 }}>
          <div className="card card-pad">
            <div className="section-title" style={{ marginBottom: 12 }}>Quick share</div>
            <button className="btn btn-sm" onClick={copySummary} disabled={!enabled}>
              <Copy size={14} /> Copy progress summary
            </button>
            <p className="hint" style={{ marginTop: 10 }}>
              Friends lists, direct trading and online leaderboards need a shared server, which this single-player release doesn’t have. The game is fully playable alone.
            </p>
          </div>
          <div className="card">
            <div className="card-head">
              <h3 className="row" style={{ gap: 8 }}>
                <Medal size={16} /> Achievement cards
              </h3>
              <Link to="/missions" className="dim" style={{ fontSize: 12 }}>
                All achievements →
              </Link>
            </div>
            <div className="card-body">
              {unlocked.length === 0 && <div className="dim" style={{ fontSize: 13 }}>Unlock achievements to create share cards.</div>}
              {unlocked.map((a) => (
                <div key={a.id} className="list-row">
                  <Medal size={16} className="gold" />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div className="dim" style={{ fontSize: 12 }}>{a.description}</div>
                  </div>
                  <button className="btn btn-xs" disabled={!enabled} onClick={() => downloadAchievementCard(s, a.title, a.description)}>
                    <Share2 size={12} /> Card
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
