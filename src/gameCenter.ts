import { Capacitor, registerPlugin } from "@capacitor/core";

export const LEADERBOARD_HIGH_SCORE = "hex_rain.high_score";

export const ACHIEVEMENTS = {
  score200: "hex_rain.score_200",
  score400: "hex_rain.score_400",
  score600: "hex_rain.score_600",
  score800: "hex_rain.score_800",
  score1000: "hex_rain.score_1000",
  bonus3x: "hex_rain.bonus_3x",
  bonus4x: "hex_rain.bonus_4x",
  bonus5x: "hex_rain.bonus_5x",
  survivor: "hex_rain.survivor",
} as const;

export type AchievementId = (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS];

interface GameCenterPlugin {
  authenticate(): Promise<{ authenticated: boolean }>;
  submitScore(opts: { score: number; leaderboardId: string }): Promise<void>;
  reportAchievement(opts: {
    id: string;
    percentComplete: number;
  }): Promise<void>;
  showLeaderboard(opts: { leaderboardId?: string }): Promise<void>;
}

const Plugin = registerPlugin<GameCenterPlugin>("GameCenter");

let authenticated = false;
let initStarted = false;

// Game Center is iOS-only. On other platforms (web, simulator with no GC
// account, etc.) every call is a no-op so the rest of the game keeps working.
function isAvailable(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export async function initGameCenter(): Promise<void> {
  if (!isAvailable() || initStarted) return;
  initStarted = true;
  try {
    const result = await Plugin.authenticate();
    authenticated = result.authenticated;
  } catch (err) {
    console.warn("[GameCenter] authenticate failed:", err);
    authenticated = false;
  }
}

export async function submitScore(score: number): Promise<void> {
  if (!authenticated) return;
  try {
    await Plugin.submitScore({ score, leaderboardId: LEADERBOARD_HIGH_SCORE });
  } catch (err) {
    console.warn("[GameCenter] submitScore failed:", err);
  }
}

const reported = new Set<AchievementId>();

export async function reportAchievement(
  id: AchievementId,
  percentComplete = 100,
): Promise<void> {
  // De-dupe inside a single session — Game Center handles persistent
  // de-duping itself, but we avoid the network/IPC chatter.
  if (percentComplete >= 100 && reported.has(id)) return;
  if (percentComplete >= 100) reported.add(id);

  if (!authenticated) return;
  try {
    await Plugin.reportAchievement({ id, percentComplete });
  } catch (err) {
    console.warn("[GameCenter] reportAchievement failed:", err);
  }
}

export async function showLeaderboard(): Promise<void> {
  if (!authenticated) return;
  try {
    await Plugin.showLeaderboard({ leaderboardId: LEADERBOARD_HIGH_SCORE });
  } catch (err) {
    console.warn("[GameCenter] showLeaderboard failed:", err);
  }
}
