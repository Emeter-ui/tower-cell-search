import { useMemo } from "react";
import { FallbackBanner } from "../components/FallbackBanner";
import { useScannerStore } from "../store/useScannerStore";
import { dlEarfcnToPair, lteBandFromDlEarfcn } from "../lib/earfcn";
import { nrarfcnToMhz, nrBandsForFreq } from "../lib/nrarfcn";
import { SignalBadge } from "../components/SignalBadge";
import { gradeRsrp, gradeRsrq, gradeSinr } from "../lib/signal";

export function Dashboard() {
  const { bridgeStatus, scans, subscriptions, settings } = useScannerStore();

  const latest = scans[0];
  const serving = useMemo(
    () => latest?.samples.find((s) => s.cell.isRegistered) ?? latest?.samples[0],
    [latest]
  );

  const sub = subscriptions.find(
    (s) => s.subId === (settings.selectedSubId ?? s.subId)
  );

  let band: string | null = null;
  let freq: number | null = null;
  let arfcn: number | null = null;
  let pci: number | null = null;
  let cellId: number | null = null;
  let rsrp: number | null = null;
  let rsrq: number | null = null;
  let sinr: number | null = null;
  if (serving) {
    const c = serving.cell;
    pci = "pci" in c ? c.pci : null;
    if (c.rat === "LTE") {
      arfcn = c.earfcn;
      const b = c.earfcn !== null ? lteBandFromDlEarfcn(c.earfcn) : undefined;
      band = b ? `LTE B${b.band}` : "LTE";
      freq = c.earfcn !== null ? dlEarfcnToPair(c.earfcn)?.dlMhz ?? null : null;
      cellId = c.ci;
      rsrp = c.signal.rsrp;
      rsrq = c.signal.rsrq;
      sinr = c.signal.rssnr;
    } else if (c.rat === "NR") {
      arfcn = c.nrarfcn;
      freq = c.nrarfcn !== null ? nrarfcnToMhz(c.nrarfcn) : null;
      const bands = freq !== null ? nrBandsForFreq(freq) : [];
      band = bands.length ? `NR ${bands.map((b) => b.band).join("/")}` : "NR";
      cellId = c.nci;
      rsrp = c.signal.ssRsrp;
      rsrq = c.signal.ssRsrq;
      sinr = c.signal.ssSinr;
    } else {
      band = c.rat;
    }
  }

  return (
    <div className="space-y-3">
      <FallbackBanner status={bridgeStatus} />

      <div className="card">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          Current serving cell
        </div>
        {!serving ? (
          <div className="mt-2 text-ink-dim text-sm">
            No scan yet — tap <b>Scan</b> or start <b>Live</b>.
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-semibold">
                  {serving.cell.plmn ?? "PLMN —"}
                </div>
                <div className="text-ink-dim text-sm">
                  {sub?.carrierName ?? sub?.displayName ?? ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-ink-dim">{band}</div>
                <div className="font-mono">{freq ? `${freq} MHz` : "—"}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="kv"><dt>PCI</dt><dd>{pci ?? "—"}</dd></div>
              <div className="kv"><dt>ARFCN</dt><dd>{arfcn ?? "—"}</dd></div>
              <div className="kv"><dt>Cell ID</dt><dd>{cellId ?? "—"}</dd></div>
              <div className="kv"><dt>Timestamp</dt><dd className="text-xs">{new Date(serving.tsMs).toLocaleString()}</dd></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SignalBadge level={gradeRsrp(rsrp)} value={rsrp} unit="dBm" />
              <SignalBadge level={gradeRsrq(rsrq)} value={rsrq} unit="dB" />
              <SignalBadge level={gradeSinr(sinr)} value={sinr} unit="dB" />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="text-xs text-ink-dim uppercase tracking-wider mb-2">
          Device
        </div>
        {bridgeStatus?.present ? (
          <dl className="grid grid-cols-2 gap-x-6">
            <div className="kv"><dt>Manufacturer</dt><dd>{bridgeStatus.manufacturer}</dd></div>
            <div className="kv"><dt>Model</dt><dd>{bridgeStatus.model}</dd></div>
            <div className="kv"><dt>Android</dt><dd>{bridgeStatus.androidVersion}</dd></div>
            <div className="kv"><dt>API</dt><dd>{bridgeStatus.apiLevel}</dd></div>
            <div className="kv"><dt>Neighbors</dt><dd>{bridgeStatus.neighborCellSupport}</dd></div>
            <div className="kv"><dt>Subscriptions</dt><dd>{bridgeStatus.subscriptions.length}</dd></div>
          </dl>
        ) : (
          <div className="text-sm text-ink-dim">
            Companion not detected. Open this app inside the
            scan-tower-cell Android companion to collect modem data.
          </div>
        )}
      </div>
    </div>
  );
}
