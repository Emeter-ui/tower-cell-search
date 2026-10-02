import { create } from "zustand";
import type {
  BridgeStatus,
  CellSample,
  ScanResult,
  SubscriptionInfo,
} from "../bridge/types";
import { getNativeBridge } from "../bridge/NativeBridge";
import {
  CellHistoryEntry,
  DEFAULT_SETTINGS,
  Settings,
  loadHistory,
  loadScans,
  loadSettings,
  mergeHistory,
  saveHistory,
  saveScans,
  saveSettings,
} from "../lib/storage";

interface LiveState {
  lastSample: CellSample | null;
  running: boolean;
  stopFn: (() => void) | null;
  changes: string[]; // human-readable change log, newest first
}

interface ScannerStore {
  bridgeStatus: BridgeStatus | null;
  subscriptions: SubscriptionInfo[];
  settings: Settings;
  scans: ScanResult[];
  history: CellHistoryEntry[];
  live: LiveState;
  busy: boolean;
  error: string | null;

  init(): Promise<void>;
  refreshBridge(): Promise<void>;
  requestPermissions(): void;
  scanOnce(opts?: { useNetworkScan?: boolean }): Promise<ScanResult | null>;
  deleteScan(scanId: string): void;
  clearHistory(): void;
  importScans(bundle: { scans: ScanResult[] }): void;
  updateSettings(patch: Partial<Settings>): void;
  startLive(): void;
  stopLive(): void;
}

export const useScannerStore = create<ScannerStore>((set, get) => ({
  bridgeStatus: null,
  subscriptions: [],
  settings: DEFAULT_SETTINGS,
  scans: [],
  history: [],
  live: { lastSample: null, running: false, stopFn: null, changes: [] },
  busy: false,
  error: null,

  async init() {
    const settings = loadSettings();
    const scans = loadScans();
    const history = loadHistory();
    set({ settings, scans, history });
    await get().refreshBridge();
  },

  async refreshBridge() {
    const b = getNativeBridge();
    try {
      const s = await b.status();
      let subs: SubscriptionInfo[] = [];
      if (s.present) subs = await b.listSubscriptions();
      set({ bridgeStatus: s, subscriptions: subs });
    } catch (e) {
      set({ bridgeStatus: { present: false, reason: String(e) } });
    }
  },

  requestPermissions() {
    const b = getNativeBridge();
    b.requestPermissions();
  },

  async scanOnce(opts) {
    set({ busy: true, error: null });
    try {
      const b = getNativeBridge();
      const { settings } = get();
      const subId = settings.selectedSubId ?? -1;
      const scan = opts?.useNetworkScan
        ? await b.requestNetworkScan(subId)
        : await b.scanOnce(subId);
      const filtered = applyAirtelFilter(scan, settings);
      const scans = [filtered, ...get().scans].slice(0, 200);
      const history = mergeHistory(get().history, filtered.samples);
      saveScans(scans);
      saveHistory(history);
      set({ scans, history, busy: false });
      return filtered;
    } catch (e) {
      set({ busy: false, error: String(e instanceof Error ? e.message : e) });
      return null;
    }
  },

  deleteScan(scanId: string) {
    const scans = get().scans.filter((s) => s.scanId !== scanId);
    saveScans(scans);
    set({ scans });
  },

  clearHistory() {
    saveHistory([]);
    saveScans([]);
    set({ history: [], scans: [] });
  },

  importScans(bundle) {
    const incoming = bundle.scans ?? [];
    const scans = [...incoming, ...get().scans].slice(0, 500);
    const history = incoming.reduce(
      (h, s) => mergeHistory(h, s.samples),
      get().history
    );
    saveScans(scans);
    saveHistory(history);
    set({ scans, history });
  },

  updateSettings(patch) {
    const next = { ...get().settings, ...patch };
    saveSettings(next);
    set({ settings: next });
  },

  startLive() {
    const existing = get().live;
    if (existing.running) return;
    const b = getNativeBridge();
    if (!b.isPresent) {
      set({ error: "Live monitor needs the Android companion." });
      return;
    }
    const { settings } = get();
    const stopFn = b.startLive({
      subId: settings.selectedSubId ?? -1,
      intervalMs: settings.pollMs,
      onSample: (r) => {
        const filtered = applyAirtelFilter(r, get().settings);
        const serving = filtered.samples.find((x) => x.cell.isRegistered) ??
          filtered.samples[0] ?? null;
        if (!serving) return;
        const prev = get().live.lastSample;
        const changes = detectChanges(prev, serving);
        const history = mergeHistory(get().history, filtered.samples);
        saveHistory(history);
        set((state) => ({
          live: {
            running: true,
            stopFn: state.live.stopFn,
            lastSample: serving,
            changes: [...changes, ...state.live.changes].slice(0, 50),
          },
          history,
        }));
      },
    });
    set({ live: { ...existing, running: true, stopFn } });
  },

  stopLive() {
    const { stopFn } = get().live;
    if (stopFn) stopFn();
    set({ live: { lastSample: null, running: false, stopFn: null, changes: [] } });
  },
}));

function applyAirtelFilter(scan: ScanResult, s: Settings): ScanResult {
  if (!s.airtelMode) return scan;
  const mcc = s.airtelMcc.trim();
  const mnc = s.airtelMnc.trim();
  if (!mcc || !mnc) return scan;
  const samples = scan.samples.filter(
    (sm) => sm.cell.mcc === mcc && sm.cell.mnc === mnc
  );
  return { ...scan, samples };
}

function detectChanges(prev: CellSample | null, next: CellSample): string[] {
  if (!prev) return [];
  const out: string[] = [];
  const a = prev.cell;
  const b = next.cell;
  if (a.rat !== b.rat) out.push(`RAT ${a.rat} → ${b.rat}`);
  if ("pci" in a && "pci" in b && a.pci !== b.pci)
    out.push(`PCI ${a.pci ?? "?"} → ${b.pci ?? "?"}`);
  if (a.rat === "LTE" && b.rat === "LTE" && a.earfcn !== b.earfcn)
    out.push(`EARFCN ${a.earfcn ?? "?"} → ${b.earfcn ?? "?"}`);
  if (a.rat === "NR" && b.rat === "NR" && a.nrarfcn !== b.nrarfcn)
    out.push(`NR-ARFCN ${a.nrarfcn ?? "?"} → ${b.nrarfcn ?? "?"}`);
  const aRsrp = a.rat === "LTE" ? a.signal.rsrp : a.rat === "NR" ? a.signal.ssRsrp : null;
  const bRsrp = b.rat === "LTE" ? b.signal.rsrp : b.rat === "NR" ? b.signal.ssRsrp : null;
  if (aRsrp !== null && bRsrp !== null) {
    const d = bRsrp - aRsrp;
    if (d >= 3) out.push(`Signal improved ${aRsrp} → ${bRsrp} dBm (+${d})`);
    else if (d <= -3) out.push(`Signal degraded ${aRsrp} → ${bRsrp} dBm (${d})`);
  }
  const aId =
    a.rat === "LTE" ? a.ci :
    a.rat === "NR" ? a.nci :
    a.rat === "WCDMA" ? a.cid :
    a.rat === "GSM" ? a.cid : null;
  const bId =
    b.rat === "LTE" ? b.ci :
    b.rat === "NR" ? b.nci :
    b.rat === "WCDMA" ? b.cid :
    b.rat === "GSM" ? b.cid : null;
  if (aId !== bId) out.push(`Cell ID ${aId ?? "?"} → ${bId ?? "?"}`);
  return out.map((t) => `${new Date(next.tsMs).toLocaleTimeString()} · ${t}`);
}
