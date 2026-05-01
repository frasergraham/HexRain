import "./style.css";
import { preloadSfx } from "./audio";
import { App } from "@capacitor/app";
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

// Deep-link handling. Two entry points:
//   1. Web: window.location.search has `?challenge=X` because the
//      browser navigated to the URL directly.
//   2. iOS Universal Link: the OS routes the URL into the app via
//      Capacitor's appUrlOpen event (cold launch and warm tap both).
function challengeFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, window.location.origin);
    return u.searchParams.get("challenge");
  } catch {
    return null;
  }
}

const sharedChallenge = new URLSearchParams(window.location.search).get("challenge");
if (sharedChallenge) {
  window.history.replaceState({}, "", window.location.pathname);
  void game.openSingleChallenge(sharedChallenge, "menu");
}

// Cold launch via Universal Link gives Capacitor the launch URL but
// not necessarily window.location — fetch it explicitly. The plugin
// is a no-op on web (returns null) so this branch only fires on iOS.
void App.getLaunchUrl().then((u) => {
  const id = challengeFromUrl(u?.url);
  if (id) void game.openSingleChallenge(id, "menu");
});

// Warm taps: subscribe for the rest of the app lifetime.
void App.addListener("appUrlOpen", ({ url }) => {
  const id = challengeFromUrl(url);
  if (id) void game.openSingleChallenge(id, "menu");
});

// Cold-launch CloudKit sync. Both calls are no-ops on web / when iCloud
// is unavailable. Pull first so the menu reflects cloud-side progress
// (best scores, unlocked blocks, custom challenges) before the player
// can do anything that would write back. Then wire the live-update
// subscription for any installed community challenges.
void (async () => {
  await pullProgressDown();
  await subscribeToInstalledUpdates();
})();
