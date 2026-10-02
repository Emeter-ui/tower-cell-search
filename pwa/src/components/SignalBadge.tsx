import { SIGNAL_COLORS, SignalLevel } from "../lib/signal";

export function SignalBadge({
  level,
  value,
  unit,
}: {
  level: SignalLevel;
  value: number | null | undefined;
  unit?: string;
}) {
  const text =
    value === null || value === undefined || !isFinite(value as number)
      ? "—"
      : `${value}${unit ? ` ${unit}` : ""}`;
  return (
    <span
      className={`pill font-mono ${SIGNAL_COLORS[level]} border-transparent`}
      title={level}
    >
      {text}
    </span>
  );
}
