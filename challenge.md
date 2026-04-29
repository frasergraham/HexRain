# Challenge Mode — Design Doc

A second game mode for HexRain: a curated ladder of 30 hand-tuned challenges, grouped into 6 blocks of 5. Each challenge is a finite, data-driven script of waves with an explicit beginning, middle, and end. The player picks one from a selection screen, plays it from a left-edge progress bar of 0% to 100%, and either survives (best score banked) or dies (best score still banked if higher). Endless mode is unchanged in shape, but inherits two of the new wall variants once score thresholds are crossed.

This doc covers data model, runtime, UI, persistence, achievements, generation rules, and implementation order. It does **not** list the 30 challenges — that's the next step, after this doc is reviewed.

---

## 1. Wave DSL

### 1.1 Format and storage

Challenges live in TS, not external text files. Embedded TS keeps types honest, lets the parser run at module-load time, surfaces typos at compile time, and avoids a `fetch()` round trip in the iOS Capacitor wrapper.

New file: **`src/challenges.ts`**

```ts
export interface ChallengeDef {
  id: string;            // "1-1" .. "6-5"
  name: string;          // "Gauntlet of Fear"
  difficulty: 1|2|3|4|5; // hex-rating shown on selection
  block: 1|2|3|4|5|6;
  index: 1|2|3|4|5;
  effects?: Partial<{
    slowDuration: number;
    fastDuration: number;
    shieldDuration: number;
    droneDuration: number;
  }>;
  waves: string[];       // one comma-separated wave script per element
}
```

Each `waves[i]` is one wave the runtime executes start-to-finish before advancing.

### 1.2 Grammar

```
wave  := token ("," token)*
token := keyValue | explicitSlot
keyValue := key "=" value
explicitSlot := <three-digit-string>     // "145", "000"
```

Recognised keys (case-insensitive):

| Key          | Type    | Default                | Meaning |
| ---          | ---     | ---                    | --- |
| `dur`        | seconds | computed from spawns   | Hard wall on wave duration |
| `speed`      | float   | 1.0                    | Multiplier on `BASE_FALL_SPEED` |
| `rate`       | seconds | 0.55                   | Probabilistic spawn interval |
| `slotRate`   | seconds | `rate`                 | Cadence of explicit slot timing |
| `origin`     | enum    | `top`                  | `top`, `topAngled`, `side` |
| `dir`        | float   | 0                      | Tilt radians for `topAngled`/`side` |
| `size`       | range   | `2-5`                  | `min-max` cluster size, capped at 5 |
| `walls`      | enum    | `none`                 | `none`, `pinch`, `zigzag`, `narrow` |
| `wallAmp`    | float   | 0.18                   | Zigzag inset amplitude (fraction of half-board) |
| `wallPeriod` | seconds | 1.4                    | Zigzag y-period |
| `safeCol`    | int     | random                 | Pin safe column; `none` = no safe column |
| `swarm`      | bool    | false                  | Single-cell sequence cadence |
| `pct`        | list    | `normal:1`             | `kind:weight,kind:weight,...` |
| `count`      | int     | unlimited              | Cap on probabilistic spawns |

#### Explicit slot

Three digits `[size][col][angleIdx]`. Size 0 = silent slot, 1–5 = polyhex of that size, 6–9 clamp to 5. Column 0 = leftmost active rail, 9 = rightmost. Angle table:

| Idx | Tilt (rad) |
| --- | --- |
| 0   | 0 |
| 1   | -0.15 |
| 2   | +0.15 |
| 3   | -0.35 |
| 4   | +0.35 |
| 5   | -0.6 |
| 6   | +0.6 |
| 7   | side from left at -0.4 (mid-y entry) |
| 8   | side from right at +0.4 |
| 9   | random ±0.7 |

### 1.3 Sample lines

Probabilistic opener:
```
size=2-3, rate=0.9, speed=1.0
```

Pure script with narrow walls:
```
count=0, slotRate=0.5, walls=narrow,
130,000,230,000,330,000,430,000,330,000,230,000,130
```

