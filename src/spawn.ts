// Pure spawn-cadence helpers. Phase 1.5 of the refactor (partial):
// extracts the score-driven cadence math out of Game so it can be
// unit-tested without spinning up a Matter.js engine.
//
// Each function takes the inputs it needs as plain values and
// returns a value or a config object. No `this`, no DOM, no engine
// state. Game's wrapper methods become 1-2 lines that forward into
// these.
//
// The remaining helpers in the original Phase 1.5 PR list
// (pickSpawnColumn, shapeColumnFootprint, chooseWallForEndlessWave,
// computeFallSpeed, currentSpawnInterval) are coupled to many
// `this.*` fields and are deferred until those collaborators
// (Spawner, WaveDirector) are extracted in Phase 3.

const LATE_RAMP_FLOOR_SCORE = 500;
const LATE_RAMP_PER_100 = 0.1;
const LATE_RAMP_CAP = 1.8;

const SPAWN_INTERVAL_START = 1.6;
const SPAWN_INTERVAL_MIN = 0.7;
const SPAWN_INTERVAL_RAMP = 0.03;

export interface WaveParams {
  waveDuration: number;
  calmDuration: number;
  waveSpawnInterval: number;
  calmSpawnInterval: number;
  waveSpeedMul: number;
}

// Late-game permanent speed multiplier. Every 100 points past the
// floor adds 10% to the base rate; capped at 1.8× so the game stays
// playable at extreme scores.
//
// Examples: 0..500 → 1.0×; 600 → 1.1×; 1000 → 1.5×; 1300+ → 1.8×.
export function lateGameSpeedMul(score: number): number {
  const raw = 1 + Math.max(0, (score - LATE_RAMP_FLOOR_SCORE) / 100) * LATE_RAMP_PER_100;
  return Math.min(LATE_RAMP_CAP, raw);
}

// Wave / calm cadence + speed parameters at a given score and
// difficulty's spawn-interval multiplier. Pure: no engine state.
export function computeWaveParams(score: number, spawnIntervalMul: number): WaveParams {
  return {
    // Wave grows from short to long with score.
    waveDuration: Math.min(8, 2.2 + score * 0.06),
    // Calm shrinks but never below 2.5s — always at least one breather.
    calmDuration: Math.max(2.5, 7 - score * 0.07),
    // Wave spawn cadence: faster than calm, scales with score.
    waveSpawnInterval: Math.max(0.32, 0.55 - score * 0.005),
    // Calm spawn cadence: original curve, with the difficulty's
    // starting interval scaling.
    calmSpawnInterval: Math.max(
      SPAWN_INTERVAL_MIN,
      SPAWN_INTERVAL_START * spawnIntervalMul - score * SPAWN_INTERVAL_RAMP,
    ),
    // Wave fall speed multiplier on top of base.
    waveSpeedMul: Math.min(2.5, 1.5 + score * 0.015),
  };
}
