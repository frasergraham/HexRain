// Validation + resolver tests for the endless-balance override layer.
//
// validatePayload is the security boundary between CloudKit-delivered
// data and the live game — every reject case earns its own line so a
// regression that relaxes a guard is loud.
//
// The resolvers (getEffectiveDifficultyConfig / getEffectiveGlobalTunables
// / snapshotEndlessBalance) exercise the localStorage-backed merge path
// end-to-end so the integration with storage.ts can't silently break.

import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GLOBAL_TUNABLES,
  buildSnapshot,
  clearOverride,
  getEffectiveDifficultyConfig,
  getEffectiveGlobalTunables,
  loadOverrideStore,
  snapshotEndlessBalance,
  snapshotFromOverrides,
  upsertOverride,
  validatePayload,
} from "../src/endlessBalance";
import { DIFFICULTY_CONFIG } from "../src/spawnKind";

beforeEach(() => {
  localStorage.clear();
});

describe("validatePayload — happy paths", () => {
  it("accepts an empty difficulty override", () => {
    const r = validatePayload({
      scope: "medium", version: 1, updatedAt: 1, config: {},
    });
    expect(r).toEqual({ ok: true, errors: [] });
  });

  it("accepts an empty global override", () => {
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1, global: {},
    });
    expect(r).toEqual({ ok: true, errors: [] });
  });

  it("accepts a payload with no config/global at all (silent no-op)", () => {
    const r = validatePayload({ scope: "easy", version: 1, updatedAt: 1 });
    expect(r.ok).toBe(true);
  });

  it("accepts a realistic difficulty tweak", () => {
    const r = validatePayload({
      scope: "hardcore",
      version: 3,
      updatedAt: Date.now(),
      note: "ship it",
      config: { stickyMul: 0.08, helpfulMul: 0.07, dangerSize: 5 },
    });
    expect(r.ok).toBe(true);
  });

  it("accepts a realistic global tweak", () => {
    const r = validatePayload({
      scope: "global",
      version: 1,
      updatedAt: Date.now(),
      global: { lateRampCap: 1.4, swarmWaveChance: 0.30 },
    });
    expect(r.ok).toBe(true);
  });
});