Mixed script + RNG:
```
slotRate=0.6, rate=1.2, speed=1.2, walls=pinch,
145,000,000,245,000,000,345
```

Zigzag with mostly small clusters and a fast pickup:
```
dur=10, speed=1.4, rate=0.45, walls=zigzag, wallAmp=0.22, wallPeriod=1.6,
size=1-3, pct=normal:80,fast:10,coin:10
```

### 1.4 `pct` weights

`pct=normal:70,coin:10,sticky:10,fast:5,slow:5` — unnormalised weights. Kinds not listed are weight 0. Default `normal:1` = all blue.

### 1.5 Stream interaction

Slot stream and probabilistic stream run **concurrently**:
- Slot tick every `slotRate`, fires scripted spawn or skip.
- Prob tick every `rate`, fires `pct`-weighted spawn.

Pure script: set `count=0`. Pure prob: omit slots. Slots ignore safe-column rules; prob respects them.

### 1.6 Parser location

New file: **`src/waveDsl.ts`** exporting:

```ts
interface ParsedWave { /* all defaults filled */ }
function parseWaveLine(line: string): ParsedWave;
function validateChallenge(def: ChallengeDef): string[];
```

Validation runs in dev only at module load (`if (import.meta.env.DEV)`). Errors throw at startup. Checks: every wave parses; 6 blocks × 5 challenges; unique IDs; `waves.length` 10–100; `difficulty` 1–5.

### 1.7 Edge cases

- Empty wave string → throw at parse.
- `count=0` and no slots → throw.
- `walls=narrow` + `size=4-5` → spawn falls back to size 3 silently, dev log.
- Slot column out-of-rail → clamp to nearest valid column.
- `safeCol` + slot stream → slots ignore it.

---

## 2. Walls — pinch, zigzag, narrow

### 2.1 Existing pinch

Lives in `game.ts`:
- `pinch`, `pinchTarget` scalars (~line 373).
- Lerped each frame in `update()`.
- `currentRailLeft()` / `currentRailRight()` consume `pinch`.
- `pickSpawnColumn()` shrinks columns by `(1 - pinch * 0.6)`.
- Render: slabs + edge lines in `render()`.
- Trigger: `startWave()` sets `pinchTarget = 0.35` after `narrowingScore` with 50% RNG.

### 2.2 Generalised WallState

```ts
type WallKind = "none" | "pinch" | "zigzag" | "narrow";

interface WallState {
  kind: WallKind;
  amount: number;       // 0..1, lerped from amountTarget
  amountTarget: number;
  amp: number;          // zigzag only
  period: number;       // zigzag only
  phase: number;        // accumulates game-dt for zigzag animation
}
```

`currentRailLeft(yWorld?)` / `currentRailRight(yWorld?)` take optional y; for zigzag, inset varies along y. Internal `wallInsetAt(y) → {left, right}` is the single source of truth.

#### Insets

```
pinch:  inset = boardWidth * 0.5 * 0.6  * amount
narrow: inset = boardWidth * 0.5 * 0.85 * amount
zigzag: inset(y) = baseInset + amp * boardWidth * 0.5 * sin(2π*(y/h + phase/period))
        (left/right mirror so the corridor slants but stays roughly the same width)
```

Numbers locked in `WALL_PRESETS` constant.

#### Player push (zigzag only)

Each frame after Matter step:
1. Sample `leftWall = wallInsetAt(playerY).left`, `rightWall = wallInsetAt(playerY).right`.
2. If player x bound is inside the wall: snap body x outward, zero corresponding velocity component.
3. If snap distance > `hexSize * 0.4`: apply small downward y impulse (sells the "shoved" feel).
4. Hold push direction for ≥0.4s after activation to avoid frame-to-frame flips at zero-crossings.

No Matter constraints / compound bodies. Same approach as existing stick-flight code.

For pinch and narrow: existing player clamp does the work.

### 2.3 Rendering

Single private method `drawWalls()` invoked from `render()`. Switches on `kind`:
- `pinch` — existing slab + edge line.
- `narrow` — same path, more saturated red tint (`rgba(220,80,90,0.16)` fill, brighter edge).
- `zigzag` — polygon path tracing the inset over y; stroke leading edge plus translucent fill.

