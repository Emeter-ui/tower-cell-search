import type { CellSample } from "../bridge/types";
import { dlEarfcnToPair, lteBandFromDlEarfcn } from "../lib/earfcn";
import { nrarfcnToMhz, nrBandsForFreq } from "../lib/nrarfcn";
import type { CellHistoryEntry } from "../lib/storage";

function fmt(v: unknown, unit?: string) {
  if (v === null || v === undefined || (typeof v === "number" && !isFinite(v)))
    return <span className="text-signal-unknown">Unavailable / Restricted</span>;
  return (
    <span>
      {String(v)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

export function CellDetail({
  sample,
  history,
  onClose,
}: {
  sample: CellSample;
  history?: CellHistoryEntry;
  onClose: () => void;
}) {
  const c = sample.cell;
  let bandLabel: string | null = null;
  let dl: number | null = null;
  let ul: number | null = null;
  if (c.rat === "LTE" && c.earfcn !== null) {
    const b = lteBandFromDlEarfcn(c.earfcn);
    bandLabel = b ? `B${b.band} (${b.duplex})` : null;
    const pair = dlEarfcnToPair(c.earfcn);
    dl = pair?.dlMhz ?? null;
    ul = pair?.ulMhz ?? null;
  } else if (c.rat === "NR" && c.nrarfcn !== null) {
    dl = nrarfcnToMhz(c.nrarfcn);
    const bands = dl !== null ? nrBandsForFreq(dl) : [];
    bandLabel = bands.length ? bands.map((b) => b.band).join(" / ") : null;
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-bg-raised border-t sm:border border-line rounded-t-2xl sm:rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs text-ink-dim uppercase tracking-wider">
              {c.rat} · {c.isRegistered ? "Serving cell" : "Neighbor cell"}
            </div>
            <div className="text-lg font-semibold">{c.plmn ?? "PLMN —"}</div>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-6">
          <div className="kv"><dt>Operator (PLMN)</dt><dd>{fmt(c.plmn)}</dd></div>
          <div className="kv"><dt>MCC</dt><dd>{fmt(c.mcc)}</dd></div>
          <div className="kv"><dt>MNC</dt><dd>{fmt(c.mnc)}</dd></div>
          <div className="kv"><dt>RAT</dt><dd>{c.rat}</dd></div>
          <div className="kv"><dt>Band</dt><dd>{fmt(bandLabel)}</dd></div>
          {c.rat === "LTE" && (
            <>
              <div className="kv"><dt>EARFCN</dt><dd>{fmt(c.earfcn)}</dd></div>
              <div className="kv"><dt>DL frequency</dt><dd>{fmt(dl, "MHz")}</dd></div>
              <div className="kv"><dt>UL frequency</dt><dd>{fmt(ul, "MHz")}</dd></div>
              <div className="kv"><dt>PCI</dt><dd>{fmt(c.pci)}</dd></div>
              <div className="kv"><dt>Cell ID (ECI)</dt><dd>{fmt(c.ci)}</dd></div>
              <div className="kv"><dt>TAC</dt><dd>{fmt(c.tac)}</dd></div>
              <div className="kv"><dt>RSRP</dt><dd>{fmt(c.signal.rsrp, "dBm")}</dd></div>
              <div className="kv"><dt>RSRQ</dt><dd>{fmt(c.signal.rsrq, "dB")}</dd></div>
              <div className="kv"><dt>RSSI</dt><dd>{fmt(c.signal.rssi, "dBm")}</dd></div>
              <div className="kv"><dt>SINR (RSSNR)</dt><dd>{fmt(c.signal.rssnr, "dB")}</dd></div>
              <div className="kv"><dt>CQI</dt><dd>{fmt(c.signal.cqi)}</dd></div>
              <div className="kv"><dt>Timing advance</dt><dd>{fmt(c.signal.timingAdvance)}</dd></div>
              <div className="kv"><dt>Signal level</dt><dd>{fmt(c.signal.level)} / 4</dd></div>
              <div className="kv"><dt>Bandwidth</dt><dd>{fmt(c.bandwidth, "kHz")}</dd></div>
            </>
          )}
          {c.rat === "NR" && (
            <>
              <div className="kv"><dt>NR-ARFCN</dt><dd>{fmt(c.nrarfcn)}</dd></div>
              <div className="kv"><dt>DL frequency</dt><dd>{fmt(dl, "MHz")}</dd></div>
              <div className="kv"><dt>NR PCI</dt><dd>{fmt(c.pci)}</dd></div>
              <div className="kv"><dt>NCI</dt><dd>{fmt(c.nci)}</dd></div>
              <div className="kv"><dt>TAC</dt><dd>{fmt(c.tac)}</dd></div>
              <div className="kv"><dt>SS-RSRP</dt><dd>{fmt(c.signal.ssRsrp, "dBm")}</dd></div>
              <div className="kv"><dt>SS-RSRQ</dt><dd>{fmt(c.signal.ssRsrq, "dB")}</dd></div>
              <div className="kv"><dt>SS-SINR</dt><dd>{fmt(c.signal.ssSinr, "dB")}</dd></div>
              <div className="kv"><dt>CSI-RSRP</dt><dd>{fmt(c.signal.csiRsrp, "dBm")}</dd></div>
              <div className="kv"><dt>CSI-RSRQ</dt><dd>{fmt(c.signal.csiRsrq, "dB")}</dd></div>
              <div className="kv"><dt>CSI-SINR</dt><dd>{fmt(c.signal.csiSinr, "dB")}</dd></div>
              <div className="kv"><dt>Signal level</dt><dd>{fmt(c.signal.level)} / 4</dd></div>
            </>
          )}
          {c.rat === "WCDMA" && (
            <>
              <div className="kv"><dt>UARFCN</dt><dd>{fmt(c.uarfcn)}</dd></div>
              <div className="kv"><dt>PSC</dt><dd>{fmt(c.psc)}</dd></div>
              <div className="kv"><dt>CID</dt><dd>{fmt(c.cid)}</dd></div>
              <div className="kv"><dt>LAC</dt><dd>{fmt(c.lac)}</dd></div>
              <div className="kv"><dt>RSCP</dt><dd>{fmt(c.signal.rscp, "dBm")}</dd></div>
              <div className="kv"><dt>Ec/No</dt><dd>{fmt(c.signal.ecno, "dB")}</dd></div>
            </>
          )}
          {c.rat === "GSM" && (
            <>
              <div className="kv"><dt>ARFCN</dt><dd>{fmt(c.arfcn)}</dd></div>
              <div className="kv"><dt>BSIC</dt><dd>{fmt(c.bsic)}</dd></div>
              <div className="kv"><dt>CID</dt><dd>{fmt(c.cid)}</dd></div>
              <div className="kv"><dt>LAC</dt><dd>{fmt(c.lac)}</dd></div>
              <div className="kv"><dt>RSSI</dt><dd>{fmt(c.signal.rssi, "dBm")}</dd></div>
            </>
          )}
          {history && (
            <>
              <div className="kv">
                <dt>First seen</dt>
                <dd>{new Date(history.firstSeenMs).toLocaleString()}</dd>
              </div>
              <div className="kv">
                <dt>Last seen</dt>
                <dd>{new Date(history.lastSeenMs).toLocaleString()}</dd>
              </div>
              <div className="kv">
                <dt>Observations</dt>
                <dd>{history.observations}</dd>
              </div>
              <div className="kv">
                <dt>Best RSRP</dt>
                <dd>{fmt(history.bestRsrp, "dBm")}</dd>
              </div>
              <div className="kv">
                <dt>Worst RSRP</dt>
                <dd>{fmt(history.worstRsrp, "dBm")}</dd>
              </div>
            </>
          )}
        </dl>

        <div className="mt-4 text-xs text-ink-mute">
          Tower location unknown — Android does not expose the physical tower
          coordinates for a PCI / Cell ID.
        </div>
      </div>
    </div>
  );
}
