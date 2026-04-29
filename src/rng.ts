// Tiny seedable PRNG. Used by challenge mode so a given challenge id
// produces the same wave sequence on every replay (shape rolls, kind
// dispatches, sub-tilt jitter, column picks). Endless mode uses
// Math.random and stays fresh per run.
//
// Algorithm: mulberry32 — 32-bit state, ~2^32 period, good enough for
// gameplay-grade randomness and trivially reproducible across V8 /
// JavaScriptCore (the iOS WKWebView). API matches Math.random:
// `() => number` returning [0, 1).

export type Random = () => number;

export function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable string → 32-bit hash (FNV-1a). Same hash on V8 / JSC, so a
// challenge id like "3-4" maps to the same seed everywhere.
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
