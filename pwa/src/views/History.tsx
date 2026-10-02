import { useRef } from "react";
import { useScannerStore } from "../store/useScannerStore";
import {
  exportAllCsv,
  exportScanCsv,
  exportScansJson,
  parseImportedJson,
} from "../lib/export";
import { SignalBadge } from "../components/SignalBadge";
import { gradeRsrp } from "../lib/signal";

export function History() {
  const {
    scans,
    history,
    deleteScan,
    clearHistory,
    importScans,
  } = useScannerStore();
  const fileInput = useRef<HTMLInputElement>(null);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const bundle = parseImportedJson(text);
      importScans(bundle);
    } catch (err) {
      alert(String(err));
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap gap-2">
        <button
          className="btn"
          onClick={() => exportScansJson(scans)}
          disabled={scans.length === 0}
        >
          Export JSON
        </button>
        <button
          className="btn"
          onClick={() => exportAllCsv(scans)}
          disabled={scans.length === 0}
        >
          Export CSV
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={onImport}
        />
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm("Erase all local scans and history?")) clearHistory();
          }}
          disabled={scans.length === 0 && history.length === 0}
        >
          Clear history
        </button>
      </div>

      <div className="card">
        <div className="text-xs text-ink-dim uppercase tracking-wider mb-2">
          Scans ({scans.length})
        </div>
        {scans.length === 0 ? (
          <div className="text-ink-dim text-sm">No scans yet.</div>
        ) : (
          <ul className="divide-y divide-line">
            {scans.map((s) => (
              <li
                key={s.scanId}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-mono text-sm">{s.scanId}</div>
                  <div className="text-xs text-ink-dim">
                    {new Date(s.tsMs).toLocaleString()} · {s.samples.length} cells · {s.source}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => exportScanCsv(s)}>
                    CSV
                  </button>
                  <button className="btn btn-danger" onClick={() => deleteScan(s.scanId)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="text-xs text-ink-dim uppercase tracking-wider mb-2">
          Unique cells ({history.length})
        </div>
        {history.length === 0 ? (
          <div className="text-ink-dim text-sm">
            No cells recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg-sunk">
                <tr>
                  <th className="th">RAT</th>
                  <th className="th">PLMN</th>
                  <th className="th">PCI</th>
                  <th className="th">Cell ID</th>
                  <th className="th">ARFCN</th>
                  <th className="th">Obs</th>
                  <th className="th">Last RSRP</th>
                  <th className="th">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 200).map((h) => (
                  <tr key={h.key} className="odd:bg-bg-raised/40">
                    <td className="td">{h.rat}</td>
                    <td className="td">{h.plmn ?? "—"}</td>
                    <td className="td">{h.pci ?? "—"}</td>
                    <td className="td">{h.cellId ?? "—"}</td>
                    <td className="td">{h.earfcn ?? h.nrarfcn ?? "—"}</td>
                    <td className="td">{h.observations}</td>
                    <td className="td">
                      <SignalBadge
                        level={gradeRsrp(h.lastRsrp)}
                        value={h.lastRsrp}
                        unit="dBm"
                      />
                    </td>
                    <td className="td text-xs">
                      {new Date(h.lastSeenMs).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
