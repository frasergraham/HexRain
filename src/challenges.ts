// Challenge definitions + persistence for HexRain's challenge mode.
//
// Each challenge is a finite, scripted run defined as a list of wave
// strings (parsed by waveDsl). The roster lives in CHALLENGES; progress
// (best score per challenge, completion list, unlocked blocks) is
// stored under a single localStorage key.

import { parseWaveLine, validateChallenge, type ChallengeDefLike } from "./waveDsl";

export interface ChallengeDef extends ChallengeDefLike {
  // ChallengeDefLike already includes id, name, difficulty, block, index, effects, waves.
}

export interface ChallengeProgress {
  v: 1;
  best: Record<string, number>;
  completed: string[];
  unlockedBlocks: number[];
}

const STORAGE_KEY = "hexrain.challenges.v1";

const EMPTY_PROGRESS: ChallengeProgress = {
  v: 1,
  best: {},
  completed: [],
  unlockedBlocks: [1],
};

// CHALLENGES roster. Filled in by hand/generated content; validated at
// dev module load. See challenge.md §11 for the generation strategy.
export const CHALLENGES: ChallengeDef[] = [
  // === Block 1 — First Steps. Tutorial-grade. ===
  {
    id: "1-1", name: "First Drops", block: 1, index: 1, difficulty: 1,
    waves: [
      "size=1, rate=1.4, speed=0.85, count=4",
      "size=1-2, rate=1.3, speed=0.9, count=5",
      "size=2, rate=1.2, speed=0.95, count=5",
      "size=2-3, rate=1.1, speed=1.0, count=5, pct=normal:80,coin:20",
      "size=2, rate=1.0, speed=1.05, count=6",
      "size=2-3, rate=0.95, speed=1.05, count=6",
      "size=2-3, rate=0.9, speed=1.1, count=7, pct=normal:80,coin:20",
      "size=3, rate=0.9, speed=1.1, count=8",
      "size=2-3, rate=0.85, speed=1.15, count=8",
      "size=3, rate=0.85, speed=1.2, count=9, pct=normal:85,coin:15",
    ],
  },
  {
    id: "1-2", name: "Easy Rain", block: 1, index: 2, difficulty: 1,
    waves: [
      "size=2, rate=1.3, speed=0.9, count=5",
      "size=2-3, rate=1.2, speed=0.95, count=6",
      "size=2-3, rate=1.1, speed=1.0, count=7",
      "size=3, rate=1.0, speed=1.05, count=7, pct=normal:80,coin:20",
      "size=2-3, rate=0.95, speed=1.05, count=8",
      "size=3, rate=0.9, speed=1.1, count=8",
      "size=3-4, rate=0.85, speed=1.15, count=9",
      "size=3, rate=0.85, speed=1.15, count=9, pct=normal:80,coin:20",
      "size=3-4, rate=0.8, speed=1.2, count=10",
      "size=3, rate=0.8, speed=1.2, count=10",
      "size=3-4, rate=0.75, speed=1.2, count=11",
      "size=3, rate=0.75, speed=1.2, count=12, pct=normal:80,coin:20",
    ],
  },
  {
    id: "1-3", name: "Slow Roll", block: 1, index: 3, difficulty: 2,
    effects: { slowDuration: 6 },
    waves: [
      "size=2-3, rate=1.0, speed=0.95, count=6",
      "size=3, rate=0.95, speed=1.0, count=7",
      "count=0, slotRate=0.7, speed=1.0, 230,330,430,000,330",
      "size=2-3, rate=0.9, speed=1.05, count=8, pct=normal:75,coin:15,slow:10",
      "size=3, rate=0.85, speed=1.1, count=9",
      "size=3-4, rate=0.8, speed=1.15, count=10",
      "count=0, slotRate=0.65, speed=1.1, 240,000,140,000,340,000,240",
      "size=3, rate=0.8, speed=1.15, count=11, pct=normal:75,coin:15,slow:10",
      "size=3-4, rate=0.75, speed=1.2, count=12",
      "size=3, rate=0.7, speed=1.2, count=12",
      "size=3-4, rate=0.7, speed=1.25, count=13",
      "size=3-4, rate=0.65, speed=1.25, count=14, pct=normal:80,coin:20",
    ],
  },
  {
    id: "1-4", name: "Open Sky", block: 1, index: 4, difficulty: 2,
    waves: [
      "size=2, rate=1.1, speed=0.95, count=6",
      "size=2-3, rate=1.0, speed=1.0, count=7",
      "size=3, rate=0.9, speed=1.05, count=8, pct=normal:80,coin:20",
      "count=0, slotRate=0.7, speed=1.0, 130,330,530,000,230,430",
      "size=3-4, rate=0.85, speed=1.1, count=9",
      "size=3, rate=0.8, speed=1.15, count=10",
      "size=3-4, rate=0.75, speed=1.2, count=11, pct=normal:75,coin:25",
      "count=0, slotRate=0.6, speed=1.15, 140,340,540,000,240,440",
      "size=3, rate=0.7, speed=1.2, count=12",
      "size=3-4, rate=0.65, speed=1.25, count=13",
      "size=4, rate=0.65, speed=1.25, count=13",
      "size=3-4, rate=0.6, speed=1.3, count=14, pct=normal:80,coin:20",
    ],
  },
  {
    id: "1-5", name: "Soft Landing", block: 1, index: 5, difficulty: 3,
    effects: { slowDuration: 6 },
    waves: [
      "size=2-3, rate=1.0, speed=1.0, count=7",
      "size=3, rate=0.9, speed=1.05, count=8, pct=normal:80,coin:20",
      "size=3, rate=0.85, speed=1.1, count=9",
      "count=0, slotRate=0.6, speed=1.1, 130,230,330,430,530,000,330",
      "size=3-4, rate=0.8, speed=1.15, count=10, pct=normal:75,coin:15,slow:10",
      "size=4, rate=0.75, speed=1.2, count=11",
      "size=3-4, rate=0.7, speed=1.25, count=12",
      "count=0, slotRate=0.55, speed=1.2, 140,340,540,000,240,440,140,340",
      "size=4, rate=0.7, speed=1.3, count=13, pct=normal:75,coin:15,slow:10",
      "size=3-4, rate=0.65, speed=1.3, count=13",
      "size=4-5, rate=0.6, speed=1.35, count=14",
      "size=4, rate=0.6, speed=1.35, count=14, pct=normal:80,coin:20",
      "size=4-5, rate=0.55, speed=1.4, count=15",
    ],
  },

  // === Block 2 — Climbing. Speed introduction + first walls. ===
  {
    id: "2-1", name: "Squeeze Play", block: 2, index: 1, difficulty: 1,
    waves: [
      "size=2-3, rate=1.0, speed=1.0, count=7",
      "size=3, rate=0.9, speed=1.05, count=8",
      "size=3, rate=0.85, speed=1.1, count=9, walls=pinch, pct=normal:80,coin:20",
      "size=3-4, rate=0.8, speed=1.1, count=10, walls=pinch",
      "size=3, rate=0.75, speed=1.15, count=10",
      "size=3-4, rate=0.7, speed=1.2, count=11, walls=pinch",
      "size=4, rate=0.7, speed=1.2, count=12, walls=pinch, pct=normal:80,coin:20",
      "size=3-4, rate=0.65, speed=1.25, count=12",
      "size=4, rate=0.65, speed=1.3, count=13, walls=pinch",
      "size=3-4, rate=0.6, speed=1.3, count=14",
      "size=4, rate=0.6, speed=1.35, count=14, walls=pinch",
      "size=3-4, rate=0.55, speed=1.4, count=15, walls=pinch, pct=normal:80,coin:20",
    ],
  },
  {
    id: "2-2", name: "Side Step", block: 2, index: 2, difficulty: 2,
    waves: [
      "size=2-3, rate=1.0, speed=1.05, count=7",
      "count=0, slotRate=0.6, speed=1.1, 037,000,137,000,237,000,337",
      "size=3, rate=0.9, speed=1.15, count=8, pct=normal:80,coin:20",
      "count=0, slotRate=0.55, speed=1.15, 048,000,148,000,248,000,348,000",
      "size=3-4, rate=0.8, speed=1.2, count=10",
      "count=0, slotRate=0.5, speed=1.2, 037,048,037,048,137,148",
      "size=4, rate=0.75, speed=1.25, count=11, pct=normal:80,coin:20",
      "size=3-4, rate=0.7, speed=1.3, count=12",
      "count=0, slotRate=0.5, speed=1.3, 037,148,037,148,237,348",
      "size=4, rate=0.65, speed=1.35, count=13, walls=pinch",
      "size=4-5, rate=0.6, speed=1.4, count=14",
      "size=4, rate=0.55, speed=1.4, count=15, walls=pinch, pct=normal:80,coin:20",
    ],
  },
  {
    id: "2-3", name: "Coin Run", block: 2, index: 3, difficulty: 2,
    waves: [
      "size=2-3, rate=0.9, speed=1.05, count=7, pct=normal:60,coin:40",
      "size=2-3, rate=0.85, speed=1.1, count=8, pct=normal:60,coin:40",
      "size=3, rate=0.8, speed=1.15, count=9, pct=normal:55,coin:45",
      "count=0, slotRate=0.55, speed=1.1, 130,230,330,430,530,330,230",
      "size=3, rate=0.75, speed=1.2, count=10, pct=normal:55,coin:45",
      "size=3-4, rate=0.7, speed=1.25, count=11, walls=pinch, pct=normal:55,coin:45",
      "size=3, rate=0.65, speed=1.3, count=12, pct=normal:50,coin:50",
      "count=0, slotRate=0.5, speed=1.25, 140,240,340,440,540,440,340,240,140",
      "size=3-4, rate=0.6, speed=1.35, count=13, walls=pinch, pct=normal:55,coin:45",
      "size=4, rate=0.6, speed=1.35, count=14, pct=normal:60,coin:40",
      "size=3-4, rate=0.55, speed=1.4, count=15, pct=normal:55,coin:45",
      "size=4, rate=0.5, speed=1.4, count=15, walls=pinch, pct=normal:55,coin:45",
    ],
  },
  {
    id: "2-4", name: "Tight Lane", block: 2, index: 4, difficulty: 3,
    effects: { slowDuration: 5 },
    waves: [
      "size=2-3, rate=1.0, speed=1.05, count=7",
      "size=3, rate=0.9, speed=1.1, count=8, walls=pinch",
      "size=3, rate=0.8, speed=1.15, count=9, walls=pinch",
      "count=0, slotRate=0.5, speed=1.15, walls=pinch, 230,330,430,000,330,230,430,530",
      "size=3-4, rate=0.75, speed=1.2, count=10, walls=pinch, pct=normal:75,coin:15,slow:10",
      "size=4, rate=0.7, speed=1.25, count=11",
      "size=3-4, rate=0.65, speed=1.3, count=12, walls=pinch",
      "count=0, slotRate=0.45, speed=1.3, walls=pinch, 130,230,330,430,000,230,330,430,530",
      "size=4, rate=0.6, speed=1.35, count=13, walls=pinch, pct=normal:75,coin:15,slow:10",
      "size=4-5, rate=0.55, speed=1.4, count=14, walls=pinch",
      "size=4, rate=0.5, speed=1.4, count=15",
      "size=4-5, rate=0.5, speed=1.45, count=16, walls=pinch, pct=normal:75,coin:15,slow:10",
      "size=4-5, rate=0.45, speed=1.5, count=17, walls=pinch",
    ],
  },
  {
    id: "2-5", name: "Pressure Cooker", block: 2, index: 5, difficulty: 3,
    effects: { slowDuration: 6 },
    waves: [
      "size=2-3, rate=0.95, speed=1.1, count=7",
      "size=3, rate=0.85, speed=1.15, count=8",
      "size=3, rate=0.8, speed=1.2, count=9, walls=pinch",
      "count=0, slotRate=0.5, speed=1.2, walls=pinch, 130,230,330,430,530,330,230",
      "size=3-4, rate=0.75, speed=1.25, count=10, pct=normal:75,coin:15,slow:10",
      "size=4, rate=0.7, speed=1.3, count=11, walls=pinch",
      "size=3-4, rate=0.65, speed=1.35, count=12, walls=pinch",
      "count=0, slotRate=0.45, speed=1.3, walls=pinch, 140,240,340,440,540,000,340,240,140",
      "size=4, rate=0.6, speed=1.4, count=13, pct=normal:75,coin:15,slow:10",
      "size=4-5, rate=0.55, speed=1.45, count=14, walls=pinch",
      "size=4, rate=0.5, speed=1.5, count=15, walls=pinch",
      "size=4-5, rate=0.5, speed=1.5, count=16, pct=normal:75,coin:15,slow:10",
      "size=4-5, rate=0.45, speed=1.55, count=17, walls=pinch",
      "count=0, slotRate=0.4, speed=1.5, walls=pinch, 140,340,540,000,240,440,140,340,540,440",
    ],
  },

  // === Block 3 — Halfway There. Walls + zigzag + sticky. ===
  {
    id: "3-1", name: "Zig and Zag", block: 3, index: 1, difficulty: 2,
    waves: [
      "size=2-3, rate=1.0, speed=1.1, count=7",
      "size=3, rate=0.9, speed=1.15, count=8",
      "size=3, rate=0.85, speed=1.2, count=9, walls=zigzag",
      "count=0, slotRate=0.55, speed=1.15, walls=zigzag, 130,230,330,430,530,330,230",
      "size=3-4, rate=0.8, speed=1.25, count=10, walls=zigzag, pct=normal:85,coin:15",
      "size=4, rate=0.75, speed=1.3, count=11, walls=zigzag",
      "size=3-4, rate=0.7, speed=1.35, count=12",
      "count=0, slotRate=0.5, speed=1.3, walls=zigzag, 140,340,540,000,240,440,140,340",
      "size=4, rate=0.65, speed=1.4, count=13, walls=zigzag, pct=normal:85,coin:15",
      "size=4-5, rate=0.6, speed=1.45, count=14, walls=zigzag",
      "size=4, rate=0.55, speed=1.5, count=15",
      "size=4-5, rate=0.55, speed=1.5, count=16, walls=zigzag, pct=normal:85,coin:15",
      "count=0, slotRate=0.45, speed=1.5, walls=zigzag, 130,230,330,430,530,000,330,230,130",
      "size=4-5, rate=0.5, speed=1.55, count=17, walls=zigzag",
      "size=4-5, rate=0.45, speed=1.6, count=18, walls=zigzag",
    ],
  },
  {
    id: "3-2", name: "Wall Crawler", block: 3, index: 2, difficulty: 3,
    effects: { slowDuration: 5 },
    waves: [
      "size=2-3, rate=0.95, speed=1.15, count=7",
      "size=3, rate=0.85, speed=1.2, count=8, walls=pinch",
      "size=3, rate=0.8, speed=1.25, count=9, walls=zigzag",
      "count=0, slotRate=0.5, speed=1.2, walls=pinch, 130,230,330,430,530,330,230,130",
      "size=3-4, rate=0.75, speed=1.3, count=10, walls=zigzag, pct=normal:75,coin:15,slow:10",
      "size=4, rate=0.7, speed=1.35, count=11, walls=pinch",
      "size=3-4, rate=0.65, speed=1.4, count=12",
      "count=0, slotRate=0.45, speed=1.35, walls=zigzag, 140,240,340,440,540,000,340,240,140",
      "size=4, rate=0.6, speed=1.45, count=13, walls=pinch, pct=normal:75,coin:15,slow:10",
      "size=4-5, rate=0.55, speed=1.5, count=14, walls=zigzag",
      "size=4, rate=0.5, speed=1.55, count=15, walls=pinch",
      "size=4-5, rate=0.5, speed=1.55, count=16, walls=zigzag, pct=normal:70,coin:15,slow:10,sticky:5",
      "size=4-5, rate=0.45, speed=1.6, count=17, walls=zigzag",
      "count=0, slotRate=0.4, speed=1.6, walls=zigzag, 130,230,330,430,530,000,330,230,130,430,530",
      "size=4-5, rate=0.4, speed=1.6, count=18, walls=zigzag",
      "size=5, rate=0.4, speed=1.6, count=18, walls=zigzag, pct=normal:75,coin:15,slow:10",
    ],
  },
  {
    id: "3-3", name: "Heal & Hope", block: 3, index: 3, difficulty: 3,
    waves: [
      "size=2-3, rate=0.95, speed=1.1, count=7",
      "size=3, rate=0.85, speed=1.15, count=8, pct=normal:70,sticky:20,coin:10",
      "size=3-4, rate=0.8, speed=1.2, count=9, pct=normal:70,sticky:20,coin:10",
      "size=3, rate=0.75, speed=1.25, count=10, walls=pinch, pct=normal:65,sticky:25,coin:10",
      "count=0, slotRate=0.5, speed=1.2, 130,230,330,430,530,000,230,330,430",
      "size=3-4, rate=0.7, speed=1.3, count=11, pct=normal:65,sticky:25,coin:10",
      "size=4, rate=0.65, speed=1.35, count=12, walls=zigzag, pct=normal:70,sticky:20,coin:10",
      "size=3-4, rate=0.6, speed=1.4, count=13, pct=normal:65,sticky:25,coin:10",
      "count=0, slotRate=0.45, speed=1.35, walls=pinch, 130,330,530,000,230,430,000,130,330,530",
      "size=4, rate=0.55, speed=1.45, count=14, walls=zigzag, pct=normal:70,sticky:20,coin:10",
      "size=4-5, rate=0.5, speed=1.5, count=15, pct=normal:65,sticky:25,coin:10",
      "size=4, rate=0.5, speed=1.5, count=16, walls=zigzag, pct=normal:70,sticky:20,coin:10",
      "size=4-5, rate=0.45, speed=1.55, count=17, pct=normal:65,sticky:25,coin:10",
      "size=5, rate=0.45, speed=1.6, count=18, pct=normal:65,sticky:25,coin:10",
    ],
  },
  {
    id: "3-4", name: "Hex Switchback", block: 3, index: 4, difficulty: 4,
    effects: { slowDuration: 5 },
    waves: [
      "size=2-3, rate=0.9, speed=1.15, count=7",
      "size=3, rate=0.8, speed=1.2, count=8, walls=zigzag",
      "count=0, slotRate=0.5, speed=1.2, walls=zigzag, 130,230,330,430,530,330,230,130,330",
      "size=3, rate=0.75, speed=1.3, count=10, walls=zigzag, pct=normal:75,coin:15,slow:10",
      "size=3-4, rate=0.7, speed=1.35, count=11, walls=pinch",
      "count=0, slotRate=0.45, speed=1.35, walls=zigzag, 140,240,340,440,540,000,340,440,540,440,340",
      "size=4, rate=0.65, speed=1.4, count=12, walls=zigzag, pct=normal:70,coin:15,slow:10,sticky:5",
      "size=3-4, rate=0.6, speed=1.45, count=13, walls=zigzag",
      "size=4, rate=0.55, speed=1.5, count=14, walls=zigzag",
      "count=0, slotRate=0.4, speed=1.5, walls=zigzag, 130,230,330,430,530,000,230,330,430,000,130,530",
      "size=4-5, rate=0.5, speed=1.55, count=15, walls=zigzag",
      "size=4, rate=0.5, speed=1.6, count=16, walls=zigzag, pct=normal:70,coin:15,slow:10,sticky:5",
      "size=4-5, rate=0.45, speed=1.6, count=17, walls=zigzag",
      "size=5, rate=0.45, speed=1.65, count=18, walls=zigzag",
      "size=4-5, rate=0.4, speed=1.65, count=19, walls=zigzag",
    ],
  },
  {
    id: "3-5", name: "Demon Run", block: 3, index: 5, difficulty: 4,
    effects: { slowDuration: 5, fastDuration: 4 },
    waves: [
      "size=2-3, rate=0.9, speed=1.2, count=7",
      "size=3, rate=0.8, speed=1.25, count=9, walls=zigzag",
      "size=3-4, rate=0.7, speed=1.3, count=10",
      "count=0, slotRate=0.45, speed=1.3, walls=zigzag, 130,230,330,430,530,000,330,230,430,530,130",
      "size=4, rate=0.65, speed=1.4, count=11, walls=zigzag, pct=normal:70,coin:10,slow:10,sticky:10",
      "size=3-4, rate=0.6, speed=1.45, count=12, walls=zigzag",
      "size=4, rate=0.55, speed=1.5, count=13",
      "count=0, slotRate=0.4, speed=1.5, walls=zigzag, 140,340,540,000,240,440,140,340,540,440,340,240",
      "size=4-5, rate=0.5, speed=1.55, count=14, walls=zigzag, pct=normal:65,coin:10,slow:10,sticky:10,fast:5",
      "size=4, rate=0.5, speed=1.6, count=15, walls=zigzag",
      "size=4-5, rate=0.45, speed=1.65, count=16, walls=zigzag",
      "size=5, rate=0.45, speed=1.7, count=17, walls=zigzag",
      "count=0, slotRate=0.4, speed=1.6, walls=zigzag, 140,340,540,000,240,440,000,340,540,440,340,240,140",
      "size=4-5, rate=0.4, speed=1.7, count=18, walls=zigzag, pct=normal:70,coin:10,slow:10,sticky:10",
      "size=5, rate=0.4, speed=1.75, count=19, walls=zigzag",
      "size=4-5, rate=0.4, speed=1.8, count=20, walls=zigzag",
    ],
  },

  // === Block 4 — Hex Veteran. Narrow walls + fast pickups. ===
  {
    id: "4-1", name: "Narrow Margins", block: 4, index: 1, difficulty: 3,
    effects: { slowDuration: 5 },
    waves: [
      "size=2-3, rate=0.9, speed=1.2, count=8",
      "size=3, rate=0.8, speed=1.25, count=9, walls=narrow",
      "size=3, rate=0.75, speed=1.3, count=10, walls=narrow, pct=normal:80,coin:20",
      "size=3-4, rate=0.7, speed=1.35, count=11",
      "count=0, slotRate=0.5, speed=1.3, walls=narrow, 230,330,430,000,330,430,230",
      "size=3-4, rate=0.65, speed=1.4, count=12, walls=narrow, pct=normal:75,coin:15,slow:10",
      "size=4, rate=0.6, speed=1.45, count=13, walls=narrow",
      "size=3-4, rate=0.55, speed=1.5, count=14, walls=zigzag",
      "count=0, slotRate=0.45, speed=1.45, walls=narrow, 230,330,430,000,330,230,430,000,330",
      "size=4, rate=0.5, speed=1.55, count=15, walls=narrow, pct=normal:75,coin:15,slow:10",
      "size=4-5, rate=0.45, speed=1.6, count=16, walls=narrow",
      "size=4-5, rate=0.45, speed=1.6, count=17, walls=zigzag",
      "size=5, rate=0.4, speed=1.65, count=18, walls=narrow",
      "size=4-5, rate=0.4, speed=1.7, count=19, walls=narrow",
      "size=4-5, rate=0.4, speed=1.7, count=20, walls=zigzag",
    ],
  },
  {
    id: "4-2", name: "Speed Trap", block: 4, index: 2, difficulty: 4,
    effects: { fastDuration: 4 },
    waves: [
      "size=2-3, rate=0.85, speed=1.25, count=8",
      "size=3, rate=0.75, speed=1.35, count=10",
      "size=3-4, rate=0.7, speed=1.4, count=11, walls=zigzag",
      "size=3, rate=0.65, speed=1.5, count=12, pct=normal:75,coin:10,fast:15",
      "count=0, slotRate=0.45, speed=1.45, walls=zigzag, 130,230,330,430,530,000,230,330,430",
      "size=3-4, rate=0.6, speed=1.55, count=13, walls=narrow",
      "size=4, rate=0.55, speed=1.6, count=14, walls=zigzag, pct=normal:70,coin:10,fast:15,slow:5",
      "size=3-4, rate=0.5, speed=1.65, count=15",
      "count=0, slotRate=0.4, speed=1.6, walls=narrow, 230,330,430,000,330,430,230,000,330",
      "size=4, rate=0.5, speed=1.7, count=16, walls=zigzag, pct=normal:70,coin:10,fast:15,slow:5",
      "size=4-5, rate=0.45, speed=1.75, count=17, walls=narrow",
      "size=4, rate=0.45, speed=1.8, count=18, walls=zigzag",
      "size=4-5, rate=0.4, speed=1.85, count=19, walls=narrow",
      "size=5, rate=0.4, speed=1.9, count=20, walls=zigzag",
      "size=4-5, rate=0.4, speed=1.9, count=21, walls=narrow, pct=normal:70,coin:10,fast:15,slow:5",
      "size=4-5, rate=0.35, speed=1.95, count=22, walls=zigzag",
    ],
  },
  {
    id: "4-3", name: "The Funnel", block: 4, index: 3, difficulty: 4,
    effects: { slowDuration: 5, fastDuration: 4 },
    waves: [
      "size=2-3, rate=0.85, speed=1.25, count=8, walls=pinch",
      "size=3, rate=0.75, speed=1.35, count=9, walls=pinch",
      "size=3-4, rate=0.7, speed=1.4, count=10, walls=zigzag",
      "size=3, rate=0.65, speed=1.5, count=11, walls=narrow, pct=normal:80,coin:20",
      "count=0, slotRate=0.45, speed=1.45, walls=narrow, 230,330,430,000,330,230,430,000,330",
      "size=3-4, rate=0.6, speed=1.55, count=12, walls=narrow, pct=normal:70,coin:10,slow:10,fast:10",
      "size=4, rate=0.55, speed=1.6, count=13, walls=narrow",
      "size=3-4, rate=0.5, speed=1.65, count=14, walls=zigzag",
      "count=0, slotRate=0.4, speed=1.6, walls=narrow, 230,330,430,000,330,430,230,000,330,430",
      "size=4, rate=0.5, speed=1.7, count=15, walls=narrow, pct=normal:70,coin:10,slow:10,fast:10",
      "size=4-5, rate=0.45, speed=1.75, count=16, walls=narrow",
      "size=4, rate=0.45, speed=1.8, count=17, walls=narrow",
      "size=4-5, rate=0.4, speed=1.85, count=18, walls=narrow",
      "size=5, rate=0.4, speed=1.9, count=19, walls=narrow",
      "size=4-5, rate=0.35, speed=1.95, count=20, walls=narrow",
      "size=4-5, rate=0.35, speed=2.0, count=21, walls=narrow",
    ],
  },
  {
    id: "4-4", name: "Fast Forward", block: 4, index: 4, difficulty: 5,
    effects: { fastDuration: 4 },
    waves: [
      "size=2-3, rate=0.85, speed=1.3, count=9",
      "size=3, rate=0.75, speed=1.4, count=10",
      "size=3-4, rate=0.7, speed=1.5, count=11, walls=zigzag, pct=normal:70,coin:15,fast:15",
      "size=3, rate=0.65, speed=1.6, count=12, walls=zigzag",
      "count=0, slotRate=0.45, speed=1.55, walls=zigzag, 130,230,330,430,530,000,230,330,430,530",
      "size=3-4, rate=0.6, speed=1.65, count=13, walls=narrow, pct=normal:65,coin:10,fast:15,slow:10",
      "size=4, rate=0.55, speed=1.7, count=14, walls=zigzag",
      "size=3-4, rate=0.5, speed=1.75, count=15, walls=narrow",
      "size=4, rate=0.5, speed=1.8, count=16, walls=zigzag, pct=normal:65,coin:10,fast:15,slow:10",
      "size=4-5, rate=0.45, speed=1.85, count=17, walls=narrow",
      "size=4, rate=0.45, speed=1.9, count=18, walls=zigzag",
      "count=0, slotRate=0.4, speed=1.85, walls=zigzag, 140,340,540,000,240,440,140,340,540,440,340,240",
      "size=4-5, rate=0.4, speed=1.95, count=19, walls=narrow",
      "size=5, rate=0.4, speed=2.0, count=20, walls=zigzag",
      "size=4-5, rate=0.35, speed=2.05, count=21, walls=narrow",
      "size=4-5, rate=0.35, speed=2.1, count=22, walls=zigzag",
      "size=5, rate=0.3, speed=2.15, count=23, walls=zigzag",
      "size=4-5, rate=0.3, speed=2.2, count=24, walls=narrow",
    ],
  },
  {
    id: "4-5", name: "The Vise", block: 4, index: 5, difficulty: 5,
    effects: { slowDuration: 5, fastDuration: 4 },
    waves: [
      "size=2-3, rate=0.85, speed=1.3, count=9, walls=pinch",
      "size=3, rate=0.75, speed=1.4, count=10, walls=narrow",
      "size=3-4, rate=0.7, speed=1.45, count=11, walls=narrow",
      "size=3, rate=0.65, speed=1.55, count=12, walls=narrow, pct=normal:75,coin:15,slow:10",
      "count=0, slotRate=0.45, speed=1.5, walls=narrow, 230,330,430,000,330,430,230,000,330,430",
      "size=3-4, rate=0.6, speed=1.6, count=13, walls=narrow",
      "size=4, rate=0.55, speed=1.65, count=14, walls=narrow, pct=normal:65,coin:10,slow:10,fast:10,sticky:5",
      "size=3-4, rate=0.5, speed=1.7, count=15, walls=narrow",
      "count=0, slotRate=0.4, speed=1.65, walls=narrow, 230,330,430,000,330,230,430,000,330,430,230",
      "size=4, rate=0.5, speed=1.8, count=16, walls=narrow",
      "size=4-5, rate=0.45, speed=1.85, count=17, walls=narrow, pct=normal:65,coin:10,slow:10,fast:10,sticky:5",
      "size=4, rate=0.45, speed=1.9, count=18, walls=narrow",
      "size=4-5, rate=0.4, speed=1.95, count=19, walls=narrow",
      "size=5, rate=0.4, speed=2.0, count=20, walls=narrow",
      "size=4-5, rate=0.4, speed=2.05, count=21, walls=narrow",
      "size=5, rate=0.35, speed=2.1, count=22, walls=narrow",
      "size=4-5, rate=0.35, speed=2.15, count=23, walls=narrow",
    ],
  },

  // === Block 5 — Brink of Mastery. Endurance + shield pickups. ===
  {
    id: "5-1", name: "Long Haul", block: 5, index: 1, difficulty: 4,
    effects: { slowDuration: 5, shieldDuration: 12 },
    waves: makeLongHaul(30, 1.2, 1.8, 0.9, 0.45),
  },
  {
    id: "5-2", name: "Endurance", block: 5, index: 2, difficulty: 4,
    effects: { slowDuration: 5, shieldDuration: 12 },
    waves: makeLongHaul(35, 1.25, 1.85, 0.85, 0.45),
  },
  {
    id: "5-3", name: "Iron Will", block: 5, index: 3, difficulty: 5,
    effects: { slowDuration: 5, shieldDuration: 12 },
    waves: makeLongHaul(40, 1.3, 1.9, 0.85, 0.4),
  },
  {
    id: "5-4", name: "Hex Marathon", block: 5, index: 4, difficulty: 5,
    effects: { slowDuration: 5, shieldDuration: 12, fastDuration: 4 },
    waves: makeLongHaul(50, 1.3, 1.95, 0.8, 0.4),
  },
  {
    id: "5-5", name: "The Crucible", block: 5, index: 5, difficulty: 5,
    effects: { slowDuration: 4, shieldDuration: 10, fastDuration: 4 },
    waves: makeLongHaul(60, 1.35, 2.0, 0.75, 0.38),
  },

  // === Block 6 — Hex Master. Final ladder. ===
  {
    id: "6-1", name: "Ascendant", block: 6, index: 1, difficulty: 5,
    effects: { slowDuration: 5, shieldDuration: 10, fastDuration: 4, droneDuration: 12 },
    waves: makeFinalLadder(60, 1.4, 2.0),
  },
  {
    id: "6-2", name: "Apex", block: 6, index: 2, difficulty: 5,
    effects: { slowDuration: 5, shieldDuration: 10, fastDuration: 4, droneDuration: 12 },
    waves: makeFinalLadder(70, 1.4, 2.05),
  },
  {
    id: "6-3", name: "Pinnacle", block: 6, index: 3, difficulty: 5,
    effects: { slowDuration: 5, shieldDuration: 10, fastDuration: 4, droneDuration: 12 },
    waves: makeFinalLadder(80, 1.45, 2.1),
  },
  {
    id: "6-4", name: "The Climb", block: 6, index: 4, difficulty: 5,
    effects: { slowDuration: 4, shieldDuration: 10, fastDuration: 4, droneDuration: 12 },
    waves: makeFinalLadder(90, 1.5, 2.15),
  },
  {
    id: "6-5", name: "Gauntlet of Fear", block: 6, index: 5, difficulty: 5,
    effects: { slowDuration: 4, shieldDuration: 10, fastDuration: 3, droneDuration: 10 },
    waves: makeFinalLadder(100, 1.55, 2.2),
  },
];

