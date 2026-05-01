#!/usr/bin/env node
// HexRain community moderation script.
//
// Manual review surface for the public CloudKit container. Talks to the
// CloudKit Web Services REST API using a server-to-server token created
// in the CloudKit Dashboard:
//   1. Apple Developer → CloudKit Console → iCloud.com.hexrain.app
//   2. Tokens & Keys → Server-to-Server Keys → "+" to create a new key
//   3. Save the private key PEM somewhere safe; copy the Key ID
//   4. Drop both into ~/.config/hexrain/moderator-token.json (see MODERATION.md)
//
// Subcommands:
//   list-reports [--since 7d]                List recent reports grouped by challenge
//   hide <recordName> [--reason <text>]      Set status="hidden" on a PublishedChallenge
//   unhide <recordName>                      Set status="approved"
//   recount-upvotes <recordName>             Recompute denormalised upvoteCount
//   recount-plays <recordName>               Recompute denormalised playCount (sum of Score.attempts)
//
// Environment overrides (rarely needed):
//   HEXRAIN_MOD_TOKEN_PATH                   Custom token JSON path
//   HEXRAIN_MOD_ENV                          "development" (default) or "production"

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_TOKEN_PATH = path.join(os.homedir(), ".config", "hexrain", "moderator-token.json");
const TOKEN_PATH = process.env.HEXRAIN_MOD_TOKEN_PATH || DEFAULT_TOKEN_PATH;
const CK_ENV = process.env.HEXRAIN_MOD_ENV || "development";
const CK_HOST = "https://api.apple-cloudkit.com";

function loadConfig() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error(`Token file not found: ${TOKEN_PATH}`);
    console.error("See MODERATION.md for setup instructions.");
    process.exit(1);
  }
  const raw = fs.readFileSync(TOKEN_PATH, "utf8");
  const cfg = JSON.parse(raw);
  if (!cfg.keyId || !cfg.privateKeyPem || !cfg.container) {
    console.error("Token file missing keyId, privateKeyPem, or container.");
    process.exit(1);
  }
  return cfg;
}

// CloudKit Web Services signs requests with ECDSA over the SHA-256 hash
// of the path + ISO8601 date + body hash. See:
//   https://developer.apple.com/documentation/cloudkitjs/setting_up_cloudkit_js
//   https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html
function ckRequest(cfg, subPath, body) {
  const json = JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(json).digest("base64");
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const fullPath = `/database/1/${cfg.container}/${CK_ENV}/public${subPath}`;
  const stringToSign = `${date}:${bodyHash}:${fullPath}`;
  const signer = crypto.createSign("SHA256");
  signer.update(stringToSign);
  const signature = signer.sign(cfg.privateKeyPem, "base64");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Apple-CloudKit-Request-KeyID": cfg.keyId,
    "X-Apple-CloudKit-Request-ISO8601Date": date,
    "X-Apple-CloudKit-Request-SignatureV1": signature,
  };
  const url = `${CK_HOST}${fullPath}`;
  return fetch(url, { method: "POST", headers, body: json }).then(async (r) => {
    const text = await r.text();
    if (!r.ok) {
      console.error(`HTTP ${r.status} ${r.statusText}`);
      console.error(text);
      process.exit(1);
    }
    return text ? JSON.parse(text) : {};
  });
}

async function queryAll(cfg, recordType, filterBy = []) {
  const out = [];
  let cursor = null;
  do {
    const body = {
      query: { recordType, filterBy },
      resultsLimit: 200,
    };
    if (cursor) body.continuationMarker = cursor;
    const res = await ckRequest(cfg, "/records/query", body);
    for (const r of (res.records || [])) out.push(r);
    cursor = res.continuationMarker || null;
  } while (cursor);
  return out;
}

async function fetchOne(cfg, recordName) {
  const res = await ckRequest(cfg, "/records/lookup", {
    records: [{ recordName }],
  });
  const rec = (res.records || [])[0];
  if (!rec || rec.serverErrorCode) return null;
  return rec;
}

async function modify(cfg, recordName, fields, recordType, recordChangeTag) {
  const op = {
    operationType: recordChangeTag ? "update" : "forceUpdate",
    record: {
      recordName,
      recordType,
      recordChangeTag,
      fields: Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, { value: v }]),
      ),
    },
  };
  return ckRequest(cfg, "/records/modify", { operations: [op] });
}

