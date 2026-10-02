import { useMemo, useState } from "react";
import { useScannerStore } from "../store/useScannerStore";
import { CellTable } from "../components/CellTable";
import { CellDetail } from "../components/CellDetail";
import type { CellSample } from "../bridge/types";

export function Cells() {
  const { scans } = useScannerStore();
  const [selected, setSelected] = useState<CellSample | null>(null);
  const [operator, setOperator] = useState("");
  const [rat, setRat] = useState("ANY");
  const [pci, setPci] = useState("");
  const [arfcn, setArfcn] = useState("");
  const [minRsrp, setMinRsrp] = useState("");

  const samples = useMemo(() => {
    // Flatten the newest 20 scans so the Cells view is a cross-scan picture.
    const seen = new Map<string, CellSample>();
    for (const s of scans.slice(0, 20)) {
      for (const sm of s.samples) {
        const key =
          sm.cell.rat +
          "|" +
          (sm.cell.plmn ?? "") +
          "|" +
          ("pci" in sm.cell ? sm.cell.pci : "") +
          "|" +
          (sm.cell.rat === "LTE" ? sm.cell.ci : sm.cell.rat === "NR" ? sm.cell.nci : "");
        const prev = seen.get(key);
        if (!prev || prev.tsMs < sm.tsMs) seen.set(key, sm);
      }
    }
    return Array.from(seen.values());
  }, [scans]);

  const filter = {
    operator,
    rat,
    pci: pci === "" ? null : Number(pci),
    arfcn: arfcn === "" ? null : Number(arfcn),
    minRsrp: minRsrp === "" ? null : Number(minRsrp),
  };

  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input
            className="input"
            placeholder="Operator / PLMN"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
          />
          <select
            className="input"
            value={rat}
            onChange={(e) => setRat(e.target.value)}
          >
            <option value="ANY">Any RAT</option>
            <option>LTE</option>
            <option>NR</option>
            <option>WCDMA</option>
            <option>GSM</option>
          </select>
          <input
            className="input"
            placeholder="PCI"
            inputMode="numeric"
            value={pci}
            onChange={(e) => setPci(e.target.value)}
          />
          <input
            className="input"
            placeholder="EARFCN / NR-ARFCN"
            inputMode="numeric"
            value={arfcn}
            onChange={(e) => setArfcn(e.target.value)}
          />
          <input
            className="input"
            placeholder="min RSRP"
            inputMode="numeric"
            value={minRsrp}
            onChange={(e) => setMinRsrp(e.target.value)}
          />
        </div>
      </div>
      <CellTable
        samples={samples}
        onPick={(r) => setSelected(r.sample)}
        filter={filter}
      />
      {selected && (
        <CellDetail sample={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
