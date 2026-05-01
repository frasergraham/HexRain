// Post-sync patch for ios/App/App/capacitor.config.json.
//
// Capacitor's CLI scans installed third-party plugin packages for
// @objc(ClassName) declarations and writes them into packageClassList.
// Plugins that live inside this app's CapApp-SPM target (i.e. GameCenter
// + StoreKit) are invisible to that scanner, so without this patch they
// end up unregistered and JS calls reject with `UNIMPLEMENTED`.
//
// Run after `cap sync ios`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "ios/App/App/capacitor.config.json");

const LOCAL_PLUGINS = ["GameCenterPlugin", "StoreKitPlugin", "CloudKitPlugin"];

const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const existing = Array.isArray(cfg.packageClassList) ? cfg.packageClassList : [];
const merged = Array.from(new Set([...existing, ...LOCAL_PLUGINS]));

if (existing.length === merged.length && existing.every((v, i) => v === merged[i])) {
  console.log("[patch-cap-plugins] packageClassList already up to date");
  process.exit(0);
}

cfg.packageClassList = merged;
fs.writeFileSync(configPath, JSON.stringify(cfg, null, "\t") + "\n");
console.log(`[patch-cap-plugins] packageClassList -> ${JSON.stringify(merged)}`);