### 2.4 Endless integration

`startWave()` decision:
```
if score >= 1000 && r < 0.4 → narrow
else if score >= 800 && r < 0.4 → zigzag
else if score >= cfg().narrowingScore && r < 0.5 → pinch
else → none
```

Mutually exclusive. `startCalm()` always sets `kind="none", amountTarget=0`. New kind only allowed when `amount < 0.01` to avoid mid-fade pops.

### 2.5 Edge cases

- Zigzag straddling the player at phase=0: hold push direction (above).
- Spawn columns under zigzag: query `wallInsetAt(boardOriginY)` for top-only insets.
- Player shoved past existing rail clamp: existing `clampToRail` handles.

---

## 3. Challenge runtime

### 3.1 Game class fields

```ts
type GameMode = "endless" | "challenge";
private gameMode: GameMode = "endless";
private activeChallenge: ChallengeDef | null = null;
private challengeWaveIdx = 0;
private challengeWaveTimer = 0;
private challengeSlotTimer = 0;
private challengeSpawnTimer = 0;
private challengeSlotIdx = 0;
private challengeProbCount = 0;
private currentParsedWave: ParsedWave | null = null;
private effectOverrides: ChallengeDef["effects"] | null = null;
private progressDisplayed = 0;
```

### 3.2 update() branch

```
if (gameMode === "endless") {
  advanceWavePhase(gameDt);
  spawnTimer -= gameDt;
  if (spawnTimer <= 0) { spawnCluster(); spawnTimer = currentSpawnInterval(); }
} else {
  advanceChallenge(gameDt);
}
```

`advanceChallenge(dt)`:
1. Decrement `challengeWaveTimer` and stream timers.
2. On slot tick: fire `spawnFromSlot(slot)` (or skip).
3. On prob tick: fire `spawnChallengeProbabilistic()`.
4. When wave done (`countCap` reached, slots exhausted, or `dur` elapsed): build next `ParsedWave`, apply its WallState, reset stream counters.
5. When all waves done AND no clusters on screen: `completeChallenge()`.

Existing `FallingCluster.spawn` is reused so cluster rendering / collision routing stays identical.

### 3.3 Score

Same scoring rules. Best score tracked per challenge regardless of completion (death at 99% still banks if higher). Completing 100% awards a flat +20 bonus floater.

### 3.4 Progress

```
percent = (challengeWaveIdx + within-wave) / waves.length
within-wave = 1 - spawnsRemaining / spawnsAtStart
```

`spawnsAtStart` = `dur / rate` (prob-only) or `slots.length + countCap` (mixed). Smoothed: `progressDisplayed += (progress - progressDisplayed) * (1 - exp(-dt * 6))`.

### 3.5 Edge cases

- `speed=0` → validator rejects.
- Death at 99%: bank best, mark failed.
- Last wave clusters still on screen: defer `completeChallenge()` until clear AND fast timer expired (so payouts land under the run banner).

---

## 4. Game state machine

### 4.1 New states

```ts
type GameState =
  | "menu"
  | "challengeSelect"
  | "challengeIntro"
  | "playing"
  | "paused"
  | "gameover"
  | "challengeComplete";
```

### 4.2 Transitions

```
menu → challengeSelect (CHALLENGES btn)
menu → playing (PLAY btn, gameMode=endless)

challengeSelect → challengeIntro (choose card)
challengeSelect → menu (BACK)

challengeIntro → playing (GO / 2s timeout, gameMode=challenge)
challengeIntro → challengeSelect (BACK)

playing ↔ paused (P / pause btn / resume)
paused → menu | challengeSelect (QUIT, depending on mode)

playing(challenge) → challengeComplete (100%)
playing(challenge | endless) → gameover (death)

gameover → playing | challengeIntro (PLAY AGAIN, by mode)
gameover → menu | challengeSelect (BACK)

challengeComplete → challengeSelect (NEXT)
challengeComplete → challengeIntro (REPLAY)
challengeComplete → menu (MENU)
```

### 4.3 Quit-without-loss

