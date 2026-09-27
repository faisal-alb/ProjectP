"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, FastForward } from "lucide-react";
import { SCENARIOS, type RunEvent, type RunLog, type RunState, type ZoneId } from "@gridflex/shared";

const ZONE_NAME: Record<ZoneId, string> = {
  downtown: "Downtown",
  north: "North Austin",
  south: "South Austin",
  east: "East Austin",
};

/** The stress day's scripted moments, in the words a presenter would use. */
const SCENARIO_STORY: Record<string, string> = {
  "demand-surge": "Demand jumps and pushes a neighborhood toward what its local lines can carry.",
  "missing-readings": "Some meters stop reporting. Those intervals wait for real readings before anyone is paid.",
  "stale-readings": "A few meters resend old readings. They're quarantined instead of counted.",
  "ev-departure": "A driver unplugs early, so that EV leaves the event.",
  "opt-out": "A household opts out, and its devices stop being offered.",
  reserve: "Batteries protect a higher reserve, so they have less to share.",
  "negative-price": "Wholesale prices go negative, so there's no reason to buy flexibility.",
  "solar-drop": "A cloud front cuts rooftop solar output.",
  "device-offline": "A home battery goes offline, and GridFlex works around it.",
  "price-ineligible": "Some offers are above the operator's price cap, so they're left out.",
  storm: "A storm warning makes batteries hold more in reserve.",
  "partial-procurement": "There isn't enough flexibility to cover the whole shortfall, so GridFlex buys what it can.",
  peak: "The evening peak arrives, the biggest test of the day.",
  "under-delivery": "A device delivers less than it promised and is paid only for what it delivered.",
  "over-delivery": "A device delivers more than it promised. Payment stays capped at the commitment.",
  "duplicate-readings": "A meter sends the same readings twice. They're counted once.",
  "implausible-readings": "A meter reports impossible numbers, and they're quarantined.",
  "rpc-timeout": "The Solana RPC goes down. Settlement waits and retries instead of losing payments.",
  "forecast-offline": "The forecast service goes offline. New events pause, and events underway finish.",
  "assistant-offline": "The voice assistant goes offline. The grid keeps running without it.",
};

/** Minutes the stress preset adds a demand surge, on top of the scenarios' own start times. */
const SURGE_MINUTES = [120, 360, 720, 1095, 1185];

const STAGES = ["Forecast", "Commit", "Deliver", "Pay"] as const;

