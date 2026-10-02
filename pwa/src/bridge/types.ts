// Contract shared between the PWA and the Android companion. Every numeric
// field is nullable because Android reports `CellInfo.UNAVAILABLE` for data
// the HAL did not provide — the UI MUST display those as
// "Unavailable / Restricted", never as a fabricated number.

export type Rat = "LTE" | "NR" | "WCDMA" | "GSM" | "CDMA" | "UNKNOWN";

export interface SubscriptionInfo {
  subId: number;
  slotIndex: number;
  carrierName: string | null;
  displayName: string | null;
  mcc: string | null;
  mnc: string | null;
  isDefaultData: boolean;
  isDefaultVoice: boolean;
}

export interface SignalLte {
  rsrp: number | null; // dBm
  rsrq: number | null; // dB
  rssi: number | null; // dBm
  rssnr: number | null; // dB (RSSNR scale) — Android exposes RSSNR, we expose as SINR hint
  cqi: number | null;
  timingAdvance: number | null; // only for serving
  level: number | null; // Android 0..4 bars
}

export interface SignalNr {
  ssRsrp: number | null; // dBm
  ssRsrq: number | null; // dB
  ssSinr: number | null; // dB
  csiRsrp: number | null;
  csiRsrq: number | null;
  csiSinr: number | null;
  level: number | null;
}

export interface CellLte {
  rat: "LTE";
  isRegistered: boolean; // serving when true
  mcc: string | null;
  mnc: string | null;
  plmn: string | null;
  tac: number | null;
  ci: number | null; // 28-bit, includes eNB + sector
  pci: number | null;
  earfcn: number | null; // DL EARFCN. API 24+ (null below).
  bandwidth: number | null; // kHz. API 28+
  signal: SignalLte;
}

export interface CellNr {
  rat: "NR";
  isRegistered: boolean;
  mcc: string | null;
  mnc: string | null;
  plmn: string | null;
  tac: number | null;
  nci: number | null;
  pci: number | null;
  nrarfcn: number | null;
  signal: SignalNr;
}

export interface CellWcdma {
  rat: "WCDMA";
  isRegistered: boolean;
  mcc: string | null;
  mnc: string | null;
  plmn: string | null;
  lac: number | null;
  cid: number | null;
  psc: number | null;
  uarfcn: number | null;
  signal: { rscp: number | null; ecno: number | null; level: number | null };
}

export interface CellGsm {
  rat: "GSM";
  isRegistered: boolean;
  mcc: string | null;
  mnc: string | null;
  plmn: string | null;
  lac: number | null;
  cid: number | null;
  arfcn: number | null;
  bsic: number | null;
  signal: { rssi: number | null; ber: number | null; level: number | null };
}

export type Cell = CellLte | CellNr | CellWcdma | CellGsm;

export interface CellSample {
  subId: number;
  slotIndex: number;
  tsMs: number;
  cell: Cell;
}

export interface ScanResult {
  scanId: string;
  tsMs: number;
  locationGranted: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  samples: CellSample[];
  // Which API path produced the samples. Visible in the UI so the user knows
  // what to trust.
  source:
    | "getAllCellInfo"
    | "requestNetworkScan"
    | "getAllCellInfo+networkScan"
    | "mock-demo";
  warnings: string[];
}

export interface BridgeCapabilities {
  present: true;
  apiLevel: number;
  manufacturer: string;
  model: string;
  androidVersion: string;
  canReadCellInfo: boolean;
  canReadFineLocation: boolean;
  canReadPhoneState: boolean;
  canRequestNetworkScan: boolean;
  neighborCellSupport: "yes" | "unknown" | "no";
  subscriptions: SubscriptionInfo[];
}

export interface NoBridge {
  present: false;
  reason: string;
}

export type BridgeStatus = BridgeCapabilities | NoBridge;
