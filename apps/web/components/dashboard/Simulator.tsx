"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Switch } from "@/components/onboarding/controls";
import { EVENT_STATE_LABEL, type EventState } from "./HouseholdEvent";
import { useHouseholdState } from "./HouseholdState";

/**
 * Demo controls, hidden on purpose: anyone browsing the app sees nothing about simulation.
 * Tap the header label three times quickly to open the panel.
 */
const SimulatorContext = createContext<{ open: boolean; toggle: () => void; close: () => void }>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function SimulatorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return <SimulatorContext.Provider value={value}>{children}</SimulatorContext.Provider>;
}

export const useSimulator = () => useContext(SimulatorContext);

const TAPS = 3;
const WINDOW_MS = 900;

/** Props for an element that opens the simulator when tapped three times in quick succession. */
export function useSecretTap() {
  const { toggle } = useSimulator();
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t <= WINDOW_MS);
    if (taps.current.length >= TAPS) {
      taps.current = [];
      toggle();
    }
  }, [toggle]);
}

/** Household simulator: jump to any event state and force a storm. Rendered inside the household state provider. */
export function SimulatorPanel() {
  const { open, close } = useSimulator();
  const s = useHouseholdState();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <aside
      aria-label="Simulator"
      className="fixed bottom-4 right-4 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border-strong bg-background-raised p-4 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Simulator</p>
        <button
          type="button"
          onClick={close}
          aria-label="Close simulator"
          className="-m-1 rounded-md p-1 text-muted transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <label className="mt-4 block text-xs text-muted">
        Preview state
        <select
          value={s.preview}
          onChange={(e) => s.setPreview(e.target.value as EventState | "live")}
          className="mt-1.5 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        >
          <option value="live">Live (from your rules)</option>
          {(Object.keys(EVENT_STATE_LABEL) as EventState[]).map((st) => (
            <option key={st} value={st}>
              {EVENT_STATE_LABEL[st]}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Switch checked={s.plan.stormExpected} onChange={s.setStorm} label="Storm expected tonight" />
        Storm expected tonight
      </div>

      <p className="mt-4 text-xs text-muted-2">Demo controls only. Tap the header label three times to hide this.</p>
    </aside>
  );
}
