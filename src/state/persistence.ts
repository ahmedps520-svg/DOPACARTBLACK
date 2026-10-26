/**
 * Local persistence. The whole GameState is stored as one structured-clone
 * value in IndexedDB (falls back to localStorage when IndexedDB is blocked).
 */
import { createStore, get, set, del } from 'idb-keyval';
import type { GameState } from '../engine/types';
import { SAVE_VERSION } from '../engine/constants';

const KEY = 'dopacart-save';
const LS_KEY = 'dopacart-save-fallback';

let idb: ReturnType<typeof createStore> | null = null;
function store() {
  if (!idb) idb = createStore('dopacart', 'saves');
  return idb;
}

let idbBroken = false;

export async function loadGame(): Promise<GameState | null> {
  try {
    if (!idbBroken) {
      const v = await get<GameState>(KEY, store());
      if (v) return migrate(v);
    }
  } catch {
    idbBroken = true;
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function saveGame(s: GameState): Promise<void> {
  if (!idbBroken) {
    try {
      await set(KEY, s, store());
      return;
    } catch {
      idbBroken = true;
    }
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: nothing more we can do; the UI warns via status.
    throw new Error('Unable to save progress: browser storage is unavailable.');
  }
}

export async function deleteGame(): Promise<void> {
  try {
    await del(KEY, store());
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

function migrate(s: GameState): GameState | null {
  if (!s || typeof s !== 'object' || typeof s.version !== 'number') return null;
  if (s.version > SAVE_VERSION) return null;
  return s;
}

/** Validate an imported save file enough to refuse obvious garbage. */
export function parseSaveFile(text: string): GameState {
  const s = JSON.parse(text) as GameState;
  const ok =
    s &&
    s.version === SAVE_VERSION &&
    typeof s.wallet?.cash === 'number' &&
    s.market &&
    Array.isArray(s.transactions) &&
    s.clock &&
    typeof s.clock.t === 'number';
  if (!ok) throw new Error('This file is not a DOPACART save for this version.');
  return s;
}
