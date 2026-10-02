// Thin typed wrapper around the Android @JavascriptInterface named
// `AndroidCellBridge`. The Kotlin side returns JSON strings (safer across the
// WebView boundary than complex objects); we parse here.

import type {
  BridgeStatus,
  OduStatus,
  ScanResult,
  SubscriptionInfo,
} from "./types";

type RawBridge = {
  status(): string;
  requestPermissions(): void; // fire-and-forget; app shows a dialog
  listSubscriptions(): string;
  scanOnce(subIdOrNegative: number): string; // negative = default
  startLive(subIdOrNegative: number, intervalMs: number): void;
  stopLive(): void;
  requestNetworkScan(subIdOrNegative: number): string; // best-effort; returns error payload when denied
  // --- ODU (ZLT X17U) ---
  oduStatus(): string;
  oduOpenLogin(url: string): void;
  oduScanOnce(): string; // throws by returning {"error":"..."} when not logged in
  oduClearSession(): void;
};

declare global {
  interface Window {
    AndroidCellBridge?: RawBridge;
    // Push channel for live samples. The Kotlin side evaluates
    //   window.__cellLive && window.__cellLive(json)
    __cellLive?: (json: string) => void;
    __cellBridgeEvent?: (eventJson: string) => void;
  }
}

export interface NativeBridge {
  readonly isPresent: boolean;
  status(): Promise<BridgeStatus>;
  requestPermissions(): void;
  listSubscriptions(): Promise<SubscriptionInfo[]>;
  scanOnce(subId?: number): Promise<ScanResult>;
  requestNetworkScan(subId?: number): Promise<ScanResult>;
  startLive(opts: {
    subId?: number;
    intervalMs: number;
    onSample: (r: ScanResult) => void;
  }): () => void;
  oduStatus(): Promise<OduStatus>;
  oduOpenLogin(url: string): void;
  oduScanOnce(): Promise<ScanResult>;
  oduClearSession(): Promise<void>;
}

class RealBridge implements NativeBridge {
  isPresent = true;
  constructor(private raw: RawBridge) {}

  async status(): Promise<BridgeStatus> {
    return JSON.parse(this.raw.status()) as BridgeStatus;
  }
  requestPermissions() {
    this.raw.requestPermissions();
  }
  async listSubscriptions(): Promise<SubscriptionInfo[]> {
    return JSON.parse(this.raw.listSubscriptions()) as SubscriptionInfo[];
  }
  async scanOnce(subId?: number): Promise<ScanResult> {
    return JSON.parse(this.raw.scanOnce(subId ?? -1)) as ScanResult;
  }
  async requestNetworkScan(subId?: number): Promise<ScanResult> {
    return JSON.parse(this.raw.requestNetworkScan(subId ?? -1)) as ScanResult;
  }
  startLive(opts: {
    subId?: number;
    intervalMs: number;
    onSample: (r: ScanResult) => void;
  }) {
    window.__cellLive = (json: string) => {
      try {
        opts.onSample(JSON.parse(json) as ScanResult);
      } catch {
        /* ignore malformed push */
      }
    };
    this.raw.startLive(opts.subId ?? -1, opts.intervalMs);
    return () => {
      try {
        this.raw.stopLive();
      } catch {
        /* already stopped */
      }
      window.__cellLive = undefined;
    };
  }
  async oduStatus(): Promise<OduStatus> {
    return JSON.parse(this.raw.oduStatus()) as OduStatus;
  }
  oduOpenLogin(url: string): void {
    this.raw.oduOpenLogin(url);
  }
  async oduScanOnce(): Promise<ScanResult> {
    const parsed = JSON.parse(this.raw.oduScanOnce());
    if (parsed && typeof parsed.error === "string") throw new Error(parsed.error);
    return parsed as ScanResult;
  }
  async oduClearSession(): Promise<void> {
    this.raw.oduClearSession();
  }
}

class AbsentBridge implements NativeBridge {
  isPresent = false;
  constructor(private reason: string) {}
  async status(): Promise<BridgeStatus> {
    return { present: false, reason: this.reason };
  }
  requestPermissions() {
    /* no-op */
  }
  async listSubscriptions() {
    return [];
  }
  async scanOnce(): Promise<ScanResult> {
    throw new Error(this.reason);
  }
  async requestNetworkScan(): Promise<ScanResult> {
    throw new Error(this.reason);
  }
  startLive() {
    return () => {};
  }
  async oduStatus(): Promise<OduStatus> {
    return {
      configured: false,
      loggedIn: false,
      url: null,
      sessionAgeMs: null,
      lastError: this.reason,
    };
  }
  oduOpenLogin() {
    /* no-op */
  }
  async oduScanOnce(): Promise<ScanResult> {
    throw new Error(this.reason);
  }
  async oduClearSession(): Promise<void> {
    /* no-op */
  }
}

let singleton: NativeBridge | null = null;
export function getNativeBridge(): NativeBridge {
  if (singleton) return singleton;
  if (typeof window !== "undefined" && window.AndroidCellBridge) {
    singleton = new RealBridge(window.AndroidCellBridge);
  } else {
    singleton = new AbsentBridge(
      "Native cellular scanning is unavailable in this browser. Install the Android companion to access modem information."
    );
  }
  return singleton;
}
