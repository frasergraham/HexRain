// Challenge intro screen — shown after the player picks a challenge
// from the select grid, before they hit START. Phase 2.5.

import { difficultyTint } from "../components/blockIcon";
import { escapeHtml } from "../escape";
import type { Screen } from "../Screen";

export interface ChallengeIntroProps {
  id: string;
  name: string;
  difficulty: number;
  waveCount: number;
  /** Best score the player has reached on this challenge, or 0. */
  best: number;
}

export const ChallengeIntro: Screen<ChallengeIntroProps> = {
  render({ id, name, difficulty, waveCount, best }) {
    const tint = difficultyTint(difficulty);
    const hexes: string[] = [];
    for (let i = 0; i < difficulty; i++) {
      hexes.push(
        `<span class="challenge-card-hex" style="background:${tint}; width:14px; height:16px;"></span>`,
      );
    }
    return `
      <div class="challenge-intro">
        <span class="id">${id}</span>
        <h1>${escapeHtml(name)}</h1>
        <div class="challenge-card-hexes" style="gap:4px;">${hexes.join("")}</div>
        <p class="meta">${waveCount} waves${best > 0 ? ` · Best: ${best}` : ""}</p>
        <button type="button" class="play-btn" data-action="challenge-go">START</button>
        <button type="button" class="challenge-back" data-action="challenge-back">← Back</button>
      </div>
    `;
  },
};