// Helper that builds a long endurance wave list of `n` waves, ramping
// speed from `startSpeed` → `endSpeed` and rate from `startRate` →
// `endRate`. Sprinkles walls and power-ups in alternating bands.
function makeLongHaul(n: number, startSpeed: number, endSpeed: number, startRate: number, endRate: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const speed = (startSpeed + (endSpeed - startSpeed) * t).toFixed(2);
    const rate = (startRate + (endRate - startRate) * t).toFixed(2);
    const sizeMin = i < n * 0.2 ? 2 : i < n * 0.5 ? 3 : 4;
    const sizeMax = i < n * 0.3 ? 4 : 5;
    const wall =
      i % 9 === 4 ? "narrow"
      : i % 5 === 2 ? "zigzag"
      : i % 3 === 1 ? "pinch"
      : "none";
    const wallTok = wall === "none" ? "" : `, walls=${wall}`;
    const isPickup = i % 6 === 3;
    const pct = isPickup
      ? "pct=normal:60,coin:10,slow:10,sticky:10,shield:10"
      : i % 4 === 0
        ? "pct=normal:75,coin:15,slow:10"
        : "pct=normal:85,coin:15";
    const isScripted = i % 7 === 5;
    if (isScripted) {
      const slotRate = (parseFloat(rate) * 0.85).toFixed(2);
      out.push(
        `count=0, slotRate=${slotRate}, speed=${speed}${wallTok}, 130,230,330,430,530,000,230,330,430,000,130,330,530`,
      );
    } else {
      const count = 10 + Math.floor(i * 0.4);
      out.push(`size=${sizeMin}-${sizeMax}, rate=${rate}, speed=${speed}, count=${count}${wallTok}, ${pct}`);
    }
  }
  return out;
}

