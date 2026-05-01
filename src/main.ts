import "./style.css";
import { Capacitor } from "@capacitor/core";
import { preloadSfx } from "./audio";
import { Game } from "./game";

// Tag the document for web vs native so style.css can letterbox the
// browser preview to an iPhone aspect ratio without changing the iOS
// build (which already runs full-bleed inside the device frame).
if (Capacitor.getPlatform() === "web") {
  document.body.classList.add("web");
}

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
