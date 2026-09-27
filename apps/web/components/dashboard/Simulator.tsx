"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { SCENARIOS } from "@gridflex/shared";
import { presenterRequest, useRun } from "./RunProvider";
import { DemoGuide } from "./DemoGuide";
import { OperatorWalletButton } from "./OperatorWallet";
const Context = createContext({
  open: false,
  toggle: () => {},
  close: () => {},
});
export function SimulatorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [toggle, close]);
  return (
    <Context.Provider value={{ open, toggle, close }}>
      {children}
    </Context.Provider>
  );
}
export const useSimulator = () => useContext(Context);
export function useSecretTap() {
  const { toggle } = useSimulator();
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < 900);
    if (taps.current.length >= 3) {
      taps.current = [];
      toggle();
    }
  }, [toggle]);
}
const button =
  "rounded-md border border-border-strong px-3 py-2 text-sm hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent";
export function SimulatorPanel() {
  const { open, close } = useSimulator();
  const { run, refresh, connected } = useRun();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [resourceId, setResourceId] = useState("downtown-battery-0");
  const [reservePercent, setReservePercent] = useState(20);
  const [priceCap, setPriceCap] = useState(0.6);
  const [preset, setPreset] = useState("stress");
  const playbackActive = run?.autoplay || run?.status === "running" || run?.status === "draining";
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  async function perform(action: string, value?: unknown) {
    setBusy(true);
    setError("");
    try {
      await presenterRequest("control", { action, value });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    if (!unlocked || run?.speed !== 0) return null;
    return (
      <div className="fixed bottom-24 left-5 z-40 max-w-[calc(100vw-2.5rem)] sm:bottom-8 sm:left-8">
        <DemoGuide
          run={run}
          busy={busy}
          error={error}
          disabled={!connected}
          onNext={() => void perform("next-event")}
        />
      </div>
    );
  }
  return (
    <aside
      aria-label="Simulation controls"
      className="fixed bottom-4 right-4 z-50 max-h-[85dvh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl bg-background-raised p-5 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Simulation controls</h2>
        <button
          aria-label="Close simulation controls"
          onClick={close}
          className="p-2"
        >
          <X size={18} />
        </button>
      </div>
      {!unlocked ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const d = await presenterRequest("unlock", { code });
              sessionStorage.setItem("gridflex-presenter", d.token);
              setUnlocked(true);
              setCode("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            Presenter access code
            <input
              ref={input}
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-2 block w-full rounded-md border border-border bg-background p-2"
            />
          </label>
          <button className={button} disabled={busy}>
            Unlock controls
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted">
            One shared run · Ctrl Shift S or triple-tap the header to close.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy || run?.speed === 0}
              onClick={() =>
                void perform(playbackActive ? "pause" : "start")
              }
            >
              {playbackActive ? "Pause" : "Start"}
            </button>
            <button
              className={button}
              disabled={busy || run?.status !== "paused" || run?.autoplay}
              onClick={() => void perform("step", 15)}
            >
              Step 15 minutes
            </button>
          </div>
          <label className="block text-sm">
            Playback speed
            <select
              aria-label="Playback speed"
              className="mt-1 block w-full rounded-md bg-background p-2"
              value={run?.speed ?? 96}
              disabled={busy}
              onChange={(e) => void perform("speed", Number(e.target.value))}
            >
              {[1, 24, 96].map((n) => (
                <option key={n} value={n}>
                  {n}×
                  {n === 1
                    ? " · real time"
                    : n === 96
                      ? " · 15-minute day"
                      : " · one-hour day"}
                </option>
              ))}
              <option value={0}>Manual · next event</option>
            </select>
          </label>
          {run?.speed === 0 && (
            <p className="text-xs text-muted">
              Automatic playback is paused. Close this panel and use Next event
              to advance to the next event update or scenario.
            </p>
          )}
          <label className="block text-sm">
            New run
            <select
              className="mt-1 block w-full rounded-md bg-background p-2"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="stress">Stress day</option>
              <option value="historical">Historical inputs</option>
            </select>
          </label>
          <button
            className={button}
            disabled={busy}
            onClick={() => void perform("restart", preset)}
          >
            Create new run
          </button>
          <p className="text-xs text-muted">
            Previous transactions stay on-chain. Outstanding commitments must
            finish before a new run starts.
          </p>
          <label className="block text-sm">
            Scenario
            <select
              className="mt-1 block w-full rounded-md bg-background p-2"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.category} · {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={button}
            disabled={busy || !run}
            onClick={() => void perform("inject", scenario)}
          >
            Inject scenario
          </button>
          <button
            className={`${button} ml-2`}
            disabled={busy}
            onClick={async () => {
              try {
                const d = await presenterRequest("preflight");
                setError(
                  d.errors.length ? d.errors.join(" ") : "Ready to run.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Check readiness
          </button>
          <details className="border-t border-border pt-3 text-xs">
            <summary className="cursor-pointer text-sm">
              Coverage evidence
            </summary>
            <ol className="mt-3 space-y-2">
              {run?.coverage.map((c) => (
                <li key={c.scenario} className="flex justify-between gap-3">
                  <span>
                    {SCENARIOS.find((s) => s.id === c.scenario)?.label}
                  </span>
                  <span
                    className={
                      c.status === "observed" ? "text-normal" : "text-muted"
                    }
                  >
                    {c.status}
                    {c.evidence.length ? ` · #${c.evidence.join(", #")}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </details>
          <details className="text-sm">
            <summary className="cursor-pointer">Operating preferences</summary>
            <label className="mt-3 block">
              Price cap ($/kWh)
              <input
                className="mt-1 w-full rounded-md bg-background p-2"
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={priceCap}
                onChange={(e) => setPriceCap(Number(e.target.value))}
              />
            </label>
            <button
              className={`${button} mt-2`}
              disabled={busy}
              onClick={() => void perform("price-cap", priceCap)}
            >
              Apply price cap
            </button>
            <label className="mt-3 block">
              Resource
              <select
                className="mt-1 w-full rounded-md bg-background p-2"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              >
                {run?.devices.map((d) => (
                  <option key={d.id}>{d.id}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              Minimum reserve (%)
              <input
                className="mt-1 w-full rounded-md bg-background p-2"
                type="number"
                min="10"
                max="100"
                value={reservePercent}
                onChange={(e) => setReservePercent(Number(e.target.value))}
              />
            </label>
            <button
              className={`${button} mt-2`}
              disabled={busy}
              onClick={() =>
                void perform("resource", { id: resourceId, reservePercent })
              }
            >
              Apply reserve
            </button>
            <div className="mt-2 flex gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void perform("resource", { id: resourceId, available: false })
                }
              >
                Take offline
              </button>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void perform("resource", {
                    id: resourceId,
                    available: true,
                    optedOut: false,
                  })
                }
              >
                Restore resource
              </button>
            </div>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer text-sm">
              Manual wallet connection
            </summary>
            <div className="mt-3">
              <OperatorWalletButton />
            </div>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer text-sm">
              Pending transactions
            </summary>
            {run?.events
              .filter((e) => !["completed", "canceled"].includes(e.phase))
              .map((e) => (
                <p key={e.id} className="mt-2">
                  {e.zone} · {e.phase}
                  <br />
                  {e.error ?? "In progress"}
                </p>
              ))}
          </details>
        </div>
      )}
      {error && (
        <p role="status" className="mt-4 text-sm text-watch">
          {error}
        </p>
      )}
    </aside>
  );
}
