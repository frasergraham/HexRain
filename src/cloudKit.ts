// CloudKit bridge wrapper.
//
// Mirrors src/storeKit.ts — a thin TS surface that lazy-loads the
// native Capacitor plugin on iOS and degrades to no-ops on web. Used
// by src/cloudSync.ts to back personal challenge progress and the
// public community-challenge corpus.
//
// Generic upsert/fetch/query/delete are exposed (rather than
// per-record-type methods) so adding a new record type doesn't
// require new Swift. The Swift side validates record names and
// translates between JS object literals and CKRecord field types.

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type CloudKitDb = "private" | "public";

export type CloudKitAccountStatus =
  | "available"
  | "noAccount"
  | "restricted"
  | "couldNotDetermine"
  | "temporarilyUnavailable";

export type CloudKitField =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | { recordName: string; action?: "none" | "deleteSelf" };

export interface CloudKitRecord {
  recordName: string;
  recordType: string;
  fields: Record<string, CloudKitField>;
  createdAt?: number;
  modifiedAt?: number;
  creatorUserRecordName?: string;
}

export interface CloudKitQueryOpts {
  db: CloudKitDb;
  recordType: string;
  /** SQL-like predicate string (NSPredicate format on the Swift side). */
  predicate?: string;
  sortBy?: { field: string; ascending: boolean };
  limit?: number;
  /** Continuation cursor returned by a previous query. */
  cursor?: string | null;
}

export interface CloudKitQueryResult {
  records: CloudKitRecord[];
  cursor: string | null;
}

interface CloudKitPlugin {
  accountStatus(): Promise<{ status: CloudKitAccountStatus }>;
  userRecordId(): Promise<{ recordName: string | null }>;

  fetch(opts: { db: CloudKitDb; recordName: string }): Promise<CloudKitRecord | null>;
  upsert(opts: {
    db: CloudKitDb;
    recordType: string;
    recordName: string;
    fields: Record<string, CloudKitField>;
  }): Promise<CloudKitRecord>;
  delete(opts: { db: CloudKitDb; recordName: string }): Promise<void>;
  query(opts: CloudKitQueryOpts): Promise<CloudKitQueryResult>;

  /** Subscribe to publicDB updates on PublishedChallenge records the
   *  player has installed locally. The Swift side maintains the CK
   *  subscription and pushes changes via `notifyListeners`. Pass an
   *  empty list to clear. */
  subscribePublished(opts: { recordNames: string[] }): Promise<void>;

  addListener(
    eventName: "publishedUpdated",
    cb: (info: { record: CloudKitRecord }) => void,
  ): Promise<PluginListenerHandle>;
}

const Plugin = registerPlugin<CloudKitPlugin>("CloudKit");

function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function isCloudKitAvailable(): boolean {
  return isIOS();
}

let cachedAccount: CloudKitAccountStatus | null = null;
let cachedUserRecordName: string | null = null;

export async function getAccountStatus(force = false): Promise<CloudKitAccountStatus> {
  if (!isIOS()) return "noAccount";
  if (!force && cachedAccount) return cachedAccount;
  try {
    const r = await Plugin.accountStatus();
    cachedAccount = r.status;
    return r.status;
  } catch (err) {
    console.warn("[cloudKit] accountStatus failed:", err);
    return "couldNotDetermine";
  }
}

// True when the player has a usable iCloud account. Required for any
// write — reads against the public DB technically work without one,
// but we gate everything on this for a single, predictable user state.
export async function isAccountReady(): Promise<boolean> {
  return (await getAccountStatus()) === "available";
}

export async function getUserRecordName(): Promise<string | null> {
  if (!isIOS()) return null;
  if (cachedUserRecordName) return cachedUserRecordName;
  try {
    const r = await Plugin.userRecordId();
    cachedUserRecordName = r.recordName;
    return r.recordName;
  } catch (err) {
    console.warn("[cloudKit] userRecordId failed:", err);
    return null;
  }
}

export async function fetchRecord(db: CloudKitDb, recordName: string): Promise<CloudKitRecord | null> {
  if (!isIOS()) return null;
  try {
    return await Plugin.fetch({ db, recordName });
  } catch (err) {
    console.warn(`[cloudKit] fetch ${db}/${recordName} failed:`, err);
    return null;
  }
}

export async function upsertRecord(
  db: CloudKitDb,
  recordType: string,
  recordName: string,
  fields: Record<string, CloudKitField>,
): Promise<CloudKitRecord | null> {
  if (!isIOS()) return null;
  try {
    return await Plugin.upsert({ db, recordType, recordName, fields });
  } catch (err) {
    console.warn(`[cloudKit] upsert ${db}/${recordName} failed:`, err);
    return null;
  }
}

export async function deleteRecord(db: CloudKitDb, recordName: string): Promise<boolean> {
  if (!isIOS()) return false;
  try {
    await Plugin.delete({ db, recordName });
    return true;
  } catch (err) {
    console.warn(`[cloudKit] delete ${db}/${recordName} failed:`, err);
    return false;
  }
}

export async function queryRecords(opts: CloudKitQueryOpts): Promise<CloudKitQueryResult> {
  if (!isIOS()) return { records: [], cursor: null };
  try {
    return await Plugin.query(opts);
  } catch (err) {
    console.warn(`[cloudKit] query ${opts.db}/${opts.recordType} failed:`, err);
    return { records: [], cursor: null };
  }
}

export async function subscribePublished(recordNames: string[]): Promise<void> {
  if (!isIOS()) return;
  try {
    await Plugin.subscribePublished({ recordNames });
  } catch (err) {
    console.warn("[cloudKit] subscribePublished failed:", err);
  }
}

export function onPublishedUpdated(
  cb: (record: CloudKitRecord) => void,
): void {
  if (!isIOS()) return;
  void Plugin.addListener("publishedUpdated", (info) => {
    if (info?.record) cb(info.record);
  });
}
