import Foundation
import Capacitor
import GameKit
import UIKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportAchievement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadAchievements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    private var didTryAuth = false

    @objc func authenticate(_ call: CAPPluginCall) {
        let local = GKLocalPlayer.local

        if local.isAuthenticated {
            call.resolve(["authenticated": true])
            return
        }

        // Game Center will replay the handler whenever auth state changes,
        // so we have to be careful to only resolve the *current* call once.
        if didTryAuth {
            call.resolve(["authenticated": local.isAuthenticated])
            return
        }
        didTryAuth = true

        local.authenticateHandler = { [weak self] viewController, error in
            guard let self = self else { return }

            if let vc = viewController {
                DispatchQueue.main.async {
                    self.bridge?.viewController?.present(vc, animated: true, completion: nil)
                }
                return
            }

            if let err = error {
                CAPLog.print("[GameCenter] auth error:", err.localizedDescription)
                call.resolve(["authenticated": false])
                return
            }

            call.resolve(["authenticated": local.isAuthenticated])
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center not authenticated")
            return
        }
        guard let leaderboardId = call.getString("leaderboardId") else {
            call.reject("Missing leaderboardId")
            return
        }
        let score = call.getInt("score") ?? 0

        if #available(iOS 14.0, *) {
            GKLeaderboard.submitScore(
                score,
                context: 0,
                player: GKLocalPlayer.local,
                leaderboardIDs: [leaderboardId]
            ) { error in
                if let error = error {
                    call.reject("submitScore failed: \(error.localizedDescription)")
                } else {
                    call.resolve()
                }
            }
        } else {
            let gkScore = GKScore(leaderboardIdentifier: leaderboardId)
            gkScore.value = Int64(score)
            GKScore.report([gkScore]) { error in
                if let error = error {
                    call.reject("submitScore failed: \(error.localizedDescription)")
                } else {
                    call.resolve()
                }
            }
        }
    }

    @objc func reportAchievement(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center not authenticated")
            return
        }
        guard let id = call.getString("id") else {
            call.reject("Missing achievement id")
            return
        }
        let percent = call.getDouble("percentComplete") ?? 100.0

        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = percent
        achievement.showsCompletionBanner = true

        GKAchievement.report([achievement]) { error in
            if let error = error {
                call.reject("reportAchievement failed: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    // Returns IDs of every achievement the player has fully completed in
    // Game Center, so the JS layer can seed the local earned-set on launch.
    @objc func loadAchievements(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center not authenticated")
            return
        }
        GKAchievement.loadAchievements { achievements, error in
            if let error = error {
                call.reject("loadAchievements failed: \(error.localizedDescription)")
                return
            }
            let ids = (achievements ?? [])
                .filter { $0.percentComplete >= 100.0 }
                .compactMap { $0.identifier }
            call.resolve(["ids": ids])
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Game Center not authenticated")
            return
        }
        let leaderboardId = call.getString("leaderboardId")

        DispatchQueue.main.async {
            let vc = GKGameCenterViewController()
            vc.gameCenterDelegate = GameCenterDelegateProxy.shared
            if #available(iOS 14.0, *), let id = leaderboardId {
                let modern = GKGameCenterViewController(
                    leaderboardID: id,
                    playerScope: .global,
                    timeScope: .allTime
                )
                modern.gameCenterDelegate = GameCenterDelegateProxy.shared
                self.bridge?.viewController?.present(modern, animated: true, completion: nil)
            } else {
                vc.viewState = .leaderboards
                self.bridge?.viewController?.present(vc, animated: true, completion: nil)
            }
            call.resolve()
        }
    }
}

// GameKit requires a non-nil delegate to dismiss the leaderboard sheet.
class GameCenterDelegateProxy: NSObject, GKGameCenterControllerDelegate {
    static let shared = GameCenterDelegateProxy()

    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true, completion: nil)
    }
}
