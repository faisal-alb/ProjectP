import { Battery, Building2, Car, Sun, Zap } from "lucide-react";
import { downtown } from "@/lib/demo-data";

const satellites = [
  { label: "North", status: "bg-normal" },
  { label: "West", status: "bg-watch" },
  { label: "East", status: "bg-normal" },
  { label: "South", status: "bg-normal" },
];

const resources = [
  { icon: Battery, kw: "300 kW", label: "Battery" },
  { icon: Car, kw: "180 kW", label: "EV fleet" },
  { icon: Building2, kw: "170 kW", label: "Building" },
  { icon: Sun, kw: "100 kW", label: "Solar" },
  { icon: Zap, kw: "250 kW", label: "Generator" },
];

export function GridMapPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-panel p-6 sm:p-8">
      {/* radar range rings */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/10" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/10" />

      <div className="relative grid grid-cols-3 items-center gap-3 text-center sm:gap-4">
        <div />
        <NodeDot label={satellites[0].label} status={satellites[0].status} />
        <div />

        <NodeDot label={satellites[1].label} status={satellites[1].status} />
        <div className="relative rounded-xl border border-risk/35 bg-risk-soft px-3 py-4 shadow-[0_0_40px_-8px_rgba(255,106,77,0.5)]">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-risk px-2 py-0.5 text-[10px] font-medium text-background">
            Downtown
          </span>
          <p className="mt-1 text-xs text-muted">Forecast utilization</p>
          <p className="font-mono text-xl font-semibold tabular text-risk">107%</p>
          <p className="mt-2 text-[11px] text-muted">Required flex</p>
          <p className="font-mono text-sm font-semibold tabular text-foreground">
            {downtown.requiredFlexKw} kW
          </p>
          <p className="mt-2 text-[11px] text-muted">Nearby capacity</p>
          <p className="font-mono text-sm font-semibold tabular text-accent">
            {downtown.flexAvailableMw} MW
          </p>
        </div>
        <NodeDot label={satellites[2].label} status={satellites[2].status} />

        <div />
        <NodeDot label={satellites[3].label} status={satellites[3].status} />
        <div />
      </div>

      <div className="relative mt-8 flex flex-wrap justify-center gap-3 border-t border-border pt-6">
        {resources.map(({ icon: Icon, kw, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-full border border-border bg-background-raised px-3 py-2"
          >
            <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="font-mono text-xs font-medium tabular text-foreground">{kw}</span>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeDot({ label, status }: { label: string; status: string }) {
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${status}`} aria-hidden="true" />
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}