Quitting from pause in challenge mode does not bank a best score and doesn't mark complete. Just a clean exit.

---

## 5. Challenge selection UI

### 5.1 Entry point

Add `<button data-action="challenges">CHALLENGES</button>` next to PLAY in `index.html`. Same pill-button style.

### 5.2 Layout

`renderChallengeSelect()` — vertically scrollable, 6 blocks. Each block: header line ("Block 3 — 2/5 completed · Complete 3 to unlock Block 4") + horizontal strip of 5 cards.

Card states:
- **Locked** (block not unlocked): name = `???`, lock icon, dimmed.
- **Unlocked, not played**: card visible, Best `—`.
- **Unlocked, played**: shows best score.
- **Completed**: best score + green check overlay.

### 5.3 Difficulty hexes

5 hexes per row, filled = challenge.difficulty. Tints: 1=`#5b8bff`, 2=`#7aa3ff`, 3=`#ffd76b`, 4=`#ff8e3c`, 5=`#e64545`. Empty hexes are outlined only.

### 5.4 DOM + scrolling

DOM overlay (matches existing menu chrome). Cards are `<button>`. Difficulty hexes are inline SVG. Container `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, sticky top bar with BACK.

---

## 6. Progress bar

### 6.1 Placement

Vertical strip on the **left edge** of the canvas. ~6px wide, board height. Fills bottom-up.

### 6.2 Render

Drawn in `render()` after walls, before clusters, only when `gameMode === "challenge"` and state ∈ {playing, paused}.

```
const w = 6;
const x = boardOriginX - w - 4;
ctx.fillStyle = "rgba(255,255,255,0.07)";
ctx.fillRect(x, boardOriginY, w, boardHeight);
ctx.fillStyle = "#7fe89c";
const fill = boardHeight * progressDisplayed;
ctx.fillRect(x, boardOriginY + boardHeight - fill, w, fill);
// tick marks per wave boundary
```

### 6.3 Animation

`progressDisplayed` lerps to `progress` with time constant ~6. On wave-index increment: bump width to 10px for 200ms (milestone pulse).

---

## 7. Persistence

### 7.1 Schema

Single key `hexrain.challenges.v1`:

```json
{
  "v": 1,
  "best":      { "1-1": 87, "1-2": 154 },
  "completed": ["1-1", "1-2", "2-1"],
  "unlockedBlocks": [1, 2]
}
```

### 7.2 Operations

- Load → parse, fall back to `{v:1,best:{},completed:[],unlockedBlocks:[1]}`.
- Complete → update best (if higher), add to completed (de-dupe), recompute unlocks, save.
- Fail/quit-with-score → update best if higher.

```ts
function recomputeUnlocked(completed: Set<string>): number[] {
  const out = [1];
  for (let b = 1; b < 6; b++) {
    const inBlock = [...completed].filter(id => id.startsWith(`${b}-`)).length;
    if (inBlock >= 3) out.push(b + 1);
  }
  return out;
}
```

### 7.3 Versioning

`v` field checked at load. Missing → reset. Future bumps add migrations in sequence.

### 7.4 Edge cases

- localStorage quota errors → swallow, in-memory fallback (mirrors existing `saveSeenHints`).
- Unknown IDs in saved data → filtered through canonical `CHALLENGES` at load.
- Game Center: challenge progress is local-only; only block-completion achievements sync.

---

## 8. Achievements

### 8.1 IDs

```ts
challengeBlock1: "hex_rain.challenge_block_1",
... challengeBlock6 ...
```

### 8.2 Metadata

| ID | Name | Description | Badge | Tint |
| --- | --- | --- | --- | --- |
| challengeBlock1 | First Steps      | Complete every challenge in Block 1 | C1 | #5b8bff |
| challengeBlock2 | Climbing         | Complete every challenge in Block 2 | C2 | #7aa3ff |
| challengeBlock3 | Halfway There    | Complete every challenge in Block 3 | C3 | #ffd76b |
| challengeBlock4 | Hex Veteran      | Complete every challenge in Block 4 | C4 | #ff8e3c |
| challengeBlock5 | Brink of Mastery | Complete every challenge in Block 5 | C5 | #ff5c6e |
| challengeBlock6 | Hex Master       | Complete every challenge in Block 6 | C6 | #e6d6ff |

### 8.3 Reporting

In `completeChallenge()`:
```
const block = activeChallenge.block;
const allDone = challenges.filter(c => c.block === block)
                          .every(c => completed.has(c.id));
