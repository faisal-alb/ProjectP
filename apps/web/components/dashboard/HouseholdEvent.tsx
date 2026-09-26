"use client";

import { Check, Info } from "lucide-react";
import { primaryButton, secondaryButton } from "@/components/onboarding/controls";
import { AskGridFlexButton } from "@/components/voice/AskButton";
import { TxLink } from "./TxLink";

/** Every state a flex event can be in, from the participant's point of view. */
export type EventState =
  | "none"
  | "upcoming"
  | "awaiting"
  | "accepted"
  | "active"
  | "verifying"
  | "settled"
  | "partial"
  | "declined";

export const EVENT_STATE_LABEL: Record<EventState, string> = {
  none: "No event",
  upcoming: "Upcoming",
  awaiting: "Awaiting your response",
  accepted: "Accepted",
  active: "Active",
  verifying: "Verifying",
  settled: "Settled",
  partial: "Partial delivery",
  declined: "Declined",
};

export interface EventView {
  state: EventState;
  auto: boolean;
  zone: string;
  window: string;
  requestedKwh: number;
  deliveredKwh: number;
  rate: number;
  batteryAfter: number;
  reserve: number;
  minutesLeft: number;
  reliefPercent: number;
  paidLabel?: string;
  receiptUrl?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const kwh = (n: number) => `${n.toFixed(1)} kWh`;

const STEPS = ["Requested", "Accepted", "Delivering", "Verified", "Paid"];
const STEP_AT: Partial<Record<EventState, number>> = {
  accepted: 1,
  active: 2,
  verifying: 3,
  settled: 4,
  partial: 4,
};

export function HouseholdEvent({
  ev,
  onParticipate,
  onDecline,
}: {
  ev: EventView;
  onParticipate: () => void;
  onDecline: () => void;
}) {
  const { state } = ev;
  const est = ev.requestedKwh * ev.rate;
  const earned = ev.deliveredKwh * ev.rate;

  if (state === "none") {
    return (
      <section id="voice-tonight" aria-labelledby="event-heading" className="panel rounded-lg p-5 sm:p-6">
        <Eyebrow>GridFlex event</Eyebrow>
        <h2 id="event-heading" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          No active events
        </h2>
        <p className="mt-1 text-sm text-muted">Your resources are ready for the next GridFlex request.</p>
      </section>
    );
  }

  const active = state === "active";
  return (
    <section
      id="voice-tonight"
      aria-labelledby="event-heading"
      className={`panel rounded-lg p-5 sm:p-6 ${active ? "border-accent/50" : ""}`}
      style={active ? { background: "color-mix(in srgb, var(--accent) 8%, var(--surface))" } : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>{active ? "Grid event active" : "GridFlex event"}</Eyebrow>
        <StatePill state={state} auto={ev.auto} />
      </div>

      <h2
        id="event-heading"
        className={`mt-2 font-semibold tracking-tight text-balance text-foreground ${active ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}
      >
        {state === "settled" && `You earned ${ev.paidLabel ?? money(earned)}`}
        {state === "partial" && `You earned ${ev.paidLabel ?? money(earned)} for a partial delivery`}
        {state === "verifying" && "Confirming what you delivered"}
        {state === "active" && `${ev.zone} is drawing on your battery`}
        {state === "declined" && "You're sitting this one out"}
        {(state === "upcoming" || state === "awaiting" || state === "accepted") &&
          `${ev.zone} needs flexibility tonight`}
      </h2>

      {state === "active" ? (
        <ActiveMeter ev={ev} earned={earned} />
      ) : (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Fact label="When" value={ev.window} />
          {state === "settled" || state === "partial" || state === "verifying" ? (
            <>
              <Fact label="Delivered" value={kwh(ev.deliveredKwh)} mono />
              <Fact label="Rate" value={`${money(ev.rate)}/kWh`} mono />
              <Fact label={state === "verifying" ? "Pending payout" : "Paid"} value={money(earned)} mono />
            </>
          ) : (
            <>
              <Fact label="Requested from you" value={kwh(ev.requestedKwh)} mono />
              <Fact label="Rate" value={`${money(ev.rate)}/kWh`} mono />
              <Fact label="Estimated earnings" value={money(est)} mono />
            </>
          )}
        </dl>
      )}

      {state === "partial" && (
        <p className="mt-4 text-sm text-muted">
          Your meter confirmed {kwh(ev.deliveredKwh)} of the {kwh(ev.requestedKwh)} requested, for example because
          your battery reached your {ev.reserve}% reserve. You were paid for what you delivered.
        </p>
      )}
      {state === "verifying" && (
        <p className="mt-4 text-sm text-muted">
          Your meter data is being checked. Payment follows automatically once it&rsquo;s confirmed.
        </p>
      )}
      {state === "upcoming" && (
        <p className="mt-4 text-sm text-muted">Requests open a few hours before the event. We&rsquo;ll ask you then.</p>
      )}
      {state === "accepted" && (
        <p className="mt-4 text-sm text-muted">
          {ev.auto ? "AutoFlex accepted this for you because it matches your rules. " : "You're in. "}
          Your battery stays above {ev.reserve}% and ends around {ev.batteryAfter}%.
        </p>
      )}

      {(state === "awaiting" || state === "accepted" || state === "declined") && (
        <div className="mt-5 flex flex-wrap gap-3">
          {(state === "awaiting" || state === "declined") && (
            <button type="button" onClick={onParticipate} className={primaryButton}>
              {state === "declined" ? "Join after all" : "Participate"}
            </button>
          )}
          {state === "awaiting" && (
            <button type="button" onClick={onDecline} className={secondaryButton}>
              Decline
            </button>
          )}
          {state === "accepted" && (
            <button type="button" onClick={onDecline} className={secondaryButton}>
              Opt out of this event
            </button>
          )}
        </div>
      )}

      {ev.receiptUrl && (state === "settled" || state === "partial") && (
        <div className="mt-4">
          <TxLink href={ev.receiptUrl} label="View payment on Solana" />
        </div>
      )}

      {STEP_AT[state] !== undefined && <Steps at={STEP_AT[state]!} />}

      <div className="mt-5">
        <AskGridFlexButton prompt="Why is there a grid event tonight, and what does it mean for me?" label="Ask about this event" />
      </div>

      <div className="mt-6 flex gap-2.5 rounded-md border border-border bg-background-raised p-3 text-sm text-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <p>
            <span className="font-medium text-foreground">Why this event?</span> {ev.zone}&rsquo;s demand is expected
            to exceed local capacity around {ev.window.replace(" – ", " and ")}. Your battery is connected to the
            affected grid zone, so it can help.
          </p>
          <p className="mt-1.5 text-xs text-muted-2">High demand · High temperature · Evening peak</p>
        </div>
      </div>
    </section>
  );
}

function ActiveMeter({ ev, earned }: { ev: EventView; earned: number }) {
  const pct = Math.min(100, Math.round((ev.deliveredKwh / ev.requestedKwh) * 100));
  return (
    <div className="mt-5">
      <div
        className="h-3 rounded-sm bg-white/[0.08]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Energy delivered so far"
      >
        <div className="h-full rounded-sm bg-chart-flex" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Fact label="Committed" value={kwh(ev.requestedKwh)} mono big />
        <Fact label="Delivered" value={kwh(ev.deliveredKwh)} mono big />
        <Fact label="Time remaining" value={`${ev.minutesLeft} min`} mono big />
        <Fact label="Estimated earnings" value={money(earned)} mono big />
      </dl>
      <p className="mt-4 text-sm text-muted">
        Grid relief so far: <span className="font-mono tabular text-foreground">{ev.reliefPercent}%</span> of what{" "}
        {ev.zone} asked for.
      </p>
    </div>
  );
}

function Steps({ at }: { at: number }) {
  return (
    <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Event progress">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === at ? "step" : undefined}>
          <div className={`h-1 rounded-full ${i <= at ? "bg-normal" : "bg-white/[0.1]"}`} />
          <p className={`mt-1.5 flex items-center gap-1 text-[11px] sm:text-xs ${i <= at ? "text-foreground" : "text-muted-2"}`}>
            {i < at && <Check className="h-3 w-3 text-normal" aria-hidden="true" />}
            {s}
          </p>
        </li>
      ))}
    </ol>
  );
}

function StatePill({ state, auto }: { state: EventState; auto: boolean }) {
  const map: Record<EventState, { label: string; cls: string }> = {
    none: { label: "", cls: "" },
    upcoming: { label: "Upcoming", cls: "text-muted" },
    awaiting: { label: "Your response needed", cls: "text-watch" },
    accepted: { label: auto ? "Automatically accepted" : "Accepted", cls: "text-normal" },
    active: { label: "Delivering now", cls: "text-accent" },
    verifying: { label: "Verifying", cls: "text-accent" },
    settled: { label: "Paid", cls: "text-normal" },
    partial: { label: "Partly delivered", cls: "text-watch" },
    declined: { label: "Declined", cls: "text-muted" },
  };
  const s = map[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {s.label}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="tracked-caps text-xs font-medium text-muted">{children}</p>;
}

function Fact({ label, value, mono = false, big = false }: { label: string; value: string; mono?: boolean; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 font-semibold text-foreground ${big ? "text-xl" : "text-sm"} ${mono ? "font-mono tabular" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
