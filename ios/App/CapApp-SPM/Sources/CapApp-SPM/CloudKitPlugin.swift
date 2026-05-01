import Foundation
import Capacitor
import CloudKit

// CloudKit bridge plugin.
//
// Exposes a generic upsert / fetch / query / delete surface for the
// app's iCloud container plus a single CKQuerySubscription that feeds
// PublishedChallenge updates back to JS via `notifyListeners`.
//
// The container identifier is implicit — we bind to the default
// container declared in App.entitlements (iCloud.com.hexrain.app).
@objc(CloudKitPlugin)
public class CloudKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudKitPlugin"
    public let jsName = "CloudKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "accountStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "userRecordId", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fetch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "upsert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "delete", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "subscribePublished", returnType: CAPPluginReturnPromise),
    ]

    private let container = CKContainer.default()

    // Local subscription cache: which PublishedChallenge record names
    // are we currently watching? Keys map 1:1 to the CKQuerySubscription
    // ids we've registered, so refreshes can diff old vs new.
    private var subscribedRecordNames = Set<String>()

    public override func load() {
        // No background work yet — subscription rebuild happens explicitly
        // from JS via subscribePublished. Push notifications would arrive
        // through the AppDelegate's didReceiveRemoteNotification; routing
        // those into JS-visible events is a follow-up (today the JS side
        // refetches on focus instead).
    }

    // MARK: - Identity

    @objc func accountStatus(_ call: CAPPluginCall) {
        container.accountStatus { status, error in
            if let error = error {
                call.reject("accountStatus failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["status": status.jsName])
        }
    }

    @objc func userRecordId(_ call: CAPPluginCall) {
        container.fetchUserRecordID { recordId, error in
            if let error = error {
                call.reject("userRecordId failed: \(error.localizedDescription)")
                return
            }
            call.resolve(["recordName": recordId?.recordName as Any? ?? NSNull()])
        }
    }

    // MARK: - CRUD

    @objc func fetch(_ call: CAPPluginCall) {
        guard let db = self.databaseFor(call: call),
              let recordName = call.getString("recordName") else {
            call.reject("Missing db / recordName")
            return
        }
        let id = CKRecord.ID(recordName: recordName)
        db.fetch(withRecordID: id) { record, error in
            if let error = error as? CKError, error.code == .unknownItem {
                call.resolve()
                return
            }
            if let error = error {
                call.reject("fetch failed: \(error.localizedDescription)")
                return
            }
            guard let record = record else {
                call.resolve()
                return
            }
            call.resolve(self.recordToDict(record))
        }
    }

    @objc func upsert(_ call: CAPPluginCall) {
        guard let db = self.databaseFor(call: call),
              let recordType = call.getString("recordType"),
              let recordName = call.getString("recordName"),
              let fields = call.getObject("fields") else {
            call.reject("Missing db / recordType / recordName / fields")
            return
        }
        let id = CKRecord.ID(recordName: recordName)
        // Fetch-then-modify so concurrent writers don't lose fields they
        // didn't touch. CKModifyRecordsOperation with .changedKeys would
        // be more efficient at scale; this app's volume doesn't warrant it.
        db.fetch(withRecordID: id) { existing, _ in
            let record = existing ?? CKRecord(recordType: recordType, recordID: id)
            self.applyFields(fields, to: record)
            db.save(record) { saved, error in
                if let error = error {
                    call.reject("upsert failed: \(error.localizedDescription)")
                    return
                }
                if let saved = saved {
                    call.resolve(self.recordToDict(saved))
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func delete(_ call: CAPPluginCall) {
        guard let db = self.databaseFor(call: call),
              let recordName = call.getString("recordName") else {
            call.reject("Missing db / recordName")
            return
        }
        let id = CKRecord.ID(recordName: recordName)
        db.delete(withRecordID: id) { _, error in
            if let error = error as? CKError, error.code == .unknownItem {
                call.resolve()
                return
            }
            if let error = error {
                call.reject("delete failed: \(error.localizedDescription)")
                return
            }
            call.resolve()
        }
    }

    @objc func query(_ call: CAPPluginCall) {
        guard let db = self.databaseFor(call: call),
              let recordType = call.getString("recordType") else {
            call.reject("Missing db / recordType")
            return
        }
        let predicateString = call.getString("predicate") ?? "TRUEPREDICATE"
        let predicate: NSPredicate
        do {
            predicate = NSPredicate(format: predicateString)
        } catch {
            call.reject("Bad predicate: \(error.localizedDescription)")
            return
        }
        let q = CKQuery(recordType: recordType, predicate: predicate)
        if let sortBy = call.getObject("sortBy"),
           let field = sortBy["field"] as? String {
            let asc = (sortBy["ascending"] as? Bool) ?? true
            q.sortDescriptors = [NSSortDescriptor(key: field, ascending: asc)]
        }

        let limit = call.getInt("limit") ?? 30
        // CKQueryOperation supports cursors for pagination but the
        // simpler `perform(_:inZoneWith:completionHandler:)` covers the
        // first page and that's all the UI uses today. Cursor support
        // is straightforward to add later if browse pagination becomes
        // important.
        if #available(iOS 15.0, *) {
            db.fetch(withQuery: q, inZoneWith: nil, desiredKeys: nil, resultsLimit: limit) { result in
                switch result {
                case .success(let payload):
                    var out: [[String: Any]] = []
                    for (_, recordResult) in payload.matchResults {
                        if case .success(let record) = recordResult {
                            out.append(self.recordToDict(record))
                        }
                    }
                    var cursor: String? = nil
                    if let queryCursor = payload.queryCursor {
                        // CKQueryOperation.Cursor is opaque — we encode
                        // it via NSKeyedArchiver and base64 so JS can
                        // round-trip an opaque token. Decoding lives in
                        // the (future) paginated query path.
                        if let data = try? NSKeyedArchiver.archivedData(
                            withRootObject: queryCursor,
                            requiringSecureCoding: true) {
                            cursor = data.base64EncodedString()
                        }
                    }
                    call.resolve([
                        "records": out,
                        "cursor": cursor as Any? ?? NSNull(),
                    ])
                case .failure(let error):
                    call.reject("query failed: \(error.localizedDescription)")
                }
            }
        } else {
            db.perform(q, inZoneWith: nil) { records, error in
                if let error = error {
                    call.reject("query failed: \(error.localizedDescription)")
                    return
                }
                let out = (records ?? []).prefix(limit).map { self.recordToDict($0) }
                call.resolve([
                    "records": out,
                    "cursor": NSNull(),
                ])
            }
        }
    }

    // MARK: - Subscriptions

    @objc func subscribePublished(_ call: CAPPluginCall) {
        let names = (call.getArray("recordNames", String.self) ?? [])
        let desired = Set(names)
        let toAdd = desired.subtracting(subscribedRecordNames)
        let toRemove = subscribedRecordNames.subtracting(desired)
        let db = container.publicCloudDatabase

        // Remove obsolete subscriptions first so we don't trip the
        // CK quota with duplicates that the user has unsubscribed from.
        let removeOps = toRemove.map { name -> CKModifySubscriptionsOperation in
            let op = CKModifySubscriptionsOperation(
                subscriptionsToSave: nil,
                subscriptionIDsToDelete: [self.subscriptionId(for: name)],
            )
            op.qualityOfService = .utility
            return op
        }
        for op in removeOps { db.add(op) }

        for name in toAdd {
            let predicate = NSPredicate(format: "recordID == %@", CKRecord.ID(recordName: name))
            let sub = CKQuerySubscription(
                recordType: "PublishedChallenge",
                predicate: predicate,
                subscriptionID: subscriptionId(for: name),
                options: [.firesOnRecordUpdate],
            )
            let info = CKSubscription.NotificationInfo()
            info.shouldSendContentAvailable = true
            sub.notificationInfo = info
            let op = CKModifySubscriptionsOperation(
                subscriptionsToSave: [sub],
                subscriptionIDsToDelete: nil,
            )
            op.qualityOfService = .utility
            db.add(op)
        }
        subscribedRecordNames = desired
        call.resolve()
    }

    private func subscriptionId(for recordName: String) -> String {
        return "pubsub-\(recordName)"
    }

    // MARK: - Helpers

    private func databaseFor(call: CAPPluginCall) -> CKDatabase? {
        guard let db = call.getString("db") else { return nil }
        switch db {
        case "private": return container.privateCloudDatabase
        case "public": return container.publicCloudDatabase
        default: return nil
        }
    }

    private func recordToDict(_ record: CKRecord) -> [String: Any] {
        var fields: [String: Any] = [:]
        for key in record.allKeys() {
            let value = record[key]
            fields[key] = self.encodeFieldValue(value)
        }
        return [
            "recordName": record.recordID.recordName,
            "recordType": record.recordType,
            "fields": fields,
            "createdAt": (record.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
            "modifiedAt": (record.modificationDate?.timeIntervalSince1970 ?? 0) * 1000,
            "creatorUserRecordName": record.creatorUserRecordID?.recordName as Any? ?? NSNull(),
        ]
    }

    private func encodeFieldValue(_ value: Any?) -> Any {
        guard let value = value else { return NSNull() }
        if let ref = value as? CKRecord.Reference {
            return [
                "recordName": ref.recordID.recordName,
                "action": referenceActionString(ref.action),
            ]
        }
        if let arr = value as? [String] { return arr }
        if let arr = value as? [NSNumber] { return arr.map { $0.doubleValue } }
        if let str = value as? String { return str }
        if let n = value as? NSNumber { return n.doubleValue }
        if let date = value as? Date { return date.timeIntervalSince1970 * 1000 }
        if let bool = value as? Bool { return bool }
        return NSNull()
    }

    private func applyFields(_ fields: [String: Any], to record: CKRecord) {
        for (key, raw) in fields {
            if raw is NSNull {
                record[key] = nil
                continue
            }
            // Reference: { recordName, action }
            if let dict = raw as? [String: Any], let refName = dict["recordName"] as? String {
                let actionStr = (dict["action"] as? String) ?? "none"
                let action = self.referenceAction(from: actionStr)
                let ref = CKRecord.Reference(
                    recordID: CKRecord.ID(recordName: refName),
                    action: action,
                )
                record[key] = ref
                continue
            }
            if let arr = raw as? [String] {
                record[key] = arr as CKRecordValue
                continue
            }
            if let arr = raw as? [NSNumber] {
                record[key] = arr as CKRecordValue
                continue
            }
            if let str = raw as? String {
                record[key] = str as CKRecordValue
                continue
            }
            if let bool = raw as? Bool, raw is Bool {
                record[key] = (bool ? 1 : 0) as CKRecordValue
                continue
            }
            if let n = raw as? NSNumber {
                record[key] = n
                continue
            }
        }
    }

    private func referenceAction(from string: String) -> CKRecord.Reference.Action {
        switch string {
        case "deleteSelf": return .deleteSelf
        default: return .none
        }
    }

    private func referenceActionString(_ action: CKRecord.Reference.Action) -> String {
        switch action {
        case .deleteSelf: return "deleteSelf"
        case .none: return "none"
        @unknown default: return "none"
        }
    }
}

private extension CKAccountStatus {
    var jsName: String {
        switch self {
        case .available: return "available"
        case .noAccount: return "noAccount"
        case .restricted: return "restricted"
        case .couldNotDetermine: return "couldNotDetermine"
        case .temporarilyUnavailable: return "temporarilyUnavailable"
        @unknown default: return "couldNotDetermine"
        }
    }
}
