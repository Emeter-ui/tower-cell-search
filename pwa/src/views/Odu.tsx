import { useEffect, useState } from "react";
import { useScannerStore } from "../store/useScannerStore";
import { FallbackBanner } from "../components/FallbackBanner";
import { CellTable } from "../components/CellTable";
import { CellDetail } from "../components/CellDetail";
import type { CellSample } from "../bridge/types";

export function Odu() {
  const {
    bridgeStatus,
    settings,
    updateSettings,
    oduStatus,
    oduRefresh,
    oduOpenLogin,
    oduLogin,
    oduScan,
    oduClear,
    scans,
    busy,
    error,
  } = useScannerStore();
  const [selected, setSelected] = useState<CellSample | null>(null);
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");

  useEffect(() => {
    oduRefresh();
  }, [oduRefresh]);

  const latestOdu = scans.find((s) => s.source === "ODU: ZLT X17U");

  return (
    <div className="space-y-3">
      <FallbackBanner status={bridgeStatus} />
      {error && (
        <div className="card border-signal-bad/40 text-signal-bad text-sm">
          {error}
        </div>
      )}

      <div className="card space-y-3">
        <div className="text-xs text-ink-dim uppercase tracking-wider">
          ZLT X17U (Airtel ODU)
        </div>
        <div>
          <label className="label">Admin URL</label>
          <input
            className="input"
            value={settings.oduUrl}
            onChange={(e) => updateSettings({ oduUrl: e.target.value })}
            placeholder="http://192.168.1.1"
          />
          <div className="text-xs text-ink-mute mt-1">
            Join the ODU's WiFi first. The scanner polls{" "}
            <code>/cgi-bin/http.cgi</code> for serving-cell detail (cmd 1002).
          </div>
        </div>

        <div className="text-sm">
          Session:{" "}
          <b className={oduStatus?.loggedIn ? "text-signal-excellent" : "text-signal-fair"}>
            {oduStatus?.loggedIn ? "logged in" : "not logged in"}
          </b>
          {oduStatus?.sessionAgeMs !== null && oduStatus?.sessionAgeMs !== undefined && (
            <span className="text-ink-dim ml-2">
              age {Math.round(oduStatus.sessionAgeMs / 1000)} s
            </span>
          )}
          {oduStatus?.lastError && (
            <div className="text-signal-fair text-xs mt-1">
              Last error: {oduStatus.lastError}
            </div>
          )}
        </div>

        {!oduStatus?.loggedIn && (
          <div className="space-y-2 border-t border-line pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="text-xs text-ink-mute">
              Default admin on most ZLT X17U units is <code>root</code> / <code>admin</code>.
              Credentials stay on this device.
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!oduStatus?.loggedIn && (
            <button
              className="btn btn-primary flex-1 min-w-[140px]"
              onClick={() => oduLogin(username, password)}
              disabled={busy || !bridgeStatus?.present || !password}
            >
              {busy ? "Logging in…" : "Log in"}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => oduScan()}
            disabled={!oduStatus?.loggedIn || busy}
          >
            {busy ? "Reading…" : "Scan ODU now"}
          </button>
          {oduStatus?.loggedIn && (
            <button className="btn btn-danger" onClick={() => oduClear()}>
              Log out
            </button>
          )}
          <button
            className="btn"
            onClick={oduOpenLogin}
            disabled={!bridgeStatus?.present}
            title="Fallback: open the ODU's admin page in a WebView"
          >
            {oduStatus?.loggedIn ? "Open admin UI" : "Open admin UI (fallback)"}
          </button>
        </div>
      </div>

      {latestOdu && (
        <>
          <div className="card">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs text-ink-dim uppercase tracking-wider">
                  Latest ODU reading
                </div>
                <div className="text-sm text-ink-dim">
                  {new Date(latestOdu.tsMs).toLocaleString()} ·{" "}
                  {latestOdu.samples.length} cell(s)
                </div>
              </div>
              <div className="text-sm font-mono text-accent">
                {latestOdu.source}
              </div>
            </div>
            {latestOdu.warnings.length > 0 && (
              <ul className="mt-2 text-xs text-signal-fair list-disc pl-5">
                {latestOdu.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
          <CellTable
            samples={latestOdu.samples}
            onPick={(r) => setSelected(r.sample)}
          />
        </>
      )}

      {selected && (
        <CellDetail sample={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