// Final-ladder builder: even denser than makeLongHaul, drones and shields available.
function makeFinalLadder(n: number, startSpeed: number, endSpeed: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const speed = (startSpeed + (endSpeed - startSpeed) * t).toFixed(2);
    const rate = Math.max(0.32, 0.85 - 0.5 * t).toFixed(2);
    const sizeMin = i < n * 0.15 ? 2 : i < n * 0.4 ? 3 : 4;
    const sizeMax = i < n * 0.25 ? 4 : 5;
    const wall =
      i % 6 === 3 ? "narrow"
      : i % 4 === 1 ? "zigzag"
      : i % 5 === 2 ? "pinch"
      : "none";
    const wallTok = wall === "none" ? "" : `, walls=${wall}`;
    const isHelp = i % 8 === 5;
    const pct = isHelp
      ? "pct=normal:55,coin:10,slow:10,sticky:5,shield:10,drone:10"
      : i % 3 === 0
        ? "pct=normal:70,coin:10,slow:10,sticky:5,fast:5"
        : "pct=normal:85,coin:15";
    const isScripted = i % 6 === 4;
    if (isScripted) {
      const slotRate = (parseFloat(rate) * 0.85).toFixed(2);
      out.push(
        `count=0, slotRate=${slotRate}, speed=${speed}${wallTok}, 140,240,340,440,540,000,240,340,440,540,000,140,340,540`,
      );
    } else {
      const count = 12 + Math.floor(i * 0.45);
      out.push(`size=${sizeMin}-${sizeMax}, rate=${rate}, speed=${speed}, count=${count}${wallTok}, ${pct}`);
    }
  }
  return out;
}

