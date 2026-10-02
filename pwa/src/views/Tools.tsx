import { useMemo, useState } from "react";
import { LTE_BANDS } from "../data/lteBands";
import { NR_BANDS } from "../data/nrBands";
import {
  closestDlEarfcn,
  dlEarfcnToPair,
  lteBandFromDlEarfcn,
} from "../lib/earfcn";
import { closestNrarfcn, nrarfcnToMhz } from "../lib/nrarfcn";

export function Tools() {
  const [tab, setTab] = useState<"lte-earfcn" | "lte-freq" | "nr" | "bands">(
    "lte-earfcn"
  );
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap gap-2">
        {[
          ["lte-earfcn", "LTE EARFCN → MHz"],
          ["lte-freq", "LTE MHz → EARFCN"],
          ["nr", "NR-ARFCN ↔ MHz"],
          ["bands", "Band database"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`btn ${tab === id ? "btn-primary" : ""}`}
            onClick={() => setTab(id as typeof tab)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "lte-earfcn" && <LteEarfcnTool />}
      {tab === "lte-freq" && <LteFreqTool />}
      {tab === "nr" && <NrTool />}
      {tab === "bands" && <BandsTable />}
    </div>
  );
}

function LteEarfcnTool() {
  const [n, setN] = useState("");
  const result = useMemo(() => {
    const num = Number(n);
    if (!n || !isFinite(num) || num < 0) return null;
    const band = lteBandFromDlEarfcn(num);
    if (!band) return { error: "Not in any standard LTE band." };
    const pair = dlEarfcnToPair(num);
    return { band, pair };
  }, [n]);
  return (
    <div className="card space-y-2">
      <label className="label">DL EARFCN</label>
      <input
        className="input"
        inputMode="numeric"
        value={n}
        onChange={(e) => setN(e.target.value)}
        placeholder="e.g. 3100"
      />
      {result && "error" in result && (
        <div className="text-signal-fair text-sm">{result.error}</div>
      )}
      {result && !("error" in result) && (
        <dl className="grid grid-cols-2 gap-x-6">
          <div className="kv"><dt>Band</dt><dd>B{result.band.band} ({result.band.duplex})</dd></div>
          <div className="kv"><dt>DL freq</dt><dd>{result.pair?.dlMhz} MHz</dd></div>
          <div className="kv"><dt>UL freq</dt><dd>{result.pair?.ulMhz ?? "—"} {result.pair?.ulMhz ? "MHz" : ""}</dd></div>
          <div className="kv"><dt>DL range</dt><dd>{result.band.fDlLow}–{result.band.fDlHigh} MHz</dd></div>
        </dl>
      )}
    </div>
  );
}

function LteFreqTool() {
  const [f, setF] = useState("");
  const result = useMemo(() => {
    const num = Number(f);
    if (!f || !isFinite(num)) return null;
    const c = closestDlEarfcn(num);
    if (!c) return { error: "Not in any standard LTE band." };
    return c;
  }, [f]);
  return (
    <div className="card space-y-2">
      <label className="label">DL frequency (MHz)</label>
      <input
        className="input"
        inputMode="decimal"
        value={f}
        onChange={(e) => setF(e.target.value)}
        placeholder="e.g. 2655"
      />
      {result && "error" in result && (
        <div className="text-signal-fair text-sm">{result.error}</div>
      )}
      {result && !("error" in result) && (
        <dl className="grid grid-cols-2 gap-x-6">
          <div className="kv"><dt>Closest EARFCN</dt><dd>{result.nDl}</dd></div>
          <div className="kv"><dt>Reconstructed freq</dt><dd>{result.dlMhz} MHz</dd></div>
          <div className="kv"><dt>Band</dt><dd>B{result.band.band} ({result.band.duplex})</dd></div>
          <div className="kv"><dt>Error</dt><dd>{result.errorMhz} MHz</dd></div>
        </dl>
      )}
    </div>
  );
}

function NrTool() {
  const [n, setN] = useState("");
  const [f, setF] = useState("");
  const nMhz = useMemo(() => (n === "" ? null : nrarfcnToMhz(Number(n))), [n]);
  const closest = useMemo(
    () => (f === "" ? null : closestNrarfcn(Number(f))),
    [f]
  );
  return (
    <div className="card space-y-3">
      <div>
        <label className="label">NR-ARFCN</label>
        <input
          className="input"
          inputMode="numeric"
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="e.g. 632628"
        />
        {n !== "" && (
          <div className="mt-2 text-sm font-mono">
            {nMhz === null ? "Out of global raster" : `${nMhz} MHz`}
          </div>
        )}
      </div>
      <div>
        <label className="label">Frequency (MHz) → closest NR-ARFCN</label>
        <input
          className="input"
          inputMode="decimal"
          value={f}
          onChange={(e) => setF(e.target.value)}
          placeholder="e.g. 3500"
        />
        {closest && (
          <dl className="mt-2 grid grid-cols-2 gap-x-6">
            <div className="kv"><dt>Closest N-REF</dt><dd>{closest.nRef}</dd></div>
            <div className="kv"><dt>Reconstructed</dt><dd>{closest.freqMhz} MHz</dd></div>
            <div className="kv"><dt>Error</dt><dd>{closest.errorMhz} MHz</dd></div>
          </dl>
        )}
      </div>
    </div>
  );
}

function BandsTable() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const lte = LTE_BANDS.filter((b) =>
    `b${b.band} ${b.duplex} ${b.fDlLow}-${b.fDlHigh}`.toLowerCase().includes(query)
  );
  const nr = NR_BANDS.filter((b) =>
    `${b.band} ${b.duplex} ${b.fr}`.toLowerCase().includes(query)
  );
  return (
    <div className="space-y-3">
      <div className="card">
        <input
          className="input"
          placeholder="Search bands…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="card p-0 overflow-x-auto">
        <div className="px-3 pt-3 text-xs text-ink-dim uppercase">LTE</div>
        <table className="w-full">
          <thead className="bg-bg-sunk">
            <tr>
              <th className="th">Band</th>
              <th className="th">Duplex</th>
              <th className="th">DL MHz</th>
              <th className="th">UL MHz</th>
              <th className="th">EARFCN DL</th>
              <th className="th">EARFCN UL</th>
            </tr>
          </thead>
          <tbody>
            {lte.map((b) => (
              <tr key={b.band} className="odd:bg-bg-raised/40">
                <td className="td">B{b.band}</td>
                <td className="td">{b.duplex}</td>
                <td className="td">{b.fDlLow}–{b.fDlHigh}</td>
                <td className="td">
                  {b.fUlLow !== undefined ? `${b.fUlLow}–${b.fUlHigh}` : "—"}
                </td>
                <td className="td">{b.nDlLow}–{b.nDlHigh}</td>
                <td className="td">
                  {b.nUlLow !== undefined ? `${b.nUlLow}–${b.nUlHigh}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card p-0 overflow-x-auto">
        <div className="px-3 pt-3 text-xs text-ink-dim uppercase">NR</div>
        <table className="w-full">
          <thead className="bg-bg-sunk">
            <tr>
              <th className="th">Band</th>
              <th className="th">FR</th>
              <th className="th">Duplex</th>
              <th className="th">DL MHz</th>
              <th className="th">UL MHz</th>
            </tr>
          </thead>
          <tbody>
            {nr.map((b) => (
              <tr key={b.band} className="odd:bg-bg-raised/40">
                <td className="td">{b.band}</td>
                <td className="td">{b.fr}</td>
                <td className="td">{b.duplex}</td>
                <td className="td">
                  {b.fDlLow !== undefined
                    ? `${b.fDlLow}–${b.fDlHigh}`
                    : "—"}
                </td>
                <td className="td">
                  {b.fUlLow !== undefined
                    ? `${b.fUlLow}–${b.fUlHigh}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
