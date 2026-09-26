import { Battery, Building2, Car, Sun, Zap } from "lucide-react";
import { downtown } from "@/lib/demo-data";

const satellites = [
  { label: "North", status: "bg-bright" },
  { label: "West", status: "bg-warning" },
  { label: "East", status: "bg-bright" },
  { label: "South", status: "bg-bright" },
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
    <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
      <div className="grid grid-cols-3 items-center gap-3 text-center sm:gap-4">
        <div />
        <NodeDot label={satellites[0].label} status={satellites[0].status} />
        <div />

        <NodeDot label={satellites[1].label} status={satellites[1].status} />
        <div className="relative rounded-xl border-2 border-danger/50 bg-danger-soft px-3 py-4">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-danger px-2 py-0.5 text-[10px] font-medium text-white">
            Downtown
          </span>
          <p className="mt-1 text-xs text-muted">Forecast utilization</p>
          <p className="font-mono text-xl font-semibold text-danger">107%</p>
          <p className="mt-2 text-[11px] text-muted">Required flex</p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {downtown.requiredFlexKw} kW
          </p>
          <p className="mt-2 text-[11px] text-muted">Nearby capacity</p>
          <p className="font-mono text-sm font-semibold text-primary">
            {downtown.flexAvailableMw} MW
          </p>
        </div>
        <NodeDot label={satellites[2].label} status={satellites[2].status} />

        <div />
        <NodeDot label={satellites[3].label} status={satellites[3].status} />
        <div />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3 border-t border-border pt-6">
        {resources.map(({ icon: Icon, kw, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
          >
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">{kw}</span>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeDot({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${status}`} aria-hidden="true" />
      <span className="text-xs font-medium text-muted">{label}</span>
    </div>
  );
}