if (allDone) reportAchievement(`hex_rain.challenge_block_${block}`);
```

Existing `reportAchievement` handles localStorage merge, banner queue, Game Center forwarding.

### 8.4 Display + icons

Auto-appears in menu polyhex cluster. 23 → 29 achievements; existing `MAX_ROWS=4` cap copes.

Icons: run `npx tsx scripts/generate-achievement-icons.ts` to regenerate. iOS asset registration done via `seed-gamecenter.ts` and App Store Connect manual attach (per existing flow).

---

## 9. Endless mode integration

### 9.1 Triggers

```ts
private chooseWallForEndlessWave(): void {
  const r = Math.random();
  if (this.score >= 1000 && r < 0.40) this.setWall("narrow", 1.0);
  else if (this.score >= 800 && r < 0.40) this.setWall("zigzag", 1.0);
  else if (this.score >= this.cfg().narrowingScore && r < 0.50) this.setWall("pinch", 1.0);
  else this.setWall("none", 0);
}
```

Tier supersession: narrow > zigzag > pinch > none. Only one wall kind active at any moment.

### 9.2 No regression

Existing endless behavior < score 600 unchanged. Tier rolls supersede legacy pinch path.

---

## 10. Effect duration overrides

### 10.1 Helpers

```ts
private slowDuration():   number { return this.effectOverrides?.slowDuration   ?? SLOW_EFFECT_DURATION   * this.cfg().effectDurationMul; }
private fastDuration():   number { return this.effectOverrides?.fastDuration   ?? FAST_EFFECT_DURATION   * this.cfg().effectDurationMul; }
private shieldDuration(): number { return this.effectOverrides?.shieldDuration ?? SHIELD_DURATION        * this.cfg().effectDurationMul; }
private droneDuration():  number { return this.effectOverrides?.droneDuration  ?? DRONE_DURATION         * this.cfg().effectDurationMul; }
```

Replace every direct `cfg().effectDurationMul` site with the appropriate helper.

### 10.2 Open question

`FAST_EFFECT_DURATION` is currently NOT multiplied by `effectDurationMul`. Implementation should fix this (mul=1 in MEDIUM, so behavior unchanged for default difficulty) and let challenges override.

### 10.3 In-challenge difficulty

`gameMode === "challenge"` forces `cfg()` to MEDIUM. Difficulty buttons hidden from challenge UI.

---

## 11. 30-challenge generation strategy

### 11.1 Block macros

| Block | Avg waves | Wave length | Peak speed | Walls allowed | Power-ups | Vibe |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 12 | 8–16  | 1.0–1.2 | none                     | coin              | Tutorial. Diff 1–2. |
| 2 | 18 | 12–25 | 1.1–1.4 | none, pinch              | coin, slow        | Speed intro. Diff 1–3. |
| 3 | 24 | 16–32 | 1.2–1.6 | none, pinch, zigzag      | + sticky          | Walls intro. Diff 2–4. |
| 4 | 32 | 22–48 | 1.3–1.8 | + narrow                 | + fast            | Mid-game. Diff 3–5. |
| 5 | 50 | 30–80 | 1.4–2.0 | all                      | + shield          | Endurance. Diff 4–5. |
| 6 | 80 | 60–100| 1.5–2.2 | all + dynamic            | + drone           | Final ladder. Diff 5. |

Within each block: hexes vary so the easiest 2-3 in a block are always clearable for a player meeting the block at all.

### 11.2 Naming seeds

```
1-1 First Drops · 1-2 Easy Rain · 1-3 Slow Roll · 1-4 Open Sky · 1-5 Soft Landing
2-1 Squeeze Play · 2-2 Side Step · 2-3 Coin Run · 2-4 Tight Lane · 2-5 Pressure Cooker
3-1 Zig and Zag · 3-2 Wall Crawler · 3-3 Heal & Hope · 3-4 Hex Switchback · 3-5 Demon Run
4-1 Narrow Margins · 4-2 Speed Trap · 4-3 The Funnel · 4-4 Fast Forward · 4-5 The Vise
5-1 Long Haul · 5-2 Endurance · 5-3 Iron Will · 5-4 Hex Marathon · 5-5 The Crucible
6-1 Ascendant · 6-2 Apex · 6-3 Pinnacle · 6-4 The Climb · 6-5 Gauntlet of Fear
```

### 11.3 Recipe per challenge

```
1. Total waves from block range, biased by index in block.
2. Five-act envelope: opener, build, peak, breather, finale.
3. Allocate waves: opener 15-20%, build 25-30%, peak 25-35%, breather 5-10%, finale 10-20%.
4. Per-act wall kind from block's allowed list. Peak gets hardest. Breather always walls=none.
5. Per-act speed: linear ramp through block range, breather -0.2, finale at peak.
6. ≥30% of waves use explicit slots — handcrafted feel.
7. Power-ups by difficulty:
   diff 1-2: coin every 2 waves
   diff 3:   one slow per challenge
   diff 4:   fast in build
   diff 5:   shield in peak
   block 6:  drones reserved
