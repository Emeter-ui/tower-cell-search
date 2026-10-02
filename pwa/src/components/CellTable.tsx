import { useMemo, useState } from "react";
import type { CellSample } from "../bridge/types";
import { dlEarfcnToPair, lteBandFromDlEarfcn } from "../lib/earfcn";
import { nrarfcnToMhz, nrBandsForFreq } from "../lib/nrarfcn";
import { gradeRsrp, gradeRsrq, gradeSinr } from "../lib/signal";
import { SignalBadge } from "./SignalBadge";

export interface Row {
  key: string;
  sample: CellSample;
  operator: string;
  rat: string;
  band: string;
  arfcn: number | null;
  freq: number | null;
  pci: number | null;
  cellId: number | null;
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  serving: boolean;
}

type SortKey =
  | "operator"
  | "rat"
  | "band"
  | "arfcn"
  | "freq"
  | "pci"
  | "cellId"
  | "rsrp"
  | "rsrq"
  | "sinr"
  | "serving";

function cmp(a: number | string | null, b: number | string | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function sampleToRow(s: CellSample): Row {
  const c = s.cell;
  const operator = c.plmn ?? "—";
  const serving = c.isRegistered;
  if (c.rat === "LTE") {
    const band = c.earfcn !== null ? lteBandFromDlEarfcn(c.earfcn) : undefined;
    const pair = c.earfcn !== null ? dlEarfcnToPair(c.earfcn) : null;
    return {
      key: `${s.subId}:${s.tsMs}:LTE:${c.pci}:${c.ci}:${c.earfcn}`,
      sample: s,
      operator,
      rat: "LTE",
      band: band ? `B${band.band}` : "—",
      arfcn: c.earfcn,
      freq: pair?.dlMhz ?? null,
      pci: c.pci,
      cellId: c.ci,
      rsrp: c.signal.rsrp,
      rsrq: c.signal.rsrq,
      sinr: c.signal.rssnr,
      serving,
    };
  }
  if (c.rat === "NR") {
    const freq = c.nrarfcn !== null ? nrarfcnToMhz(c.nrarfcn) : null;
    const bands = freq !== null ? nrBandsForFreq(freq) : [];
    return {
      key: `${s.subId}:${s.tsMs}:NR:${c.pci}:${c.nci}:${c.nrarfcn}`,
      sample: s,
      operator,
      rat: "NR",
      band: bands.length ? bands.map((b) => b.band).join("/") : "—",
      arfcn: c.nrarfcn,
      freq,
      pci: c.pci,
      cellId: c.nci,
      rsrp: c.signal.ssRsrp,
      rsrq: c.signal.ssRsrq,
      sinr: c.signal.ssSinr,
      serving,
    };
  }
  if (c.rat === "WCDMA") {
    return {
      key: `${s.subId}:${s.tsMs}:WCDMA:${c.psc}:${c.cid}:${c.uarfcn}`,
      sample: s,
      operator,
      rat: "WCDMA",
      band: "—",
      arfcn: c.uarfcn,
      freq: null,
      pci: c.psc,
      cellId: c.cid,
      rsrp: c.signal.rscp,
      rsrq: c.signal.ecno,
      sinr: null,
      serving,
    };
  }
  // GSM
  return {
    key: `${s.subId}:${s.tsMs}:GSM:${c.cid}:${c.arfcn}`,
    sample: s,
    operator,
    rat: "GSM",
    band: "—",
    arfcn: c.arfcn,
    freq: null,
    pci: null,
    cellId: c.cid,
    rsrp: c.signal.rssi,
    rsrq: null,
    sinr: null,
    serving,
  };
}

export function CellTable({
  samples,
  onPick,
  filter,
}: {
  samples: CellSample[];
  onPick?: (row: Row) => void;
  filter?: Partial<{
    operator: string;
    plmn: string;
    rat: string;
    band: string;
    minRsrp: number | null;
    pci: number | null;
    arfcn: number | null;
  }>;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "serving",
    dir: -1,
  });

  const rows = useMemo(() => {
    let rs = samples.map(sampleToRow);
    if (filter) {
      if (filter.operator)
        rs = rs.filter((r) =>
          r.operator.toLowerCase().includes(filter.operator!.toLowerCase())
        );
      if (filter.plmn) rs = rs.filter((r) => r.operator === filter.plmn);
      if (filter.rat && filter.rat !== "ANY")
        rs = rs.filter((r) => r.rat === filter.rat);
      if (filter.band && filter.band !== "ANY")
        rs = rs.filter((r) => r.band === filter.band);
      if (typeof filter.minRsrp === "number")
        rs = rs.filter((r) => r.rsrp !== null && r.rsrp >= filter.minRsrp!);
      if (typeof filter.pci === "number")
        rs = rs.filter((r) => r.pci === filter.pci);
      if (typeof filter.arfcn === "number")
        rs = rs.filter((r) => r.arfcn === filter.arfcn);
    }
    rs.sort((a, b) => {
      const dir = sort.dir;
      switch (sort.key) {
        case "serving":
          return (Number(b.serving) - Number(a.serving)) * dir;
        case "operator":
        case "rat":
        case "band":
          return cmp(a[sort.key], b[sort.key]) * dir;
        default:
          return cmp(a[sort.key], b[sort.key]) * dir;
      }
    });
    return rs;
  }, [samples, sort, filter]);

  function clickHeader(k: SortKey) {
    setSort((prev) => ({
      key: k,
      dir: prev.key === k ? (prev.dir === 1 ? -1 : 1) : 1,
    }));
  }

  const H = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="th" onClick={() => clickHeader(k)}>
      {children}
      <span className="ml-1 text-ink-mute">
        {sort.key === k ? (sort.dir === 1 ? "▲" : "▼") : "·"}
      </span>
    </th>
  );

  if (rows.length === 0) {
    return (
      <div className="card text-sm text-ink-dim text-center">
        No cells to display.
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full">
        <thead className="bg-bg-sunk sticky top-0">
          <tr>
            <H k="operator">Operator</H>
            <H k="rat">RAT</H>
            <H k="band">Band</H>
            <H k="arfcn">EARFCN</H>
            <H k="freq">Freq MHz</H>
            <H k="pci">PCI</H>
            <H k="cellId">Cell ID</H>
            <H k="rsrp">RSRP</H>
            <H k="rsrq">RSRQ</H>
            <H k="sinr">SINR</H>
            <H k="serving">Status</H>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="odd:bg-bg-raised/40 hover:bg-accent/5 cursor-pointer"
              onClick={() => onPick?.(r)}
            >
              <td className="td">{r.operator}</td>
              <td className="td">{r.rat}</td>
              <td className="td">{r.band}</td>
              <td className="td">{r.arfcn ?? "—"}</td>
              <td className="td">{r.freq ?? "—"}</td>
              <td className="td">{r.pci ?? "—"}</td>
              <td className="td">{r.cellId ?? "—"}</td>
              <td className="td">
                <SignalBadge level={gradeRsrp(r.rsrp)} value={r.rsrp} unit="dBm" />
              </td>
              <td className="td">
                <SignalBadge level={gradeRsrq(r.rsrq)} value={r.rsrq} unit="dB" />
              </td>
              <td className="td">
                <SignalBadge level={gradeSinr(r.sinr)} value={r.sinr} unit="dB" />
              </td>
              <td className="td">
                <span
                  className={`pill ${
                    r.serving
                      ? "border-accent/40 text-accent"
                      : "border-line text-ink-dim"
                  }`}
                >
                  {r.serving ? "serving" : "neighbor"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
