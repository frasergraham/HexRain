import Foundation
import Capacitor
import StoreKit

// StoreKit 2 plugin (iOS 15+). Surfaces three calls to the JS layer plus
// a `entitlementsChanged` listener for transactions completing outside an
// active call (Apple Pay sheet finishing after a backgrounding, refunds,
// purchases on another device propagating, etc).
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    // Holds the Transaction.updates consumer so it lives as long as the plugin.
    private var updatesTask: Task<Void, Never>?

    public override func load() {
        if #available(iOS 15.0, *) {
            updatesTask = Task.detached { [weak self] in
                for await result in Transaction.updates {
                    guard case .verified(let tx) = result else { continue }
                    await tx.finish()
                    let payload: [String: Any] = ["productIds": [tx.productID]]
                    self?.notifyListeners("entitlementsChanged", data: payload)
                }
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func requestProduct(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15+")
            return
        }
        guard let id = call.getString("id") else {
            call.reject("Missing product id")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [id])
                guard let product = products.first else {
                    call.reject("Product not found: \(id)")
                    return
                }
                call.resolve([
                    "id": product.id,
                    "displayPrice": product.displayPrice,
                    "displayName": product.displayName,
                ])
            } catch {
                call.reject("requestProduct failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15+")
            return
        }
        guard let id = call.getString("id") else {
            call.reject("Missing product id")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [id])
                guard let product = products.first else {
                    call.reject("Product not found: \(id)")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    if case .verified(let tx) = verification {
                        await tx.finish()
                        call.resolve(["state": "purchased"])
                    } else {
                        call.reject("Transaction failed verification")
                    }
                case .userCancelled:
                    call.resolve(["state": "cancelled"])
                case .pending:
                    call.resolve(["state": "pending"])
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                call.reject("purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15+")
            return
        }
        Task {
            // AppStore.sync forces a fresh fetch from Apple. Surfaces an
            // auth prompt if the user isn't signed in to the App Store.
            do {
                try await AppStore.sync()
            } catch {
                CAPLog.print("[StoreKit] AppStore.sync failed:", error.localizedDescription)
                // Continue anyway — currentEntitlements still works against
                // the local cache.
            }
            var ids: [String] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let tx) = result {
                    ids.append(tx.productID)
                }
            }
            call.resolve(["productIds": ids])
        }
    }
}
