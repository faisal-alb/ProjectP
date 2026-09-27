import { Battery, Building2, Car, Sun, Zap } from "lucide-react";
import { downtown, zones } from "@/lib/demo-data";
import { InfoTip } from "@/components/ui/Tooltip";

const satellites = zones.filter((zone) => zone.name !== downtown.zone).map((zone) => ({
  label: zone.name,
  status: zone.status === "watch" ? "bg-watch" : "bg-normal",
}));

const resources = [
  { icon: Battery, kw: "300 kW", label: "Battery" },
  { icon: Car, kw: "180 kW", label: "EV fleet" },
  { icon: Building2, kw: "170 kW", label: "Building" },
  { icon: Sun, kw: "100 kW", label: "Solar" },
  { icon: Zap, kw: "250 kW", label: "Generator" },
];

export function GridMapPreview() {
  return (
    <div className="relative overflow-hidden rounded-lg panel p-6 sm:p-8">
      <div className="relative grid grid-cols-3 items-center gap-3 text-center sm:gap-4">
        <div />
        <NodeDot label={satellites[1].label} status={satellites[1].status} />
        <div />

        <NodeDot label={satellites[2].label} status={satellites[2].status} />
        <div className="relative rounded-md border border-risk/50 bg-background-raised px-3 py-4">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-risk/50 bg-background-raised px-2 py-0.5 text-[10px] font-medium text-risk">
            {downtown.zone}
          </span>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            Forecast utilization
            <InfoTip label="forecast utilization" side="bottom">
              Forecast peak load as a share of the zone&rsquo;s capacity. Over 100% means the zone would be overloaded.
            </InfoTip>
          </p>
          <p className="font-mono text-xl font-semibold tabular text-risk">107%</p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
            Required flex
            <InfoTip label="required flex" side="bottom">
              Power that must be supplied or shifted locally to bring the zone back under its capacity.
            </InfoTip>
          </p>
          <p className="font-mono text-sm font-semibold tabular text-foreground">
            {downtown.requiredFlexKw} kW
          </p>
          <p className="mt-2 text-[11px] text-muted">Nearby capacity</p>
          <p className="font-mono text-sm font-semibold tabular text-foreground">
            {downtown.flexAvailableMw} MW
          </p>
        </div>
        <NodeDot label={satellites[0].label} status={satellites[0].status} />

      </div>

      <div className="relative mt-8 flex flex-wrap justify-center gap-3 border-t border-border pt-6">
        {resources.map(({ icon: Icon, kw, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-md border border-border bg-background-raised px-3 py-2"
          >
            <Icon className="h-4 w-4 text-muted" strokeWidth={1.5} aria-hidden="true" />
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
