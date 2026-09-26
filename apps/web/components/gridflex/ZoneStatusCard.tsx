import type { Zone } from "@/lib/demo-data";
import { GridStatusBadge } from "./GridStatusBadge";

export function ZoneStatusCard({
  zone,
  highlighted = false,
}: {
  zone: Zone;
  highlighted?: boolean;
}) {
  const utilization = Math.round((zone.currentMw / zone.capacityMw) * 100);

  return (
    <div
      className={`rounded-md border p-4 transition-colors ${
        highlighted ? "border-risk/50 bg-surface" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {zone.name}
        </span>
        <GridStatusBadge status={zone.status} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted">Capacity</dt>
          <dd className="mt-0.5 font-mono font-medium tabular text-foreground">
            {zone.capacityMw.toFixed(1)} MW
          </dd>
        </div>
        <div>
          <dt className="text-muted">Current</dt>
          <dd className="mt-0.5 font-mono font-medium tabular text-foreground">
            {zone.currentMw.toFixed(1)} MW
          </dd>
        </div>
        <div>
          <dt className="text-muted">Forecast</dt>
          <dd
            className={`mt-0.5 font-mono font-medium tabular ${
              zone.status === "high" ? "text-risk" : "text-foreground"
            }`}
          >
            {zone.forecastMw.toFixed(1)} MW
          </dd>
        </div>
      </dl>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-sm bg-white/[0.06]">
        <div
          className={`h-full ${
            zone.status === "high"
              ? "bg-risk"
              : zone.status === "watch"
                ? "bg-watch"
                : "bg-normal"
          }`}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>
    </div>
  );
}
