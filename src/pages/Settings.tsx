import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, Music, Palette, Bell, Globe, User, Shield, Database, RotateCcw, FastForward, GraduationCap, Download, Upload } from 'lucide-react';
import { useGame, useGameState } from '../state/gameStore';
import { restartTutorial, updateProfile, updateSettings } from '../engine/commands';
import { useAction } from '../lib/hooks';
import { Modal, Notice, Segmented, Switch } from '../components/ui';
import { playSound } from '../audio/sound';
import { AVATAR_COLORS } from '../components/Layout';
import type { NotificationKind, Settings, Speed } from '../engine/types';
import { initials } from '../lib/format';

const NOTIFY_LABEL: Record<NotificationKind, string> = {
  alert: 'Price alerts',
  order: 'Order & delivery updates',
  store: 'Store activity',
  mission: 'Mission completions',
  level: 'Level-ups',
  event: 'Market events & releases',
  achievement: 'Achievements',
  system: 'System messages',
};

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="spread" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 200 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      <div className="row-wrap">{children}</div>
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head">
        <h2 className="row" style={{ gap: 8 }}>
          {icon} {title}
        </h2>
      </div>
      <div className="card-body" style={{ paddingTop: 4, paddingBottom: 8 }}>
        {children}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const st = useGameState((s) => s.settings);
  const profile = useGameState((s) => s.profile);
  const { run } = useAction();
  const store = useGame();
  const nav = useNavigate();
  const [name, setName] = useState(profile.name);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [importErr, setImportErr] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Settings>, msg?: string) => run((s) => updateSettings(s, patch), msg ? { success: msg, lock: false } : { quiet: true, lock: false });

  const exportSave = () => {
    const blob = new Blob([store.exportSave()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dopacart-save-${profile.name.toLowerCase().replace(/\W+/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">Preferences</div>
          <h1>Settings</h1>
          <p className="sub">Changes save automatically to this device.</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <Panel icon={<Volume2 size={16} />} title="Sound & music">
            <Row label="Sound effects" hint="Purchases, sales, alerts and level-ups">
              <Switch checked={st.sound} onChange={(v) => set({ sound: v })} label="Sound effects" />
            </Row>
            <Row label="Effects volume">
              <input type="range" min={0} max={1} step={0.05} value={st.soundVolume} onChange={(e) => set({ soundVolume: Number(e.target.value) })} aria-label="Effects volume" disabled={!st.sound} />
              <button className="btn btn-xs" onClick={() => playSound('coin', st.soundVolume)} disabled={!st.sound}>
                Test
              </button>
            </Row>
            <Row label="Ambient music" hint="Generative synth pad, made in your browser">
              <Switch checked={st.music} onChange={(v) => set({ music: v })} label="Ambient music" />
            </Row>
            <Row label="Music volume">
              <Music size={14} className="dim" />
              <input type="range" min={0} max={1} step={0.05} value={st.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })} aria-label="Music volume" disabled={!st.music} />
            </Row>
          </Panel>

          <Panel icon={<Palette size={16} />} title="Display & motion">
            <Row label="Theme">
              <Segmented
                value={st.theme}
                onChange={(v) => set({ theme: v })}
                label="Theme"
                options={[
                  { value: 'obsidian', label: 'Obsidian' },
                  { value: 'graphite', label: 'Graphite' },
                  { value: 'midnight', label: 'Midnight' },
                ]}
              />
            </Row>
            <Row label="Accent colour">
              <Segmented
                value={st.accent}
                onChange={(v) => set({ accent: v })}
                label="Accent"
                options={[
                  { value: 'crimson', label: 'Crimson' },
                  { value: 'scarlet', label: 'Scarlet' },
                  { value: 'gold', label: 'Gold' },
                ]}
              />
            </Row>
            <Row label="Animations" hint="Transitions, hover lifts and progress animations">
              <Switch checked={st.animations} onChange={(v) => set({ animations: v })} label="Animations" />
            </Row>
            <Row label="Reduced motion" hint="Removes movement for comfort (also follows your OS setting)">
              <Switch checked={st.reducedMotion} onChange={(v) => set({ reducedMotion: v })} label="Reduced motion" />
            </Row>
          </Panel>

          <Panel icon={<Globe size={16} />} title="Language">
            <Row label="Interface language" hint="Navigation and core controls. Product and news text stays in English.">
              <Segmented
                value={st.language}
                onChange={(v) => set({ language: v })}
                label="Language"
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'es', label: 'Español' },
                ]}
              />
            </Row>
          </Panel>

          <Panel icon={<Bell size={16} />} title="Notifications">
            {(Object.keys(NOTIFY_LABEL) as NotificationKind[])
              .filter((k) => k !== 'system')
              .map((k) => (
                <Row key={k} label={NOTIFY_LABEL[k]}>
                  <Switch checked={st.notify[k] !== false} onChange={(v) => set({ notify: { ...st.notify, [k]: v } })} label={NOTIFY_LABEL[k]} />
                </Row>
              ))}
          </Panel>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <Panel icon={<User size={16} />} title="Account">
            <Row label="Player name">
              <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} aria-label="Player name" />
              <button className="btn btn-sm" disabled={name.trim() === profile.name} onClick={() => run((s) => updateProfile(s, { name }), { success: 'Name updated' })}>
                Save
              </button>
            </Row>
            <Row label="Avatar colour">
              {AVATAR_COLORS.map((c, i) => (
                <button
                  key={c}
                  aria-label={`Avatar colour ${i + 1}`}
                  aria-pressed={profile.avatar === i}
                  onClick={() => run((s) => updateProfile(s, { avatar: i }), { quiet: true })}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: c, color: '#0a0a0b', fontSize: 10, fontWeight: 800, outline: profile.avatar === i ? '2px solid var(--text)' : 'none', outlineOffset: 2 }}
                >
                  {profile.avatar === i ? initials(profile.name) : ''}
                </button>
              ))}
            </Row>
            <p className="hint" style={{ padding: '10px 0' }}>
              This single-player release stores everything on this device — there is no online account, password or personal data collection.
            </p>
          </Panel>

          <Panel icon={<FastForward size={16} />} title="Simulation">
            <Row label="Market speed" hint="1× ≈ 12 real minutes per in-game day. Paused stops prices, deliveries and store sales.">
              <Segmented
                value={st.speed}
                onChange={(v: Speed) => set({ speed: v })}
                label="Market speed"
                options={[
                  { value: 0 as Speed, label: 'Pause' },
                  { value: 1 as Speed, label: '1×' },
                  { value: 2 as Speed, label: '2×' },
                  { value: 4 as Speed, label: '4×' },
                ]}
              />
            </Row>
            <Row label="Fast-forward" hint="Instantly simulates the time using the normal rules (prices, events, deliveries, sales, costs)">
              <button className="btn btn-sm" onClick={() => store.skipTime(60)}>
                +1 hour
              </button>
              <button className="btn btn-sm" onClick={() => store.skipTime(6 * 60)}>
                +6 hours
              </button>
              <button className="btn btn-sm" onClick={() => store.skipTime(24 * 60)}>
                +1 day
              </button>
            </Row>
            <Row label="Tutorial">
              <button
                className="btn btn-sm"
                onClick={() => {
                  run((s) => restartTutorial(s), { success: 'Tutorial restarted' });
                  nav('/');
                }}
              >
                <GraduationCap size={14} /> Restart tutorial
              </button>
            </Row>
          </Panel>

          <Panel icon={<Shield size={16} />} title="Privacy">
            <Row label="Show me on the leaderboard" hint="Your rank among simulated rivals">
              <Switch checked={st.showOnLeaderboard} onChange={(v) => set({ showOnLeaderboard: v })} label="Show on leaderboard" />
            </Row>
            <Row label="Storefront sharing" hint="Allow downloading share cards for your storefront">
              <Switch checked={st.publicStorefront} onChange={(v) => set({ publicStorefront: v })} label="Storefront sharing" />
            </Row>
          </Panel>

          <Panel icon={<Database size={16} />} title="Data">
            <Row label="Export save" hint="Download your full game as a JSON file">
              <button className="btn btn-sm" onClick={exportSave}>
                <Download size={14} /> Export
              </button>
            </Row>
            <Row label="Import save" hint="Replace this game with a previously exported file">
              <input
                ref={file}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    setImportErr('');
                    await store.importSave(await f.text());
                    store.toast({ tone: 'success', title: 'Save imported' });
                    nav('/');
                  } catch (x) {
                    setImportErr((x as Error).message);
                  }
                }}
              />
              <button className="btn btn-sm" onClick={() => file.current?.click()}>
                <Upload size={14} /> Import
              </button>
            </Row>
            {importErr && <p className="error-text">{importErr}</p>}
            <Row label="Reset game" hint="Permanently deletes all progress on this device">
              <button className="btn btn-sm btn-danger" onClick={() => setResetOpen(true)}>
                <RotateCcw size={14} /> Reset game
              </button>
            </Row>
          </Panel>
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset game?"
        kicker="This cannot be undone"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setResetOpen(false)}>
              Keep playing
            </button>
            <button
              className="btn btn-danger"
              disabled={confirmText.trim().toUpperCase() !== 'RESET'}
              onClick={() => {
                setResetOpen(false);
                void store.resetGame();
              }}
            >
              Delete everything
            </button>
          </>
        }
      >
        <Notice tone="error">Your wallet, inventory, stores, orders, history, missions and settings will be permanently deleted from this device.</Notice>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="reset-confirm">Type RESET to confirm</label>
          <input id="reset-confirm" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </div>
  );
}
