"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  DEMO_GENERATOR,
  DEMO_SOLAR_SURPLUS_KWH,
  buildPowerPlan,
  windowHours,
  type PlanPreference,
} from "@gridflex/shared";
import {
  BATTERY_CHARGE_PERCENT,
  BATTERY_KWH,
  BATTERY_MAX_DISCHARGE_KW,
  EV_SHIFTABLE_KW,
  demoDevices,
  household,
  zones,
  type ResourceKey,
} from "@/lib/demo-data";
import type { Emergency, ParticipantProfile } from "@/lib/profile";
import { Segmented, SliderRow, Switch, secondaryButton } from "@/components/onboarding/controls";
import { AskGridFlexButton } from "@/components/voice/AskButton";
import { useHousehold } from "./HouseholdProvider";
import { EVENT_STATE_LABEL, HouseholdEvent, type EventState } from "./HouseholdEvent";
import { PowerPlan } from "./PowerPlan";
import { TxLink } from "./TxLink";
import { usePublishVoiceSnapshot } from "@/lib/voice-snapshot";

const money = (n: number) => `$${n.toFixed(2)}`;
const price = (n: number) => `$${n.toFixed(2)}/kWh`;
const EV_CHARGE_PERCENT = 72;
/** Earned before this month; the demo has no ledger to sum. */
const EARLIER_EARNINGS = 61.59;

type GridStatus = "NORMAL" | "WATCH" | "EVENT ACTIVE" | "EMERGENCY";
const GRID_STYLE: Record<GridStatus, string> = {
  NORMAL: "text-normal",
  WATCH: "text-watch",
  "EVENT ACTIVE": "text-accent",
  EMERGENCY: "text-risk",
};
const EMERGENCY_LABEL: Record<Emergency, string> = { ask: "Manual approval", allow: "Automatic", never: "Never" };

type ResourceStatus = "READY" | "IN USE" | "UNAVAILABLE" | "OFFLINE" | "NEEDS ATTENTION";
const RESOURCE_STYLE: Record<ResourceStatus, string> = {
  READY: "text-normal",
  "IN USE": "text-accent",
  UNAVAILABLE: "text-muted",
  OFFLINE: "text-muted-2",
  "NEEDS ATTENTION": "text-watch",
};

const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today";

