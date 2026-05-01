// Pinned determinism test. The REFACTOR.md plan calls this out as the
// canary for behaviour preservation: if the same seed stops producing
// the same RNG sequence, the gameplay determinism guarantee is broken
// and the refactor must be backed out.
//
// We hash the first 1024 outputs of the RNG into a stable string so
// the assertion is one tight equality check; the hash also makes the
// expected value easy to update when an intentional change lands
// (the diff would still need a written justification, per the plan).
//
// Phase 1.1 deleted the duplicate mulberry32 + hashString in hex.ts;
// the assertions confirming the two implementations agreed used to
// live here and have been removed now that there's only one impl.

import { describe, it, expect } from "vitest";
import { mulberry32, hashSeed } from "../src/rng";

function fingerprint(rng: () => number, n = 1024): string {
  let acc = 0x811c9dc5;
  for (let i = 0; i < n; i++) {
    const v = rng();
    const u = (v * 0x100000000) >>> 0;
    acc = (acc ^ (u & 0xff)) >>> 0;
    acc = Math.imul(acc, 0x01000193) >>> 0;
    acc = (acc ^ ((u >>> 8) & 0xff)) >>> 0;
    acc = Math.imul(acc, 0x01000193) >>> 0;
    acc = (acc ^ ((u >>> 16) & 0xff)) >>> 0;
    acc = Math.imul(acc, 0x01000193) >>> 0;
    acc = (acc ^ ((u >>> 24) & 0xff)) >>> 0;
    acc = Math.imul(acc, 0x01000193) >>> 0;
  }
  return acc.toString(16).padStart(8, "0");
}

describe("mulberry32 determinism", () => {
  it("seed 1 → pinned 1024-output fingerprint", () => {
    expect(fingerprint(mulberry32(1))).toMatchInlineSnapshot(`"fb87abb0"`);
  });

  it("seed 0 → pinned 1024-output fingerprint", () => {
    expect(fingerprint(mulberry32(0))).toMatchInlineSnapshot(`"51e861a0"`);
  });

  it("arbitrary seed 0xdeadbeef → pinned fingerprint", () => {
    expect(fingerprint(mulberry32(0xdeadbeef))).toMatchInlineSnapshot(`"fc58c0f4"`);
  });
});

describe("hashSeed stability", () => {
  it("known inputs → pinned outputs", () => {
    expect(hashSeed("")).toBe(0x811c9dc5);
    expect(hashSeed("a").toString(16)).toMatchInlineSnapshot(`"e40c292c"`);
    expect(hashSeed("hex-rain").toString(16)).toMatchInlineSnapshot(`"cda81933"`);
    expect(hashSeed("3-4").toString(16)).toMatchInlineSnapshot(`"cf487bab"`);
  });
});
