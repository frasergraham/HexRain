// Cloud-delivered overrides for endless-mode balance.
//
// Why: shipping a balance tweak to endless mode currently requires an
// app release — fine for web (Railway redeploy), painful for iOS
// (App Store review cycle). This module mirrors src/officialOverrides.ts
// for the endless tunables: cold-launch pull, persist locally, resolve
// through getters that the live game consults.
//
// Scope: per-difficulty DifficultyConfig + a set of global endless
// tunables (tier weights, fall velocities, late-game ramp, spawn
// interval, swarm, geometry-unlock score gates). Each scope is a
// separate CloudKit record name so we can publish them independently.
//
// Apply model: snapshot-at-run-start. Game grabs a snapshot when an
// endless run begins; a CloudKit pull that lands mid-run does NOT
// affect the in-flight run. The next run start picks up the new
// values. Keeps the hot path free of localStorage reads and avoids
// surprising the player mid-game.

import type { ClusterKind, Difficulty } from "./types";
import {
  ANGLED_SPAWNS_SCORE,
  BASE_FALL_SPEED,
  DIFFICULTY_CONFIG,
  MAX_FALL_SPEED,
  SIDE_SPAWNS_SCORE,
  SPAWN_CHALLENGE_TIER_WEIGHT,
  SPAWN_HELPFUL_TIER_WEIGHT,
  SPAWN_STICKY_TIER_WEIGHT,
  SPEED_RAMP,
  SWARM_SPAWN_INTERVAL,
  SWARM_STICKY_CHANCE,
  SWARM_WAVE_CHANCE,
  type DifficultyConfig,
  type TierWeights,
} from "./spawnKind";
import {
  DEFAULT_LATE_RAMP_CAP,
  DEFAULT_LATE_RAMP_FLOOR_SCORE,
  DEFAULT_LATE_RAMP_PER_100,
  DEFAULT_SPAWN_INTERVAL_MIN,
  DEFAULT_SPAWN_INTERVAL_RAMP,
  DEFAULT_SPAWN_INTERVAL_START,
  type LateRampTunables,
  type SpawnIntervalTunables,
} from "./spawn";
import { loadJson, saveJson } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

// ---------- Types --------------------------------------------------------

export type EndlessOverrideScope = "easy" | "medium" | "hard" | "hardcore" | "global";

export const DIFFICULTY_SCOPES: readonly Difficulty[] = ["easy", "medium", "hard", "hardcore"];

// Global endless tunables. Everything here is a module-level constant
// in spawnKind.ts / spawn.ts today; this interface mirrors that set so
// a CloudKit override can swap any subset of them at run start.
export interface GlobalEndlessTunables {
  // Tier weights — sum may undershoot 1; the remainder is the Normal
  // tier's residual share. Increases push more specials into the mix;
  // decreases push more Normal blues.
  stickyTierWeight: number;
  helpfulTierWeight: number;
  challengeTierWeight: number;

  // Calm-wave spawn cadence.
  spawnIntervalStart: number;
  spawnIntervalMin: number;
  spawnIntervalRamp: number;

  // Initial cluster fall velocity.
  baseFallSpeed: number;
  speedRamp: number;
  maxFallSpeed: number;

  // Late-game permanent speed multiplier.
  lateRampFloorScore: number;
  lateRampPer100: number;
  lateRampCap: number;

  // Swarm waves (single-hex sprays).
  swarmWaveChance: number;
  swarmSpawnInterval: number;
  swarmStickyChance: number;

  // Score thresholds for advanced spawn geometry.
  angledSpawnsScore: number;
  sideSpawnsScore: number;
}

export const DEFAULT_GLOBAL_TUNABLES: GlobalEndlessTunables = {
  stickyTierWeight: SPAWN_STICKY_TIER_WEIGHT,
  helpfulTierWeight: SPAWN_HELPFUL_TIER_WEIGHT,
  challengeTierWeight: SPAWN_CHALLENGE_TIER_WEIGHT,
  spawnIntervalStart: DEFAULT_SPAWN_INTERVAL_START,
  spawnIntervalMin: DEFAULT_SPAWN_INTERVAL_MIN,
  spawnIntervalRamp: DEFAULT_SPAWN_INTERVAL_RAMP,
  baseFallSpeed: BASE_FALL_SPEED,
  speedRamp: SPEED_RAMP,
  maxFallSpeed: MAX_FALL_SPEED,
  lateRampFloorScore: DEFAULT_LATE_RAMP_FLOOR_SCORE,
  lateRampPer100: DEFAULT_LATE_RAMP_PER_100,
  lateRampCap: DEFAULT_LATE_RAMP_CAP,
  swarmWaveChance: SWARM_WAVE_CHANCE,
  swarmSpawnInterval: SWARM_SPAWN_INTERVAL,
  swarmStickyChance: SWARM_STICKY_CHANCE,
  angledSpawnsScore: ANGLED_SPAWNS_SCORE,
  sideSpawnsScore: SIDE_SPAWNS_SCORE,
};

