import { describe, expect, it } from "vitest";
import { clamp, clampDifficulty, clampStars, numOr } from "../src/validation";

describe("clamp", () => {
  it("clamps below the minimum", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it("clamps above the maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it("passes through values inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("treats min == max as a constant", () => {
    expect(clamp(99, 5, 5)).toBe(5);
  });
});

describe("clampDifficulty", () => {
  it.each([
    [-1, 1], [0, 1], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 5], [10, 5],
  ])("%i → %i", (input, expected) => {
    expect(clampDifficulty(input)).toBe(expected);
  });

  it("rounds non-integer inputs", () => {
    expect(clampDifficulty(2.4)).toBe(2);
    expect(clampDifficulty(2.6)).toBe(3);
  });
});

describe("clampStars", () => {
  it.each([
    [-1, 0], [0, 0], [1, 1], [2, 2], [3, 3], [4, 3], [99, 3],
  ])("%i → %i", (input, expected) => {
    expect(clampStars(input)).toBe(expected);
  });
});

describe("numOr", () => {
  it("returns the value when finite number", () => {
    expect(numOr(5, 0)).toBe(5);
    expect(numOr(0, 99)).toBe(0);
    expect(numOr(-1.5, 0)).toBe(-1.5);
  });
  it("returns the fallback for non-numbers", () => {
    expect(numOr("5", 99)).toBe(99);
    expect(numOr(undefined, 99)).toBe(99);
    expect(numOr(null, 99)).toBe(99);
    expect(numOr({}, 99)).toBe(99);
  });
  it("returns the fallback for non-finite numbers", () => {
    expect(numOr(NaN, 99)).toBe(99);
    expect(numOr(Infinity, 99)).toBe(99);
    expect(numOr(-Infinity, 99)).toBe(99);
  });
});
