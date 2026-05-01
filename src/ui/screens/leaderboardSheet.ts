// Per-challenge leaderboard sheet — top-N scores for a community
// challenge. Renders as a modal-backdrop overlay; tap-out or the ✕
// closes via data-action="close-leaderboard". Phase 2.12.

import { escapeHtml } from "../escape";
import type { Screen } from "../Screen";

export interface LeaderboardRow {
  playerName: string;
  score: number;
  attempts: number;
}

export interface LeaderboardSheetProps {
  title: string;
  loading: boolean;
  rows: LeaderboardRow[];
}

export const LeaderboardSheet: Screen<LeaderboardSheetProps | null> = {
  render(props) {
    if (!props) return "";
    const { title, loading, rows } = props;
    let body: string;
    if (loading) {
      body = `<div class="leaderboard-status">Loading…</div>`;
    } else if (rows.length === 0) {
      body = `<div class="leaderboard-status">No scores yet — be the first.</div>`;
    } else {
      body = `<ol class="leaderboard-rows">${rows.map((r, i) => {
        const playLabel = `${r.attempts} ${r.attempts === 1 ? "play" : "plays"}`;
        return `
          <li class="leaderboard-row">
            <span class="leaderboard-rank">${i + 1}</span>
            <span class="leaderboard-name">
              <span class="leaderboard-player">${escapeHtml(r.playerName)}</span>
              <span class="leaderboard-attempts">${playLabel}</span>
            </span>
            <span class="leaderboard-score">${r.score}</span>
          </li>
        `;
      }).join("")}</ol>`;
    }
    return `
      <div class="modal-backdrop" data-action="close-leaderboard">
        <div class="modal-sheet leaderboard-sheet" role="dialog" aria-label="Leaderboard">
          <header class="modal-sheet-header">
            <span>${escapeHtml(title)}</span>
            <button type="button" class="modal-close" data-action="close-leaderboard" aria-label="Close">✕</button>
          </header>
          ${body}
        </div>
      </div>
    `;
  },
};
