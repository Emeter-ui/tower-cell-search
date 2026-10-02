// ZLT X17U response parsers.
//
// cmd 1002 (UUID f3e328b1-c743-4aaf-be88-fdb5e32d7e51) returns the serving
// cell detail — PCI, FREQ (which is the EARFCN, not MHz), CELL_ID, PLMN,
// RSRP, RSRQ, SINR, bandwidth, band, etc. The same payload has both 4G and
// _5G variants of each field.
//
// We convert the response into the PWA's existing CellSample schema so ODU
// readings land in the Live monitor + Cells table + CSV/JSON exports with
// `source: "ODU: ZLT X17U"`.

import type {
  CellLte,
  CellNr,
  CellSample,
  ScanResult,
} from "../bridge/types";

function parseIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function parseHexOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!/^[0-9A-Fa-f]+$/.test(s)) return parseIntOrNull(v);
  const n = parseInt(s, 16);
  return Number.isFinite(n) ? n : null;
}

function splitPlmn(plmn: string | null): { mcc: string | null; mnc: string | null } {
  if (!plmn || plmn.length < 5) return { mcc: null, mnc: null };
  return { mcc: plmn.slice(0, 3), mnc: plmn.slice(3) };
}

/** Shape of the cmd 1002 response. All numeric fields come across as strings. */
export interface OduServingResponse {
  success: boolean;
  cmd: number;
  network_type_str: string;
  PLMN: string;
  network_operator: string;
  signal_lvl: string;
  bandwidth: string;
  bandwidth_5g?: string;

  // 4G
  PCI: string;
  FREQ: string; // EARFCN
  ENODEBID: string;
  CELL_ID: string; // hex
  ECGI: string;
  tac_4g: string;
  CQI: string;
  RSRP: string;
  RSRQ: string;
  RSSI: string;
  SINR: string;
  currentband: string;
  rank_4g?: string;

  // 5G
  PCI_5G: string;
  FREQ_5G: string;
  ENODEBID_5G: string;
  CELL_ID_5G: string;
  NCGI: string;
  tac_5g: string;
  CQI_5G: string;
  RSRP_5G: string;
  RSRQ_5G: string;
  RSSI_5G: string;
  SINR_5G: string;
  S_SINR: string;
  currentband_5g: string;

  // Carrier aggregation (reserved for future use)
  ca_pci?: string;
  ca_freq?: string;
  ca_rsrp?: string;
  ca_rsrq?: string;
  ca_rssi?: string;
  ca_bandwidth?: string;
}

/** True iff the 4G or 5G group has at least one measurable field. */
function hasLte(r: OduServingResponse): boolean {
  return !!(r.PCI || r.FREQ || r.RSRP || r.CELL_ID);
}
function hasNr(r: OduServingResponse): boolean {
  return !!(r.PCI_5G || r.FREQ_5G || r.RSRP_5G || r.CELL_ID_5G);
}

function toLte(r: OduServingResponse): CellLte {
  const { mcc, mnc } = splitPlmn(r.PLMN);
  return {
    rat: "LTE",
    isRegistered: true,
    mcc,
    mnc,
    plmn: r.PLMN || null,
    tac: parseHexOrNull(r.tac_4g),
    ci: parseHexOrNull(r.CELL_ID),
    pci: parseIntOrNull(r.PCI),
    earfcn: parseIntOrNull(r.FREQ),
    bandwidth: (() => {
      const mhz = parseIntOrNull(r.bandwidth);
      return mhz === null ? null : mhz * 1000; // kHz, matching CellSample contract
    })(),
    signal: {
      rsrp: parseIntOrNull(r.RSRP),
      rsrq: parseIntOrNull(r.RSRQ),
      rssi: parseIntOrNull(r.RSSI),
      rssnr: parseIntOrNull(r.SINR),
      cqi: parseIntOrNull(r.CQI),
      timingAdvance: null,
      level: parseIntOrNull(r.signal_lvl),
    },
  };
}

function toNr(r: OduServingResponse): CellNr {
  const { mcc, mnc } = splitPlmn(r.PLMN);
  return {
    rat: "NR",
    isRegistered: true,
    mcc,
    mnc,
    plmn: r.PLMN || null,
    tac: parseHexOrNull(r.tac_5g),
    nci: parseHexOrNull(r.CELL_ID_5G),
    pci: parseIntOrNull(r.PCI_5G),
    nrarfcn: parseIntOrNull(r.FREQ_5G),
    signal: {
      ssRsrp: parseIntOrNull(r.RSRP_5G),
      ssRsrq: parseIntOrNull(r.RSRQ_5G),
      ssSinr: parseIntOrNull(r.SINR_5G) ?? parseIntOrNull(r.S_SINR),
      csiRsrp: null,
      csiRsrq: null,
      csiSinr: null,
      level: parseIntOrNull(r.signal_lvl),
    },
  };
}

/** Convert one cmd 1002 response into one ScanResult (1-2 samples). */
export function oduServingToScanResult(
  r: OduServingResponse,
  nowMs: number = Date.now()
): ScanResult {
  const samples: CellSample[] = [];
  // Use a synthetic subId so ODU and phone-SIM samples never collide.
  const SUB_ODU = 10001;
  if (hasLte(r)) {
    samples.push({ subId: SUB_ODU, slotIndex: 0, tsMs: nowMs, cell: toLte(r) });
  }
  if (hasNr(r)) {
    samples.push({ subId: SUB_ODU, slotIndex: 0, tsMs: nowMs, cell: toNr(r) });
  }
  return {
    scanId: `odu-${nowMs.toString(36)}`,
    tsMs: nowMs,
    locationGranted: false,
    latitude: null,
    longitude: null,
    accuracyM: null,
    source: "ODU: ZLT X17U" as ScanResult["source"],
    warnings:
      samples.length === 0
        ? ["ODU response had no LTE or NR fields populated."]
        : [],
    samples,
  };
}
