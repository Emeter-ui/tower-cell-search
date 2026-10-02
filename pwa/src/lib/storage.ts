import type { ScanResult, Cell, CellSample } from "../bridge/types";

const K_SCANS = "stc.scans.v1";
const K_SETTINGS = "stc.settings.v1";
const K_HISTORY = "stc.history.v1"; // deduped per-cell history

export interface Settings {
  pollMs: number;
  airtelMode: boolean;
  airtelMcc: string;
  airtelMnc: string;
  demoMode: boolean;
  selectedSubId: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  pollMs: 3000,
  airtelMode: false,
  airtelMcc: "621",
  airtelMnc: "20",
  demoMode: false,
  selectedSubId: null,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(K_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(K_SETTINGS, JSON.stringify(s));
}

export function loadScans(): ScanResult[] {
  try {
    const raw = localStorage.getItem(K_SCANS);
    return raw ? (JSON.parse(raw) as ScanResult[]) : [];
  } catch {
    return [];
  }
}

export function saveScans(s: ScanResult[]) {
  localStorage.setItem(K_SCANS, JSON.stringify(s));
}

export interface CellHistoryEntry {
  key: string;
  rat: string;
  plmn: string | null;
  pci: number | null;
  cellId: number | null;
  tac: number | null;
  earfcn: number | null;
  nrarfcn: number | null;
  firstSeenMs: number;
  lastSeenMs: number;
  observations: number;
  bestRsrp: number | null;
  worstRsrp: number | null;
  lastRsrp: number | null;
  lastRsrq: number | null;
  lastSinr: number | null;
}

export function cellKey(c: Cell): string {
  switch (c.rat) {
    case "LTE":
      return `LTE|${c.plmn ?? "?"}|${c.pci ?? "?"}|${c.ci ?? "?"}|${c.earfcn ?? "?"}`;
    case "NR":
      return `NR|${c.plmn ?? "?"}|${c.pci ?? "?"}|${c.nci ?? "?"}|${c.nrarfcn ?? "?"}`;
    case "WCDMA":
      return `WCDMA|${c.plmn ?? "?"}|${c.psc ?? "?"}|${c.cid ?? "?"}|${c.uarfcn ?? "?"}`;
    case "GSM":
      return `GSM|${c.plmn ?? "?"}|${c.cid ?? "?"}|${c.arfcn ?? "?"}`;
  }
}

export function loadHistory(): CellHistoryEntry[] {
  try {
    const raw = localStorage.getItem(K_HISTORY);
    return raw ? (JSON.parse(raw) as CellHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(h: CellHistoryEntry[]) {
  localStorage.setItem(K_HISTORY, JSON.stringify(h));
}

function pickRsrp(s: CellSample): number | null {
  const c = s.cell;
  if (c.rat === "LTE") return c.signal.rsrp;
  if (c.rat === "NR") return c.signal.ssRsrp;
  return null;
}
function pickRsrq(s: CellSample): number | null {
  const c = s.cell;
  if (c.rat === "LTE") return c.signal.rsrq;
  if (c.rat === "NR") return c.signal.ssRsrq;
  return null;
}
function pickSinr(s: CellSample): number | null {
  const c = s.cell;
  if (c.rat === "LTE") return c.signal.rssnr;
  if (c.rat === "NR") return c.signal.ssSinr;
  return null;
}

export function mergeHistory(
  existing: CellHistoryEntry[],
  samples: CellSample[]
): CellHistoryEntry[] {
  const byKey = new Map(existing.map((e) => [e.key, e]));
  for (const s of samples) {
    const c = s.cell;
    const key = cellKey(c);
    const rsrp = pickRsrp(s);
    const rsrq = pickRsrq(s);
    const sinr = pickSinr(s);
    const prev = byKey.get(key);
    if (prev) {
      prev.lastSeenMs = s.tsMs;
      prev.observations += 1;
      prev.lastRsrp = rsrp;
      prev.lastRsrq = rsrq;
      prev.lastSinr = sinr;
      if (rsrp !== null) {
        prev.bestRsrp = prev.bestRsrp === null ? rsrp : Math.max(prev.bestRsrp, rsrp);
        prev.worstRsrp = prev.worstRsrp === null ? rsrp : Math.min(prev.worstRsrp, rsrp);
      }
    } else {
      byKey.set(key, {
        key,
        rat: c.rat,
        plmn: c.plmn,
        pci: "pci" in c ? c.pci : null,
        cellId:
          c.rat === "LTE" ? c.ci :
          c.rat === "NR" ? c.nci :
          c.rat === "WCDMA" ? c.cid :
          c.rat === "GSM" ? c.cid :
          null,
        tac: "tac" in c ? c.tac : null,
        earfcn: c.rat === "LTE" ? c.earfcn : null,
        nrarfcn: c.rat === "NR" ? c.nrarfcn : null,
        firstSeenMs: s.tsMs,
        lastSeenMs: s.tsMs,
        observations: 1,
        bestRsrp: rsrp,
        worstRsrp: rsrp,
        lastRsrp: rsrp,
        lastRsrq: rsrq,
        lastSinr: sinr,
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
}