describe("validatePayload — top-level rejects", () => {
  it("rejects non-object payloads", () => {
    expect(validatePayload(null).ok).toBe(false);
    expect(validatePayload("oops").ok).toBe(false);
    expect(validatePayload(42).ok).toBe(false);
  });

  it("rejects an unknown scope", () => {
    const r = validatePayload({
      scope: "PAINFUL", version: 1, updatedAt: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/scope/);
  });

  it("rejects a missing/zero/non-finite version", () => {
    expect(validatePayload({ scope: "easy", updatedAt: 1 }).ok).toBe(false);
    expect(validatePayload({ scope: "easy", version: 0, updatedAt: 1 }).ok).toBe(false);
    expect(validatePayload({ scope: "easy", version: NaN, updatedAt: 1 }).ok).toBe(false);
  });

  it("rejects a missing/zero/non-finite updatedAt", () => {
    expect(validatePayload({ scope: "easy", version: 1 }).ok).toBe(false);
    expect(validatePayload({ scope: "easy", version: 1, updatedAt: 0 }).ok).toBe(false);
    expect(validatePayload({ scope: "easy", version: 1, updatedAt: Infinity }).ok).toBe(false);
  });
});

describe("validatePayload — scope / field exclusivity", () => {
  it("rejects a global scope that sets config", () => {
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1, config: { stickyMul: 0.5 },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/must not set config/);
  });

  it("rejects a difficulty scope that sets global", () => {
    const r = validatePayload({
      scope: "medium", version: 1, updatedAt: 1, global: { lateRampCap: 1.4 },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/must not set global/);
  });
});

describe("validatePayload — numeric range guards", () => {
  it("rejects difficulty mul fields above the upper bound", () => {
    const r = validatePayload({
      scope: "easy", version: 1, updatedAt: 1, config: { stickyMul: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/stickyMul/);
  });

  it("rejects negative mul fields", () => {
    const r = validatePayload({
      scope: "easy", version: 1, updatedAt: 1, config: { helpfulMul: -1 },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects NaN/Infinity in numeric config fields", () => {
    expect(validatePayload({
      scope: "easy", version: 1, updatedAt: 1, config: { stickyMul: NaN },
    }).ok).toBe(false);
    expect(validatePayload({
      scope: "easy", version: 1, updatedAt: 1, config: { stickyMul: Infinity },
    }).ok).toBe(false);
  });

  it("rejects dangerSize out of [1, 20]", () => {
    expect(validatePayload({
      scope: "easy", version: 1, updatedAt: 1, config: { dangerSize: 0 },
    }).ok).toBe(false);
    expect(validatePayload({
      scope: "easy", version: 1, updatedAt: 1, config: { dangerSize: 99 },
    }).ok).toBe(false);
  });

  it("rejects probability fields outside [0, 1]", () => {
    expect(validatePayload({
      scope: "global", version: 1, updatedAt: 1, global: { swarmStickyChance: 2 },
    }).ok).toBe(false);
    expect(validatePayload({
      scope: "global", version: 1, updatedAt: 1, global: { swarmWaveChance: -0.1 },
    }).ok).toBe(false);
  });

  it("rejects lateRampCap < 1 (would slow score-0 below 1×)", () => {
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1, global: { lateRampCap: 0.5 },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects helpfulExclude entries that aren't valid cluster kinds", () => {
    const r = validatePayload({
      scope: "easy", version: 1, updatedAt: 1,
      config: { helpfulExclude: ["slow", "banana"] as unknown[] as readonly never[] },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/banana/);
  });
});

describe("validatePayload — tier-weight sum guard", () => {
  it("accepts a sum exactly at 1.0", () => {
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1,
      global: { stickyTierWeight: 0.4, helpfulTierWeight: 0.4, challengeTierWeight: 0.2 },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a sum > 1.0 (would eliminate Normal residual)", () => {
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1,
      global: { stickyTierWeight: 0.5, helpfulTierWeight: 0.5, challengeTierWeight: 0.5 },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/tier weights sum > 1/);
  });

  it("rejects a partial override that tips the merged sum past 1.0", () => {
    // defaults: helpful 0.19, challenge 0.05 → 0.24. sticky=0.85 → sum 1.09.
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1,
      global: { stickyTierWeight: 0.85 },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/sticky=0\.85/);
  });

  it("accepts a partial override that keeps the merged sum at-or-below 1.0", () => {
    // defaults: sticky 0.10, challenge 0.05 → 0.15. helpful=0.50 → sum 0.65.
    const r = validatePayload({
      scope: "global", version: 1, updatedAt: 1,
      global: { helpfulTierWeight: 0.5 },
    });
    expect(r.ok).toBe(true);
  });
});

describe("upsertOverride — store mechanics", () => {
  it("stores a valid payload + returns true", () => {
    const ok = upsertOverride({
      scope: "easy", version: 1, updatedAt: 1000, config: { stickyMul: 0.6 },
    });
    expect(ok).toBe(true);
    const store = loadOverrideStore();
    expect(store.byScope.easy?.payload.config?.stickyMul).toBe(0.6);
  });

  it("rejects an invalid payload + returns false", () => {
    const ok = upsertOverride({
      scope: "easy", version: 1, updatedAt: 1000, config: { stickyMul: -5 },
    });
    expect(ok).toBe(false);
    expect(loadOverrideStore().byScope.easy).toBeUndefined();
  });

  it("ignores an updatedAt that's not strictly newer", () => {
    upsertOverride({
      scope: "easy", version: 1, updatedAt: 1000, config: { stickyMul: 0.6 },
    });
    const wrote = upsertOverride({
      scope: "easy", version: 99, updatedAt: 1000, config: { stickyMul: 0.9 },
    });
    expect(wrote).toBe(false);
    expect(loadOverrideStore().byScope.easy?.payload.config?.stickyMul).toBe(0.6);
  });

  it("clearOverride drops the entry", () => {
    upsertOverride({ scope: "hard", version: 1, updatedAt: 1, config: { stickyMul: 0.1 } });
    expect(clearOverride("hard")).toBe(true);
    expect(loadOverrideStore().byScope.hard).toBeUndefined();
  });
});

describe("resolvers", () => {
  it("getEffectiveDifficultyConfig returns the baked default when no override", () => {
    expect(getEffectiveDifficultyConfig("medium")).toEqual(DIFFICULTY_CONFIG.medium);
  });

  it("getEffectiveDifficultyConfig merges override fields on top of the default", () => {
    upsertOverride({
      scope: "medium", version: 1, updatedAt: 1, config: { stickyMul: 0.5 },
    });
    const eff = getEffectiveDifficultyConfig("medium");
    // Override wins…
    expect(eff.stickyMul).toBe(0.5);
    // …other fields fall through to the baseline.
    expect(eff.helpfulMul).toBe(DIFFICULTY_CONFIG.medium.helpfulMul);
    expect(eff.dangerSize).toBe(DIFFICULTY_CONFIG.medium.dangerSize);
  });

  it("getEffectiveGlobalTunables returns the bundle defaults when no override", () => {
    expect(getEffectiveGlobalTunables()).toEqual(DEFAULT_GLOBAL_TUNABLES);
  });

  it("getEffectiveGlobalTunables merges override fields on top of the defaults", () => {
    upsertOverride({
      scope: "global", version: 1, updatedAt: 1, global: { lateRampCap: 1.4 },
    });
    const eff = getEffectiveGlobalTunables();
    expect(eff.lateRampCap).toBe(1.4);
    expect(eff.lateRampFloorScore).toBe(DEFAULT_GLOBAL_TUNABLES.lateRampFloorScore);
  });
});

describe("snapshotEndlessBalance", () => {
  it("packages cfg + tunables + derived bundles", () => {
    const snap = snapshotEndlessBalance("medium");
    expect(snap.difficulty).toBe("medium");
    expect(snap.config).toEqual(DIFFICULTY_CONFIG.medium);
    expect(snap.tierWeights.sticky).toBe(DEFAULT_GLOBAL_TUNABLES.stickyTierWeight);
    expect(snap.lateRamp.cap).toBe(DEFAULT_GLOBAL_TUNABLES.lateRampCap);
    expect(snap.spawnInterval.start).toBe(DEFAULT_GLOBAL_TUNABLES.spawnIntervalStart);
  });

  it("picks up localStorage-backed overrides at snapshot time", () => {
    upsertOverride({
      scope: "hardcore", version: 1, updatedAt: 1, config: { stickyMul: 0.10 },
    });
    upsertOverride({
      scope: "global", version: 1, updatedAt: 1, global: { lateRampCap: 1.3 },
    });
    const snap = snapshotEndlessBalance("hardcore");
    expect(snap.config.stickyMul).toBe(0.10);
    expect(snap.lateRamp.cap).toBe(1.3);
  });

  it("is frozen — mutation attempts have no effect", () => {
    const snap = snapshotEndlessBalance("easy");
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.config)).toBe(true);
    expect(Object.isFrozen(snap.tunables)).toBe(true);
    expect(Object.isFrozen(snap.tierWeights)).toBe(true);
    expect(Object.isFrozen(snap.lateRamp)).toBe(true);
    expect(Object.isFrozen(snap.spawnInterval)).toBe(true);
  });

  it("buildSnapshot composes explicit inputs without consulting storage", () => {
    const snap = buildSnapshot("hard", DIFFICULTY_CONFIG.hard, DEFAULT_GLOBAL_TUNABLES);
    expect(snap.difficulty).toBe("hard");
    expect(snap.config).toEqual(DIFFICULTY_CONFIG.hard);
  });

  it("snapshotFromOverrides applies partial overrides without touching storage", () => {
    const snap = snapshotFromOverrides(
      "easy",
      { stickyMul: 0.99 },
      { lateRampCap: 1.2 },
    );
    expect(snap.config.stickyMul).toBe(0.99);
    expect(snap.lateRamp.cap).toBe(1.2);
    // …and storage is untouched.
    expect(loadOverrideStore().byScope.easy).toBeUndefined();
  });
});
