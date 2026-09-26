"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Zone, ZoneStatus } from "@/lib/demo-data";

const STATUS: Record<ZoneStatus, { label: string; text: string; bar: string; rank: number }> = {
  high: { label: "Needs flexibility", text: "text-risk", bar: "bg-risk", rank: 0 },
  watch: { label: "Close to limit", text: "text-watch", bar: "bg-watch", rank: 1 },
  normal: { label: "Normal", text: "text-normal", bar: "bg-normal", rank: 2 },
};

const peakPct = (z: Zone) => Math.round((z.forecastMw / z.capacityMw) * 100);
const roomLabel = (room: number) => (room < 0 ? `${Math.abs(room).toFixed(1)} MW over` : `${room.toFixed(1)} MW`);

/**
 * "All zones tonight" as a sidebar: a compact list by default, the full table when expanded.
 * `expanded` is owned by the page so it can widen the column.
 */
export function ZoneTable({
  zones,
  expanded,
  onExpandedChange,
}: {
  zones: Zone[];
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}) {
  const sorted = [...zones].sort(
    (a, b) => STATUS[a.status].rank - STATUS[b.status].rank || peakPct(b) - peakPct(a),
  );
  const Icon = expanded ? PanelRightClose : PanelRightOpen;

  return (
    <section aria-labelledby="zones-heading" className="panel rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="zones-heading" className="text-lg font-semibold text-foreground">
            All zones tonight
          </h2>
          <p className="mt-1 text-sm text-muted">Sorted by how close each zone gets to its capacity.</p>
        </div>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-controls="zones-body"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {expanded ? "Compact" : "Details"}
        </button>
      </div>

      <div id="zones-body" className="mt-4">
        {expanded ? <FullTable zones={sorted} /> : <CompactList zones={sorted} />}
      </div>
    </section>
  );
}

function CompactList({ zones }: { zones: Zone[] }) {
  return (
    <ul className="divide-y divide-border">
      {zones.map((zone) => {
        const status = STATUS[zone.status];
        const pct = peakPct(zone);
        const room = zone.capacityMw - zone.forecastMw;
        return (
          <li key={zone.name} className="py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${status.bar}`} aria-hidden="true" />
                <span className="truncate text-sm font-medium text-foreground">{zone.name}</span>
              </span>
              <span className="font-mono text-sm tabular text-foreground/85">{pct}%</span>
            </div>
            <div className="mt-2 pl-4">
              <UtilizationBar pct={pct} barClass={status.bar} className="w-full" />
              <p className="mt-1.5 flex justify-between gap-2 text-xs">
                <span className={status.text}>{status.label}</span>
                <span className={`font-mono tabular ${room < 0 ? "font-semibold text-risk" : "text-muted"}`}>
                  {room < 0 ? roomLabel(room) : `${roomLabel(room)} spare`}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FullTable({ zones }: { zones: Zone[] }) {
  return (
    <div className="overflow-x-auto">
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
          {zones.map((zone) => {
            const status = STATUS[zone.status];
            const pct = peakPct(zone);
            const room = zone.capacityMw - zone.forecastMw;
            return (
              <tr key={zone.name} className="border-t border-border">
                <td className="py-3 pr-3 font-medium text-foreground">{zone.name}</td>
                <td className={`py-3 pr-3 text-xs font-medium ${status.text}`}>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className={`h-1.5 w-1.5 rounded-full ${status.bar}`} aria-hidden="true" />
                    {status.label}
                  </span>
                </td>
                <td className="hidden py-3 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground/85 sm:table-cell">
                  {zone.currentMw.toFixed(1)} MW
                </td>
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3">
                    <UtilizationBar pct={pct} barClass={status.bar} className="hidden w-32 md:block" />
                    <span className="font-mono text-xs whitespace-nowrap tabular text-foreground/85 sm:w-24">
                      {pct}% <span className="hidden text-muted-2 sm:inline">of {zone.capacityMw.toFixed(0)} MW</span>
                    </span>
                  </div>
                </td>
                <td className="hidden py-3 pr-3 whitespace-nowrap text-foreground/85 sm:table-cell">{zone.peakTime}</td>
                <td
                  className={`py-3 text-right font-mono whitespace-nowrap tabular ${
                    room < 0 ? "font-semibold text-risk" : "text-foreground/85"
                  }`}
                >
                  {roomLabel(room)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Scale runs to 120% so overshoot is visible past the capacity tick. */
function UtilizationBar({ pct, barClass, className }: { pct: number; barClass: string; className: string }) {
  const scale = 120;
  return (
    <div className={`relative h-1.5 shrink-0 rounded-sm bg-white/[0.06] ${className}`} aria-hidden="true">
      <div className={`h-full rounded-sm ${barClass}`} style={{ width: `${(Math.min(pct, scale) / scale) * 100}%` }} />
      <span
        className="absolute -top-1 h-3.5 w-px bg-foreground/60"
        style={{ left: `${(100 / scale) * 100}%` }}
        title="Capacity"
      />
    </div>
  );
}
