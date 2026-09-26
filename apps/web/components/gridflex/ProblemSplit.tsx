import { ArrowRight, XCircle, CheckCircle2 } from "lucide-react";
import { withoutGridFlexResources, downtown } from "@/lib/demo-data";

export function ProblemSplit() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-danger/25 bg-danger-soft/40 p-6">
        <p className="text-xs font-semibold tracking-wide text-danger uppercase">
          Without GridFlex
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Demand</p>
            <p className="font-mono text-xl font-semibold text-foreground">
              {downtown.forecastLoadMw} MW
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Capacity</p>
            <p className="font-mono text-xl font-semibold text-foreground">
              {downtown.capacityMw} MW
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
          <XCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <span className="text-sm font-medium text-danger">
            Result: Congestion risk
          </span>
        </div>

        <p className="mt-5 text-xs font-medium tracking-wide text-muted uppercase">
          Resources nearby remain disconnected
        </p>
        <ul className="mt-3 space-y-2">
          {withoutGridFlexResources.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between rounded-lg border border-border/70 bg-white/60 px-3 py-2 text-sm"
            >
              <span className="text-foreground/70">{r.label}</span>
              <span className="font-mono text-foreground/50">{r.kw} kW</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-soft/60 p-6">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          With GridFlex
        </p>

        <ul className="mt-4 space-y-2">
          {withoutGridFlexResources.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between rounded-lg border border-primary/15 bg-white px-3 py-2 text-sm"
            >
              <span className="text-foreground">{r.label}</span>
              <span className="font-mono font-medium text-primary">
                {r.kw} kW
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-center">
          <ArrowRight
            className="h-4 w-4 rotate-90 text-primary/50"
            aria-hidden="true"
          />
        </div>

        <div className="mt-1 flex items-center justify-between rounded-lg bg-primary px-4 py-3">
          <span className="text-sm font-medium text-white">Flexibility</span>
          <span className="font-mono text-lg font-semibold text-white">
            {downtown.requiredFlexKw} kW
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Grid load</p>
            <p className="font-mono text-xl font-semibold text-foreground">
              {downtown.capacityMw.toFixed(1)} MW
            </p>
          </div>
          <div className="flex items-center gap-2 self-end rounded-lg bg-white px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-bright" aria-hidden="true" />
            <span className="text-sm font-medium text-primary">Stable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
