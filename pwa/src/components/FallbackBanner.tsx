import type { BridgeStatus } from "../bridge/types";

export function FallbackBanner({ status }: { status: BridgeStatus | null }) {
  if (!status) return null;
  if (status.present) {
    const parts = [];
    if (!status.canReadFineLocation)
      parts.push("Location permission not granted — Android will not return cell info.");
    if (!status.canReadPhoneState)
      parts.push("Phone permission not granted — PLMN/subscription data limited.");
    if (status.neighborCellSupport === "no")
      parts.push("This device does not expose neighbor cells.");
    if (parts.length === 0) return null;
    return (
      <div className="card border-signal-fair/40 text-signal-fair text-sm">
        {parts.map((p) => (
          <div key={p}>⚠ {p}</div>
        ))}
      </div>
    );
  }
  return (
    <div className="card border-accent/40 text-ink text-sm">
      <div className="font-medium text-accent mb-1">
        Native cellular scanning unavailable
      </div>
      <div className="text-ink-dim">
        {status.reason} The band database, EARFCN / NR-ARFCN calculators and
        imported-scan analysis still work in this browser.
      </div>
    </div>
  );
}
