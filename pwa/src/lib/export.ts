import type { ScanResult, CellSample } from "../bridge/types";
import { dlEarfcnToPair } from "./earfcn";
import { nrarfcnToMhz } from "./nrarfcn";

function sanitize(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function samplesToCsv(samples: CellSample[], scanId: string): string {
  const header = [
    "scanId",
    "tsMs",
    "subId",
    "slot",
    "rat",
    "serving",
    "operator",
    "plmn",
    "mcc",
    "mnc",
    "band",
    "earfcn_or_nrarfcn",
    "dlMhz",
    "ulMhz",
    "pci",
    "cellId",
    "tac",
    "rsrp",
    "rsrq",
    "rssi",
    "sinr",
    "cqi",
    "timingAdvance",
    "level",
  ];
  const rows: string[] = [header.join(",")];
  for (const s of samples) {
    const c = s.cell;
    let band = "";
    let arfcn = "";
    let dl = "";
    let ul = "";
    let pci = "";
    let cellId = "";
    let tac = "";
    let rsrp = "";
    let rsrq = "";
    let rssi = "";
    let sinr = "";
    let cqi = "";
    let ta = "";
    let level = "";
    if (c.rat === "LTE") {
      arfcn = c.earfcn === null ? "" : String(c.earfcn);
      if (c.earfcn !== null) {
        const pair = dlEarfcnToPair(c.earfcn);
        if (pair) {
          dl = String(pair.dlMhz);
          ul = pair.ulMhz === null ? "" : String(pair.ulMhz);
        }
      }
      pci = c.pci === null ? "" : String(c.pci);
      cellId = c.ci === null ? "" : String(c.ci);
      tac = c.tac === null ? "" : String(c.tac);
      rsrp = c.signal.rsrp === null ? "" : String(c.signal.rsrp);
      rsrq = c.signal.rsrq === null ? "" : String(c.signal.rsrq);
      rssi = c.signal.rssi === null ? "" : String(c.signal.rssi);
      sinr = c.signal.rssnr === null ? "" : String(c.signal.rssnr);
      cqi = c.signal.cqi === null ? "" : String(c.signal.cqi);
      ta = c.signal.timingAdvance === null ? "" : String(c.signal.timingAdvance);
      level = c.signal.level === null ? "" : String(c.signal.level);
    } else if (c.rat === "NR") {
      arfcn = c.nrarfcn === null ? "" : String(c.nrarfcn);
      if (c.nrarfcn !== null) {
        const f = nrarfcnToMhz(c.nrarfcn);
        if (f !== null) dl = String(f);
      }
      pci = c.pci === null ? "" : String(c.pci);
      cellId = c.nci === null ? "" : String(c.nci);
      tac = c.tac === null ? "" : String(c.tac);
      rsrp = c.signal.ssRsrp === null ? "" : String(c.signal.ssRsrp);
      rsrq = c.signal.ssRsrq === null ? "" : String(c.signal.ssRsrq);
      sinr = c.signal.ssSinr === null ? "" : String(c.signal.ssSinr);
      level = c.signal.level === null ? "" : String(c.signal.level);
    }
    rows.push(
      [
        scanId,
        s.tsMs,
        s.subId,
        s.slotIndex,
        c.rat,
        c.isRegistered ? "serving" : "neighbor",
        "",
        c.plmn ?? "",
        c.mcc ?? "",
        c.mnc ?? "",
        band,
        arfcn,
        dl,
        ul,
        pci,
        cellId,
        tac,
        rsrp,
        rsrq,
        rssi,
        sinr,
        cqi,
        ta,
        level,
      ]
        .map(sanitize)
        .join(",")
    );
  }
  return rows.join("\n");
}

export function downloadBlob(filename: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportScansJson(scans: ScanResult[]) {
  downloadBlob(
    `scan-tower-cell-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    "application/json",
    JSON.stringify({ version: 1, scans }, null, 2)
  );
}

export function exportScanCsv(scan: ScanResult) {
  downloadBlob(
    `scan-${scan.scanId}.csv`,
    "text/csv",
    samplesToCsv(scan.samples, scan.scanId)
  );
}

export function exportAllCsv(scans: ScanResult[]) {
  const all = scans.flatMap((s) =>
    samplesToCsv(s.samples, s.scanId)
      .split("\n")
      .slice(scans.indexOf(s) === 0 ? 0 : 1)
  );
  downloadBlob(
    `scan-tower-cell-all-${Date.now()}.csv`,
    "text/csv",
    all.join("\n")
  );
}

export interface ImportedBundle {
  version: number;
  scans: ScanResult[];
}

export function parseImportedJson(text: string): ImportedBundle {
  const parsed = JSON.parse(text);
  if (parsed && Array.isArray(parsed.scans)) {
    return parsed as ImportedBundle;
  }
  if (Array.isArray(parsed)) {
    return { version: 1, scans: parsed as ScanResult[] };
  }
  throw new Error("Unrecognised scan file.");
}
