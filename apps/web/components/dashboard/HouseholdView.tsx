"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { EV_SHIFTABLE_KW, household, zones } from "@/lib/demo-data";
import { AskGridFlexButton } from "@/components/voice/AskButton";
import { useHouseholdState } from "./HouseholdState";
import { EVENT_STATE_LABEL, HouseholdEvent, type EventState } from "./HouseholdEvent";
import { PageHeader } from "./PageHeader";
import { PowerPlan } from "./PowerPlan";

const money = (n: number) => `$${n.toFixed(2)}`;

type GridStatus = "NORMAL" | "WATCH" | "EVENT ACTIVE" | "EMERGENCY";
const GRID_STYLE: Record<GridStatus, string> = {
  NORMAL: "text-normal",
  WATCH: "text-watch",
  "EVENT ACTIVE": "text-accent",
  EMERGENCY: "text-risk",
};

/** The participant's home page: tonight at a glance. Devices, earnings and rules have their own pages. */
export function HouseholdView() {
  const s = useHouseholdState();
  const { state, zone, feeder } = s;

  const gridStatus: GridStatus =
    state === "active" ? "EVENT ACTIVE" : state === "upcoming" || state === "awaiting" || state === "accepted" || state === "declined" ? "WATCH" : "NORMAL";
  const z = zones.find((x) => x.name === zone) ?? zones[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader
        title={greeting}
        subtitle={
          state === "active"
            ? "Your energy is supporting the grid right now."
            : s.batteryIn || s.evIn
              ? "Your energy is ready to support the grid."
              : "Connect or opt in a device to start earning."
        }
      >
        <AskGridFlexButton />
        <label className="flex items-center gap-2 text-xs text-muted">
          Preview state
          <select
            value={s.preview}
            onChange={(e) => s.setPreview(e.target.value as EventState | "live")}
            className="rounded-md border border-border bg-background-raised px-2 py-1 text-xs text-foreground"
          >
            <option value="live">Live (from your rules)</option>
            {(Object.keys(EVENT_STATE_LABEL) as EventState[]).map((st) => (
              <option key={st} value={st}>
                {EVENT_STATE_LABEL[st]}
              </option>
            ))}
          </select>
        </label>
      </PageHeader>

      {/* At a glance */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile label="Your available flex" href="/dashboard/devices" linkLabel="Devices">
          <p className="font-mono text-3xl font-semibold tabular text-foreground">{s.availableKwh.toFixed(1)} kWh</p>
          <p className="mt-1 text-xs text-muted">
            {s.evIn ? `+ ${EV_SHIFTABLE_KW} kW EV charging can shift` : s.batteryIn ? "From your battery, above your reserve" : "Nothing opted in"}
          </p>
        </Tile>
        <Tile label="Earned this month" href="/dashboard/earnings" linkLabel="History">
          <p className="font-mono text-3xl font-semibold tabular text-foreground">{money(s.month)}</p>
          <p className="mt-1 text-xs text-muted">
            Today {money(s.today)} · Lifetime {money(s.lifetime)}
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
            auto: s.auto,
            zone,
            window: household.eventWindow,
            requestedKwh: s.requestedKwh,
            deliveredKwh: s.deliveredKwh,
            rate: s.rate,
            batteryAfter: s.batteryAfter,
            reserve: s.rules.reserve,
            minutesLeft: 34,
            reliefPercent: 62,
            paidLabel: s.settledLive?.payout?.formatted,
            receiptUrl: s.settledLive?.url,
          }}
          onParticipate={() => {
            s.setPreview("live");
            s.setChoice("joined");
          }}
          onDecline={() => {
            s.setPreview("live");
            s.setChoice("declined");
          }}
        />

        <PowerPlan plan={s.plan} window={household.eventWindow} onPreference={s.setPlanPreference} onStorm={s.setStorm} />

        <p className="text-sm text-muted">
          AutoFlex is <span className="font-medium text-foreground">{s.rules.autoFlex ? "on" : "off"}</span> and keeps
          at least <span className="font-mono font-semibold tabular text-foreground">{s.rules.reserve}%</span> in your
          battery.{" "}
          <Link href="/dashboard/settings" className="text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground">
            Change your rules
          </Link>
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  href,
  linkLabel,
  children,
}: {
  label: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="tracked-caps text-xs font-medium text-muted">{label}</p>
        {href && (
          <Link
            href={href}
            className="-my-0.5 inline-flex shrink-0 items-center gap-0.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
