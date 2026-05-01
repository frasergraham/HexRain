import { beforeEach, describe, expect, it } from "vitest";
import {
  validateCustomChallenge,
  MAX_WAVES_PER_CUSTOM,
  loadCustomChallenges,
  type CustomChallenge,
} from "../src/customChallenges";

function build(overrides: Partial<CustomChallenge> = {}): CustomChallenge {
  return {
    id: "custom:test",
    name: "Test",
    seed: 1,
    difficulty: 3,
    effects: { slowDuration: 5, fastDuration: 5, shieldDuration: 10, droneDuration: 10, dangerSize: 7 },
    stars: { one: 1, two: 2, three: 3 },
    waves: ["size=2-3, rate=0.7, speed=1.2, count=10"],
    createdAt: 0,
    updatedAt: 0,
    best: 0,
    bestPct: 0,
    starsEarned: 0,
    ...overrides,
  };
}

beforeEach(() => {
  for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
});

describe("validateCustomChallenge — happy path", () => {
  it("accepts a one-wave challenge", () => {
    expect(validateCustomChallenge(build())).toEqual([]);
  });
});

describe("validateCustomChallenge — name", () => {
  it("rejects an empty name", () => {
    expect(validateCustomChallenge(build({ name: "" }))).toContain("Name cannot be empty.");
  });
  it("rejects whitespace-only names", () => {
    expect(validateCustomChallenge(build({ name: "   " }))).toContain("Name cannot be empty.");
  });
});

describe("validateCustomChallenge — wave count", () => {
  it("rejects zero waves", () => {
    expect(validateCustomChallenge(build({ waves: [] }))).toContain("Challenge needs at least one wave.");
  });
  it("rejects > MAX_WAVES_PER_CUSTOM waves", () => {
    const tooMany = Array(MAX_WAVES_PER_CUSTOM + 1).fill("size=2, rate=0.5, count=5");
    const errs = validateCustomChallenge(build({ waves: tooMany }));
    expect(errs.some((e) => e.startsWith("Too many waves"))).toBe(true);
  });
  it("accepts exactly MAX_WAVES_PER_CUSTOM waves", () => {
    const ok = Array(MAX_WAVES_PER_CUSTOM).fill("size=2, rate=0.5, count=5");
    expect(validateCustomChallenge(build({ waves: ok }))).toEqual([]);
  });
});

describe("validateCustomChallenge — wave lines", () => {
  it("rejects an unparseable wave with the parser's error message", () => {
    const errs = validateCustomChallenge(build({ waves: ["completely garbage"] }));
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/^Wave 1:/);
  });

  it("rejects a 'wave does nothing' wave (no count, no slots, no dur)", () => {
    const errs = validateCustomChallenge(build({ waves: ["size=1, rate=0.5, speed=1.0"] }));
    expect(errs).toContain("Wave 1: wave does nothing.");
  });

  it("accepts a wave with just a count", () => {
    expect(validateCustomChallenge(build({ waves: ["size=1, rate=0.5, speed=1.0, count=5"] }))).toEqual([]);
  });

  it("accepts a wave with just slots", () => {
    expect(validateCustomChallenge(build({ waves: ["count=0, slotRate=0.5, 130,230"] }))).toEqual([]);
  });

  it("accepts a wave with just dur+rate (no count)", () => {
    expect(validateCustomChallenge(build({ waves: ["dur=8, rate=0.5, speed=1.0, size=1"] }))).toEqual([]);
  });

  it("returns errors from multiple bad waves with their indices", () => {
    const errs = validateCustomChallenge(build({
      waves: ["size=1, rate=0.5, speed=1.0", "completely garbage"],
    }));
    expect(errs.some((e) => e.startsWith("Wave 1:"))).toBe(true);
    expect(errs.some((e) => e.startsWith("Wave 2:"))).toBe(true);
  });
});

describe("loadCustomChallenges", () => {
  it("returns an empty store when localStorage has no entry", () => {
    const store = loadCustomChallenges();
    expect(store.v).toBe(1);
    expect(store.challenges).toEqual([]);
  });

  it("returns empty when the stored value has the wrong version", () => {
    localStorage.setItem("hexrain.customChallenges.v1", JSON.stringify({ v: 99, challenges: [] }));
    expect(loadCustomChallenges().challenges).toEqual([]);
  });

  it("returns empty when the stored value is malformed", () => {
    localStorage.setItem("hexrain.customChallenges.v1", "not-json{");
    expect(loadCustomChallenges().challenges).toEqual([]);
  });
});
