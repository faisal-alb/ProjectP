"use client";

import { useEffect, useRef, useState } from "react";
import { estimateFlex, type ResourceKey } from "@gridflex/shared";
import { BatteryCharging, PlugZap } from "lucide-react";
import { SliderRow, Switch } from "./controls";
import { InfoTip } from "@/components/ui/Tooltip";

const money = (n: number) => `$${n.toFixed(2)}`;

/** A device row whose icon takes the app's "active" green while the device is switched on. */
function DeviceRow({
  icon: Icon,
  label,
  hint,
  on,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" }>;
  label: string;
  hint: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon
        className={`h-5 w-5 shrink-0 transition-colors duration-200 ${on ? "text-normal" : "text-muted-2"}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Eases a number toward its target. Restarts from the value on screen, so it can be interrupted mid-flight. */
function useTween(target: number, ms = 380) {
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : ms;
    const from = shown.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      shown.current = from + (target - from) * eased;
      setValue(shown.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}

/** A working preview of the participant limits step: set a limit, watch what one event could earn. */
export function EarningsEstimator() {
  const [battery, setBattery] = useState(true);
  const [ev, setEv] = useState(false);
  const [reserve, setReserve] = useState(40);
  const [minRate, setMinRate] = useState(0.12);

  const resources: ResourceKey[] = [...(battery ? (["battery"] as const) : []), ...(ev ? (["ev"] as const) : [])];
  const estimate = estimateFlex({ resources, reservePercent: reserve, maxKwhPerEvent: 5, minRate });

  const low = useTween(estimate.earningsLow);
  const high = useTween(estimate.earningsHigh);
  const summary = resources.length === 0 ? "Turn on a device to see an estimate." : `${money(estimate.earningsLow)} to ${money(estimate.earningsHigh)} per event`;

  return (
    <div className="panel rounded-lg p-5 sm:p-6">
      <p className="tracked-caps text-[11px] font-medium text-muted">Estimate one event</p>

      <div className="mt-2 divide-y divide-border">
        <DeviceRow icon={BatteryCharging} label="Home battery" hint="Shares energy above your reserve" on={battery}>
          <Switch checked={battery} onChange={setBattery} label="Home battery" />
        </DeviceRow>
        <DeviceRow icon={PlugZap} label="EV charging" hint="Shifts a charge to later" on={ev}>
          <Switch checked={ev} onChange={setEv} label="EV charging" />
        </DeviceRow>
      </div>

      <div
        className="mt-2 grid gap-x-8 gap-y-2 border-t border-border pt-3 sm:grid-cols-2"
        style={{ "--range-fill": "var(--accent)" } as React.CSSProperties}
      >
        <SliderRow
          label="Keep in reserve"
          value={reserve}
          display={`${reserve}%`}
          min={20}
          max={80}
          step={5}
          onChange={setReserve}
        />
        <SliderRow
          label="Lowest rate"
          value={minRate}
          display={`${money(minRate)}/kWh`}
          min={0.05}
          max={0.3}
          step={0.01}
          onChange={(v) => setMinRate(Math.round(v * 100) / 100)}
        />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4 rounded-md border border-border bg-background-raised px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-muted">
          Could earn per event
          <InfoTip label="the estimate" side="bottom">
            A range from your lowest rate up to $0.25/kWh, for a one-hour event. Real events set their own rates.
          </InfoTip>
        </span>
        <span
          className={`font-mono text-xl font-semibold tabular transition-colors duration-200 ${resources.length === 0 ? "text-muted-2" : "text-accent"}`}
          aria-hidden="true"
        >
          {resources.length === 0 ? "$0.00" : `${money(low)}–${money(high)}`}
        </span>
        <span className="sr-only" role="status">
          {summary}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-2">
        Illustrative estimate for a one-hour event, from demo rates. Not a promise of payment.
      </p>
    </div>
  );
}