export function HouseholdView({ zone, feeder, profile }: { zone: string; feeder: string; profile: ParticipantProfile }) {
  const live = useHousehold();
  const [rules, setRules] = useState({
    autoFlex: profile.autoFlex,
    reserve: profile.reservePercent,
    minRate: profile.minRate,
    maxKwh: profile.maxKwhPerEvent,
    maxEvents: profile.maxEventsPerDay,
    emergency: profile.emergency,
  });
  const [managing, setManaging] = useState(false);
  const [optedOut, setOptedOut] = useState<Partial<Record<ResourceKey, boolean>>>({});
  const [choice, setChoice] = useState<"joined" | "declined" | null>(null);
  // Demo control: lets you see every event state without waiting for one.
  const [preview, setPreview] = useState<EventState | "live">("live");
  // Demo controls for the power plan: how the user wants to optimise, and a storm override.
  const [planPreference, setPlanPreference] = useState<PlanPreference>("balanced");
  const [storm, setStorm] = useState(false);

  const has = (k: ResourceKey) => profile.resources.includes(k);
  const batteryIn = has("battery") && !optedOut.battery;
  const evIn = has("ev") && !optedOut.ev;

  const rate = household.eventPricePerKwh;
  const availableKwh = batteryIn
    ? Math.max(0, ((BATTERY_CHARGE_PERCENT - rules.reserve) / 100) * BATTERY_KWH)
    : 0;
  const requestedKwh = Math.round(Math.min(rules.maxKwh, availableKwh, BATTERY_MAX_DISCHARGE_KW) * 10) / 10;
  const batteryAfter = Math.round(BATTERY_CHARGE_PERCENT - (requestedKwh / BATTERY_KWH) * 100);

  const paidTonight = live?.tonight?.phase === "settled" ? live.tonight : null;
  const rateOk = rate >= rules.minRate;

  // What would happen tonight, from the rules alone.
  let derived: EventState;
  if (paidTonight) derived = "settled";
  else if (requestedKwh <= 0) derived = "none";
  else if (choice === "declined") derived = "declined";
  else if (choice === "joined") derived = "accepted";
  else if (rules.autoFlex && rateOk) derived = "accepted";
  else derived = "awaiting";
  const state = preview === "live" ? derived : preview;
  const auto = choice !== "joined" && rules.autoFlex && rateOk;

  // Figures for the states past "accepted" are illustrative.
  const deliveredKwh =
    state === "active" ? Math.round(requestedKwh * 0.6 * 10) / 10
    : state === "partial" ? Math.round(requestedKwh * 0.7 * 10) / 10
    : state === "verifying" || state === "settled" ? requestedKwh
    : 0;
  const settledLive = state === "settled" && paidTonight;
  const eventEarned = deliveredKwh * rate;

  const gridStatus: GridStatus =
    state === "active" ? "EVENT ACTIVE" : state === "upcoming" || state === "awaiting" || state === "accepted" || state === "declined" ? "WATCH" : "NORMAL";
  const z = zones.find((x) => x.name === zone) ?? zones[0];

  const paidHistory = household.history.filter((h) => h.status === "paid");
  const livePayouts = live?.payouts ?? [];
  const monthBase =
    paidHistory.reduce((s, h) => s + h.kwh * h.pricePerKwh, 0) +
    livePayouts.reduce((s, p) => s + Number(p.amount.base) / 1e6, 0);
  // A settled preview counts toward today unless the live payout is already in the ledger.
  const todayExtra = (state === "settled" || state === "partial") && !settledLive ? eventEarned : 0;
  const today = settledLive ? Number(paidTonight!.payout?.base ?? 0) / 1e6 : todayExtra;
  const month = monthBase + todayExtra;
  const lifetime = month + EARLIER_EARNINGS;

  const plan = buildPowerPlan({
    preference: planPreference,
    stormExpected: storm,
    event: { pricePerKwh: rate, durationHours: windowHours(household.eventWindow) },
    battery: batteryIn
      ? {
          kwh: BATTERY_KWH,
          chargePercent: BATTERY_CHARGE_PERCENT,
          maxDischargeKw: BATTERY_MAX_DISCHARGE_KW,
          reservePercent: rules.reserve,
          maxKwhPerEvent: rules.maxKwh,
          minRatePerKwh: rules.minRate,
        }
      : undefined,
    solar: has("solar") && !optedOut.solar ? { surplusKwh: DEMO_SOLAR_SURPLUS_KWH } : undefined,
    generator: has("generator") && !optedOut.generator ? DEMO_GENERATOR : undefined,
    ev: evIn ? { shiftableKw: EV_SHIFTABLE_KW, delayMinutes: profile.ev.delayMinutes } : undefined,
    hvac: has("hvac") && !optedOut.hvac ? profile.hvac : undefined,
  });

  usePublishVoiceSnapshot({
    zone,
    hasBattery: batteryIn,
    batteryKwh: BATTERY_KWH,
    chargePercent: BATTERY_CHARGE_PERCENT,
    maxDischargeKw: BATTERY_MAX_DISCHARGE_KW,
    autoFlex: rules.autoFlex,
    reservePercent: rules.reserve,
    minPricePerKwh: rules.minRate,
    maxKwhPerEvent: rules.maxKwh,
    availableKwh,
    event: {
      window: household.eventWindow,
      pricePerKwh: rate,
      plannedKwh: requestedKwh,
      estimatedEarnings: requestedKwh * rate,
      status: state,
      paid: settledLive ? paidTonight!.payout?.formatted : undefined,
    },
    earnings: { monthTotal: month, eventCount: paidHistory.length + livePayouts.length },
    plan,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{greeting}</h1>
          <p className="mt-1 text-sm text-muted">
            {state === "active"
              ? "Your energy is supporting the grid right now."
              : batteryIn || evIn
                ? "Your energy is ready to support the grid."
                : "Connect or opt in a device to start earning."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <AskGridFlexButton />
          <label className="flex items-center gap-2 text-xs text-muted">
            Preview state
            <select
              value={preview}
              onChange={(e) => setPreview(e.target.value as EventState | "live")}
              className="rounded-md border border-border bg-background-raised px-2 py-1 text-xs text-foreground"
            >
              <option value="live">Live (from your rules)</option>
              {(Object.keys(EVENT_STATE_LABEL) as EventState[]).map((s) => (
                <option key={s} value={s}>
                  {EVENT_STATE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* At a glance */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile label="Your available flex">
          <p className="font-mono text-3xl font-semibold tabular text-foreground">{availableKwh.toFixed(1)} kWh</p>
          <p className="mt-1 text-xs text-muted">
            {evIn ? `+ ${EV_SHIFTABLE_KW} kW EV charging can shift` : batteryIn ? "From your battery, above your reserve" : "Nothing opted in"}
          </p>
        </Tile>
        <Tile label="Earned this month">
          <p className="font-mono text-3xl font-semibold tabular text-foreground">{money(month)}</p>
          <p className="mt-1 text-xs text-muted">
            Today {money(today)} · Lifetime {money(lifetime)}
          </p>
        </Tile>
        <Tile label={`Grid status · ${zone} ${feeder}`}>
          <p className={`text-3xl font-semibold tracking-tight ${GRID_STYLE[gridStatus]}`}>{gridStatus}</p>
          <p className="mt-1 text-xs text-muted">
            {gridStatus === "NORMAL"
              ? "No flexibility needed right now."
              : `Load ${z.currentMw.toFixed(1)} MW, peaking ${z.peakTime}`}
          </p>
        </Tile>
      </div>

      <div className="mt-6 space-y-6">
        <HouseholdEvent
          ev={{
            state,
            auto,
            zone,
            window: household.eventWindow,
            requestedKwh,
            deliveredKwh,
            rate,
            batteryAfter,
            reserve: rules.reserve,
            minutesLeft: 34,
            reliefPercent: 62,
            paidLabel: settledLive ? paidTonight!.payout?.formatted : undefined,
            receiptUrl: settledLive ? paidTonight!.url : undefined,
          }}
          onParticipate={() => {
            setPreview("live");
            setChoice("joined");
          }}
          onDecline={() => {
            setPreview("live");
            setChoice("declined");
          }}
        />

        <PowerPlan plan={plan} window={household.eventWindow} onPreference={setPlanPreference} onStorm={setStorm} />

        {/* Resources */}
        <section aria-labelledby="resources-heading">
          <h2 id="resources-heading" className="tracked-caps text-xs font-medium text-muted">
            My resources
          </h2>
          {resources.length === 0 ? (
            <p className="panel mt-3 rounded-lg p-5 text-sm text-muted">
              No devices connected yet. Add a battery or EV to start earning.
            </p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* AutoFlex and limits */}
          <section id="voice-autoflex" aria-labelledby="autoflex-heading" className="panel h-fit rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="autoflex-heading" className="tracked-caps text-xs font-medium text-muted">
                  AutoFlex &amp; your limits
                </h2>
                <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold text-foreground">
                  {rules.autoFlex ? (
                    <>
                      Enabled <Check className="h-4 w-4 text-normal" aria-hidden="true" />
                    </>
                  ) : (
                    "Off"
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {rules.autoFlex ? "Joins events for you when they match these rules." : "You decide on each event yourself."}
                </p>
              </div>
              <Switch checked={rules.autoFlex} onChange={(v) => setRules((r) => ({ ...r, autoFlex: v }))} label="AutoFlex" />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4">
              <Rule label="Battery reserve" value={`${rules.reserve}%`} />
              <Rule label="Minimum payout" value={price(rules.minRate)} />
              <Rule label="Maximum per event" value={`${rules.maxKwh.toFixed(1)} kWh`} />
              <Rule label="Events per day" value={`${rules.maxEvents}`} />
              <Rule label="Emergency dispatch" value={EMERGENCY_LABEL[rules.emergency]} />
            </dl>
            <p className="mt-4 text-xs text-muted">
              GridFlex never takes your battery below {rules.reserve}%.
            </p>

            <button
              type="button"
              onClick={() => setManaging((m) => !m)}
              aria-expanded={managing}
              className={`${secondaryButton} mt-4`}
            >
              {managing ? "Done" : "Manage"}
            </button>

            {managing && (
              <div className="mt-5 space-y-6 border-t border-border pt-5">
                <SliderRow
                  label="Always keep at least"
                  value={rules.reserve}
                  display={`${rules.reserve}%`}
                  min={20}
                  max={80}
                  step={5}
                  onChange={(v) => setRules((r) => ({ ...r, reserve: v }))}
                  hint="Charge kept for your home, for example during an outage."
                />
                <SliderRow
                  label="Only join when paid at least"
                  value={rules.minRate}
                  display={price(rules.minRate)}
                  min={0.05}
                  max={0.3}
                  step={0.01}
                  onChange={(v) => setRules((r) => ({ ...r, minRate: Math.round(v * 100) / 100 }))}
                  hint={`Tonight pays ${price(rate)}.`}
                />
                <SliderRow
                  label="Share at most"
                  value={rules.maxKwh}
                  display={`${rules.maxKwh.toFixed(1)} kWh`}
                  min={1}
                  max={6}
                  step={0.5}
                  onChange={(v) => setRules((r) => ({ ...r, maxKwh: v }))}
                  hint="Per event."
                />
                <SliderRow
                  label="Events per day"
                  value={rules.maxEvents}
                  display={`${rules.maxEvents}`}
                  min={1}
                  max={3}
                  step={1}
                  onChange={(v) => setRules((r) => ({ ...r, maxEvents: v }))}
                />
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Emergency dispatch</p>
                  <Segmented
                    label="Emergency dispatch"
                    value={rules.emergency}
                    options={[
                      { value: "ask", label: "Ask me" },
                      { value: "allow", label: "Automatic" },
                      { value: "never", label: "Never" },
                    ]}
                    onChange={(v) => setRules((r) => ({ ...r, emergency: v }))}
                  />
                </div>
                <p className="text-xs text-muted-2">Changes apply to tonight and future events.</p>
              </div>
            )}
          </section>

          {/* Recent earnings */}
          <section id="voice-earnings" aria-labelledby="earnings-heading" className="panel h-fit rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="earnings-heading" className="tracked-caps text-xs font-medium text-muted">
                Recent earnings
              </h2>
              <AskGridFlexButton prompt="How much have I earned this month, and where did it come from?" label="Ask" className="!px-3 !py-1.5 text-xs" />
            </div>
            <ul className="mt-3 divide-y divide-border">
              {todayExtra > 0 && (
                <Row title={`${zone} Flex Event`} sub="Today" amount={todayExtra} status="Paid" />
              )}
              {livePayouts.map((p) => (
                <Row
                  key={p.marketId}
                  title={`${zone} Flex Event`}
                  sub={`${shortDate(p.settledAt)}${p.deliveredKw !== undefined ? ` · ${p.deliveredKw.toFixed(1)} kWh` : ""}`}
                  amount={Number(p.amount.base) / 1e6}
                  status="Paid"
                  url={p.url}
                />
              ))}
              {household.history.slice(0, 5).map((h) =>
                h.status === "paid" ? (
                  <Row
                    key={h.date}
                    title="Battery dispatch"
                    sub={`${h.date} · ${h.kwh.toFixed(1)} kWh at ${price(h.pricePerKwh)}`}
                    amount={h.kwh * h.pricePerKwh}
                    status="Paid"
                  />
                ) : (
                  <li key={h.date} className="flex items-baseline justify-between gap-3 py-3 text-sm text-muted">
                    <span>
                      Skipped
                      <span className="block text-xs text-muted-2">
                        {h.date} · rate was {price(h.pricePerKwh)}
                      </span>
                    </span>
                    <span className="font-mono tabular">—</span>
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel rounded-lg p-5">
      <p className="tracked-caps text-xs font-medium text-muted">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular text-foreground">{value}</dd>
    </div>
  );
}

function Row({
  title,
  sub,
  amount,
  status,
  url,
}: {
  title: string;
  sub: string;
  amount: number;
  status: string;
  url?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-3 text-sm">
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted">
          {sub} · <span className="text-normal">{status}</span>
          {url && (
            <>
              {" · "}
              <TxLink href={url} label="Receipt" />
            </>
          )}
        </span>
      </span>
      <span className="shrink-0 font-mono font-semibold tabular text-normal">+{money(amount)}</span>
    </li>
  );
}
