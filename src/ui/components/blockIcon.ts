// Renders a single ClusterKind into a small canvas, used by:
//   - The BLOCKS guide cards.
//   - The custom-wave editor's cell picker preview.
//   - The challenge select cluster-mix preview chips.
//
// Mirrors the in-game cluster look so the chrome stays in sync if the
// palette ever changes — the actual colours come from src/palettes.ts
// via blobPalette.

import { pathHex } from "../../hex";
import { blobPalette } from "../../palettes";
import type { ClusterKind } from "../../types";

export function drawBlockIcon(canvas: HTMLCanvasElement, kind: ClusterKind): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const hexSize = Math.min(w, h) * 0.32;
  ctx.clearRect(0, 0, w, h);

  if (kind === "coin") {
    const r = hexSize * 0.95;
    const glowR = hexSize * 1.6;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    halo.addColorStop(0, "rgba(255, 170, 70, 0.85)");
    halo.addColorStop(0.5, "rgba(220, 130, 30, 0.45)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, "#fff1c2");
    grad.addColorStop(0.45, "#ffb255");
    grad.addColorStop(1, "#a14e08");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 240, 200, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }

  if (kind === "normal") {
    pathHex(ctx, cx, cy, hexSize);
    const grad = ctx.createLinearGradient(0, cy - hexSize, 0, cy + hexSize);
    grad.addColorStop(0, "#aac4ff");
    grad.addColorStop(1, "#5b8bff");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#1c2348";
    ctx.stroke();
    return;
  }

  // Helpful kinds: same drawAsBlob recipe as cluster.ts.
  const palette = blobPalette(kind);
  const r = hexSize * 0.85;
  const glowR = hexSize * 1.7;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  halo.addColorStop(0, palette.haloInner);
  halo.addColorStop(0.5, palette.haloMid);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const core = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  core.addColorStop(0, palette.coreLight);
  core.addColorStop(1, palette.coreDark);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Difficulty banding for the challenge-select hexes:
// 1–2 = green (chill), 3–4 = yellow (heat), 5 = red.
export function difficultyTint(d: number): string {
  if (d >= 5) return "#e64545";
  if (d >= 3) return "#ffd76b";
  return "#7fe89c";
}
