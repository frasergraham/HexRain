// Native share sheet wrapper for community-challenge deep links.
//
// Web Share API works inside iOS WKWebView and any modern Safari /
// Chrome on mobile. On desktop browsers (where navigator.share isn't
// implemented) we fall back to copying the URL to the clipboard so
// the player still gets *something* shareable.

const SITE_BASE = "https://hexrain.xyz";

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export function challengeShareUrl(recordName: string): string {
  // Query-param shape works with GH Pages' static hosting today (no
  // SPA fallback needed). Universal Links / path-based routes
  // (/c/{recordName}) would be a follow-up — see notes in CLAUDE.md.
  return `${SITE_BASE}/?challenge=${encodeURIComponent(recordName)}`;
}

export async function shareChallenge(name: string, recordName: string): Promise<ShareOutcome> {
  const url = challengeShareUrl(recordName);
  const text = `Check out this Hex Rain challenge: ${name}`;
  const data: ShareData = { title: name, text, url };
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      // User cancellation throws AbortError. Anything else is a real
      // failure — fall through to clipboard so the URL is at least
      // recoverable.
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      /* fall through */
    }
  }
  // Final fallback: prompt() at least lets the user copy by hand.
  if (typeof window !== "undefined" && typeof window.prompt === "function") {
    window.prompt("Copy this link:", url);
    return "copied";
  }
  return "failed";
}
