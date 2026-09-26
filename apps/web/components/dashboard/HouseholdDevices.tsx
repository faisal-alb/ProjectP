"use client";

import { BATTERY_CHARGE_PERCENT, BATTERY_KWH, demoDevices } from "@/lib/demo-data";
import { Switch } from "@/components/onboarding/controls";
import { useHouseholdState } from "./HouseholdState";
import { PageHeader } from "./PageHeader";

const EV_CHARGE_PERCENT = 72;

type ResourceStatus = "READY" | "IN USE" | "UNAVAILABLE" | "OFFLINE" | "NEEDS ATTENTION";
const RESOURCE_STYLE: Record<ResourceStatus, string> = {
  READY: "text-normal",
  "IN USE": "text-accent",
  UNAVAILABLE: "text-muted",
  OFFLINE: "text-muted-2",
  "NEEDS ATTENTION": "text-watch",
};

export function HouseholdDevices() {
  const { profile, optedOut, setOptedOut, rules, state } = useHouseholdState();

  const resources = profile.resources.map((key) => {
    const d = demoDevices[key];
    const out = !!optedOut[key];
    const status: ResourceStatus = out ? "UNAVAILABLE" : state === "active" && key === "battery" ? "IN USE" : "READY";
    let line1 = d.spec;
    let line2 = "";
    if (key === "battery") {
      line1 = `${BATTERY_CHARGE_PERCENT}% charge`;
      line2 = out ? "Not shared with GridFlex" : `${Math.max(0, ((BATTERY_CHARGE_PERCENT - rules.reserve) / 100) * BATTERY_KWH).toFixed(1)} kWh available`;
    } else if (key === "ev") {
      line1 = `${EV_CHARGE_PERCENT}% charge`;
      line2 = out ? "Not shared with GridFlex" : `Charging can shift until ${formatTime(profile.ev.readyBy)}`;
    } else if (key === "solar") line2 = "Adds to what your home can share";
    else if (key === "hvac") line2 = `Can adjust ±${profile.hvac.maxAdjustF}°F for up to ${profile.hvac.maxMinutes} min`;
    else if (key === "generator") line2 = "On standby";
    else line2 = "Shiftable load";
    return { key, name: d.device, status, line1, line2, out };
  });

  return (
    <div>
      <PageHeader title="My devices" subtitle="Choose which devices GridFlex can use during events." />

      <section aria-label="Devices" className="mt-6">
        {resources.length === 0 ? (
          <p className="panel rounded-lg p-5 text-sm text-muted">
            No devices connected yet. Add a battery or EV to start earning.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((r) => (
              <div key={r.key} className="panel rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <span className={`shrink-0 text-xs font-semibold ${RESOURCE_STYLE[r.status]}`}>{r.status}</span>
                </div>
                <p className="mt-3 font-mono text-2xl font-semibold tabular text-foreground">{r.line1}</p>
                <p className="mt-1 text-xs text-muted">{r.line2}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                  <span>{r.out ? "Opted out" : "Available to GridFlex"}</span>
                  <Switch
                    checked={!r.out}
                    onChange={(v) => setOptedOut((o) => ({ ...o, [r.key]: !v }))}
                    label={`Share ${r.name} with GridFlex`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}
