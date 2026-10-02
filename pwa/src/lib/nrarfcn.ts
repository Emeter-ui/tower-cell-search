// NR-ARFCN ↔ frequency per 3GPP TS 38.104 §5.4.2.1.
// F_REF = F_REF_Offs + ΔF_Global * (N_REF − N_REF_Offs).
// Three global ranges with distinct Δf:
//   0 – 3000 MHz:   Δf = 5 kHz,  Offs = (0, 0)
//   3000 – 24250:   Δf = 15 kHz, Offs = (3000 MHz, 600000)
//   24250 – 100000: Δf = 60 kHz, Offs = (24250.08 MHz, 2016667)

import { NR_BANDS, NrBand } from "../data/nrBands";

interface GlobalRange {
  fOffsMhz: number;
  nOffs: number;
  nMin: number;
  nMax: number;
  deltaKhz: number;
}

const GLOBAL_RANGES: GlobalRange[] = [
  { fOffsMhz: 0, nOffs: 0, nMin: 0, nMax: 599999, deltaKhz: 5 },
  { fOffsMhz: 3000, nOffs: 600000, nMin: 600000, nMax: 2016666, deltaKhz: 15 },
  { fOffsMhz: 24250.08, nOffs: 2016667, nMin: 2016667, nMax: 3279165, deltaKhz: 60 },
];

export function nrarfcnToMhz(nRef: number): number | null {
  const r = GLOBAL_RANGES.find((g) => nRef >= g.nMin && nRef <= g.nMax);
  if (!r) return null;
  const f = r.fOffsMhz + (r.deltaKhz / 1000) * (nRef - r.nOffs);
  return +f.toFixed(6);
}

/** Closest N-REF for a given frequency, following the global raster. */
export function closestNrarfcn(freqMhz: number): {
  nRef: number;
  freqMhz: number;
  errorMhz: number;
} | null {
  const r = [...GLOBAL_RANGES]
    .reverse()
    .find((g) => freqMhz >= g.fOffsMhz);
  if (!r) return null;
  const n = Math.round(
    r.nOffs + ((freqMhz - r.fOffsMhz) * 1000) / r.deltaKhz
  );
  if (n < r.nMin || n > r.nMax) return null;
  const back = r.fOffsMhz + (r.deltaKhz / 1000) * (n - r.nOffs);
  return { nRef: n, freqMhz: +back.toFixed(6), errorMhz: +Math.abs(back - freqMhz).toFixed(6) };
}

/** Guess NR band from a center frequency; returns all matching bands. */
export function nrBandsForFreq(
  freqMhz: number,
  direction: "DL" | "UL" = "DL"
): NrBand[] {
  return NR_BANDS.filter((b) => {
    if (direction === "DL") {
      return b.fDlLow !== undefined && b.fDlHigh !== undefined &&
        freqMhz >= b.fDlLow && freqMhz <= b.fDlHigh;
    }
    return b.fUlLow !== undefined && b.fUlHigh !== undefined &&
      freqMhz >= b.fUlLow && freqMhz <= b.fUlHigh;
  });
}