export interface EndlessOverridePayload {
  scope: EndlessOverrideScope;
  /** Set when scope ∈ DIFFICULTY_SCOPES — partial DifficultyConfig override. */
  config?: Partial<DifficultyConfig>;
  /** Set when scope === "global" — partial GlobalEndlessTunables override. */
  global?: Partial<GlobalEndlessTunables>;
  /** Monotonic version. Bumped on a normal upload; held flat for a
   *  silent publish (alongside an updatedAt bump). */
  version: number;
  /** Server-side updatedAt timestamp. Drives refresh independently of
   *  version — silent publish path. */
  updatedAt: number;
  /** Optional changelog blurb (admin-facing, not shown in-game). */
  note?: string;
}

export interface EndlessOverrideEntry {
  payload: EndlessOverridePayload;
  lastSeenVersion: number;
  lastSeenUpdatedAt: number;
  fetchedAt: number;
}

interface EndlessOverrideStore {
  v: 1;
  byScope: Partial<Record<EndlessOverrideScope, EndlessOverrideEntry>>;
}

// Snapshot the live game grabs at run start. Frozen so consumers can't
// accidentally mutate it.
export interface EndlessBalanceSnapshot {
  difficulty: Difficulty;
  config: DifficultyConfig;
  tunables: GlobalEndlessTunables;
  tierWeights: TierWeights;
  lateRamp: LateRampTunables;
  spawnInterval: SpawnIntervalTunables;
}

const STORAGE_KEY = STORAGE_KEYS.endlessBalance;

// ---------- Validation ---------------------------------------------------

export interface ValidatePayloadResult {
  ok: boolean;
  errors: string[];
}

function isFiniteNumberInRange(v: unknown, lo: number, hi: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
}

function validateConfig(config: unknown, errors: string[]): void {
  if (!config || typeof config !== "object") {
    errors.push("config: not an object");
    return;
  }
  const c = config as Partial<DifficultyConfig>;
  const numericFields: Array<[keyof DifficultyConfig, number, number]> = [
    ["fallSpeedMul", 0.0001, 10],
    ["spawnIntervalMul", 0.0001, 10],
    ["stickyMul", 0, 10],
    ["helpfulMul", 0, 10],
    ["challengeMul", 0, 10],
    ["tinyMinScore", 0, 9999],
    ["bigMinScore", 0, 9999],
    ["effectDurationMul", 0.0001, 10],
    ["slowDurationMul", 0.0001, 10],
    ["fastDurationMul", 0.0001, 10],
    ["shieldDurationMul", 0.0001, 10],
    ["droneDurationMul", 0.0001, 10],
    ["tinyDurationMul", 0.0001, 10],
    ["bigDurationMul", 0.0001, 10],
    ["narrowingScore", 0, 9999],
    ["zigzagScore", 0, 9999],
    ["narrowScore", 0, 9999],
    ["dangerSize", 1, 20],
  ];
  for (const [key, lo, hi] of numericFields) {
    if (c[key] === undefined) continue;
    if (!isFiniteNumberInRange(c[key], lo, hi)) {
      errors.push(`config.${String(key)}: out of range [${lo}, ${hi}] (got ${String(c[key])})`);
    }
  }
  if (c.helpfulExclude !== undefined) {
    if (!Array.isArray(c.helpfulExclude)) {
      errors.push("config.helpfulExclude: not an array");
    } else {
      const allowed: ReadonlySet<ClusterKind> = new Set<ClusterKind>([
        "normal", "sticky", "slow", "fast", "coin", "shield", "drone", "tiny", "big",
      ]);
      for (const k of c.helpfulExclude) {
        if (!allowed.has(k)) errors.push(`config.helpfulExclude: unknown kind ${k}`);
      }
    }
  }
}

