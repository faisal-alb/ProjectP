"use client";

import { useId, useState } from "react";
import {
  AirVent,
  Bath,
  Battery,
  BatteryCharging,
  BatteryFull,
  Bike,
  Building2,
  Bus,
  Car,
  Check,
  Cpu,
  Droplet,
  Droplets,
  Factory,
  Fan,
  Flame,
  Fuel,
  Lightbulb,
  Plug,
  PlugZap,
  Plus,
  Refrigerator,
  Search,
  Shirt,
  ShowerHead,
  Snowflake,
  SolarPanel,
  Sprout,
  Sun,
  ThermometerSnowflake,
  Utensils,
  Warehouse,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  RESOURCE_KEYS,
  RESOURCE_ROLES,
  matchesResource,
  resourceType,
  type ResourceKey,
  type ResourceRole,
} from "@gridflex/shared";
import { ChoiceTile, Segmented } from "@/components/onboarding/controls";

type Icon = typeof Battery;

export const RESOURCE_ICON: Record<ResourceKey, Icon> = {
  battery: Battery,
  solar: Sun,
  ev: Car,
  hvac: Snowflake,
  waterHeater: ShowerHead,
  generator: Zap,
  solarBattery: SolarPanel,
  bidirectionalEv: PlugZap,
  heatPump: Fan,
  heatPumpWaterHeater: Droplets,
  miniSplit: AirVent,
  poolPump: Waves,
  hotTub: Bath,
  dryer: Shirt,
  washer: Droplet,
  dishwasher: Utensils,
  fridge: Refrigerator,
  dehumidifier: Droplets,
  wellPump: Droplet,
  ebike: Bike,
  powerStation: BatteryCharging,
  ups: Plug,
  portableGenerator: Fuel,
  windTurbine: Wind,
  fuelCell: Flame,
  building: Building2,
  commercialBattery: BatteryFull,
  evFleet: Bus,
  coldStorage: ThermometerSnowflake,
  thermalStorage: Warehouse,
  lighting: Lightbulb,
  industrialProcess: Factory,
  irrigation: Sprout,
  dataCenter: Cpu,
  chp: Flame,
  solarCarport: SolarPanel,
};

const ROLE_LABEL = Object.fromEntries(RESOURCE_ROLES.map((r) => [r.role, r.label])) as Record<ResourceRole, string>;

/** Neutral tags for what a resource does: consumes, produces, stores. */
export function RoleTags({ roles }: { roles: ResourceRole[] }) {
  return (
    <span className="flex flex-wrap gap-1" aria-label={`Category: ${roles.map((r) => ROLE_LABEL[r]).join(", ")}`}>
      {roles.map((r) => (
        <span key={r} className="rounded-sm border border-border px-1.5 py-px text-[11px] leading-4 text-muted" aria-hidden="true">
          {ROLE_LABEL[r]}
        </span>
      ))}
    </span>
  );
}

/** What each category means, once, above the choices. */
export function RoleLegend() {
  return (
    <dl className="grid gap-x-5 gap-y-2 rounded-md border border-border bg-background-raised p-3 text-xs sm:grid-cols-3">
      {RESOURCE_ROLES.map((r) => (
        <div key={r.role}>
          <dt className="font-medium text-foreground">{r.label}</dt>
          <dd className="mt-0.5 text-muted">{r.description}</dd>
        </div>
      ))}
    </dl>
  );
}

const COMMON = RESOURCE_KEYS.filter((k) => resourceType(k).common);
const MORE = RESOURCE_KEYS.filter((k) => !resourceType(k).common);

type RoleFilter = ResourceRole | "all";

/**
 * Most common resources as tiles, then a search over the whole catalog.
 * Used by onboarding and by the dashboard's Devices page.
 */
export function ResourcePicker({
  selected,
  onToggle,
  headingLevel = "h2",
}: {
  selected: ResourceKey[];
  onToggle: (key: ResourceKey) => void;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");

  const searching = query.trim() !== "" || role !== "all";
  const results = (searching ? RESOURCE_KEYS : MORE).filter(
    (k) => matchesResource(k, query) && (role === "all" || resourceType(k).roles.includes(role)),
  );
  const addedFromSearch = selected.filter((k) => !resourceType(k).common);

  return (
    <div className="space-y-8">
      <div>
        <Heading className="text-sm font-semibold text-foreground">Most common</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2" role="group" aria-label="Most common resources">
          {COMMON.map((key) => {
            const r = resourceType(key);
            return (
              <ChoiceTile
                key={key}
                icon={RESOURCE_ICON[key]}
                title={r.name}
                description={r.description}
                meta={<RoleTags roles={r.roles} />}
                selected={selected.includes(key)}
                onClick={() => onToggle(key)}
              />
            );
          })}
        </div>
      </div>

      <div>
        <Heading className="text-sm font-semibold text-foreground">Find more resources</Heading>
        <p className="mt-1 text-xs text-muted">
          {RESOURCE_KEYS.length} kinds, from pool pumps to fleet depots. Search by name or brand.
        </p>

        {addedFromSearch.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Added from search">
            {addedFromSearch.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onToggle(key)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface py-1 pr-2 pl-2.5 text-xs font-medium text-foreground transition-colors hover:border-foreground/40"
                  aria-label={`Remove ${resourceType(key).name}`}
                >
                  {resourceType(key).name}
                  <X className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-col items-start gap-3">
          <div className="relative w-full">
            <label htmlFor={searchId} className="sr-only">
              Search resources
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-2" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, e.g. pool pump, Generac, heat pump"
              className="w-full rounded-md border border-border bg-background-raised py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-2 focus-visible:border-border-strong"
            />
          </div>
          <Segmented<RoleFilter>
            label="Filter by category"
            value={role}
            options={[{ value: "all", label: "All" }, ...RESOURCE_ROLES.map((r) => ({ value: r.role, label: r.label }))]}
            onChange={setRole}
            gridOnMobile
          />
        </div>

        <p className="sr-only" aria-live="polite">
          {results.length} {results.length === 1 ? "resource" : "resources"} found
        </p>

        {results.length === 0 ? (
          <p className="mt-3 rounded-md border border-border px-3 py-4 text-sm text-muted">
            Nothing matches &ldquo;{query.trim()}&rdquo;. Try another name, or add it later from your dashboard.
          </p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border" aria-label="Resources">
            {results.map((key) => {
              const r = resourceType(key);
              const on = selected.includes(key);
              const Icon = RESOURCE_ICON[key];
              return (
                <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted">{r.description}</p>
                    <div className="mt-1.5">
                      <RoleTags roles={r.roles} />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${on ? "Remove" : "Add"} ${r.name}`}
                    onClick={() => onToggle(key)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      on ? "border-border-strong bg-surface text-foreground" : "border-border text-muted hover:border-border-strong hover:text-foreground"
                    }`}
                  >
                    {on ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                    {on ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
