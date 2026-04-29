// Render a 512x512 PNG icon for each achievement in ACHIEVEMENT_LIST,
// matching the in-game hex badge: pointy-top hex filled with the
// achievement's tint colour, dark badge text centred on top.
//
// Output: assets/achievement-icons/<vendorIdentifier>.png
//   plus  assets/achievement-icons/leaderboard-high-score.png
//
// Run: npx tsx scripts/generate-achievement-icons.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

import { ACHIEVEMENT_LIST } from "../src/gameCenter";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SIZE = 512;
// Dark canvas background so the GameKit circular crop renders the hex
// on the same colour as the in-game menu chrome.
const BG = "#0d0f1c";
// Text colour matches the in-game badge (.achievement-badge color).
const TEXT = "#0d0f1c";

// Pointy-top regular hexagon inscribed in the canvas with a small inset
// so the hex doesn't bleed into the circular crop edge.
function hexPath(): string {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE * 0.48;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // pointy-top
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `M${pts[0]} L${pts.slice(1).join(" L")} Z`;
}

// Pick a font size that lets the badge text fit comfortably inside the
// hex regardless of length: short labels (★, 200) get big text, long
// labels (+100, 1.5K) get scaled down.
function fontSizeFor(label: string): number {
  const len = label.length;
  if (len <= 1) return 280;
  if (len === 2) return 240;
  if (len === 3) return 200;
  if (len === 4) return 160;
  return 130;
}

function svgFor(label: string, tint: string): string {
  const path = hexPath();
  const fs = fontSizeFor(label);
  // Mix the tint with white for the text shadow, mirroring the in-game
  // `text-shadow: 0 1px 0 color-mix(...)` rule.
  const shadow = mixWithWhite(tint, 0.65);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
  <path d="${path}" fill="${tint}"/>
  <g font-family="Avenir Next, Helvetica Neue, Trebuchet MS, Arial, sans-serif" font-weight="800" text-anchor="middle" dominant-baseline="central">
    <text x="${SIZE / 2}" y="${SIZE / 2 + fs * 0.04 + 4}" font-size="${fs}" fill="${shadow}">${escapeXml(label)}</text>
    <text x="${SIZE / 2}" y="${SIZE / 2 + fs * 0.04}" font-size="${fs}" fill="${TEXT}">${escapeXml(label)}</text>
  </g>
</svg>`;
}

function mixWithWhite(hex: string, ratio: number): string {
  const { r, g, b } = parseHex(hex);
  const mix = (c: number) => Math.round(c * ratio + 255 * (1 - ratio));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderToFile(svg: string, outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: SIZE } });
  writeFileSync(outPath, resvg.render().asPng());
}

const outDir = resolve(__dirname, "..", "assets", "achievement-icons");

for (const meta of ACHIEVEMENT_LIST) {
  const file = resolve(outDir, `${meta.id}.png`);
  renderToFile(svgFor(meta.badge, meta.tint), file);
  console.log(`wrote ${file}`);
}

// Per-difficulty leaderboard icons — same star glyph, different tints so
// they're distinguishable in the GameKit leaderboard list. Tints
// roughly match the in-game difficulty palette: blue (easy) → amber
// (medium) → orange (hard).
const LEADERBOARD_TINTS: Record<string, string> = {
  easy: "#5b8bff",
  medium: "#ffd76b",
  hard: "#ff7a4a",
  hardcore: "#dc463c",
};
for (const [diff, tint] of Object.entries(LEADERBOARD_TINTS)) {
  const file = resolve(outDir, `leaderboard-${diff}.png`);
  renderToFile(svgFor("★", tint), file);
  console.log(`wrote ${file}`);
}
