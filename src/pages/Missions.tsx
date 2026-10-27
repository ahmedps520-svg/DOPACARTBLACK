import { useMemo } from 'react';
import { Award, CheckCircle2, Gift, Lock, Medal, Share2, Target, CalendarClock } from 'lucide-react';
import { useGameState } from '../state/gameStore';
import { ACHIEVEMENTS, MISSIONS, TITLES, allUnlocks, evaluateDaily, rewardText, titleForLevel, xpForLevel, MAX_LEVEL } from '../engine/progression';
import { claimDaily, claimMission } from '../engine/commands';
import { useAction, useIntentKey } from '../lib/hooks';
import { Meter } from '../components/ui';
import { int } from '../lib/format';
import { formatDuration, formatGameTime, startOfDay } from '../engine/time';
import { MINUTES_PER_DAY } from '../engine/constants';
import { downloadAchievementCard } from '../lib/shareCard';

function ClaimButton({ onClaim, label = 'Claim' }: { onClaim: (key: string) => boolean; label?: string }) {
  const [key, renew] = useIntentKey();
  return (
    <button
      className="btn btn-gold btn-sm"
      onClick={() => {
        if (onClaim(key)) renew();
      }}
    >
      <Gift size={14} /> {label}
    </button>
  );
}

export function Missions() {
  const s = useGameState((st) => st);
  const { run } = useAction();
  const p = s.progression;
  const cur = xpForLevel(p.level);
  const next = xpForLevel(p.level + 1);
  const unlocks = useMemo(() => allUnlocks().filter((u) => u.level > p.level).slice(0, 6), [p.level]);
  const nextTitle = TITLES.find((t) => t.level > p.level);
  const dailies = p.daily.ids.map((id) => evaluateDaily(s, id));
  const dayEnds = startOfDay(s.clock.t) + MINUTES_PER_DAY;
  const groups = ['Getting Started', 'Trading', 'Business', 'Mastery'] as const;
  const frac = p.level >= MAX_LEVEL ? 1 : (p.xp - cur) / Math.max(1, next - cur);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Progression</div>
          <h1>Missions & Levels</h1>
          <p className="sub">Experience comes from real business results — profit, deliveries, missions and achievements. Rewards are granted only after the game verifies each condition.</p>
        </div>
      </div>

      <div className="card level-hero">
        <div className="level-ring" aria-label={`Level ${p.level}`}>
          <svg viewBox="0 0 120 120" width={120} height={120}>
            <circle cx={60} cy={60} r={52} fill="none" stroke="var(--surface-3)" strokeWidth={8} />
            <circle cx={60} cy={60} r={52} fill="none" stroke="url(#lvl-grad)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${frac * 326.7} 326.7`} transform="rotate(-90 60 60)" />
            <defs>
              <linearGradient id="lvl-grad" x1="0" x2="1">
                <stop offset="0" stopColor="#c49a2b" />
                <stop offset="1" stopColor="#f3d27a" />
              </linearGradient>
            </defs>
          </svg>
          <span className="num-big">{p.level}</span>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <div>
            <div className="label">Current title</div>
            <div className="display" style={{ fontSize: 40 }}>{titleForLevel(p.level)}</div>
          </div>
          <div>
            <Meter value={frac} max={1} tone="gold" />
            <div className="spread dim" style={{ fontSize: 12, marginTop: 6 }}>
              <span className="num">{int(p.xp)} XP total</span>
              <span>{p.level >= MAX_LEVEL ? 'Maximum level reached' : `${int(next - p.xp)} XP to level ${p.level + 1}`}</span>
            </div>
          </div>
          {nextTitle && <div className="dim" style={{ fontSize: 13 }}>Next title: <strong style={{ color: 'var(--text)' }}>{nextTitle.title}</strong> at level {nextTitle.level}</div>}
        </div>
      </div>

      <div className="grid grid-2 section" style={{ marginTop: 24, alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h2 className="row" style={{ gap: 8 }}>
              <CalendarClock size={16} /> Daily challenges
            </h2>
            <span className="dim" style={{ fontSize: 12 }}>Reset in {formatDuration(dayEnds - s.clock.t)}</span>
          </div>
          <div className="card-body">
            {dailies.map((d) => {
              const claimed = p.daily.claimed.includes(d.id);
              const done = d.current >= d.target;
              return (
                <div key={d.id} className={`mission ${claimed ? 'done' : ''}`}>
                  <div>
                    <div className="m-title" style={{ fontWeight: 650 }}>{d.title}</div>
                    <div style={{ margin: '8px 0 4px' }}>
                      <Meter value={Math.min(d.current, d.target)} max={d.target} tone={done ? 'up' : undefined} />
                    </div>
                    <div className="dim" style={{ fontSize: 12 }}>
                      {d.unit === '%' ? `${d.current}% / ${d.target}%` : `${int(Math.min(d.current, d.target))} / ${int(d.target)}${d.unit ? ` ${d.unit}` : ''}`} · {rewardText(d.xp, d.credits)}
                    </div>
                  </div>
                  {claimed ? (
                    <span className="badge badge-up">
                      <CheckCircle2 size={12} /> Claimed
                    </span>
                  ) : done ? (
                    <ClaimButton onClaim={(key) => !!run((st) => claimDaily(st, d.id, key), { sound: 'coin', success: 'Challenge reward claimed', successBody: rewardText(d.xp, d.credits) })?.ok} />
                  ) : (
                    <span className="badge">In progress</span>
                  )}
                </div>
              );
            })}
            <p className="hint" style={{ marginTop: 10 }}>Three challenges per in-game day. Unclaimed rewards expire at midnight.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="row" style={{ gap: 8 }}>
              <Lock size={16} /> Coming up
            </h2>
          </div>
          <div className="card-body">
            {unlocks.length === 0 && <div className="dim">Everything is unlocked.</div>}
            {unlocks.map((u) => (
              <div key={u.label} className="list-row">
                <span className="badge" style={{ minWidth: 54, justifyContent: 'center' }}>Lv {u.level}</span>
                <span className="grow">{u.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <section className="section" key={g}>
          <div className="section-head">
            <h2 className="row" style={{ gap: 10 }}>
              <Target size={20} className="accent" /> {g}
            </h2>
          </div>
          <div className="card card-pad" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {MISSIONS.filter((m) => m.group === g).map((m) => {
              const st = p.missions[m.id];
              const [c, t] = m.progress(s);
              const completed = st?.completedAt !== undefined;
              const claimed = st?.claimedAt !== undefined;
              return (
                <div key={m.id} className={`mission ${claimed ? 'done' : ''}`}>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      {claimed && <CheckCircle2 size={15} className="up" />}
                      <span className="m-title" style={{ fontWeight: 650 }}>{m.title}</span>
                      <span className="dim" style={{ fontSize: 12 }}>{rewardText(m.xp, m.credits)}</span>
                    </div>
                    <div className="dim" style={{ fontSize: 13, marginTop: 2 }}>{m.description}</div>
                    {!completed && (
                      <div style={{ marginTop: 8, maxWidth: 420 }}>
                        <Meter value={Math.min(c, t)} max={t} />
                        <div className="dim num" style={{ fontSize: 11, marginTop: 4 }}>
                          {int(Math.min(c, t))} / {int(t)}
                        </div>
                      </div>
                    )}
                    {completed && st?.completedAt !== undefined && <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Completed {formatGameTime(st.completedAt)}</div>}
                  </div>
                  {claimed ? (
                    <span className="badge badge-up">Claimed</span>
                  ) : completed ? (
                    <ClaimButton onClaim={(key) => !!run((stt) => claimMission(stt, m.id, key), { sound: 'coin', success: `Mission reward: ${m.title}`, successBody: rewardText(m.xp, m.credits) })?.ok} />
                  ) : (
                    <span className="badge">{Math.floor((Math.min(c, t) / t) * 100)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="row" style={{ gap: 10 }}>
              <Award size={22} className="gold" /> Achievements
            </h2>
            <div className="sub">
              {Object.keys(p.achievements).length} of {ACHIEVEMENTS.length} unlocked · XP is granted automatically
            </div>
          </div>
        </div>
        <div className="grid grid-3">
          {ACHIEVEMENTS.map((a) => {
            const at = p.achievements[a.id];
            const unlocked = at !== undefined;
            return (
              <div key={a.id} className={`achievement ${unlocked ? 'unlocked' : 'locked'}`}>
                <span className="medal">{unlocked ? <Medal size={20} /> : <Lock size={18} />}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{a.title}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{a.description}</div>
                  <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>{unlocked ? `Unlocked ${formatGameTime(at)} · +${a.xp} XP` : `+${a.xp} XP`}</div>
                </div>
                {unlocked && (
                  <button className="icon-btn" title="Download share card" aria-label={`Share ${a.title}`} onClick={() => downloadAchievementCard(s, a.title, a.description)}>
                    <Share2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
