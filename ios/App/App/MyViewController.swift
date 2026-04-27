import UIKit
import Capacitor
import CapApp_SPM

// Capacitor SPM doesn't auto-discover plugins from the Obj-C runtime
// (the legacy CAP_PLUGIN macro path). Subclass the bridge VC and
// register the in-app GameCenter plugin instance here so the JS layer
// can resolve `registerPlugin('GameCenter')`.
class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
