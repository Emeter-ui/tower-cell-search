import { useScannerStore } from "../store/useScannerStore";

export function Settings() {
  const {
    settings,
    updateSettings,
    bridgeStatus,
    subscriptions,
    requestPermissions,
    refreshBridge,
  } = useScannerStore();

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          Live monitor
        </div>
        <div>
          <label className="label">Poll interval (ms)</label>
          <input
            className="input"
            type="number"
            min={500}
            max={60000}
            step={100}
            value={settings.pollMs}
            onChange={(e) =>
              updateSettings({ pollMs: Math.max(500, Number(e.target.value)) })
            }
          />
          <div className="text-xs text-ink-mute mt-1">
            Lower values give you more updates but cost battery. 2000–5000 ms is a
            good default.
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          Airtel scan mode
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.airtelMode}
            onChange={(e) => updateSettings({ airtelMode: e.target.checked })}
          />
          Enable Airtel-only filtering
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">MCC</label>
            <input
              className="input"
              value={settings.airtelMcc}
              onChange={(e) => updateSettings({ airtelMcc: e.target.value })}
            />
          </div>
          <div>
            <label className="label">MNC</label>
            <input
              className="input"
              value={settings.airtelMnc}
              onChange={(e) => updateSettings({ airtelMnc: e.target.value })}
            />
          </div>
        </div>
        <div className="text-xs text-ink-mute">
          Default is Airtel Nigeria (MCC 621, MNC 20). Change to match your
          Airtel country. Multiple MNCs can be configured by editing then
          scanning again.
        </div>
      </div>

      <div className="card space-y-3">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          SIM
        </div>
        {subscriptions.length === 0 ? (
          <div className="text-sm text-ink-dim">No subscriptions reported.</div>
        ) : (
          <select
            className="input"
            value={settings.selectedSubId ?? ""}
            onChange={(e) =>
              updateSettings({
                selectedSubId:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
          >
            <option value="">Default</option>
            {subscriptions.map((s) => (
              <option key={s.subId} value={s.subId}>
                SIM {s.slotIndex + 1} · {s.carrierName ?? s.displayName ?? s.subId}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="card space-y-3">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          Bridge
        </div>
        <div className="text-sm space-y-1">
          <div>
            Status:{" "}
            <b>{bridgeStatus?.present ? "Connected" : "Unavailable"}</b>
          </div>
          {bridgeStatus?.present && (
            <>
              <div>Location permission: {bridgeStatus.canReadFineLocation ? "granted" : "missing"}</div>
              <div>Phone permission: {bridgeStatus.canReadPhoneState ? "granted" : "missing"}</div>
              <div>Neighbor cell support: {bridgeStatus.neighborCellSupport}</div>
              <div>requestNetworkScan: {bridgeStatus.canRequestNetworkScan ? "available" : "restricted"}</div>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => refreshBridge()}>
            Refresh
          </button>
          <button className="btn" onClick={requestPermissions}>
            Request permissions
          </button>
        </div>
      </div>

      <div className="card space-y-2">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          Demo mode
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.demoMode}
            onChange={(e) => updateSettings({ demoMode: e.target.checked })}
          />
          Load a canned sample scan when scanning in the browser without the
          native bridge
        </label>
        <div className="text-xs text-ink-mute">
          Off by default. Clearly separated — never used when the Android
          companion is present.
        </div>
      </div>

      <div className="card space-y-2">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          Privacy
        </div>
        <div className="text-sm text-ink-dim">
          All scans stay on this device. No network sync. Location is used
          only to tag scans locally, and only when you grant it.
        </div>
      </div>
    </div>
  );
}
