import "./style.css";
import { preloadSfx } from "./audio";
import { Game } from "./game";
import { pullProgressDown, subscribeToInstalledUpdates } from "./cloudSync";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const overlay = document.getElementById("overlay");
const touchbar = document.getElementById("touchbar");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

if (!canvas || !overlay || !touchbar || !scoreEl || !bestEl) {
  throw new Error("Missing required DOM nodes");
}

const game = new Game({ canvas, overlay, touchbar, scoreEl, bestEl });
game.start();
preloadSfx();

// Cold-launch CloudKit sync. Both calls are no-ops on web / when iCloud
// is unavailable. Pull first so the menu reflects cloud-side progress
// (best scores, unlocked blocks, custom challenges) before the player
// can do anything that would write back. Then wire the live-update
// subscription for any installed community challenges.
void (async () => {
  await pullProgressDown();
  await subscribeToInstalledUpdates();
})();