const ACTIVE = (e: RunEvent) => e.phase !== "completed" && e.phase !== "canceled";
const usd = (base: string | number) => `$${(Number(base) / 1e6).toFixed(2)}`;
const kw = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} kW`;
const paidOf = (e: RunEvent) => e.commitments.reduce((s, c) => s + Number(c.paidBase ?? 0), 0);

function clockAt(run: RunState, minute: number) {
  return new Date(Date.parse(run.start) + minute * 60_000).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  });
}

function nextScripted(run: RunState, before = 1440) {
  if (run.preset !== "stress") return undefined;
  const moments = [
    ...SURGE_MINUTES.map((minute) => ({ id: "demand-surge", label: "Demand surge", minute })),
    ...SCENARIOS.filter((s) => s.minute >= 0),
  ];
  return moments
    .filter((m) => m.minute >= run.minute && m.minute < before)
    .sort((a, b) => a.minute - b.minute)[0];
}

interface Step {
  id: string;
  /** Which part of an event's life the next click moves through. */
  stage: number;
  kicker: string;
  title: string;
  body: string;
  action: string;
  working: string;
}

/** What the next click will do, read from the same state the engine advances. */
function nextStep(run: RunState): Step | null {
  const active = run.events.filter(ACTIVE);
  const committing = active.filter((e) => e.phase === "scheduled" || e.phase === "committing");
  const paying = active.filter((e) => e.phase === "verifying" || e.phase === "settling");
  const delivering = active.filter((e) => e.phase === "dispatching").sort((a, b) => a.endMinute - b.endMinute);
  const more = (list: RunEvent[]) => (list.length > 1 ? ` ${list.length - 1} more ${list.length === 2 ? "event does" : "events do"} the same.` : "");

  if (committing.length) {
    const e = committing[0];
    const n = e.commitments.length;
    return {
      id: `commit-${e.id}`,
      stage: 1,
      kicker: `${ZONE_NAME[e.zone]} · ${clockAt(run, e.startMinute)} – ${clockAt(run, e.endMinute)}`,
      title: "Lock in the deal on Solana",
      body: `GridFlex escrows ${usd(e.escrowBase)} in test USDC and records ${n} household ${n === 1 ? "commitment" : "commitments"} on-chain for ${kw(e.requiredKw)} of relief. Once confirmed, the devices start delivering.${more(committing)}`,
      action: "Commit on Solana",
      working: "Sending escrow and commitments to Solana…",
    };
  }
  if (paying.length) {
    const e = paying[0];
    return {
      id: `pay-${e.id}`,
      stage: 3,
      kicker: `${ZONE_NAME[e.zone]} · window closed at ${clockAt(run, e.endMinute)}`,
      title: "Check the meters and pay",
      body: `GridFlex compares each device's meter readings with what it promised, then pays households in test USDC. Nobody is paid for more than they committed.${e.error ? ` Last attempt: ${e.error}` : ""}${more(paying)}`,
      action: "Verify and pay",
      working: "Verifying delivery and settling payouts…",
    };
  }
  if (delivering.length) {
    const e = delivering[0];
    const n = e.commitments.length;
    const interrupt = nextScripted(run, e.endMinute);
    return {
      id: `deliver-${e.id}-${interrupt?.minute ?? ""}`,
      stage: 2,
      kicker: `${ZONE_NAME[e.zone]} · helping until ${clockAt(run, e.endMinute)}`,
      title: "Let the devices deliver",
      body: interrupt
        ? `${n} ${n === 1 ? "device eases" : "devices ease"} off or share power. Before the window ends, at ${clockAt(run, interrupt.minute)}: ${SCENARIO_STORY[interrupt.id] ?? interrupt.label}`
        : `${n} ${n === 1 ? "device eases" : "devices ease"} off or share power while meters record every minute. Fast-forward to the end of the window.`,
      action: `Fast-forward to ${clockAt(run, interrupt?.minute ?? e.endMinute)}`,
      working: "Fast-forwarding through the delivery window…",
    };
  }
  if (run.status === "completed" || run.minute >= 1440) return null;
  const upcoming = nextScripted(run);
  return {
    id: `watch-${run.minute}-${upcoming?.id ?? ""}`,
    stage: 0,
    kicker: upcoming ? `Next up · ${upcoming.label} at ${clockAt(run, upcoming.minute)}` : "Watching the forecast",
    title: "Fast-forward to the next grid stress",
    body: upcoming
      ? `The clock runs until something happens. GridFlex re-checks every neighborhood's forecast every 15 minutes. ${SCENARIO_STORY[upcoming.id] ?? ""}`
      : "The clock runs until a neighborhood is forecast to go past what its local lines can carry.",
    action: "Fast-forward",
    working: "Fast-forwarding the day…",
  };
}

/** Plain-language lines for what the last click changed. */
function recap(run: RunState, since: number): string[] {
  const eventOf = (id?: string) => run.events.find((e) => e.id === id);
  const lines = run.log
    .filter((l) => l.seq > since)
    .map((l: RunLog) => {
      const e = eventOf(l.eventId);
      const zone = e ? ZONE_NAME[e.zone] : "";
      switch (l.type) {
        case "event.scheduled":
          return e && `${zone} is forecast to overload. Event set for ${clockAt(run, e.startMinute)}, ${kw(e.requiredKw)} needed.`;
        case "event.dispatching":
          return e && `${zone}: commitments confirmed on Solana. Devices are helping.`;
        case "event.verifying":
          return e && `${zone}: delivery window closed.`;
        case "event.completed":
          return e && `${zone}: households paid ${usd(paidOf(e))}.`;
        case "event.canceled":
          return `${zone ? `${zone}: ` : ""}event canceled. ${l.message}`;
        case "scenario.injected":
          return `${l.message} started.`;
        case "settlement.pending":
          return `Settlement waiting: ${l.message}`;
        case "forecast.unavailable":
        case "telemetry.recovered":
          return l.message;
        default:
          return undefined;
      }
    })
    .filter((l): l is string => !!l);
  return [...new Set(lines)].slice(-3);
}

// The app's strong ease-in-out: time moving on screen, not entering or leaving.
const easeInOut = cubicBezier(0.77, 0, 0.175, 1);

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, y1, y2);
  };
}