function validateGlobal(global: unknown, errors: string[]): void {
  if (!global || typeof global !== "object") {
    errors.push("global: not an object");
    return;
  }
  const g = global as Partial<GlobalEndlessTunables>;
  const numericFields: Array<[keyof GlobalEndlessTunables, number, number]> = [
    ["stickyTierWeight", 0, 1],
    ["helpfulTierWeight", 0, 1],
    ["challengeTierWeight", 0, 1],
    ["spawnIntervalStart", 0.01, 60],
    ["spawnIntervalMin", 0.01, 60],
    ["spawnIntervalRamp", 0, 1],
    ["baseFallSpeed", 0.0001, 100],
    ["speedRamp", 0, 10],
    ["maxFallSpeed", 0.0001, 100],
    ["lateRampFloorScore", 0, 99999],
    ["lateRampPer100", 0, 10],
    ["lateRampCap", 1, 10],
    ["swarmWaveChance", 0, 1],
    ["swarmSpawnInterval", 0.01, 60],
    ["swarmStickyChance", 0, 1],
    ["angledSpawnsScore", 0, 99999],
    ["sideSpawnsScore", 0, 99999],
  ];
  for (const [key, lo, hi] of numericFields) {
    if (g[key] === undefined) continue;
    if (!isFiniteNumberInRange(g[key], lo, hi)) {
      errors.push(`global.${String(key)}: out of range [${lo}, ${hi}] (got ${String(g[key])})`);
    }
  }

  // Tier weights sum must leave room for the Normal residual. If
  // sticky+helpful+challenge > 1, pickKindWithWeights never picks
  // Normal — the override silently breaks the spawn mix. Validate
  // against the post-merge sum (override fields fall back to the
  // baked defaults) so partial overrides are checked correctly.
  const effSticky = g.stickyTierWeight ?? SPAWN_STICKY_TIER_WEIGHT;
  const effHelpful = g.helpfulTierWeight ?? SPAWN_HELPFUL_TIER_WEIGHT;
  const effChallenge = g.challengeTierWeight ?? SPAWN_CHALLENGE_TIER_WEIGHT;
  // 1e-9 tolerance for IEEE-754 rounding on harmless near-1 sums.
  if (effSticky + effHelpful + effChallenge > 1 + 1e-9) {
    const sum = (effSticky + effHelpful + effChallenge).toFixed(4);
    errors.push(
      `tier weights sum > 1 (would eliminate Normal): ` +
      `sticky=${effSticky} helpful=${effHelpful} challenge=${effChallenge} sum=${sum}`,
    );
  }
}

export function validatePayload(p: unknown): ValidatePayloadResult {
  const errors: string[] = [];
  if (!p || typeof p !== "object") return { ok: false, errors: ["not an object"] };
  const obj = p as Partial<EndlessOverridePayload>;
  const validScopes: readonly EndlessOverrideScope[] = [...DIFFICULTY_SCOPES, "global"];
  if (typeof obj.scope !== "string" || !validScopes.includes(obj.scope as EndlessOverrideScope)) {
    errors.push(`scope invalid: ${obj.scope}`);
  }
  if (typeof obj.version !== "number" || obj.version < 1 || !Number.isFinite(obj.version)) {
    errors.push(`version invalid: ${obj.version}`);
  }
  if (typeof obj.updatedAt !== "number" || obj.updatedAt <= 0 || !Number.isFinite(obj.updatedAt)) {
    errors.push(`updatedAt invalid: ${obj.updatedAt}`);
  }
  if (obj.scope === "global") {
    if (obj.global !== undefined) validateGlobal(obj.global, errors);
    if (obj.config !== undefined) errors.push("global scope must not set config");
  } else if (obj.scope && (DIFFICULTY_SCOPES as readonly string[]).includes(obj.scope)) {
    if (obj.config !== undefined) validateConfig(obj.config, errors);
    if (obj.global !== undefined) errors.push("difficulty scope must not set global");
  }
  return { ok: errors.length === 0, errors };
}

// ---------- Storage ------------------------------------------------------

export function loadOverrideStore(): EndlessOverrideStore {
  const parsed = loadJson<Partial<EndlessOverrideStore> | null>(STORAGE_KEY, null);
  if (!parsed || parsed.v !== 1 || !parsed.byScope || typeof parsed.byScope !== "object") {
    return { v: 1, byScope: {} };
  }
  return { v: 1, byScope: parsed.byScope };
}

function saveStore(store: EndlessOverrideStore): void {
  saveJson(STORAGE_KEY, store);
}

