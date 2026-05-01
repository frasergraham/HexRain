import { describe, expect, it } from "vitest";
import { blobPalette, debrisPalette, hintPalette } from "../src/palettes";
import type { ClusterKind } from "../src/types";

const ALL_KINDS: ClusterKind[] = [
  "normal", "sticky", "slow", "fast", "coin", "shield", "drone", "tiny", "big",
];

describe("palettes — every kind resolves", () => {
  it.each(ALL_KINDS)("blobPalette('%s') has all four fields", (k) => {
    const p = blobPalette(k);
    expect(p.haloInner).toBeTruthy();
    expect(p.haloMid).toBeTruthy();
    expect(p.coreLight).toBeTruthy();
    expect(p.coreDark).toBeTruthy();
  });

  it.each(ALL_KINDS)("hintPalette('%s') has all three fields", (k) => {
    const p = hintPalette(k);
    expect(p.fill).toBeTruthy();
    expect(p.stroke).toBeTruthy();
    expect(p.glow).toBeTruthy();
  });

  it.each(ALL_KINDS)("debrisPalette('%s') has all three fields", (k) => {
    const p = debrisPalette(k);
    expect(p.fill).toBeTruthy();
    expect(p.accent).toBeTruthy();
    expect(p.stroke).toBeTruthy();
  });
});

// Snapshot the palette colour values so any future shift is visible
// in the diff. The plan called these out explicitly: "every
// ClusterKind resolves all three palette shapes to the same colour
// values they had before".
describe("palette snapshots", () => {
  it("blobPalette: snapshot of all kinds", () => {
    const map = Object.fromEntries(ALL_KINDS.map((k) => [k, blobPalette(k)]));
    expect(map).toMatchSnapshot();
  });

  it("hintPalette: snapshot of all kinds", () => {
    const map = Object.fromEntries(ALL_KINDS.map((k) => [k, hintPalette(k)]));
    expect(map).toMatchSnapshot();
  });

  it("debrisPalette: snapshot of all kinds", () => {
    const map = Object.fromEntries(ALL_KINDS.map((k) => [k, debrisPalette(k)]));
    expect(map).toMatchSnapshot();
  });
});

describe("palettes — re-exports from cluster.ts", () => {
  it("cluster.blobPalette is the same function as palettes.blobPalette", async () => {
    const cluster = await import("../src/cluster");
    expect(cluster.blobPalette).toBe(blobPalette);
    expect(cluster.hintPalette).toBe(hintPalette);
  });
});
