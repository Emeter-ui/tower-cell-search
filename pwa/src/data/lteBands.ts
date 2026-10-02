// LTE E-UTRA band database (3GPP TS 36.101).
// All values are in MHz. EARFCN math: F_DL = F_DL_low + 0.1*(N_DL - N_OffsDL).
// Bands intentionally include the full standard set the task asks for; this is
// NOT a carrier-specific list.

export type LteDuplex = "FDD" | "TDD" | "SDL";

export interface LteBand {
  band: number;
  duplex: LteDuplex;
  // DL
  fDlLow: number; // MHz
  fDlHigh: number;
  nOffsDl: number; // EARFCN offset
  nDlLow: number;
  nDlHigh: number;
  // UL (absent for SDL)
  fUlLow?: number;
  fUlHigh?: number;
  nOffsUl?: number;
  nUlLow?: number;
  nUlHigh?: number;
  notes?: string;
}

export const LTE_BANDS: LteBand[] = [
  // --- FDD ---
  { band: 1, duplex: "FDD", fDlLow: 2110, fDlHigh: 2170, nOffsDl: 0, nDlLow: 0, nDlHigh: 599, fUlLow: 1920, fUlHigh: 1980, nOffsUl: 18000, nUlLow: 18000, nUlHigh: 18599 },
  { band: 2, duplex: "FDD", fDlLow: 1930, fDlHigh: 1990, nOffsDl: 600, nDlLow: 600, nDlHigh: 1199, fUlLow: 1850, fUlHigh: 1910, nOffsUl: 18600, nUlLow: 18600, nUlHigh: 19199 },
  { band: 3, duplex: "FDD", fDlLow: 1805, fDlHigh: 1880, nOffsDl: 1200, nDlLow: 1200, nDlHigh: 1949, fUlLow: 1710, fUlHigh: 1785, nOffsUl: 19200, nUlLow: 19200, nUlHigh: 19949 },
  { band: 4, duplex: "FDD", fDlLow: 2110, fDlHigh: 2155, nOffsDl: 1950, nDlLow: 1950, nDlHigh: 2399, fUlLow: 1710, fUlHigh: 1755, nOffsUl: 19950, nUlLow: 19950, nUlHigh: 20399 },
  { band: 5, duplex: "FDD", fDlLow: 869, fDlHigh: 894, nOffsDl: 2400, nDlLow: 2400, nDlHigh: 2649, fUlLow: 824, fUlHigh: 849, nOffsUl: 20400, nUlLow: 20400, nUlHigh: 20649 },
  { band: 7, duplex: "FDD", fDlLow: 2620, fDlHigh: 2690, nOffsDl: 2750, nDlLow: 2750, nDlHigh: 3449, fUlLow: 2500, fUlHigh: 2570, nOffsUl: 20750, nUlLow: 20750, nUlHigh: 21449 },
  { band: 8, duplex: "FDD", fDlLow: 925, fDlHigh: 960, nOffsDl: 3450, nDlLow: 3450, nDlHigh: 3799, fUlLow: 880, fUlHigh: 915, nOffsUl: 21450, nUlLow: 21450, nUlHigh: 21799 },
  { band: 12, duplex: "FDD", fDlLow: 729, fDlHigh: 746, nOffsDl: 5010, nDlLow: 5010, nDlHigh: 5179, fUlLow: 699, fUlHigh: 716, nOffsUl: 23010, nUlLow: 23010, nUlHigh: 23179 },
  { band: 13, duplex: "FDD", fDlLow: 746, fDlHigh: 756, nOffsDl: 5180, nDlLow: 5180, nDlHigh: 5279, fUlLow: 777, fUlHigh: 787, nOffsUl: 23180, nUlLow: 23180, nUlHigh: 23279 },
  { band: 14, duplex: "FDD", fDlLow: 758, fDlHigh: 768, nOffsDl: 5280, nDlLow: 5280, nDlHigh: 5379, fUlLow: 788, fUlHigh: 798, nOffsUl: 23280, nUlLow: 23280, nUlHigh: 23379 },
  { band: 17, duplex: "FDD", fDlLow: 734, fDlHigh: 746, nOffsDl: 5730, nDlLow: 5730, nDlHigh: 5849, fUlLow: 704, fUlHigh: 716, nOffsUl: 23730, nUlLow: 23730, nUlHigh: 23849 },
  { band: 18, duplex: "FDD", fDlLow: 860, fDlHigh: 875, nOffsDl: 5850, nDlLow: 5850, nDlHigh: 5999, fUlLow: 815, fUlHigh: 830, nOffsUl: 23850, nUlLow: 23850, nUlHigh: 23999 },
  { band: 19, duplex: "FDD", fDlLow: 875, fDlHigh: 890, nOffsDl: 6000, nDlLow: 6000, nDlHigh: 6149, fUlLow: 830, fUlHigh: 845, nOffsUl: 24000, nUlLow: 24000, nUlHigh: 24149 },
  { band: 20, duplex: "FDD", fDlLow: 791, fDlHigh: 821, nOffsDl: 6150, nDlLow: 6150, nDlHigh: 6449, fUlLow: 832, fUlHigh: 862, nOffsUl: 24150, nUlLow: 24150, nUlHigh: 24449 },
  { band: 25, duplex: "FDD", fDlLow: 1930, fDlHigh: 1995, nOffsDl: 8040, nDlLow: 8040, nDlHigh: 8689, fUlLow: 1850, fUlHigh: 1915, nOffsUl: 26040, nUlLow: 26040, nUlHigh: 26689 },
  { band: 26, duplex: "FDD", fDlLow: 859, fDlHigh: 894, nOffsDl: 8690, nDlLow: 8690, nDlHigh: 9039, fUlLow: 814, fUlHigh: 849, nOffsUl: 26690, nUlLow: 26690, nUlHigh: 27039 },
  { band: 28, duplex: "FDD", fDlLow: 758, fDlHigh: 803, nOffsDl: 9210, nDlLow: 9210, nDlHigh: 9659, fUlLow: 703, fUlHigh: 748, nOffsUl: 27210, nUlLow: 27210, nUlHigh: 27659 },
  { band: 29, duplex: "SDL", fDlLow: 717, fDlHigh: 728, nOffsDl: 9660, nDlLow: 9660, nDlHigh: 9769, notes: "DL only" },
  { band: 30, duplex: "FDD", fDlLow: 2350, fDlHigh: 2360, nOffsDl: 9770, nDlLow: 9770, nDlHigh: 9869, fUlLow: 2305, fUlHigh: 2315, nOffsUl: 27660, nUlLow: 27660, nUlHigh: 27759 },
  { band: 32, duplex: "SDL", fDlLow: 1452, fDlHigh: 1496, nOffsDl: 9920, nDlLow: 9920, nDlHigh: 10359, notes: "DL only (L-band)" },
  { band: 66, duplex: "FDD", fDlLow: 2110, fDlHigh: 2200, nOffsDl: 66436, nDlLow: 66436, nDlHigh: 67335, fUlLow: 1710, fUlHigh: 1780, nOffsUl: 131972, nUlLow: 131972, nUlHigh: 132671 },
  { band: 71, duplex: "FDD", fDlLow: 617, fDlHigh: 652, nOffsDl: 68586, nDlLow: 68586, nDlHigh: 68935, fUlLow: 663, fUlHigh: 698, nOffsUl: 133122, nUlLow: 133122, nUlHigh: 133471 },

  // --- TDD ---
  { band: 34, duplex: "TDD", fDlLow: 2010, fDlHigh: 2025, nOffsDl: 36200, nDlLow: 36200, nDlHigh: 36349, fUlLow: 2010, fUlHigh: 2025, nOffsUl: 36200, nUlLow: 36200, nUlHigh: 36349 },
  { band: 38, duplex: "TDD", fDlLow: 2570, fDlHigh: 2620, nOffsDl: 37750, nDlLow: 37750, nDlHigh: 38249, fUlLow: 2570, fUlHigh: 2620, nOffsUl: 37750, nUlLow: 37750, nUlHigh: 38249 },
  { band: 39, duplex: "TDD", fDlLow: 1880, fDlHigh: 1920, nOffsDl: 38250, nDlLow: 38250, nDlHigh: 38649, fUlLow: 1880, fUlHigh: 1920, nOffsUl: 38250, nUlLow: 38250, nUlHigh: 38649 },
  { band: 40, duplex: "TDD", fDlLow: 2300, fDlHigh: 2400, nOffsDl: 38650, nDlLow: 38650, nDlHigh: 39649, fUlLow: 2300, fUlHigh: 2400, nOffsUl: 38650, nUlLow: 38650, nUlHigh: 39649 },
  { band: 41, duplex: "TDD", fDlLow: 2496, fDlHigh: 2690, nOffsDl: 39650, nDlLow: 39650, nDlHigh: 41589, fUlLow: 2496, fUlHigh: 2690, nOffsUl: 39650, nUlLow: 39650, nUlHigh: 41589 },
  { band: 42, duplex: "TDD", fDlLow: 3400, fDlHigh: 3600, nOffsDl: 41590, nDlLow: 41590, nDlHigh: 43589, fUlLow: 3400, fUlHigh: 3600, nOffsUl: 41590, nUlLow: 41590, nUlHigh: 43589 },
  { band: 43, duplex: "TDD", fDlLow: 3600, fDlHigh: 3800, nOffsDl: 43590, nDlLow: 43590, nDlHigh: 45589, fUlLow: 3600, fUlHigh: 3800, nOffsUl: 43590, nUlLow: 43590, nUlHigh: 45589 },
  { band: 46, duplex: "TDD", fDlLow: 5150, fDlHigh: 5925, nOffsDl: 46790, nDlLow: 46790, nDlHigh: 54539, fUlLow: 5150, fUlHigh: 5925, nOffsUl: 46790, nUlLow: 46790, nUlHigh: 54539, notes: "LAA / unlicensed" },
  { band: 48, duplex: "TDD", fDlLow: 3550, fDlHigh: 3700, nOffsDl: 55240, nDlLow: 55240, nDlHigh: 56739, fUlLow: 3550, fUlHigh: 3700, nOffsUl: 55240, nUlLow: 55240, nUlHigh: 56739, notes: "CBRS" },
];

export function getLteBand(band: number): LteBand | undefined {
  return LTE_BANDS.find((b) => b.band === band);
}
