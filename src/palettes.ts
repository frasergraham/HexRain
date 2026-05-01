// Centralised colour palettes for every ClusterKind. Phase 1.3 of the
// refactor consolidates three near-identical palette switches that
// used to live in cluster.ts (blob + hint) and debris.ts (debris).
//
// The original accessor names are re-exported from cluster.ts and
// debris.ts so call sites are unchanged. New shapes (e.g. an editor
// preview palette) should be added here too rather than scattered.

import type { ClusterKind } from "./types";

export interface BlobPalette {
  haloInner: string;
  haloMid: string;
  coreLight: string;
  coreDark: string;
}

export interface HintPalette {
  fill: string;
  stroke: string;
  glow: string;
}

export interface DebrisPalette {
  fill: string;
  accent: string;
  stroke: string;
}

const BLOB_DEFAULT: BlobPalette = {
  haloInner: "rgba(170, 196, 255, 0.7)",
  haloMid: "rgba(91, 139, 255, 0.4)",
  coreLight: "#aac4ff",
  coreDark: "#1f3074",
};

const BLOB_PALETTES: Partial<Record<ClusterKind, BlobPalette>> = {
  sticky: {
    haloInner: "rgba(255, 138, 209, 0.85)",
    haloMid: "rgba(210, 58, 138, 0.45)",
    coreLight: "#ffd0ee",
    coreDark: "#a01e6a",
  },
  slow: {
    haloInner: "rgba(255, 232, 110, 0.85)",
    haloMid: "rgba(220, 180, 40, 0.45)",
    coreLight: "#fff5b6",
    coreDark: "#a07a08",
  },
  fast: {
    haloInner: "rgba(150, 255, 175, 0.85)",
    haloMid: "rgba(40, 200, 90, 0.45)",
    coreLight: "#c8ffd5",
    coreDark: "#0a7a3c",
  },
  shield: {
    haloInner: "rgba(220, 220, 220, 0.85)",
    haloMid: "rgba(140, 140, 140, 0.45)",
    coreLight: "#f0f0f0",
    coreDark: "#3a3a3a",
  },
  drone: {
    haloInner: "rgba(210, 170, 255, 0.85)",
    haloMid: "rgba(140, 90, 220, 0.45)",
    coreLight: "#e6d6ff",
    coreDark: "#3c1a72",
  },
  tiny: {
    haloInner: "rgba(90, 240, 255, 0.85)",
    haloMid: "rgba(20, 180, 220, 0.45)",
    coreLight: "#c8fbff",
    coreDark: "#0a5060",
  },
  big: {
    haloInner: "rgba(180, 100, 255, 0.85)",
    haloMid: "rgba(100, 30, 180, 0.45)",
    coreLight: "#dab8ff",
    coreDark: "#2c0a5a",
  },
};

const HINT_PALETTES: Record<ClusterKind, HintPalette> = {
  normal: { fill: "#dfe8ff", stroke: "rgba(20, 30, 70, 0.85)", glow: "rgba(120, 160, 255, 0.95)" },
  sticky: { fill: "#ffe0f2", stroke: "rgba(80, 16, 50, 0.85)", glow: "rgba(255, 110, 190, 0.95)" },
  slow: { fill: "#fff6c2", stroke: "rgba(80, 60, 0, 0.85)", glow: "rgba(255, 220, 110, 0.95)" },
  fast: { fill: "#d4ffd6", stroke: "rgba(0, 60, 20, 0.85)", glow: "rgba(120, 255, 170, 0.95)" },
  coin: { fill: "#ffeac2", stroke: "rgba(70, 35, 0, 0.85)", glow: "rgba(255, 175, 70, 0.95)" },
  shield: { fill: "#f0f0f0", stroke: "rgba(40, 40, 40, 0.85)", glow: "rgba(220, 220, 220, 0.95)" },
  drone: { fill: "#eedfff", stroke: "rgba(50, 20, 90, 0.85)", glow: "rgba(210, 170, 255, 0.95)" },
  tiny: { fill: "#c8fbff", stroke: "rgba(0, 60, 80, 0.85)", glow: "rgba(60, 230, 255, 0.95)" },
  big: { fill: "#e6cdff", stroke: "rgba(40, 10, 80, 0.85)", glow: "rgba(180, 100, 255, 0.95)" },
};

const DEBRIS_DEFAULT: DebrisPalette = {
  fill: "#5b8bff",
  accent: "#aac4ff",
  stroke: "#1c2348",
};

const DEBRIS_PALETTES: Partial<Record<ClusterKind, DebrisPalette>> = {
  sticky: { fill: "#d23a8a", accent: "#ff8ad1", stroke: "#ffd6ee" },
  slow: { fill: "#d3a000", accent: "#ffe46b", stroke: "#fff5b6" },
  fast: { fill: "#1ea35e", accent: "#92ffb6", stroke: "#d4ffd6" },
  coin: { fill: "#d97a18", accent: "#ffce6b", stroke: "#fff0c9" },
};

export function blobPalette(kind: ClusterKind): BlobPalette {
  return BLOB_PALETTES[kind] ?? BLOB_DEFAULT;
}

export function hintPalette(kind: ClusterKind): HintPalette {
  return HINT_PALETTES[kind];
}

export function debrisPalette(kind: ClusterKind): DebrisPalette {
  return DEBRIS_PALETTES[kind] ?? DEBRIS_DEFAULT;
}
