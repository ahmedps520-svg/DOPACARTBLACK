/**
 * Bridges the pure engine to React. Holds the current GameState, runs the
 * clock, persists after every change and turns new notifications into
 * toasts. Components never mutate state directly — they dispatch commands.
 */
import { create } from 'zustand';
import type { CommandResult, GameNotification, GameState } from '../engine/types';
import { createNewGame, type NewGameOptions } from '../engine/newGame';
import { advanceRealTime, runTicks } from '../engine/sim';
import { MINUTES_PER_DAY, REAL_MS_PER_TICK, TICK_MINUTES, MAX_OFFLINE_MINUTES } from '../engine/constants';
import { deleteGame, loadGame, parseSaveFile, saveGame } from './persistence';
import { playSound, setMusic, type SoundId } from '../audio/sound';
import { netWorth } from '../engine/selectors';
import { replaceEqualDeep } from './share';

export interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info' | 'gold';
  title: string;
  body?: string;
  link?: string;
}

export interface OfflineReport {
  minutes: number;
  capped: boolean;
  deliveredOrders: string[];
  storeUnits: number;
  cashDelta: number;
  netWorthDelta: number;
  newEvents: string[];
  alerts: number;
}

type Status = 'loading' | 'welcome' | 'playing' | 'elsewhere';

interface Store {
  status: Status;
  game: GameState | null;
  hasSave: boolean;
  saveError: string | null;
  offline: OfflineReport | null;
  toasts: Toast[];
  init: () => Promise<void>;
  newGame: (opts: NewGameOptions) => Promise<void>;
  continueGame: () => Promise<void>;
  takeOver: () => Promise<void>;
  dispatch: <T>(cmd: (s: GameState) => CommandResult<T>, opts?: DispatchOptions) => CommandResult<T> | null;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  dismissOffline: () => void;
  resetGame: () => Promise<void>;
  exportSave: () => string;
  importSave: (text: string) => Promise<void>;
  /** Advance in-game time immediately (testing / impatient players). */
  skipTime: (minutes: number) => void;
}

export interface DispatchOptions {
  success?: string | ((data: unknown) => string);
  successBody?: string;
  sound?: SoundId;
  /** Show an error toast on failure (default true). */
  errorToast?: boolean;
  quiet?: boolean;
  /** UI double-submit lock (default on); settings toggles turn it off. */
  lock?: boolean;
}

let toastSeq = 1;
let ticker: number | null = null;
let lastSave = 0;
let saving = false;
let pendingSave = false;
const tabId = Math.random().toString(36).slice(2);
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dopacart-tabs') : null;

function sfx(id: SoundId) {
  const s = useGame.getState().game?.settings;
  if (s?.sound) playSound(id, s.soundVolume);
}

async function persist(force = false) {
  const g = useGame.getState().game;
  if (!g || useGame.getState().status !== 'playing') return;
  const now = Date.now();
  if (!force && now - lastSave < 2500) {
    pendingSave = true;
    return;
  }
  if (saving) {
    pendingSave = true;
    return;
  }
  saving = true;
  lastSave = now;
  try {
    await saveGame(g);
    if (useGame.getState().saveError) useGame.setState({ saveError: null });
  } catch (e) {
    useGame.setState({ saveError: (e as Error).message });
  } finally {
    saving = false;
    if (pendingSave) {
      pendingSave = false;
      setTimeout(() => void persist(true), 500);
    }
  }
}

function announce(prev: GameState | null, next: GameState) {
  if (!prev) return;
  const seen = new Set(prev.notifications.map((n) => n.id));
  const fresh: GameNotification[] = next.notifications.filter((n) => !seen.has(n.id));
  if (fresh.length === 0) return;
  const show = fresh.slice(0, 3);
  for (const n of show) {
    useGame.getState().toast({
      tone: n.kind === 'level' || n.kind === 'achievement' || n.kind === 'mission' ? 'gold' : 'info',
      title: n.title,
      body: n.body,
      link: n.link,
    });
  }
  if (fresh.some((n) => n.kind === 'level')) sfx('level');
  else sfx('notify');
}

function tick() {
  const { game, status } = useGame.getState();
  if (!game || status !== 'playing') return;
  const now = Date.now();
  // Cheap pre-check so idle intervals do not clone the state.
  const pending = game.settings.speed === 0 ? 0 : game.clock.carryMs + (now - game.clock.lastReal) * game.settings.speed;
  if (pending < REAL_MS_PER_TICK) {
    // Keep the wall-clock anchor fresh without re-rendering subscribers.
    game.clock.carryMs = game.settings.speed === 0 ? 0 : pending;
    game.clock.lastReal = now;
    return;
  }
  const work = structuredClone(game);
  advanceRealTime(work, now);
  const next = replaceEqualDeep(game, work);
  useGame.setState({ game: next });
  announce(game, next);
  void persist();
}

function startTicker() {
  if (ticker !== null) return;
  ticker = window.setInterval(tick, 500);
}

function stopTicker() {
  if (ticker !== null) window.clearInterval(ticker);
  ticker = null;
}

function claimTab() {
  channel?.postMessage({ type: 'takeover', tabId });
}

channel?.addEventListener('message', (e: MessageEvent) => {
  if (e.data?.type === 'takeover' && e.data.tabId !== tabId && useGame.getState().status === 'playing') {
    void persist(true);
    stopTicker();
    useGame.setState({ status: 'elsewhere' });
  }
});

