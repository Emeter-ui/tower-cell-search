import { useEffect, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { Dashboard } from "./views/Dashboard";
import { Scan } from "./views/Scan";
import { Cells } from "./views/Cells";
import { Live } from "./views/Live";
import { History } from "./views/History";
import { Tools } from "./views/Tools";
import { Settings } from "./views/Settings";
import { Odu } from "./views/Odu";
import { useScannerStore } from "./store/useScannerStore";

export type TabId =
  | "dashboard"
  | "scan"
  | "cells"
  | "live"
  | "odu"
  | "history"
  | "tools"
  | "settings";

export default function App() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const init = useScannerStore((s) => s.init);
  useEffect(() => {
    init();
    // The Kotlin side pushes bridge events (permission results etc.) through
    // this channel so the UI can re-read the bridge status without polling.
    window.__cellBridgeEvent = () => {
      const s = useScannerStore.getState();
      s.refreshBridge();
      s.oduRefresh();
    };
    return () => {
      window.__cellBridgeEvent = undefined;
    };
  }, [init]);

  return (
    <div className="min-h-full flex flex-col max-w-4xl mx-auto">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-4 py-3">
        <div className="text-sm uppercase tracking-widest text-ink-dim">
          scan-tower-cell
        </div>
        <h1 className="text-lg font-semibold capitalize">{tab}</h1>
      </header>
      <main className="flex-1 p-3 pb-24">
        {tab === "dashboard" && <Dashboard />}
        {tab === "scan" && <Scan />}
        {tab === "cells" && <Cells />}
        {tab === "live" && <Live />}
        {tab === "odu" && <Odu />}
        {tab === "history" && <History />}
        {tab === "tools" && <Tools />}
        {tab === "settings" && <Settings />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
