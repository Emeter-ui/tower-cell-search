// Signal grading. Thresholds are indicative values commonly used by RF teams
// — the UI treats them as a visual hint only, never as fabricated data.

export type SignalLevel =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "bad"
  | "unknown";

export function gradeRsrp(rsrp: number | null | undefined): SignalLevel {
  if (rsrp === null || rsrp === undefined || !isFinite(rsrp)) return "unknown";
  if (rsrp >= -80) return "excellent";
  if (rsrp >= -90) return "good";
  if (rsrp >= -100) return "fair";
  if (rsrp >= -110) return "poor";
  return "bad";
}

export function gradeRsrq(rsrq: number | null | undefined): SignalLevel {
  if (rsrq === null || rsrq === undefined || !isFinite(rsrq)) return "unknown";
  if (rsrq >= -10) return "excellent";
  if (rsrq >= -15) return "good";
  if (rsrq >= -20) return "fair";
  return "poor";
}

export function gradeSinr(sinr: number | null | undefined): SignalLevel {
  if (sinr === null || sinr === undefined || !isFinite(sinr)) return "unknown";
  if (sinr >= 20) return "excellent";
  if (sinr >= 13) return "good";
  if (sinr >= 0) return "fair";
  return "poor";
}

export const SIGNAL_COLORS: Record<SignalLevel, string> = {
  excellent: "bg-signal-excellent/15 text-signal-excellent",
  good: "bg-signal-good/15 text-signal-good",
  fair: "bg-signal-fair/15 text-signal-fair",
  poor: "bg-signal-poor/15 text-signal-poor",
  bad: "bg-signal-bad/15 text-signal-bad",
  unknown: "bg-signal-unknown/15 text-signal-unknown",
};
