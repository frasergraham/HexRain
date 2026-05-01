import { describe, expect, it } from "vitest";
import { computeWaveParams, lateGameSpeedMul } from "../src/spawn";

describe("lateGameSpeedMul", () => {
  it("returns 1.0 below the floor (score 0..500)", () => {
    expect(lateGameSpeedMul(0)).toBe(1);
    expect(lateGameSpeedMul(100)).toBe(1);
    expect(lateGameSpeedMul(500)).toBe(1);
  });

  it("ramps 10% per 100 points past the floor", () => {
    expect(lateGameSpeedMul(600)).toBeCloseTo(1.1);
    expect(lateGameSpeedMul(700)).toBeCloseTo(1.2);
    expect(lateGameSpeedMul(1000)).toBeCloseTo(1.5);
  });

  it("caps at 1.8x", () => {
    expect(lateGameSpeedMul(1300)).toBe(1.8);
    expect(lateGameSpeedMul(2000)).toBe(1.8);
    expect(lateGameSpeedMul(99999)).toBe(1.8);
  });

  it("treats negative scores as 1.0 (clamps the ramp at zero)", () => {
    expect(lateGameSpeedMul(-100)).toBe(1);
  });
});

describe("computeWaveParams", () => {
  it("waveDuration grows with score, capped at 8s", () => {
    expect(computeWaveParams(0, 1).waveDuration).toBeCloseTo(2.2);
    expect(computeWaveParams(50, 1).waveDuration).toBeCloseTo(5.2);
    expect(computeWaveParams(100, 1).waveDuration).toBe(8);
    expect(computeWaveParams(500, 1).waveDuration).toBe(8);
  });

  it("calmDuration shrinks with score, floored at 2.5s", () => {
    expect(computeWaveParams(0, 1).calmDuration).toBeCloseTo(7);
    expect(computeWaveParams(50, 1).calmDuration).toBeCloseTo(3.5);
    expect(computeWaveParams(100, 1).calmDuration).toBe(2.5);
    expect(computeWaveParams(500, 1).calmDuration).toBe(2.5);
  });

  it("waveSpawnInterval shrinks with score, floored at 0.32s", () => {
    expect(computeWaveParams(0, 1).waveSpawnInterval).toBeCloseTo(0.55);
    expect(computeWaveParams(46, 1).waveSpawnInterval).toBeCloseTo(0.32);
    expect(computeWaveParams(200, 1).waveSpawnInterval).toBe(0.32);
  });

  it("calmSpawnInterval scales with the difficulty multiplier and ramps with score", () => {
    // medium: spawnIntervalMul = 1.0 → start at 1.6
    expect(computeWaveParams(0, 1).calmSpawnInterval).toBeCloseTo(1.6);
    // easy: 1.25 → start at 2.0
    expect(computeWaveParams(0, 1.25).calmSpawnInterval).toBeCloseTo(2.0);
    // hard: 0.85 → start at 1.36
    expect(computeWaveParams(0, 0.85).calmSpawnInterval).toBeCloseTo(1.36);
    // Floor at 0.7 (medium hits it around score ~30, hard earlier).
    expect(computeWaveParams(50, 1).calmSpawnInterval).toBe(0.7);
  });

  it("waveSpeedMul grows with score, capped at 2.5", () => {
    expect(computeWaveParams(0, 1).waveSpeedMul).toBeCloseTo(1.5);
    expect(computeWaveParams(67, 1).waveSpeedMul).toBeCloseTo(2.505);
    expect(computeWaveParams(100, 1).waveSpeedMul).toBe(2.5);
    expect(computeWaveParams(500, 1).waveSpeedMul).toBe(2.5);
  });
});