/** Catch up elapsed real time (game closed / tab asleep) on a plain copy. */
function catchUp(g: GameState): { state: GameState; report: OfflineReport | null } {
  const elapsedMs = Math.max(0, Date.now() - g.clock.lastReal);
  const minutesWanted = g.settings.speed === 0 ? 0 : ((elapsedMs * g.settings.speed) / REAL_MS_PER_TICK) * TICK_MINUTES;
  const s = structuredClone(g);
  const beforeT = s.clock.t;
  const beforeCash = s.wallet.cash;
  const beforeNw = netWorth(s);
  const beforeUnits = s.counters.storeUnitsSold;
  const beforeEvents = new Set(s.events.map((e) => e.id));
  const activeOrders = new Set(s.orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').map((o) => o.id));
  const beforeAlerts = s.alerts.filter((a) => a.active).length;
  advanceRealTime(s, Date.now());
  const minutes = s.clock.t - beforeT;
  if (minutes < 60) return { state: s, report: null };
  return {
    state: s,
    report: {
      minutes,
      capped: minutesWanted > MAX_OFFLINE_MINUTES,
      deliveredOrders: s.orders.filter((o) => activeOrders.has(o.id) && o.status === 'delivered').map((o) => o.id),
      storeUnits: s.counters.storeUnitsSold - beforeUnits,
      cashDelta: s.wallet.cash - beforeCash,
      netWorthDelta: netWorth(s) - beforeNw,
      newEvents: s.events.filter((e) => !beforeEvents.has(e.id) && e.kind !== 'report').map((e) => e.headline),
      alerts: beforeAlerts - s.alerts.filter((a) => a.active).length,
    },
  };
}

function applySettingsSideEffects(g: GameState) {
  const root = document.documentElement;
  root.dataset.theme = g.settings.theme;
  root.dataset.accent = g.settings.accent;
  root.dataset.motion = g.settings.reducedMotion || !g.settings.animations ? 'reduced' : 'full';
  root.lang = g.settings.language;
  setMusic(g.settings.music, g.settings.musicVolume);
}

export const useGame = create<Store>((set, get) => ({
  status: 'loading',
  game: null,
  hasSave: false,
  saveError: null,
  offline: null,
  toasts: [],

  init: async () => {
    const saved = await loadGame();
    set({ hasSave: !!saved, game: saved, status: 'welcome' });
    if (saved) applySettingsSideEffects(saved);
    window.addEventListener('pagehide', () => void persist(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void persist(true);
    });
  },

  newGame: async (opts) => {
    stopTicker();
    const g = createNewGame(opts);
    claimTab();
    set({ game: g, status: 'playing', hasSave: true, offline: null });
    applySettingsSideEffects(g);
    await persist(true);
    startTicker();
  },

  continueGame: async () => {
    const saved = (await loadGame()) ?? get().game;
    if (!saved) return;
    const { state, report } = catchUp(saved);
    claimTab();
    set({ game: state, status: 'playing', offline: report });
    applySettingsSideEffects(state);
    await persist(true);
    startTicker();
  },

  takeOver: async () => {
    await get().continueGame();
  },

  dispatch: (cmd, opts = {}) => {
    const g = get().game;
    if (!g || get().status !== 'playing') return null;
    const res = cmd(g);
    if (res.ok) {
      if (res.state !== g) {
        set({ game: res.state });
        announce(g, res.state);
        if (res.state.settings !== g.settings) applySettingsSideEffects(res.state);
        void persist(true);
      }
      if (opts.sound) sfx(opts.sound);
      if (opts.success) {
        const title = typeof opts.success === 'function' ? opts.success(res.data) : opts.success;
        get().toast({ tone: 'success', title, body: opts.successBody });
      }
    } else {
      if (opts.errorToast !== false && !opts.quiet) {
        get().toast({ tone: 'error', title: 'Action failed', body: res.error });
        sfx('error');
      }
    }
    return res;
  },

  toast: (t) => {
    const id = toastSeq++;
    set((st) => ({ toasts: [...st.toasts.slice(-4), { ...t, id }] }));
    window.setTimeout(() => get().dismissToast(id), t.tone === 'error' ? 6500 : 4500);
  },

  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  dismissOffline: () => set({ offline: null }),

  resetGame: async () => {
    stopTicker();
    await deleteGame();
    setMusic(false, 0);
    set({ game: null, hasSave: false, status: 'welcome', offline: null });
  },

  exportSave: () => JSON.stringify(get().game),

  importSave: async (text) => {
    const s = parseSaveFile(text);
    stopTicker();
    s.clock.lastReal = Date.now();
    set({ game: s, status: 'playing', hasSave: true, offline: null });
    applySettingsSideEffects(s);
    claimTab();
    await persist(true);
    startTicker();
  },

  skipTime: (minutes) => {
    const g = get().game;
    if (!g) return;
    const n = Math.max(1, Math.round(Math.min(minutes, MINUTES_PER_DAY * 7) / TICK_MINUTES));
    const s = structuredClone(g);
    runTicks(s, n);
    s.clock.lastReal = Date.now();
    const next = replaceEqualDeep(g, s);
    set({ game: next });
    announce(g, next);
    void persist(true);
  },
}));

/** Select from the current game (only valid on in-game screens). */
export function useGameState<T>(selector: (s: GameState) => T): T {
  return useGame((st) => selector(st.game as GameState));
}
