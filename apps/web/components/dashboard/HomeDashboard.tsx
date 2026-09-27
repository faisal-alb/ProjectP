"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import {
  deviceCondition,
  resourceType,
  virtualAt,
  type DeviceKind,
  type DeviceState,
  type ResourceKey,
  type RunEvent,
  type RunState,
} from "@gridflex/shared";
import { AskGridFlexButton } from "@/components/voice/AskButton";
import { saveParticipantResources } from "@/app/actions";
import { RESOURCE_ICON, ResourcePicker, RoleLegend, RoleTags } from "@/components/resources/ResourcePicker";
import { InfoTip } from "@/components/ui/Tooltip";
import { KIND_OF, useHome } from "./HomeContext";
import { HouseholdEvent, type EventState, type EventView } from "./HouseholdEvent";
import { PageHeader } from "./PageHeader";
import { ForecastChart } from "./RunDashboard";
import { useRun } from "./RunProvider";
import { TxLink } from "./TxLink";

const money = (n: number) => `$${n.toFixed(2)}`;
const one = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const explorerTx = (sig?: string) => (sig ? `https://explorer.solana.com/tx/${sig}?cluster=devnet` : undefined);

const KIND_ORDER: DeviceKind[] = ["battery", "ev", "solar", "hvac", "generator"];
const KIND_LABEL: Record<DeviceKind, string> = {
  battery: "battery",
  ev: "EV",
  solar: "solar panels",
  hvac: "AC",
  generator: "generator",
};

function clock(run: RunState, minute: number) {
  return new Date(Date.parse(run.start) + minute * 60_000).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

function runHour(run: RunState) {
  return Number(
    new Date(virtualAt(run)).toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }),
  ) % 24;
}

/** The household's slice of the shared run: its own devices, the events they joined, and what they earned. */
function useHomeRun() {
  const home = useHome();
  const { run, connected } = useRun();
  if (!run) return { home, run: null, connected } as const;
  const zone = run.zones.find((z) => z.id === home.zoneId)!;
  const devices = run.devices
    .filter((d) => d.zone === home.zoneId && home.kinds.includes(d.kind))
    .filter((d) => d.kind !== "battery" || d.id.endsWith("-0"))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const ids = new Set(devices.map((d) => d.id));
  const kindOf = new Map(devices.map((d) => [d.id, d.kind]));
  const events = run.events
    .filter((e) => e.zone === home.zoneId)
    .map((e) => ({ ...e, commitments: e.commitments.filter((c) => ids.has(c.resourceId)) }))
    .filter((e) => e.commitments.length > 0)
    .sort((a, b) => a.startMinute - b.startMinute);
  const paidOf = (e: RunEvent) => e.commitments.reduce((s, c) => s + Number(c.paidBase ?? 0), 0) / 1e6;
  const paid = events.reduce((s, e) => s + paidOf(e), 0);
  const deliveredKwh = events.reduce((s, e) => s + e.commitments.reduce((t, c) => t + c.deliveredWh, 0), 0) / 1000;
  const battery = devices.find((d) => d.kind === "battery");
  return { home, run, connected, zone, devices, events, kindOf, paid, paidOf, deliveredKwh, battery } as const;
}

type Loaded = Exclude<ReturnType<typeof useHomeRun>, { run: null }>;

function Waiting({ title, connected }: { title: string; connected: boolean }) {
  return (
    <div>
      <PageHeader title={title} subtitle={connected ? "Waiting for the energy day to begin." : "Connecting to GridFlex…"} />
    </div>
  );
}

function stateOf(e: RunEvent): EventState {
  if (e.phase === "scheduled" || e.phase === "committing") return "accepted";
  if (e.phase === "dispatching") return "active";
  if (e.phase === "verifying" || e.phase === "settling") return "verifying";
  const committed = e.commitments.reduce((s, c) => s + c.committedWh, 0);
  const delivered = e.commitments.reduce((s, c) => s + c.deliveredWh, 0);
  return delivered < committed * 0.95 ? "partial" : "settled";
}

