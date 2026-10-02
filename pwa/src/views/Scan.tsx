import { useState } from "react";
import { useScannerStore } from "../store/useScannerStore";
import { FallbackBanner } from "../components/FallbackBanner";
import { CellTable } from "../components/CellTable";
import { CellDetail } from "../components/CellDetail";
import { exportScanCsv } from "../lib/export";
import type { CellSample } from "../bridge/types";
import { loadDemoScan } from "../demo/demoData";

export function Scan() {
  const {
    bridgeStatus,
    scans,
    busy,
    error,
    scanOnce,
    requestPermissions,
    settings,
    subscriptions,
    updateSettings,
    importScans,
  } = useScannerStore();
  const [selected, setSelected] = useState<CellSample | null>(null);
  const [networkScan, setNetworkScan] = useState(false);

  const latest = scans[0];

  async function doScan() {
    if (!bridgeStatus?.present) {
      if (settings.demoMode) {
        importScans({ scans: [loadDemoScan()] });
      }
      return;
    }
    await scanOnce({ useNetworkScan: networkScan });
  }

  return (
    <div className="space-y-3">
      <FallbackBanner status={bridgeStatus} />
      {error && (
        <div className="card border-signal-bad/40 text-signal-bad text-sm">
          {error}
        </div>
      )}

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary flex-1 min-w-[160px]"
            onClick={doScan}
            disabled={busy}
          >
            {busy ? "Scanning…" : "Scan networks"}
          </button>
          {bridgeStatus?.present && !bridgeStatus.canReadFineLocation && (
            <button className="btn" onClick={requestPermissions}>
              Grant permissions
            </button>
          )}
          {latest && (
            <button className="btn" onClick={() => exportScanCsv(latest)}>
              Export CSV
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={networkScan}
              onChange={(e) => setNetworkScan(e.target.checked)}
            />
            Try <code>requestNetworkScan</code> (needs carrier privileges — falls back when denied)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.airtelMode}
              onChange={(e) => updateSettings({ airtelMode: e.target.checked })}
            />
            Airtel scan mode
          </label>
          {settings.airtelMode && (
            <>
              <label>
                MCC{" "}
                <input
                  className="input inline-block w-20 py-1"
                  value={settings.airtelMcc}
                  onChange={(e) => updateSettings({ airtelMcc: e.target.value })}
                />
              </label>
              <label>
                MNC{" "}
                <input
                  className="input inline-block w-20 py-1"
                  value={settings.airtelMnc}
                  onChange={(e) => updateSettings({ airtelMnc: e.target.value })}
                />
              </label>
            </>
          )}
        </div>

        {subscriptions.length > 1 && (
          <div className="text-sm">
            <label className="label">SIM</label>
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
          </div>
        )}
      </div>

      {latest && (
        <div className="card">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-ink-dim uppercase tracking-wider">
                Scan {latest.scanId}
              </div>
              <div className="text-sm text-ink-dim">
                {new Date(latest.tsMs).toLocaleString()} · source: {latest.source}
              </div>
            </div>
            <div className="text-sm font-mono">
              {latest.samples.length} cells
            </div>
          </div>
          {latest.warnings.length > 0 && (
            <ul className="mt-2 text-xs text-signal-fair list-disc pl-5">
              {latest.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {latest && (
        <CellTable
          samples={latest.samples}
          onPick={(r) => setSelected(r.sample)}
        />
      )}

      {selected && (
        <CellDetail sample={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
