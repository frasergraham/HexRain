import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hexrain.app",
  appName: "Hex Rain",
  webDir: "dist",
  ios: {
    // "never" lets the WebView extend full-bleed under the safe-area
    // bands; the CSS already handles env(safe-area-inset-*) for the HUD
    // and touchbar. With "always" + scrollEnabled:false, WKWebView
    // baked the bottom inset in as a permanent margin and clipped the
    // touchbar's hex slider off the screen.
    contentInset: "never",
    backgroundColor: "#0d0f1c",
    // Disable WKWebView native scrolling — the canvas fills the viewport
    // and any drag should rotate the player, not pan the page.
    scrollEnabled: false,
  },
};

export default config;
