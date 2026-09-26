import type { Zone, ZoneStatus } from "@/lib/demo-data";

const STATUS: Record<ZoneStatus, { label: string; text: string; bar: string; rank: number }> = {
  high: { label: "Needs flexibility", text: "text-risk", bar: "bg-risk", rank: 0 },
  watch: { label: "Close to limit", text: "text-watch", bar: "bg-watch", rank: 1 },
  normal: { label: "Normal", text: "text-normal", bar: "bg-normal", rank: 2 },
};

export function ZoneTable({ zones }: { zones: Zone[] }) {
  const sorted = [...zones].sort(
    (a, b) =>
      STATUS[a.status].rank - STATUS[b.status].rank ||
      b.forecastMw / b.capacityMw - a.forecastMw / a.capacityMw,
  );

  return (
    <section aria-labelledby="zones-heading" className="panel rounded-lg p-5 sm:p-6">
      <h2 id="zones-heading" className="text-lg font-semibold text-foreground">
        All zones tonight
      </h2>
      <p className="mt-1 text-sm text-muted">Sorted by how close each zone gets to its capacity.</p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 pr-3 font-medium">Zone</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="hidden pb-2 pr-3 text-right font-medium sm:table-cell">Load now</th>
              <th className="pb-2 pr-3 font-medium">
                <span className="sm:hidden">Peak</span>
                <span className="hidden sm:inline">Tonight&rsquo;s peak vs capacity</span>
              </th>
              <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Peak at</th>
              <th className="pb-2 text-right font-medium">Room at peak</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((zone) => {
              const status = STATUS[zone.status];
              const peakPct = Math.round((zone.forecastMw / zone.capacityMw) * 100);
              const room = zone.capacityMw - zone.forecastMw;
              return (
                <tr key={zone.name} className="border-t border-border">
                  <td className="py-3 pr-3 font-medium text-foreground">{zone.name}</td>
                  <td className={`py-3 pr-3 text-xs font-medium ${status.text}`}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.bar}`} aria-hidden="true" />
                      {status.label}
                    </span>
                  </td>
                  <td className="hidden py-3 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground/85 sm:table-cell">
                    {zone.currentMw.toFixed(1)} MW
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <UtilizationBar pct={peakPct} barClass={status.bar} />
                      <span className="font-mono text-xs whitespace-nowrap tabular text-foreground/85 sm:w-24">
                        {peakPct}% <span className="hidden text-muted-2 sm:inline">of {zone.capacityMw.toFixed(0)} MW</span>
                      </span>
                    </div>
                  </td>
                  <td className="hidden py-3 pr-3 whitespace-nowrap text-foreground/85 sm:table-cell">{zone.peakTime}</td>
                  <td
                    className={`py-3 text-right font-mono whitespace-nowrap tabular ${
                      room < 0 ? "font-semibold text-risk" : "text-foreground/85"
                    }`}
                  >
                    {room < 0 ? `${Math.abs(room).toFixed(1)} MW over` : `${room.toFixed(1)} MW`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Scale runs to 120% so overshoot is visible past the capacity tick. */
function UtilizationBar({ pct, barClass }: { pct: number; barClass: string }) {
  const scale = 120;
  return (
    <div className="relative hidden h-1.5 w-32 shrink-0 rounded-sm bg-white/[0.06] md:block" aria-hidden="true">
      <div className={`h-full rounded-sm ${barClass}`} style={{ width: `${(Math.min(pct, scale) / scale) * 100}%` }} />
      <span
        className="absolute -top-1 h-3.5 w-px bg-foreground/60"
        style={{ left: `${(100 / scale) * 100}%` }}
        title="Capacity"
      />
    </div>
  );
}
