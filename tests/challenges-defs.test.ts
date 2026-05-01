// Replaces the dev-only `if (import.meta.env?.DEV)` block that used
// to live at the bottom of src/challenges.ts. Phase 4.1 of the
// refactor: same checks now run in CI on every PR, so a busted
// roster fails the build instead of just printing console.error
// in dev mode.

import { describe, expect, it } from "vitest";
import { CHALLENGES } from "../src/challenges";
import { parseWaveLine, validateChallenge } from "../src/waveDsl";

describe("CHALLENGES roster integrity", () => {
  it("has unique challenge ids", () => {
    const ids = new Set<string>();
    const dupes: string[] = [];
    for (const c of CHALLENGES) {
      if (ids.has(c.id)) dupes.push(c.id);
      ids.add(c.id);
    }
    expect(dupes).toEqual([]);
  });

  it("every block has exactly 5 challenges", () => {
    const blockCounts = new Map<number, number>();
    for (const c of CHALLENGES) {
      blockCounts.set(c.block, (blockCounts.get(c.block) ?? 0) + 1);
    }
    for (const [b, n] of blockCounts) {
      expect(n, `block ${b}`).toBe(5);
    }
  });

  it("validateChallenge returns no errors for any roster entry", () => {
    for (const c of CHALLENGES) {
      const errs = validateChallenge(c);
      expect(errs, `${c.id} (${c.name})`).toEqual([]);
    }
  });

  it("every wave line in every challenge parses cleanly", () => {
    for (const c of CHALLENGES) {
      for (let i = 0; i < c.waves.length; i++) {
        expect(
          () => parseWaveLine(c.waves[i]!),
          `${c.id} wave ${i + 1}`,
        ).not.toThrow();
      }
    }
  });

  it("every challenge declares a difficulty in 1..5", () => {
    for (const c of CHALLENGES) {
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it("every challenge id matches its block-index pair (e.g. 3-2 → block 3, index 2)", () => {
    for (const c of CHALLENGES) {
      const [blockStr, indexStr] = c.id.split("-");
      expect(parseInt(blockStr!, 10), `${c.id} block`).toBe(c.block);
      expect(parseInt(indexStr!, 10), `${c.id} index`).toBe(c.index);
    }
  });
});
