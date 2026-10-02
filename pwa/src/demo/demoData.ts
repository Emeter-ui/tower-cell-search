// Clearly-separated demo data. Only loaded when:
//   - the user explicitly enabled Settings → Demo mode, AND
//   - the native bridge is not present.
// Never used in production scanning.

import type { ScanResult } from "../bridge/types";

export function loadDemoScan(): ScanResult {
  const now = Date.now();
  return {
    scanId: `demo-${now}`,
    tsMs: now,
    locationGranted: false,
    latitude: null,
    longitude: null,
    accuracyM: null,
    source: "mock-demo",
    warnings: [
      "This is demo data generated inside the PWA for UI preview only — not from a real modem.",
    ],
    samples: [
      {
        subId: 1,
        slotIndex: 0,
        tsMs: now,
        cell: {
          rat: "LTE",
          isRegistered: true,
          mcc: "621",
          mnc: "20",
          plmn: "62120",
          tac: 1234,
          ci: 54321987,
          pci: 243,
          earfcn: 3100,
          bandwidth: 20000,
          signal: {
            rsrp: -92,
            rsrq: -7,
            rssi: -62,
            rssnr: 17,
            cqi: 12,
            timingAdvance: 2,
            level: 3,
          },
        },
      },
      {
        subId: 1,
        slotIndex: 0,
        tsMs: now,
        cell: {
          rat: "LTE",
          isRegistered: false,
          mcc: "621",
          mnc: "20",
          plmn: "62120",
          tac: 1234,
          ci: null,
          pci: 118,
          earfcn: 1850,
          bandwidth: null,
          signal: {
            rsrp: -104,
            rsrq: -12,
            rssi: null,
            rssnr: 4,
            cqi: null,
            timingAdvance: null,
            level: 2,
          },
        },
      },
      {
        subId: 1,
        slotIndex: 0,
        tsMs: now,
        cell: {
          rat: "NR",
          isRegistered: true,
          mcc: "621",
          mnc: "20",
          plmn: "62120",
          tac: 1234,
          nci: 123456789,
          pci: 55,
          nrarfcn: 632628,
          signal: {
            ssRsrp: -88,
            ssRsrq: -11,
            ssSinr: 18,
            csiRsrp: null,
            csiRsrq: null,
            csiSinr: null,
            level: 3,
          },
        },
      },
    ],
  };
}
