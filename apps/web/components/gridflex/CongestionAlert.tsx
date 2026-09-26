import { AlertTriangle } from "lucide-react";
import { downtown } from "@/lib/demo-data";

export function CongestionAlert() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-watch/25 bg-watch-soft p-4">
      <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-watch/15 text-watch">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-watch/20" />
      </span>
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
