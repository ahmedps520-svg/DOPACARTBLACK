/**
 * Structural sharing: returns `next`, but with every subtree that is deeply
 * equal to the matching subtree of `prev` replaced by the `prev` reference.
 * Lets React skip re-rendering components whose slice did not change after
 * a simulation tick that ran on a cloned state.
 */
export function replaceEqualDeep<T>(prev: T, next: T): T {
  if (prev === next) return prev;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let equal = prev.length === next.length;
    const out = next.map((item, i) => {
      const v = i < prev.length ? replaceEqualDeep(prev[i], item) : item;
      if (v !== prev[i]) equal = false;
      return v;
    });
    return (equal ? prev : out) as T;
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    const pk = Object.keys(prev);
    const nk = Object.keys(next);
    let equal = pk.length === nk.length;
    const out: Record<string, unknown> = {};
    for (const k of nk) {
      const v = replaceEqualDeep((prev as Record<string, unknown>)[k], (next as Record<string, unknown>)[k]);
      out[k] = v;
      if (v !== (prev as Record<string, unknown>)[k]) equal = false;
    }
    return (equal ? prev : out) as T;
  }
  return next;
}

function isPlainObject(o: unknown): o is Record<string, unknown> {
  return typeof o === 'object' && o !== null && Object.getPrototypeOf(o) === Object.prototype;
}