// Apply an inbound override. Returns true if it changed local state.
//
// Like officialOverrides, two watermarks drive behaviour:
//   - updatedAt → content refresh (silent publish path)
//   - version → mostly informational here since endless overrides
//     don't drive any player-facing badge; tracked anyway for parity
//     and for moderator tools.
export function upsertOverride(payload: EndlessOverridePayload): boolean {
  const validation = validatePayload(payload);
  if (!validation.ok) {
    console.warn("endlessBalance: rejected invalid payload", validation.errors);
    return false;
  }
  const store = loadOverrideStore();
  const prev = store.byScope[payload.scope];
  if (!prev) {
    store.byScope[payload.scope] = {
      payload,
      lastSeenVersion: payload.version,
      lastSeenUpdatedAt: payload.updatedAt,
      fetchedAt: Date.now(),
    };
    saveStore(store);
    return true;
  }
  if (payload.updatedAt <= prev.lastSeenUpdatedAt) return false;
  store.byScope[payload.scope] = {
    payload,
    lastSeenVersion: Math.max(prev.lastSeenVersion, payload.version),
    lastSeenUpdatedAt: payload.updatedAt,
    fetchedAt: Date.now(),
  };
  saveStore(store);
  return true;
}

export function clearOverride(scope: EndlessOverrideScope): boolean {
  const store = loadOverrideStore();
  if (!store.byScope[scope]) return false;
  delete store.byScope[scope];
  saveStore(store);
  return true;
}

export function getOverrideEntry(scope: EndlessOverrideScope): EndlessOverrideEntry | undefined {
  return loadOverrideStore().byScope[scope];
}

// ---------- Resolvers ----------------------------------------------------

// Merge a partial DifficultyConfig over the baked default. Fields the
// override leaves undefined fall through to the baseline.
export function getEffectiveDifficultyConfig(d: Difficulty): DifficultyConfig {
  const base = DIFFICULTY_CONFIG[d];
  const entry = loadOverrideStore().byScope[d];
  if (!entry || !entry.payload.config) return base;
  return { ...base, ...entry.payload.config };
}

export function getEffectiveGlobalTunables(): GlobalEndlessTunables {
  const entry = loadOverrideStore().byScope["global"];
  if (!entry || !entry.payload.global) return DEFAULT_GLOBAL_TUNABLES;
  return { ...DEFAULT_GLOBAL_TUNABLES, ...entry.payload.global };
}

// Bundle the per-difficulty config + global tunables into the snapshot
// shape the live game holds for the duration of a run.
export function snapshotEndlessBalance(d: Difficulty): EndlessBalanceSnapshot {
  return buildSnapshot(d, getEffectiveDifficultyConfig(d), getEffectiveGlobalTunables());
}

// Construct a snapshot from explicit inputs. Used by the live game's
// snapshotEndlessBalance() (which feeds in the localStorage-merged
// values) and by the offline simulator (which feeds in synthetic
// overrides from --config). Pure: no I/O.
export function buildSnapshot(
  d: Difficulty,
  config: DifficultyConfig,
  tunables: GlobalEndlessTunables,
): EndlessBalanceSnapshot {
  return Object.freeze({
    difficulty: d,
    config,
    tunables,
    tierWeights: Object.freeze({
      sticky: tunables.stickyTierWeight,
      helpful: tunables.helpfulTierWeight,
      challenge: tunables.challengeTierWeight,
    }),
    lateRamp: Object.freeze({
      floor: tunables.lateRampFloorScore,
      per100: tunables.lateRampPer100,
      cap: tunables.lateRampCap,
    }),
    spawnInterval: Object.freeze({
      start: tunables.spawnIntervalStart,
      min: tunables.spawnIntervalMin,
      ramp: tunables.spawnIntervalRamp,
    }),
  });
}

// Construct a snapshot from raw partial overrides, no localStorage
// involved. The simulator uses this to thread a synthetic
// EndlessBalanceOverride payload through runEndless without having
// to fake out the storage layer.
export function snapshotFromOverrides(
  d: Difficulty,
  configOverride: Partial<DifficultyConfig> = {},
  globalOverride: Partial<GlobalEndlessTunables> = {},
): EndlessBalanceSnapshot {
  const config: DifficultyConfig = { ...DIFFICULTY_CONFIG[d], ...configOverride };
  const tunables: GlobalEndlessTunables = { ...DEFAULT_GLOBAL_TUNABLES, ...globalOverride };
  return buildSnapshot(d, config, tunables);
}