/** Runs the displayed clock forward through a jump, so skipped time reads as time passing. */
function useFastForward(target: number) {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    const delta = target - from;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    if (delta <= 1 || reduce) {
      frame = requestAnimationFrame(() => {
        current.current = target;
        setShown(target);
      });
      return () => cancelAnimationFrame(frame);
    }
    const duration = Math.min(1400, 400 + delta * 4);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      current.current = from + delta * easeInOut(p);
      setShown(current.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return { shown, moving: Math.round(shown) !== target };
}

export function DemoGuide({
  run,
  busy,
  error,
  disabled,
  onNext,
}: {
  run: RunState;
  busy: boolean;
  error: string;
  disabled: boolean;
  onNext: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const step = nextStep(run);
  const { shown, moving } = useFastForward(run.minute);
  const happened = since === null ? [] : recap(run, since);
  const done = !step;

  const next = () => {
    setSince(run.log.at(-1)?.seq ?? 0);
    onNext();
  };

  const label = busy ? step?.working ?? "Working…" : step ? `Next: ${step.action}` : "Day complete";

  if (collapsed)
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-expanded={false}
        aria-label="Open demo guide"
        className="demo-guide-in flex h-12 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-background shadow-lg transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <FastForward size={18} aria-hidden="true" />
        <span className="font-mono tabular">{clockAt(run, Math.round(shown))}</span>
        <span>· {step ? step.action : "Day complete"}</span>
      </button>
    );

  return (
    <section
      aria-label="Demo guide"
      className="demo-guide-in w-[22rem] max-w-full overflow-hidden rounded-xl border border-border-strong bg-background-raised shadow-xl"
    >
      <div className="relative h-1 bg-surface" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 w-full origin-left bg-accent/60"
          style={{ transform: `scaleX(${Math.min(1, shown / 1440)})` }}
        />
        {run.events.map((e) => (
          <span
            key={e.id}
            className={`pop-in absolute inset-y-0 w-0.5 ${ACTIVE(e) ? "bg-foreground" : "bg-normal"}`}
            style={{ left: `${(e.startMinute / 1440) * 100}%` }}
          />
        ))}
        {busy && <span className="demo-guide-working absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/70 to-transparent" />}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-baseline gap-2 text-xs text-muted">
            <span className="tracked-caps">Guided demo</span>
            <span className={`font-mono text-sm tabular transition-colors duration-200 ${moving ? "text-accent" : "text-foreground"}`}>
              {clockAt(run, Math.round(shown))}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-expanded={true}
            aria-label="Minimize demo guide"
            className="-m-1.5 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>

        <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Event steps">
          {STAGES.map((name, i) => {
            const state = done || (step && i < step.stage) ? "done" : step?.stage === i ? "next" : "todo";
            return (
              <li key={name} aria-current={state === "next" ? "step" : undefined}>
                <span
                  className={`block h-1 rounded-sm transition-colors duration-200 ${
                    state === "done" ? "bg-foreground/70" : state === "next" ? "bg-accent" : "bg-surface"
                  }`}
                />
                <span className={`mt-1 block text-[11px] transition-colors duration-200 ${state === "next" ? "text-foreground" : "text-muted-2"}`}>
                  {name}
                </span>
              </li>
            );
          })}
        </ol>

        <div key={step?.id ?? "done"} className="demo-step-in mt-3" aria-live="polite">
          {step ? (
            <>
              <p className="text-xs text-muted">{step.kicker}</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground">That&rsquo;s the whole day</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {run.events.filter((e) => e.phase === "completed").length} events settled, and households were paid{" "}
                {usd(run.events.reduce((s, e) => s + paidOf(e), 0))} in test USDC. Start a new run from the simulation controls.
              </p>
            </>
          )}
        </div>

        {happened.length > 0 && !busy && (
          <ul key={since ?? 0} className="demo-step-in mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted" aria-label="What just happened">
            {happened.map((line) => (
              <li key={line} className="flex gap-1.5">
                <Check className="mt-px h-3.5 w-3.5 shrink-0 text-normal" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-watch">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={disabled || busy || done}
          aria-busy={busy}
          onClick={next}
          className={`demo-guide-next mt-4 flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-background disabled:cursor-not-allowed hover:brightness-110 ${busy ? "disabled:cursor-progress" : "disabled:opacity-60"} focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}
        >
          <span className="truncate">{label}</span>
          {busy ? (
            <FastForward size={16} className="demo-guide-pulse shrink-0" aria-hidden="true" />
          ) : (
            <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}
