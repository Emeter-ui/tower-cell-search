// EARFCN ↔ frequency per 3GPP TS 36.101 §5.7.3.
// F_DL = F_DL_low + 0.1 * (N_DL - N_OffsDL). UL analogous when the band has UL.

import { LTE_BANDS, LteBand } from "../data/lteBands";

export interface LteFreqPair {
  dlMhz: number;
  ulMhz: number | null; // null for SDL
}

/** Resolve the LTE band from a DL EARFCN. Returns undefined for unknown N. */
export function lteBandFromDlEarfcn(nDl: number): LteBand | undefined {
  return LTE_BANDS.find((b) => nDl >= b.nDlLow && nDl <= b.nDlHigh);
}

/** Resolve the LTE band from an UL EARFCN. */
export function lteBandFromUlEarfcn(nUl: number): LteBand | undefined {
  return LTE_BANDS.find(
    (b) =>
      b.nUlLow !== undefined &&
      b.nUlHigh !== undefined &&
      nUl >= b.nUlLow &&
      nUl <= b.nUlHigh
  );
}

export function dlEarfcnToMhz(nDl: number): number | null {
  const band = lteBandFromDlEarfcn(nDl);
  if (!band) return null;
  return +(band.fDlLow + 0.1 * (nDl - band.nOffsDl)).toFixed(3);
}

export function ulEarfcnToMhz(nUl: number): number | null {
  const band = lteBandFromUlEarfcn(nUl);
  if (!band || band.nOffsUl === undefined || band.fUlLow === undefined)
    return null;
  return +(band.fUlLow + 0.1 * (nUl - band.nOffsUl)).toFixed(3);
}

/** Given a serving DL EARFCN, return the paired DL + UL frequencies in MHz. */
export function dlEarfcnToPair(nDl: number): LteFreqPair | null {
  const band = lteBandFromDlEarfcn(nDl);
  if (!band) return null;
  const dl = band.fDlLow + 0.1 * (nDl - band.nOffsDl);
  if (band.duplex === "SDL" || band.nOffsUl === undefined || band.fUlLow === undefined) {
    return { dlMhz: +dl.toFixed(3), ulMhz: null };
  }
  // TDD uses the same channel number for UL; FDD uses the paired number.
  const nUl =
    band.duplex === "TDD" ? nDl : nDl - band.nOffsDl + band.nOffsUl;
  const ul = band.fUlLow + 0.1 * (nUl - band.nOffsUl);
  return { dlMhz: +dl.toFixed(3), ulMhz: +ul.toFixed(3) };
}

export interface ClosestEarfcn {
  nDl: number;
  dlMhz: number;
  band: LteBand;
  errorMhz: number;
}

/** Find the closest DL EARFCN across all bands for a given DL frequency. */
export function closestDlEarfcn(freqMhz: number): ClosestEarfcn | null {
  let best: ClosestEarfcn | null = null;
  for (const b of LTE_BANDS) {
    if (freqMhz < b.fDlLow || freqMhz > b.fDlHigh) continue;
    const n = Math.round((freqMhz - b.fDlLow) / 0.1 + b.nOffsDl);
    if (n < b.nDlLow || n > b.nDlHigh) continue;
    const f = b.fDlLow + 0.1 * (n - b.nOffsDl);
    const err = Math.abs(f - freqMhz);
    if (!best || err < best.errorMhz) {
      best = { nDl: n, dlMhz: +f.toFixed(3), band: b, errorMhz: +err.toFixed(4) };
    }
  }
  return best;
}
