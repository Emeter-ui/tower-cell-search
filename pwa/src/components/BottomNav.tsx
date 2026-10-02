import type { TabId } from "../App";

const TABS: { id: TabId; label: string; glyph: string }[] = [
  { id: "dashboard", label: "Dashboard", glyph: "▣" },
  { id: "scan", label: "Scan", glyph: "⟳" },
  { id: "cells", label: "Cells", glyph: "▦" },
  { id: "live", label: "Live", glyph: "●" },
  { id: "history", label: "History", glyph: "⌛" },
  { id: "tools", label: "Tools", glyph: "⚙" },
  { id: "settings", label: "Settings", glyph: "✎" },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur
        grid grid-cols-7 gap-0.5 px-1 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]"
    >
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex flex-col items-center justify-center py-2 min-h-[52px]
              text-[10px] rounded-md ${
                on ? "text-accent bg-accent/10" : "text-ink-dim"
              }`}
          >
            <span className="text-lg leading-none">{t.glyph}</span>
            <span className="mt-0.5">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
