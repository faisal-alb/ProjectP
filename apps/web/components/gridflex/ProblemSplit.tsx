import { ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import { withoutGridFlexResources, downtown } from "@/lib/demo-data";

export function ProblemSplit() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-risk/25 bg-risk-soft/40 p-6">
        <p className="tracked-caps text-xs font-semibold text-risk">
          Without GridFlex
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Demand</p>
            <p className="font-mono text-xl font-semibold tabular text-foreground">
              {downtown.forecastLoadMw} MW
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Capacity</p>
            <p className="font-mono text-xl font-semibold tabular text-foreground">
              {downtown.capacityMw} MW
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2">
          <XCircle className="h-4 w-4 shrink-0 text-risk" aria-hidden="true" />
          <span className="text-sm font-medium text-risk">
            Result: Congestion risk
          </span>
        </div>

        <p className="mt-5 tracked-caps text-xs font-medium text-muted">
          Resources nearby remain disconnected
        </p>
        <ul className="mt-3 space-y-2">
          {withoutGridFlexResources.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-sm"
            >
              <span className="text-foreground/70">{r.label}</span>
              <span className="font-mono tabular text-foreground/50">{r.kw} kW</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent-soft/60 p-6">
        <p className="tracked-caps text-xs font-semibold text-accent">
          With GridFlex
        </p>

        <ul className="mt-4 space-y-2">
          {withoutGridFlexResources.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between rounded-lg border border-accent/15 bg-background-raised px-3 py-2 text-sm"
            >
              <span className="text-foreground">{r.label}</span>
              <span className="font-mono font-medium tabular text-accent">
                {r.kw} kW
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-center">
          <ArrowRight
            className="h-4 w-4 rotate-90 text-accent/50"
            aria-hidden="true"
          />
        </div>

        <div className="mt-1 flex items-center justify-between rounded-lg bg-accent px-4 py-3">
          <span className="text-sm font-medium text-background">Flexibility</span>
          <span className="font-mono text-lg font-semibold tabular text-background">
            {downtown.requiredFlexKw} kW
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Grid load</p>
            <p className="font-mono text-xl font-semibold tabular text-foreground">
              {downtown.capacityMw.toFixed(1)} MW
            </p>
          </div>
          <div className="flex items-center gap-2 self-end rounded-lg bg-background-raised px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-normal" aria-hidden="true" />
            <span className="text-sm font-medium text-accent">Stable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
