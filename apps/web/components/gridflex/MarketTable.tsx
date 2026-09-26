"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { flexResources, marketTotals } from "@/lib/demo-data";

type RowStatus = "pending" | "accepted";

export function MarketTable() {
  const [statuses, setStatuses] = useState<RowStatus[]>(
    flexResources.map(() => "pending"),
  );

  useEffect(() => {
    const timers = flexResources.map((_, i) =>
      setTimeout(
        () => {
          setStatuses((prev) => {
            const next = [...prev];
            next[i] = "accepted";
            return next;
          });
        },
        500 + i * 450,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const committed = flexResources
    .filter((_, i) => statuses[i] === "accepted")
    .reduce((sum, r) => sum + r.kw, 0);

  return (
    <div className="rounded-lg panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="tracked-caps text-xs font-medium text-muted">
            Active Flex Market
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            Downtown Miami · 7:00–8:00 PM
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-muted">Requested</p>
            <p className="font-mono text-lg font-semibold tabular text-foreground">
              {marketTotals.requestedKw} kW
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Committed</p>
            <p className="font-mono text-lg font-semibold tabular text-accent">
              {committed} kW
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-medium">Resource</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Flex</th>
              <th className="pb-2 font-medium">Price</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {flexResources.map((resource, i) => (
              <tr key={resource.label} className="border-t border-border">
                <td className="py-2.5 pr-2 font-medium text-foreground">
                  {resource.label}
                </td>
                <td className="py-2.5 pr-2 text-muted">{resource.type}</td>
                <td className="py-2.5 pr-2 font-mono tabular text-foreground/80">
                  {resource.kw} kW
                </td>
                <td className="py-2.5 pr-2 font-mono tabular text-foreground/80">
                  ${resource.pricePerKwh.toFixed(2)}
                </td>
                <td className="py-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors duration-500 ${
                      statuses[i] === "accepted"
                        ? "text-normal"
                        : "text-muted-2"
                    }`}
                  >
                    {statuses[i] === "accepted" ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Clock className="h-3 w-3" aria-hidden="true" />
                    )}
                    {statuses[i] === "accepted" ? "Accepted" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">
          {marketTotals.committedKw} kW committed
        </span>
        <span className="text-sm text-muted">
          Estimated cost{" "}
          <span className="font-mono font-semibold tabular text-foreground">
            ${marketTotals.estimatedCost.toFixed(2)}
          </span>
        </span>
        <span className="text-sm text-muted">
          Settlement <span className="font-medium text-foreground">Solana</span>
        </span>
      </div>
    </div>
  );
}
