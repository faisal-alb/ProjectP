"use client";

import { useEffect, useState } from "react";
import { zones } from "@/lib/demo-data";
import { GridStatusBadge } from "./GridStatusBadge";
import { CongestionAlert } from "./CongestionAlert";

const BASE_LOAD = 78;

export function HeroGridPreview() {
  const [load, setLoad] = useState(BASE_LOAD);

  useEffect(() => {
    const id = setInterval(() => {
      setLoad((prev) => {
        const next = prev + (Math.random() - 0.5) * 1.4;
        return Math.min(84, Math.max(74, Math.round(next * 10) / 10));
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-md rounded-2xl glass-panel p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="tracked-caps text-[11px] font-medium text-muted">
            Miami Grid
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            System Load
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="font-mono text-2xl font-semibold tabular text-foreground">
              {load.toFixed(1)}
              <span className="text-sm text-muted">%</span>
            </span>
          </div>
          <p className="text-[11px] text-muted">live</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 pr-1.5 font-medium">Zone</th>
              <th className="pb-2 pr-1.5 font-medium">Capacity</th>
              <th className="pb-2 pr-1.5 font-medium">Current</th>
              <th className="pb-2 pr-1.5 font-medium">Forecast</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr
                key={zone.name}
                className={`border-t border-border ${
                  zone.status === "high" ? "bg-risk-soft/60" : ""
                }`}
              >
                <td className="py-2 pr-1.5 font-medium text-foreground">
                  {zone.name}
                </td>
                <td className="py-2 pr-1.5 font-mono tabular text-foreground/80">
                  {zone.capacityMw.toFixed(1)} MW
                </td>
                <td className="py-2 pr-1.5 font-mono tabular text-foreground/80">
                  {zone.currentMw.toFixed(1)} MW
                </td>
                <td className="py-2 pr-1.5 font-mono tabular text-foreground/80">
                  {zone.forecastMw.toFixed(1)} MW
                </td>
                <td className="py-2">
                  <span className="block sm:hidden">
                    <GridStatusBadge status={zone.status} compact />
                  </span>
                  <span className="hidden sm:block">
                    <GridStatusBadge status={zone.status} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <CongestionAlert />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-accent/20 bg-accent-soft px-4 py-3">
        <span className="text-xs font-medium text-accent">
          Available local flexibility
        </span>
        <span className="font-mono text-sm font-semibold text-accent tabular">
          1.4 MW
        </span>
      </div>
    </div>
  );
}
