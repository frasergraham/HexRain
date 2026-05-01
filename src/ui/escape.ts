// HTML escaper used by every screen template. Pulled out of game.ts in
// Phase 2 so screen modules don't need to reach back into the
// monolith. Plays nice with the literal-template pattern that all
// screens use: `<span>${escapeHtml(c.name)}</span>`.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
