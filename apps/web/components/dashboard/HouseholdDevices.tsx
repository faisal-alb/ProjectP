"use client";

import { useState } from "react";
import { BATTERY_CHARGE_PERCENT, BATTERY_KWH, RESOURCE_ROLES, resourceType, type ResourceRole } from "@/lib/demo-data";
import { Segmented, Switch } from "@/components/onboarding/controls";
import { RESOURCE_ICON, ResourcePicker, RoleLegend, RoleTags } from "@/components/resources/ResourcePicker";
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

type RoleFilter = ResourceRole | "all";

export function HouseholdDevices() {
  const { profile, resources: keys, toggleResource, optedOut, setOptedOut, rules, state } = useHouseholdState();
  const [filter, setFilter] = useState<RoleFilter>("all");

  const resources = keys.map((key) => {
    const d = resourceType(key);
    const out = !!optedOut[key];
    const status: ResourceStatus = out ? "UNAVAILABLE" : state === "active" && key === "battery" ? "IN USE" : "READY";
    let line1 = d.spec;
    let line2 = out ? "Not shared with GridFlex" : d.offer;
    if (key === "battery") {
      line1 = `${BATTERY_CHARGE_PERCENT}% charge`;
      if (!out) line2 = `${Math.max(0, ((BATTERY_CHARGE_PERCENT - rules.reserve) / 100) * BATTERY_KWH).toFixed(1)} kWh available`;
    } else if (key === "ev") {
      line1 = `${EV_CHARGE_PERCENT}% charge`;
      if (!out) line2 = `Charging can shift until ${formatTime(profile.ev.readyBy)}`;
    } else if (key === "hvac" && !out) line2 = `Can adjust ±${profile.hvac.maxAdjustF}°F for up to ${profile.hvac.maxMinutes} min`;
    else if (key === "generator" && !out) line2 = "On standby";
    return { key, name: d.device, roles: d.roles, status, line1, line2, out };
  });

  const count = (role: ResourceRole) => resources.filter((r) => r.roles.includes(role)).length;
  // Removing the last device in a category falls back to showing all.
  const active: RoleFilter = filter !== "all" && count(filter) === 0 ? "all" : filter;
  const shown = active === "all" ? resources : resources.filter((r) => r.roles.includes(active));

  return (
    <div>
      <PageHeader title="My devices" subtitle="Choose which devices GridFlex can use during events, or add more." />

      <section aria-labelledby="connected-heading" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="connected-heading" className="tracked-caps text-xs font-medium text-muted">
            Connected · {resources.length}
          </h2>
          {resources.length > 0 && (
            <Segmented<RoleFilter>
              label="Show devices that"
              value={active}
              options={[
                { value: "all", label: `All ${resources.length}` },
                ...RESOURCE_ROLES.map((r) => ({ value: r.role, label: `${r.label} ${count(r.role)}`, disabled: count(r.role) === 0 })),
              ]}
              onChange={setFilter}
            />
          )}
        </div>

        {resources.length === 0 ? (
          <p className="panel mt-3 rounded-lg p-5 text-sm text-muted">
            No devices connected yet. Add one below to start earning.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              const Icon = RESOURCE_ICON[r.key];
              return (
                <div key={r.key} className="panel flex flex-col rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden="true" />
                      <span className="truncate">{r.name}</span>
                    </p>
                    <span className={`shrink-0 text-xs font-semibold ${RESOURCE_STYLE[r.status]}`}>{r.status}</span>
                  </div>
                  <div className="mt-2">
                    <RoleTags roles={r.roles} />
                  </div>
                  <p className="mt-3 font-mono text-2xl font-semibold tabular text-foreground">{r.line1}</p>
                  <p className="mt-1 flex-1 text-xs text-muted">{r.line2}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
                    <span className="flex items-center gap-3">
                      <Switch
                        checked={!r.out}
                        onChange={(v) => setOptedOut((o) => ({ ...o, [r.key]: !v }))}
                        label={`Share ${r.name} with GridFlex`}
                      />
                      {r.out ? "Opted out" : "Available to GridFlex"}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleResource(r.key)}
                      className="text-muted-2 transition-colors hover:text-foreground"
                      aria-label={`Remove ${r.name}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="add-heading" className="panel mt-8 rounded-lg p-5 sm:p-6">
        <h2 id="add-heading" className="text-lg font-semibold text-foreground">
          Add resources
        </h2>
        <p className="mt-1 text-sm text-muted">Each one uses, makes or stores power, and some do more than one.</p>
        <div className="mt-4">
          <RoleLegend />
        </div>
        <div className="mt-6">
          <ResourcePicker selected={keys} onToggle={toggleResource} headingLevel="h3" />
        </div>
      </section>
    </div>
  );
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}