```

### 11.4 Tooling

`scripts/preview-challenge.ts` validates roster + prints summary stats. Optional but valuable.

---

## 12. Implementation order

1. **Foundations** (sequential):
   1. `GameMode` field + new GameState variants. No UI yet.
   2. Refactor pinch into `WallState` (kind=pinch only). Verify endless still feels identical.
   3. Replace direct `cfg().effectDurationMul` calls with helpers.

2. **Walls** (depends on 1.2):
   1. `narrow` kind + render.
   2. `zigzag` kind + push math.
   3. Score-gated triggers in `chooseWallForEndlessWave` (ships standalone, before challenge mode).

3. **Wave DSL** (parallel to walls):
   1. `parseWaveLine` + `validateChallenge`.
   2. `ChallengeDef` + empty `CHALLENGES`.
   3. 1-2 placeholder challenges to exercise parser.

4. **Challenge runtime**:
   1. `advanceChallenge`, slot + prob streams.
   2. Wave→Wall transitions.
   3. Progress + smoothing + `completeChallenge`.

5. **Persistence**:
   1. Storage helpers.
   2. Hooks in complete + death paths.

6. **UI** (parallel after foundations):
   1. CHALLENGES menu button.
   2. Challenge select overlay.
   3. Intro + complete overlays.
   4. Canvas progress bar.

7. **Achievements**:
   1. 6 new IDs in `gameCenter.ts` and `ACHIEVEMENT_LIST`.
   2. Hooks in `completeChallenge`.
   3. Generate icons.

8. **Roster**:
   1. Author 30 challenges.
   2. Run validator. Tune.

9. **Polish**:
   1. Challenge complete sting.
   2. Score-screen variant.

---

## 13. Open questions / risks

### 13.1 Decisions punted to implementation

- Slot grammar v1: slots always spawn `normal` clusters; power-ups via `pct` in prob stream.
- Fast-effect duration: should obey `effectDurationMul` (mul=1 in MEDIUM, no behavior change for default).
- Drones carry across waves (player-state, not wave-state).
- Best score = highest banked during run, regardless of completion.

### 13.2 Risks

- Zigzag push may fight Matter's solver, especially during slow-mo. Allocate test time. Fallback: zigzag without push (visual only, soft clamp).
- Game Center metadata for 6 new achievements: verify `seed-gamecenter.ts` behavior early.
- Polyhex packing of 29 achievements visually OK with `MAX_ROWS=4`.
- Validator must be elided from prod build (Vite handles via `import.meta.env.DEV`).

### 13.3 Testability

- No unit test infra today. Vitest is implied by Vite. Could add for parser if desired.
- `?challenge=3-2` URL param for direct-jump testing.
- `scripts/validate-challenges.ts` as pre-build sanity check.

---

End of design doc.
