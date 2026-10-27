import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CommandResult, GameState } from '../engine/types';
import { useGame, type DispatchOptions } from '../state/gameStore';
import { playSound } from '../audio/sound';

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * An idempotency key for one user intent (e.g. one purchase dialog). It is
 * reused until the command succeeds, so double clicks or retries of the same
 * intent are rejected by the engine instead of executing twice.
 */
export function useIntentKey(): [string, () => void] {
  const [key, setKey] = useState(newKey);
  const renew = useCallback(() => setKey(newKey()), []);
  return [key, renew];
}

/**
 * Dispatch a command. Adds a short in-flight lock so a burst of clicks on
 * the same button cannot fire twice before React re-renders.
 */
export function useAction() {
  const dispatch = useGame((s) => s.dispatch);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    <T,>(cmd: (s: GameState) => CommandResult<T>, opts?: DispatchOptions): CommandResult<T> | null => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        return dispatch(cmd, opts);
      } finally {
        window.setTimeout(() => {
          busyRef.current = false;
          setBusy(false);
        }, 350);
      }
    },
    [dispatch],
  );
  return { run, busy };
}

export function useClickSound() {
  const settings = useGame((s) => s.game?.settings);
  return useCallback(() => {
    if (settings?.sound) playSound('click', settings.soundVolume);
  }, [settings]);
}

export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** Previous value of a prop/state (for flash-on-change animations). */
export function usePrevious<T>(v: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = v;
  }, [v]);
  return ref.current;
}

export function useGo() {
  return useNavigate();
}