function parseSince(arg) {
  if (!arg) return 0;
  const m = arg.match(/^(\d+)([dhm])$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const ms = m[2] === "d" ? 86400_000 : m[2] === "h" ? 3600_000 : 60_000;
  return Date.now() - n * ms;
}

async function listReports(cfg, args) {
  const sinceArg = args.find((a) => a.startsWith("--since="))?.slice(8)
    ?? (args.includes("--since") ? args[args.indexOf("--since") + 1] : null);
  const since = parseSince(sinceArg ?? "30d");
  const reports = await queryAll(cfg, "Report");
  const grouped = new Map(); // challengeRecordName → reports[]
  for (const r of reports) {
    const reportedAt = (r.fields?.reportedAt?.value ?? 0);
    if (reportedAt < since) continue;
    const ref = r.fields?.challengeRef?.value;
    const refName = (ref && ref.recordName) || "(unknown)";
    if (!grouped.has(refName)) grouped.set(refName, []);
    grouped.get(refName).push(r);
  }
  if (grouped.size === 0) {
    console.log(`No reports newer than ${new Date(since).toISOString()}.`);
    return;
  }
  for (const [refName, rs] of grouped) {
    const challenge = await fetchOne(cfg, refName);
    const name = challenge?.fields?.name?.value ?? "(missing)";
    const author = challenge?.fields?.authorName?.value ?? "(unknown)";
    const status = challenge?.fields?.status?.value ?? "(unknown)";
    console.log(`\n=== ${refName}`);
    console.log(`    "${name}" by ${author} — status=${status} — ${rs.length} report(s)`);
    for (const r of rs) {
      const reason = r.fields?.reason?.value ?? "?";
      const note = r.fields?.note?.value ?? "";
      const when = new Date(r.fields?.reportedAt?.value ?? 0).toISOString();
      console.log(`    [${when}] ${reason} — ${note}`);
    }
  }
}

async function setStatus(cfg, recordName, status) {
  const rec = await fetchOne(cfg, recordName);
  if (!rec) {
    console.error(`Not found: ${recordName}`);
    process.exit(1);
  }
  await modify(cfg, recordName, { status }, rec.recordType, rec.recordChangeTag);
  console.log(`${recordName} → status=${status}`);
}

async function recountUpvotes(cfg, recordName) {
  const rec = await fetchOne(cfg, recordName);
  if (!rec) {
    console.error(`Not found: ${recordName}`);
    process.exit(1);
  }
  const upvotes = await queryAll(cfg, "Upvote", [{
    fieldName: "challengeRef",
    comparator: "EQUALS",
    fieldValue: { value: { recordName } },
  }]);
  const newCount = upvotes.length;
  await modify(cfg, recordName, { upvoteCount: newCount }, rec.recordType, rec.recordChangeTag);
  console.log(`${recordName} → upvoteCount=${newCount}`);
}

async function recountPlays(cfg, recordName) {
  const rec = await fetchOne(cfg, recordName);
  if (!rec) {
    console.error(`Not found: ${recordName}`);
    process.exit(1);
  }
  const scores = await queryAll(cfg, "Score", [{
    fieldName: "challengeRef",
    comparator: "EQUALS",
    fieldValue: { value: { recordName } },
  }]);
  const total = scores.reduce((acc, s) => acc + (s.fields?.attempts?.value ?? 1), 0);
  await modify(cfg, recordName, { playCount: total }, rec.recordType, rec.recordChangeTag);
  console.log(`${recordName} → playCount=${total}`);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    console.error("Usage: moderator.mjs <list-reports|hide|unhide|recount-upvotes|recount-plays> [args]");
    process.exit(1);
  }
  const cfg = loadConfig();
  if (cmd === "list-reports") {
    await listReports(cfg, rest);
  } else if (cmd === "hide") {
    const rn = rest[0];
    if (!rn) { console.error("Usage: hide <recordName>"); process.exit(1); }
    await setStatus(cfg, rn, "hidden");
  } else if (cmd === "unhide") {
    const rn = rest[0];
    if (!rn) { console.error("Usage: unhide <recordName>"); process.exit(1); }
    await setStatus(cfg, rn, "approved");
  } else if (cmd === "recount-upvotes") {
    const rn = rest[0];
    if (!rn) { console.error("Usage: recount-upvotes <recordName>"); process.exit(1); }
    await recountUpvotes(cfg, rn);
  } else if (cmd === "recount-plays") {
    const rn = rest[0];
    if (!rn) { console.error("Usage: recount-plays <recordName>"); process.exit(1); }
    await recountPlays(cfg, rn);
  } else {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
