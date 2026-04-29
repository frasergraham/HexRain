// StoreKit bridge wrapper.
//
// Mirrors the Game Center pattern: a thin TS surface that lazy-loads the
// native Capacitor plugin on iOS and degrades to a no-op on web. Powers
// the "Unlock All Challenges" IAP shown on the challenge select screen.

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export const UNLOCK_ALL_PRODUCT_ID = "com.hexrain.app.unlockall";

export type PurchaseState = "purchased" | "cancelled" | "pending" | "failed";

export interface ProductInfo {
  id: string;
  displayPrice: string;
  displayName: string;
}

interface StoreKitPlugin {
  requestProduct(opts: { id: string }): Promise<ProductInfo>;
  purchase(opts: { id: string }): Promise<{ state: "purchased" | "cancelled" | "pending" }>;
  restorePurchases(): Promise<{ productIds: string[] }>;
  addListener(
    eventName: "entitlementsChanged",
    cb: (info: { productIds: string[] }) => void,
  ): Promise<PluginListenerHandle>;
}

const Plugin = registerPlugin<StoreKitPlugin>("StoreKit");

function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function isStoreKitAvailable(): boolean {
  return isIOS();
}

// Cached product info — Apple charges a network round-trip on requestProduct,
// so fetch once per app lifetime.
let productPromise: Promise<ProductInfo | null> | null = null;

export function getUnlockAllProduct(): Promise<ProductInfo | null> {
  if (!isIOS()) return Promise.resolve(null);
  if (productPromise) return productPromise;
  productPromise = Plugin.requestProduct({ id: UNLOCK_ALL_PRODUCT_ID })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[storeKit] requestProduct failed:", err);
      // Reset so a later call retries (e.g. recovered network).
      productPromise = null;
      return null;
    });
  return productPromise;
}

export async function purchaseUnlockAll(): Promise<PurchaseState> {
  if (!isIOS()) return "failed";
  try {
    const r = await Plugin.purchase({ id: UNLOCK_ALL_PRODUCT_ID });
    return r.state;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[storeKit] purchase failed:", err);
    return "failed";
  }
}

// True if the unlock entitlement is currently owned by the signed-in
// Apple account (after the optional AppStore.sync).
export async function restoreUnlockAll(): Promise<boolean> {
  if (!isIOS()) return false;
  try {
    const r = await Plugin.restorePurchases();
    return r.productIds.includes(UNLOCK_ALL_PRODUCT_ID);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[storeKit] restore failed:", err);
    return false;
  }
}

// Fires whenever the underlying StoreKit transaction queue grants a new
// entitlement (purchase completing after backgrounding, refunds, etc).
// The callback receives `true` if the unlock product is now owned.
export function onUnlockAllEntitlementChanged(cb: (owned: boolean) => void): void {
  if (!isIOS()) return;
  void Plugin.addListener("entitlementsChanged", (info) => {
    cb(info.productIds.includes(UNLOCK_ALL_PRODUCT_ID));
  });
}