export function challengeById(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

// === Persistence ==========================================================

export function loadChallengeProgress(): ChallengeProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<ChallengeProgress> | null;
    if (!parsed || parsed.v !== 1) return { ...EMPTY_PROGRESS };
    const validIds = new Set(CHALLENGES.map((c) => c.id));
    const bestEntries = Object.entries(parsed.best ?? {}).filter(([id]) => validIds.has(id));
    const completed = (parsed.completed ?? []).filter((id) => validIds.has(id));
    const unique = Array.from(new Set(completed)).sort();
    return {
      v: 1,
      best: Object.fromEntries(bestEntries),
      completed: unique,
      unlockedBlocks: recomputeUnlocked(new Set(unique)),
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

function save(p: ChallengeProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch { /* ignore quota / private mode */ }
}

export function saveChallengeBest(id: string, score: number): ChallengeProgress {
  const p = loadChallengeProgress();
  const prev = p.best[id] ?? 0;
  if (score <= prev) return p;
  const next: ChallengeProgress = {
    ...p,
    best: { ...p.best, [id]: score },
  };
  save(next);
  return next;
}

export function saveChallengeCompletion(id: string, score: number): ChallengeProgress {
  const p = loadChallengeProgress();
  const prev = p.best[id] ?? 0;
  const completed = new Set(p.completed);
  completed.add(id);
  const next: ChallengeProgress = {
    v: 1,
    best: { ...p.best, [id]: Math.max(prev, score) },
    completed: Array.from(completed).sort(),
    unlockedBlocks: recomputeUnlocked(completed),
  };
  save(next);
  return next;
}

function recomputeUnlocked(completed: Set<string>): number[] {
  const out = [1];
  for (let b = 1; b < 6; b++) {
    let inBlock = 0;
    for (const id of completed) if (id.startsWith(`${b}-`)) inBlock += 1;
    if (inBlock >= 3) out.push(b + 1);
  }
  return out;
}

// === Validation guard (dev only) ==========================================

if (import.meta.env?.DEV) {
  const ids = new Set<string>();
  const blockCounts = new Map<number, number>();
  const errors: string[] = [];
  for (const c of CHALLENGES) {
    if (ids.has(c.id)) errors.push(`Duplicate challenge id ${c.id}`);
    ids.add(c.id);
    blockCounts.set(c.block, (blockCounts.get(c.block) ?? 0) + 1);
    for (const e of validateChallenge(c)) errors.push(`[${c.id}] ${e}`);
    // Sanity-parse every wave (validateChallenge already did this, but
    // double-check so a bad wave throws here with a clear stack trace).
    for (let i = 0; i < c.waves.length; i++) {
      try { parseWaveLine(c.waves[i]); }
      catch (e) {
        errors.push(`[${c.id}] wave ${i + 1}: ${(e as Error).message}`);
      }
    }
  }
  for (const [b, n] of blockCounts) {
    if (n !== 5) errors.push(`Block ${b} has ${n} challenges (expected 5)`);
  }
  if (errors.length) {
    // eslint-disable-next-line no-console
    console.error("[challenges] validation errors:\n" + errors.join("\n"));
  }
}