function devicesIn(e: RunEvent, kindOf: Map<string, DeviceKind>) {
  const kinds = [...new Set(e.commitments.map((c) => kindOf.get(c.resourceId)).filter(Boolean))] as DeviceKind[];
  const names = kinds.sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)).map((k) => KIND_LABEL[k]);
  if (names.length <= 1) return `Your ${names[0] ?? "devices"}`;
  return `Your ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function eventView(s: Loaded, e: RunEvent): EventView {
  const { run, home, zone, battery, kindOf } = s;
  const committedWh = e.commitments.reduce((t, c) => t + c.committedWh, 0);
  const deliveredWh = e.commitments.reduce((t, c) => t + c.deliveredWh, 0);
  // Pay-as-bid: each device is paid its own offer price, so show the blended rate.
  const rate = committedWh > 0 ? e.commitments.reduce((t, c) => t + c.price * c.committedWh, 0) / committedWh : e.price;
  const paid = s.paidOf(e);
  const batteryWh = e.commitments.find((c) => kindOf.get(c.resourceId) === "battery")?.committedWh ?? 0;
  const pct = battery ? Math.round((battery.energyKwh / battery.capacityKwh) * 100) : -1;
  const decision = run.decisions.find((d) => d.id === e.decisionId);
  const forecast = decision?.horizonKw[0];
  const env = run.environment;
  const drivers = [
    forecast !== undefined ? `Forecast ${one(forecast)} kW vs ${one(zone.capacityKw)} kW limit` : undefined,
    decision && decision.pSpike >= 0.5 ? `Price spike risk ${Math.round(decision.pSpike * 100)}%` : undefined,
    env ? `${Math.round(env.tempF)}°F` : undefined,
  ].filter(Boolean) as string[];
  return {
    state: stateOf(e),
    auto: true,
    zone: home.zoneName,
    window: `${clock(run, e.startMinute)} – ${clock(run, e.endMinute)}`,
    requestedKwh: committedWh / 1000,
    deliveredKwh: deliveredWh / 1000,
    rate,
    batteryAfter: battery && batteryWh > 0 ? Math.max(0, Math.round(pct - (batteryWh / 1000 / battery.capacityKwh) * 100)) : -1,
    reserve: Math.round((battery?.reserve ?? 0.2) * 100),
    minutesLeft: Math.max(0, e.endMinute - run.minute),
    reliefPercent: e.requiredKw > 0 ? Math.min(100, Math.round((zone.reliefKw / e.requiredKw) * 100)) : 0,
    paidLabel: paid > 0 ? money(paid) : undefined,
    receiptUrl: explorerTx(e.commitments.find((c) => c.signature)?.signature),
    why: `${home.zoneName} was forecast to go past what its local lines can safely carry, so GridFlex asked nearby devices to ease off or share energy. ${devicesIn(e, kindOf)} ${e.commitments.length > 1 ? "are" : "is"} on the same street, so ${e.commitments.length > 1 ? "they" : "it"} can help.`,
    drivers,
  };
}

/* ---------- Overview ---------- */

type GridStatus = "NORMAL" | "WATCH" | "EVENT ACTIVE";
const GRID_STYLE: Record<GridStatus, string> = { NORMAL: "text-normal", WATCH: "text-watch", "EVENT ACTIVE": "text-accent" };

export function HomeOverview() {
  const s = useHomeRun();
  if (!s.run) return <Waiting title="My energy" connected={s.connected} />;
  const { run, home, zone, battery, events, devices } = s;

  const current = events.find((e) => e.phase !== "completed" && e.phase !== "canceled") ?? events.filter((e) => e.phase === "completed").at(-1);
  const view = current ? eventView(s, current) : undefined;
  const helpingNow = events.some((e) => e.phase === "dispatching");
  const status: GridStatus = helpingNow ? "EVENT ACTIVE" : zone.status === "normal" ? "NORMAL" : "WATCH";

  const hour = runHour(run);
  const greeting = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const availableKwh = battery ? Math.max(0, battery.energyKwh - battery.reserve * battery.capacityKwh) : 0;
  const ev = devices.find((d) => d.kind === "ev");
  const paidToday = s.paid;

  return (
    <div>
      <PageHeader
        title={greeting}
        subtitle={
          helpingNow
            ? "Your energy is supporting the grid right now."
            : devices.length
              ? "Your energy is ready to support the grid."
              : "Add a device to start earning."
        }
      >
        <AskGridFlexButton />
      </PageHeader>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile
          label="Your available flex"
          info="Energy above your reserve that GridFlex could use in the next event."
          href="/dashboard/devices"
          linkLabel="Devices"
        >
          <p className="font-mono text-3xl font-semibold tabular text-foreground">{availableKwh.toFixed(1)} kWh</p>
          <p className="mt-1 text-xs text-muted">
            {battery
              ? `From your battery, above your ${Math.round(battery.reserve * 100)}% reserve${ev ? " · EV charging can shift" : ""}`
              : ev
                ? "EV charging can shift to later"
                : "No battery connected"}
          </p>
        </Tile>
        <Tile label="Earned today" href="/dashboard/earnings" linkLabel="History">
          <p className="font-mono text-3xl font-semibold tabular text-foreground">{money(paidToday)}</p>
          <p className="mt-1 text-xs text-muted">
            {events.filter((e) => s.paidOf(e) > 0).length} paid events · test USDC
          </p>
        </Tile>
        <Tile
          label={`Grid status · ${home.zoneName} ${home.feeder}`}
          info="How close your neighborhood's demand is to what its local lines can safely carry. When it gets high, GridFlex asks nearby devices, like yours, to help."
        >
          <p className={`text-3xl font-semibold tracking-tight ${GRID_STYLE[status]}`}>{status}</p>
          <p className="mt-1 text-xs text-muted">
            Demand {one(zone.loadKw)} of {one(zone.capacityKw)} kW
          </p>
        </Tile>
      </div>

      <div className="mt-6 space-y-6">
        {view ? (
          <HouseholdEvent ev={view} />
        ) : (
          <HouseholdEvent
            ev={{ state: "none", auto: true, zone: home.zoneName, window: "", requestedKwh: 0, deliveredKwh: 0, rate: 0, batteryAfter: -1, reserve: 0, minutesLeft: 0, reliefPercent: 0 }}
          />
        )}

        <section aria-labelledby="neighborhood-heading" className="panel rounded-lg p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="neighborhood-heading" className="text-lg font-semibold text-foreground">
              {home.zoneName} today
            </h2>
            <span className={`text-sm ${zone.status === "high" ? "text-risk" : zone.status === "watch" ? "text-watch" : "text-normal"}`}>
              {zone.status === "high" ? "Needs help" : zone.status === "watch" ? "Getting busy" : "Plenty of room"}
            </span>
          </div>
          {run.series?.length ? (
            <div className="max-w-2xl">
              <ForecastChart run={run} zone={home.zoneId} />
              <p className="mt-2 text-xs text-muted">Green: your neighborhood&rsquo;s demand · Blue: GridFlex forecast · Dashed: safe limit</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">The chart fills in as the day plays out.</p>
          )}
        </section>

        <p className="text-sm text-muted">
          AutoFlex is <span className="font-medium text-foreground">on</span>
          {battery && (
            <>
              {" "}and keeps at least{" "}
              <span className="font-mono font-semibold tabular text-foreground">{Math.round(battery.reserve * 100)}%</span> in your
              battery
            </>
          )}
          .{" "}
          <Link href="/dashboard/settings" className="text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground">
            See your rules
          </Link>
        </p>
        <DemoNote run={run} />
      </div>
    </div>
  );
}

function Tile({ label, info, href, linkLabel, children }: { label: string; info?: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className="tracked-caps">{label}</span>
          {info && <InfoTip label={label}>{info}</InfoTip>}
        </p>
        {href && (
          <Link href={href} className="-my-0.5 inline-flex shrink-0 items-center gap-0.5 text-xs text-muted transition-colors hover:text-foreground">
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DemoNote({ run }: { run: RunState }) {
  const date = new Date(run.start).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" });
  return (
    <p className="border-t border-border pt-4 text-xs text-muted-2">
      Replaying {date} in Austin with modeled home devices. Payments are test USDC on Solana devnet, not real money.
    </p>
  );
}

/* ---------- Devices ---------- */

type DeviceStatus = "READY" | "HELPING NOW" | "UNAVAILABLE" | "OPTED OUT" | "AWAY";
const DEVICE_STYLE: Record<DeviceStatus, string> = {
  READY: "text-normal",
  "HELPING NOW": "text-accent",
  UNAVAILABLE: "text-muted",
  "OPTED OUT": "text-muted-2",
  AWAY: "text-muted",
};

function deviceLines(d: DeviceState, run: RunState): [string, string] {
  const pct = Math.round((d.energyKwh / d.capacityKwh) * 100);
  switch (d.kind) {
    case "battery":
      return [`${pct}% charged`, `${one(Math.max(0, d.energyKwh - d.reserve * d.capacityKwh))} kWh above your ${Math.round(d.reserve * 100)}% reserve`];
    case "ev":
      if (d.away) return [`${pct}% charged`, `Back on the charger around ${clock(run, 1080)}`];
      return [`${pct}% charged`, `Needs ${one(d.targetKwh)} kWh by ${clock(run, d.departureMinute)} · charging can wait`];
    case "hvac":
      return [`${Math.round(d.temperatureF)}°F inside`, `Never lets it go above ${Math.round(d.comfortMaxF)}°F`];
    case "solar":
      return [`Up to ${one(d.maxKw)} kW`, "Sends extra output to the grid when asked"];
    case "generator":
      return [`${one(d.fuelKwh)} kWh of fuel`, d.powerKw > 0 ? "Running for the grid" : "On standby"];
  }
}

export function HomeDevices() {
  const s = useHomeRun();
  if (!s.run)
    return (
      <>
        <Waiting title="My devices" connected={s.connected} />
        <AddDevices />
      </>
    );
  const { run, devices, events, home } = s;
  const earnedBy = (id: string) =>
    events.flatMap((e) => e.commitments).filter((c) => c.resourceId === id).reduce((t, c) => t + Number(c.paidBase ?? 0), 0) / 1e6;
  const eventsBy = (id: string) => events.filter((e) => e.commitments.some((c) => c.resourceId === id)).length;
  const notInRun = home.picked.filter((k) => !KIND_OF[k]);

  return (
    <div>
      <PageHeader title="My devices" subtitle="What GridFlex can use when your neighborhood needs help, or add more." />
      <section aria-labelledby="connected-heading" className="mt-6">
        <h2 id="connected-heading" className="tracked-caps text-xs font-medium text-muted">
          Connected · {devices.length}
        </h2>
        {devices.length === 0 ? (
          <p className="panel mt-3 rounded-lg p-5 text-sm text-muted">
            None of your devices take part in today&rsquo;s run yet. Add a home battery, EV, AC, solar panels or a generator below to start earning.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => {
              const key = home.resources[d.kind] ?? d.kind;
              const type = resourceType(key);
              const Icon = RESOURCE_ICON[key];
              const status: DeviceStatus = d.optedOut
                ? "OPTED OUT"
                : !d.available || d.status === "Unavailable" || (d.kind === "generator" && d.fuelKwh <= 0)
                  ? "UNAVAILABLE"
                  : d.status === "Delivering"
                    ? "HELPING NOW"
                    : d.kind === "ev" && d.away
                      ? "AWAY"
                      : "READY";
              const [line1, line2] = deviceLines(d, run);
              const condition = deviceCondition(run, d);
              const earned = earnedBy(d.id);
              return (
                <div key={d.id} className="panel flex flex-col rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} aria-hidden="true" />
                      <span className="truncate">{type.device}</span>
                    </p>
                    <span className={`shrink-0 text-xs font-semibold ${DEVICE_STYLE[status]}`}>{status}</span>
                  </div>
                  <div className="mt-2">
                    <RoleTags roles={type.roles} />
                  </div>
                  <p className="mt-3 font-mono text-2xl font-semibold tabular text-foreground">{line1}</p>
                  <p className="mt-1 text-xs text-muted">{line2}</p>
                  <p className="mt-2 flex-1 text-xs text-watch" aria-live="polite">
                    {condition}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted">
                    <span>Helped in {eventsBy(d.id)} {eventsBy(d.id) === 1 ? "event" : "events"} today</span>
                    <span className="font-mono tabular text-normal">+{money(earned)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {notInRun.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Also saved: {notInRun.map((k) => resourceType(k).name).join(", ")}. GridFlex can&rsquo;t call on{" "}
            {notInRun.length === 1 ? "it" : "these"} in today&rsquo;s run yet.
          </p>
        )}
      </section>
      <AddDevices />
      <div className="mt-8">
        <DemoNote run={run} />
      </div>
    </div>
  );
}

const toggled = (keys: ResourceKey[], key: ResourceKey) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);

/** The same picker as onboarding. Each change is saved to the profile, and the run picks it up right away. */
function AddDevices() {
  const { picked } = useHome();
  const [selected, toggleSelected] = useOptimistic(picked, toggled);
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const onToggle = (key: ResourceKey) => {
    const next = toggled(selected, key);
    setFailed(false);
    startTransition(async () => {
      toggleSelected(key);
      const r = await saveParticipantResources(next).catch(() => ({ ok: false as const }));
      if (!r.ok) setFailed(true);
    });
  };

  return (
    <section aria-labelledby="add-heading" className="panel mt-8 rounded-lg p-5 sm:p-6">
      <h2 id="add-heading" className="text-lg font-semibold text-foreground">
        Add devices
      </h2>
      <p className="mt-1 text-sm text-muted">Each one uses, makes or stores power, and some do more than one.</p>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-watch">
          Couldn&rsquo;t save that change. Try again.
        </p>
      )}
      <div className="mt-4">
        <RoleLegend />
      </div>
      <div className="mt-6">
        <ResourcePicker selected={selected} onToggle={onToggle} headingLevel="h3" />
      </div>
    </section>
  );
}

/* ---------- Earnings ---------- */

const STATUS_LABEL: Record<EventState, { label: string; cls: string }> = {
  none: { label: "", cls: "" },
  upcoming: { label: "Upcoming", cls: "text-muted" },
  awaiting: { label: "Waiting", cls: "text-watch" },
  accepted: { label: "Accepted", cls: "text-muted" },
  active: { label: "Helping now", cls: "text-accent" },
  verifying: { label: "Verifying", cls: "text-accent" },
  settled: { label: "Paid", cls: "text-normal" },
  partial: { label: "Paid", cls: "text-normal" },
  declined: { label: "Declined", cls: "text-muted" },
};

export function HomeEarnings() {
  const s = useHomeRun();
  if (!s.run) return <Waiting title="Earnings" connected={s.connected} />;
  const { run, events, kindOf, home } = s;
  const shown = events.filter((e) => e.phase !== "canceled").reverse();
  const paidCount = events.filter((e) => s.paidOf(e) > 0).length;

  return (
    <div>
      <PageHeader title="Earnings" subtitle="What you've been paid for supporting the grid today.">
        <AskGridFlexButton prompt="How much have I earned today, and where did it come from?" label="Ask" className="!px-3 !py-1.5 text-xs" />
      </PageHeader>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Total label="Earned today" value={money(s.paid)} accent />
        <Total label="Energy shared" value={`${one(s.deliveredKwh)} kWh`} />
        <Total label="Paid events" value={String(paidCount)} />
      </dl>

      <section aria-labelledby="earnings-heading" className="panel mt-6 rounded-lg p-5">
        <h2 id="earnings-heading" className="tracked-caps text-xs font-medium text-muted">
          Recent earnings
        </h2>
        {shown.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing yet. When {home.zoneName} needs help and your devices join in, payments show up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {shown.map((e) => {
              const st = stateOf(e);
              const paid = s.paidOf(e);
              const kwh = e.commitments.reduce((t, c) => t + c.deliveredWh, 0) / 1000;
              const receipt = explorerTx(e.commitments.find((c) => c.signature)?.signature);
              return (
                <li key={e.id} className="flex items-baseline justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {devicesIn(e, kindOf)} helped {home.zoneName}
                    </span>
                    <span className="block text-xs text-muted">
                      {clock(run, e.startMinute)} · {one(kwh)} kWh · <span className={STATUS_LABEL[st].cls}>{STATUS_LABEL[st].label}</span>
                      {receipt && (
                        <>
                          {" · "}
                          <TxLink href={receipt} label="Receipt" />
                        </>
                      )}
                    </span>
                  </span>
                  <span className={`shrink-0 font-mono font-semibold tabular ${paid > 0 ? "text-normal" : "text-muted"}`}>
                    {paid > 0 ? `+${money(paid)}` : "Pending"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <div className="mt-8">
        <DemoNote run={run} />
      </div>
    </div>
  );
}

function Total({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel rounded-lg p-5">
      <dt className="tracked-caps text-xs font-medium text-muted">{label}</dt>
      <dd className={`mt-3 font-mono text-3xl font-semibold tabular ${accent ? "text-normal" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

/* ---------- Rules ---------- */

export function HomeRules() {
  const s = useHomeRun();
  if (!s.run) return <Waiting title="Your rules" connected={s.connected} />;
  const { run, devices, home } = s;
  const find = (k: DeviceKind) => devices.find((d) => d.kind === k);
  const battery = find("battery");
  const ev = find("ev");
  const hvac = find("hvac");
  const minPrice = devices.length ? Math.min(...devices.map((d) => d.minPrice)) : undefined;

  const rules: { title: string; body: string; value: string }[] = [
    { title: "AutoFlex", body: "Joins events that match your rules, so you never have to place bids.", value: "On" },
    ...(minPrice !== undefined
      ? [{ title: "Minimum pay", body: "GridFlex only uses a device when the event pays at least its offer price.", value: `From $${minPrice.toFixed(2)}/kWh` }]
      : []),
    ...(battery
      ? [
          { title: "Battery reserve", body: "Always kept in your battery for your own home.", value: `${Math.round(battery.reserve * 100)}%` },
          { title: "Battery sharing", body: `Up to ${one(battery.maxKwhPerEvent)} kWh per event, at most ${battery.maxEventsPerDay} events a day.`, value: `${one(battery.maxKw)} kW max` },
        ]
      : []),
    ...(ev ? [{ title: "EV ready by", body: `Charging can pause, but your car will have ${one(ev.targetKwh)} kWh when you leave.`, value: clock(run, ev.departureMinute) }] : []),
    ...(hvac ? [{ title: "Comfort limit", body: "AC can ease off for a while, but never past this temperature.", value: `${Math.round(hvac.comfortMaxF)}°F` }] : []),
    { title: "Payouts", body: "Paid to your GridFlex wallet as soon as delivery is verified.", value: "USDC · devnet" },
  ];

  return (
    <div>
      <PageHeader title="Your rules" subtitle="GridFlex only uses your devices inside these limits." />
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.title} className="panel flex items-start justify-between gap-4 rounded-lg p-5">
            <div>
              <p className="font-medium text-foreground">{r.title}</p>
              <p className="mt-1 text-sm text-muted">{r.body}</p>
            </div>
            <p className="shrink-0 font-mono text-sm font-semibold tabular text-foreground">{r.value}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        These are the limits in effect for today&rsquo;s shared energy day in {home.zoneName}, so everyone watching sees the same results.
      </p>
      <div className="mt-8">
        <DemoNote run={run} />
      </div>
    </div>
  );
}

