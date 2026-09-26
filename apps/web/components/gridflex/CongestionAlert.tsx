import { AlertTriangle } from "lucide-react";
import { downtown } from "@/lib/demo-data";

export function CongestionAlert() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border border-l-2 border-l-watch bg-surface p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-watch" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          Congestion predicted
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {downtown.zone} · {downtown.peakTime}
        </p>
        <p className="mt-2 text-xs text-muted">
          Required flexibility{" "}
          <span className="font-mono font-semibold text-foreground tabular">
            {downtown.requiredFlexKw} kW
          </span>
        </p>
      </div>
    </div>
  );
}
