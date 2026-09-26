"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { PLAN_PREFERENCES, type PlanAction, type PlanPreference, type PowerPlan as Plan } from "@gridflex/shared";
import { AskGridFlexButton } from "@/components/voice/AskButton";

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Tonight's ranked plan. The ranking comes from the optimizer (`buildPowerPlan`); this card
 * only shows it, and the voice assistant explains it.
 */
export function PowerPlan({
  plan,
  window,
  onPreference,
}: {
  plan: Plan;
  window: string;
  onPreference: (p: PlanPreference) => void;
}) {
  return (
    <section id="voice-plan" aria-labelledby="plan-heading" className="panel rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="tracked-caps flex items-center gap-1.5 text-xs font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Energy Copilot
          </p>
          <h2 id="plan-heading" className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            Tonight&rsquo;s Power Plan
          </h2>
          <p className="mt-1 text-sm text-muted">
            {plan.stormExpected ? "Storm expected · " : ""}Grid stress {window.replace(" – ", " to ")} · about{" "}
            <span className="font-mono tabular text-foreground">{money(plan.expectedEarnings)}</span> if you follow it
          </p>
        </div>
        <AskGridFlexButton
          prompt="Walk me through tonight's power plan and why it's ranked that way."
          label="Explain plan"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-xs text-muted">
          Optimize for
          <select
            value={plan.preference}
            onChange={(e) => onPreference(e.target.value as PlanPreference)}
            className="rounded-md border border-border bg-background-raised px-2 py-1 text-xs text-foreground"
          >
            {PLAN_PREFERENCES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ol className="mt-2 divide-y divide-border">
        {plan.actions.map((a) => (
          <Action key={a.kind} action={a} best={a.rank === 1 && a.recommended} />
        ))}
      </ol>

      <p className="mt-4 rounded-md border border-border bg-background-raised p-3 text-sm text-muted">
        <span className="font-medium text-foreground">Why this plan?</span> {plan.why}
      </p>
    </section>
  );
}

function Action({ action: a, best }: { action: PlanAction; best: boolean }) {
  const [open, setOpen] = useState(false);
  const dim = !a.recommended;
  return (
    <li className={`py-3 ${dim ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 font-mono text-sm tabular text-muted-2">{a.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm font-medium text-foreground">{a.title}</p>
            {best && <span className="tracked-caps text-[10px] font-semibold text-accent">Best</span>}
            {a.conditional && a.recommended && <span className="text-[11px] text-muted-2">If more is requested</span>}
            {dim && <span className="text-[11px] text-muted-2">Not recommended</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
          {(a.reasons.length > 0 || a.caveat) && (
            <>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-2 transition-colors hover:text-foreground"
              >
                Details
                <ChevronDown
                  className={`h-3 w-3 transition-transform duration-150 ease-[var(--ease-out)] ${open ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {open && (
                <ul className="mt-1.5 space-y-1 text-xs text-muted">
                  {a.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  {a.caveat && <li className="text-watch">{a.caveat}</li>}
                </ul>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 text-right">
          {a.earnings > 0 ? (
            <p className="font-mono text-sm font-semibold tabular text-foreground">+{money(a.earnings)}</p>
          ) : (
            <p className="text-sm text-muted-2">{a.kind === "STORE_SOLAR" ? "$0 cost" : "$0.00"}</p>
          )}
          {a.recommended && <p className="mt-0.5 font-mono text-[11px] tabular text-muted-2">{a.score}</p>}
        </div>
      </div>
    </li>
  );
}
