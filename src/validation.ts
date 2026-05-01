// Small numeric helpers used by data-loading code (custom challenges,
// CloudKit record marshalling). Centralised so the same clamp logic
// doesn't sit duplicated next to two different load paths.

export function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function clampDifficulty(v: number): 1 | 2 | 3 | 4 | 5 {
  return clamp(Math.round(v), 1, 5) as 1 | 2 | 3 | 4 | 5;
}

export function clampStars(v: number): 0 | 1 | 2 | 3 {
  return clamp(Math.round(v), 0, 3) as 0 | 1 | 2 | 3;
}
