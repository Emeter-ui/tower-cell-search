// 5G NR operating band database (3GPP TS 38.101-1 FR1 and 38.101-2 FR2).
// Frequencies in MHz. For SDL/SUL the opposite direction is undefined.

export type NrDuplex = "FDD" | "TDD" | "SDL" | "SUL";

export interface NrBand {
  band: string; // "n1", "n78", "n257"...
  n: number;
  duplex: NrDuplex;
  fUlLow?: number;
  fUlHigh?: number;
  fDlLow?: number;
  fDlHigh?: number;
  fr: "FR1" | "FR2";
  notes?: string;
}

export const NR_BANDS: NrBand[] = [
  // FR1
  { band: "n1", n: 1, duplex: "FDD", fUlLow: 1920, fUlHigh: 1980, fDlLow: 2110, fDlHigh: 2170, fr: "FR1" },
  { band: "n2", n: 2, duplex: "FDD", fUlLow: 1850, fUlHigh: 1910, fDlLow: 1930, fDlHigh: 1990, fr: "FR1" },
  { band: "n3", n: 3, duplex: "FDD", fUlLow: 1710, fUlHigh: 1785, fDlLow: 1805, fDlHigh: 1880, fr: "FR1" },
  { band: "n5", n: 5, duplex: "FDD", fUlLow: 824, fUlHigh: 849, fDlLow: 869, fDlHigh: 894, fr: "FR1" },
  { band: "n7", n: 7, duplex: "FDD", fUlLow: 2500, fUlHigh: 2570, fDlLow: 2620, fDlHigh: 2690, fr: "FR1" },
  { band: "n8", n: 8, duplex: "FDD", fUlLow: 880, fUlHigh: 915, fDlLow: 925, fDlHigh: 960, fr: "FR1" },
  { band: "n12", n: 12, duplex: "FDD", fUlLow: 699, fUlHigh: 716, fDlLow: 729, fDlHigh: 746, fr: "FR1" },
  { band: "n14", n: 14, duplex: "FDD", fUlLow: 788, fUlHigh: 798, fDlLow: 758, fDlHigh: 768, fr: "FR1" },
  { band: "n18", n: 18, duplex: "FDD", fUlLow: 815, fUlHigh: 830, fDlLow: 860, fDlHigh: 875, fr: "FR1" },
  { band: "n20", n: 20, duplex: "FDD", fUlLow: 832, fUlHigh: 862, fDlLow: 791, fDlHigh: 821, fr: "FR1" },
  { band: "n25", n: 25, duplex: "FDD", fUlLow: 1850, fUlHigh: 1915, fDlLow: 1930, fDlHigh: 1995, fr: "FR1" },
  { band: "n26", n: 26, duplex: "FDD", fUlLow: 814, fUlHigh: 849, fDlLow: 859, fDlHigh: 894, fr: "FR1" },
  { band: "n28", n: 28, duplex: "FDD", fUlLow: 703, fUlHigh: 748, fDlLow: 758, fDlHigh: 803, fr: "FR1" },
  { band: "n29", n: 29, duplex: "SDL", fDlLow: 717, fDlHigh: 728, fr: "FR1" },
  { band: "n30", n: 30, duplex: "FDD", fUlLow: 2305, fUlHigh: 2315, fDlLow: 2350, fDlHigh: 2360, fr: "FR1" },
  { band: "n34", n: 34, duplex: "TDD", fUlLow: 2010, fUlHigh: 2025, fDlLow: 2010, fDlHigh: 2025, fr: "FR1" },
  { band: "n38", n: 38, duplex: "TDD", fUlLow: 2570, fUlHigh: 2620, fDlLow: 2570, fDlHigh: 2620, fr: "FR1" },
  { band: "n39", n: 39, duplex: "TDD", fUlLow: 1880, fUlHigh: 1920, fDlLow: 1880, fDlHigh: 1920, fr: "FR1" },
  { band: "n40", n: 40, duplex: "TDD", fUlLow: 2300, fUlHigh: 2400, fDlLow: 2300, fDlHigh: 2400, fr: "FR1" },
  { band: "n41", n: 41, duplex: "TDD", fUlLow: 2496, fUlHigh: 2690, fDlLow: 2496, fDlHigh: 2690, fr: "FR1" },
  { band: "n48", n: 48, duplex: "TDD", fUlLow: 3550, fUlHigh: 3700, fDlLow: 3550, fDlHigh: 3700, fr: "FR1", notes: "CBRS" },
  { band: "n50", n: 50, duplex: "TDD", fUlLow: 1432, fUlHigh: 1517, fDlLow: 1432, fDlHigh: 1517, fr: "FR1" },
  { band: "n51", n: 51, duplex: "TDD", fUlLow: 1427, fUlHigh: 1432, fDlLow: 1427, fDlHigh: 1432, fr: "FR1" },
  { band: "n66", n: 66, duplex: "FDD", fUlLow: 1710, fUlHigh: 1780, fDlLow: 2110, fDlHigh: 2200, fr: "FR1" },
  { band: "n70", n: 70, duplex: "FDD", fUlLow: 1695, fUlHigh: 1710, fDlLow: 1995, fDlHigh: 2020, fr: "FR1" },
  { band: "n71", n: 71, duplex: "FDD", fUlLow: 663, fUlHigh: 698, fDlLow: 617, fDlHigh: 652, fr: "FR1" },
  { band: "n74", n: 74, duplex: "FDD", fUlLow: 1427, fUlHigh: 1470, fDlLow: 1475, fDlHigh: 1518, fr: "FR1" },
  { band: "n75", n: 75, duplex: "SDL", fDlLow: 1432, fDlHigh: 1517, fr: "FR1" },
  { band: "n76", n: 76, duplex: "SDL", fDlLow: 1427, fDlHigh: 1432, fr: "FR1" },
  { band: "n77", n: 77, duplex: "TDD", fUlLow: 3300, fUlHigh: 4200, fDlLow: 3300, fDlHigh: 4200, fr: "FR1" },
  { band: "n78", n: 78, duplex: "TDD", fUlLow: 3300, fUlHigh: 3800, fDlLow: 3300, fDlHigh: 3800, fr: "FR1" },
  { band: "n79", n: 79, duplex: "TDD", fUlLow: 4400, fUlHigh: 5000, fDlLow: 4400, fDlHigh: 5000, fr: "FR1" },
  { band: "n80", n: 80, duplex: "SUL", fUlLow: 1710, fUlHigh: 1785, fr: "FR1" },
  { band: "n81", n: 81, duplex: "SUL", fUlLow: 880, fUlHigh: 915, fr: "FR1" },
  { band: "n82", n: 82, duplex: "SUL", fUlLow: 832, fUlHigh: 862, fr: "FR1" },
  { band: "n83", n: 83, duplex: "SUL", fUlLow: 703, fUlHigh: 748, fr: "FR1" },
  { band: "n84", n: 84, duplex: "SUL", fUlLow: 1920, fUlHigh: 1980, fr: "FR1" },
  // FR2
  { band: "n257", n: 257, duplex: "TDD", fUlLow: 26500, fUlHigh: 29500, fDlLow: 26500, fDlHigh: 29500, fr: "FR2" },
  { band: "n258", n: 258, duplex: "TDD", fUlLow: 24250, fUlHigh: 27500, fDlLow: 24250, fDlHigh: 27500, fr: "FR2" },
  { band: "n260", n: 260, duplex: "TDD", fUlLow: 37000, fUlHigh: 40000, fDlLow: 37000, fDlHigh: 40000, fr: "FR2" },
  { band: "n261", n: 261, duplex: "TDD", fUlLow: 27500, fUlHigh: 28350, fDlLow: 27500, fDlHigh: 28350, fr: "FR2" },
];

export function getNrBand(bandNumber: number): NrBand | undefined {
  return NR_BANDS.find((b) => b.n === bandNumber);
}
