import { useScannerStore } from "../store/useScannerStore";
import { FallbackBanner } from "../components/FallbackBanner";
import { dlEarfcnToPair, lteBandFromDlEarfcn } from "../lib/earfcn";
import { nrarfcnToMhz, nrBandsForFreq } from "../lib/nrarfcn";
import { SignalBadge } from "../components/SignalBadge";
import { gradeRsrp, gradeRsrq, gradeSinr } from "../lib/signal";

export function Live() {
  const { bridgeStatus, live, startLive, stopLive, settings } = useScannerStore();
  const sample = live.lastSample;
  const c = sample?.cell;
  let band: string | null = null;
  let freq: number | null = null;
  let arfcn: number | null = null;
  let rsrp: number | null = null;
  let rsrq: number | null = null;
  let sinr: number | null = null;
  let cellId: number | null = null;
  let pci: number | null = null;
  if (c?.rat === "LTE") {
    const b = c.earfcn !== null ? lteBandFromDlEarfcn(c.earfcn) : undefined;
    band = b ? `LTE B${b.band}` : "LTE";
    freq = c.earfcn !== null ? dlEarfcnToPair(c.earfcn)?.dlMhz ?? null : null;
    arfcn = c.earfcn;
    rsrp = c.signal.rsrp;
    rsrq = c.signal.rsrq;
    sinr = c.signal.rssnr;
    cellId = c.ci;
    pci = c.pci;
  } else if (c?.rat === "NR") {
    arfcn = c.nrarfcn;
    freq = c.nrarfcn !== null ? nrarfcnToMhz(c.nrarfcn) : null;
    const bands = freq !== null ? nrBandsForFreq(freq) : [];
    band = bands.length ? `NR ${bands.map((b) => b.band).join("/")}` : "NR";
    rsrp = c.signal.ssRsrp;
    rsrq = c.signal.ssRsrq;
    sinr = c.signal.ssSinr;
    cellId = c.nci;
    pci = c.pci;
  }

  return (
    <div className="space-y-3">
      <FallbackBanner status={bridgeStatus} />
      <div className="card flex items-center justify-between">
        <div>
          <div className="text-xs text-ink-dim uppercase tracking-wider">
            Live monitor
          </div>
          <div className="text-sm text-ink-dim">
            {live.running
              ? `Polling every ${settings.pollMs} ms`
              : "Not running"}
          </div>
        </div>
        {live.running ? (
          <button className="btn btn-danger" onClick={stopLive}>
            Stop
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={startLive}
            disabled={!bridgeStatus?.present}
          >
            Start
          </button>
        )}
      </div>

      <div className="card">
        {!sample ? (
          <div className="text-ink-dim text-sm">
            Waiting for the first sample.
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs text-ink-dim uppercase tracking-wider">
                  {c?.rat} · serving
                </div>
                <div className="text-xl font-semibold">
                  {c?.plmn ?? "PLMN —"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-ink-dim">{band}</div>
                <div className="font-mono">{freq ? `${freq} MHz` : "—"}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6">
              <div className="kv"><dt>PCI</dt><dd>{pci ?? "—"}</dd></div>
              <div className="kv"><dt>ARFCN</dt><dd>{arfcn ?? "—"}</dd></div>
              <div className="kv"><dt>Cell ID</dt><dd>{cellId ?? "—"}</dd></div>
              <div className="kv"><dt>Timestamp</dt><dd className="text-xs">{new Date(sample.tsMs).toLocaleTimeString()}</dd></div>
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
          Changes
        </div>
        {live.changes.length === 0 ? (
          <div className="text-ink-dim text-sm">No changes yet.</div>
        ) : (
          <ul className="font-mono text-xs space-y-1">
            {live.changes.map((c, i) => (
              <li key={i} className="text-ink">{c}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
