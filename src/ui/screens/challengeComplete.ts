// Challenge complete screen — animated bar fill, star pop sequence,
// optional "Block N Unlocked" banner. Phase 2.6.
//
// The animation phase fires from `bind()` after render: the bar
// fill width transitions from 0 → fillPct, and each earned star
// pops the moment the fill crosses its tier threshold.

import { escapeHtml } from "../escape";
import type { Screen } from "../Screen";

export interface ChallengeCompleteProps {
  idLabel: string;
  name: string;
  score: number;
  best: number;
  /** True when this run is the new personal best — switches the
   *  bottom strip from "Best N" to a "NEW BEST" banner. */
  isNewBest: boolean;
  /** Star thresholds (1★ / 2★ / 3★) — drives the bar tier ticks
   *  and pop timing. */
  thresholds: { one: number; two: number; three: number };
  /** Stars actually earned (0..3). */
  earnedStars: number;
  /** Block ids freshly unlocked by this completion (for the
   *  "Block N Unlocked" banner; empty array = no banner). */
  newlyUnlocked: number[];
  /** Optional: callback fired each time a star pops (so the caller
   *  can play an SFX cue). */
  onStarPop?: (idx: number, earned: boolean) => void;
}

export const ChallengeComplete: Screen<ChallengeCompleteProps> = {
  render({ idLabel, name, score, best, isNewBest, thresholds, earnedStars, newlyUnlocked }) {
    const starHtml: string[] = [];
    for (let i = 0; i < 3; i++) {
      const filled = i < earnedStars;
      starHtml.push(
        `<span class="challenge-star${filled ? " earned" : " empty"}" data-star-idx="${i}">★</span>`,
      );
    }
    const tiers = [thresholds.one, thresholds.two, thresholds.three];
    const barMax = Math.max(score, thresholds.three) * 1.05;
    const fillPct = Math.min(100, (score / barMax) * 100);
    const tierMarkers = tiers
      .map((t) => {
        const pct = Math.min(100, (t / barMax) * 100).toFixed(2);
        return `
          <div class="bar-tier" style="left:${pct}%;">
            <span class="bar-tier-star">★</span>
            <span class="bar-tier-score">${t}</span>
          </div>
        `;
      })
      .join("");
    const unlockBanner = newlyUnlocked.length > 0
      ? newlyUnlocked.map((b) =>
          `<p class="challenge-unlock-banner">Block ${b} Unlocked</p>`,
        ).join("")
      : "";
    return `
      <div class="challenge-intro">
        <p class="challenge-complete-banner">Challenge Complete</p>
        <span class="id">${escapeHtml(idLabel)}</span>
        <h1>${escapeHtml(name)}</h1>
        <div class="challenge-stars-big">${starHtml.join("")}</div>
        <div class="challenge-score-bar">
          <div class="bar-track">
            <div class="bar-fill"></div>
            ${tierMarkers}
            <div class="bar-marker" style="left:${fillPct.toFixed(2)}%;">
              <span class="bar-marker-score">${score}</span>
            </div>
          </div>
        </div>
        <p class="tagline">${isNewBest ? "NEW BEST" : `Best ${best}`}</p>
        ${unlockBanner}
        <button type="button" class="play-btn" data-action="play">PLAY AGAIN</button>
        <button type="button" class="challenge-back" data-action="challenge-back">Back</button>
        <button type="button" class="challenge-back" data-action="challenge-menu">Main menu</button>
      </div>
    `;
  },
  bind(root, { score, thresholds, onStarPop }) {
    const tiers = [thresholds.one, thresholds.two, thresholds.three];
    const barMax = Math.max(score, thresholds.three) * 1.05;
    const fillPct = Math.min(100, (score / barMax) * 100);
    const fillEl = root.querySelector<HTMLDivElement>(".bar-fill");
    const markerEl = root.querySelector<HTMLDivElement>(".bar-marker");
    const BAR_DURATION_MS = 1100;
    const POST_BAR_DELAY_MS = 260;
    if (fillEl && markerEl) {
      fillEl.style.transition = `width ${BAR_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
      markerEl.style.transition = `left ${BAR_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease-out`;
      requestAnimationFrame(() => {
        fillEl.style.width = `${fillPct.toFixed(2)}%`;
        markerEl.classList.add("show");
      });
    }
    const starEls = Array.from(
      root.querySelectorAll<HTMLSpanElement>(".challenge-star"),
    );
    const timeouts: number[] = [];
    starEls.forEach((el, i) => {
      const threshold = tiers[i]!;
      const reachedAt = score >= threshold
        ? Math.min(BAR_DURATION_MS, (threshold / Math.max(1, score)) * BAR_DURATION_MS)
        : BAR_DURATION_MS + POST_BAR_DELAY_MS;
      const id = window.setTimeout(() => {
        el.classList.add("pop");
        if (onStarPop) onStarPop(i, el.classList.contains("earned"));
      }, reachedAt);
      timeouts.push(id);
    });
    return () => {
      for (const id of timeouts) clearTimeout(id);
    };
  },
};
