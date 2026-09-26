import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { forecastUpdatedAt, zones } from "@/lib/demo-data";
import { DowntownEvent } from "./DowntownEvent";

export function OperatorDashboard({ initialCap }: { initialCap: number }) {
  const counts = {
    high: zones.filter((z) => z.status === "high").length,
    watch: zones.filter((z) => z.status === "watch").length,
    normal: zones.filter((z) => z.status === "normal").length,
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Miami grid</h1>
          <p className="mt-1 text-sm text-muted">Tonight&rsquo;s outlook · Forecast updated {forecastUpdatedAt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Zone summary">
            <SummaryItem dot="bg-risk" count={counts.high} label="needs flexibility" plural="need flexibility" />
            <SummaryItem dot="bg-watch" count={counts.watch} label="close to limit" />
            <SummaryItem dot="bg-normal" count={counts.normal} label="normal" />
          </ul>
          <Link href="/dashboard/zones" className="inline-flex items-center gap-0.5 text-muted transition-colors hover:text-foreground">
            All zones
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <DowntownEvent initialCap={initialCap} />
      </div>
    </div>
  );
}

function SummaryItem({ dot, count, label, plural }: { dot: string; count: number; label: string; plural?: string }) {
  return (
    <li className="flex items-center gap-2 text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">
          {count} {count === 1 ? "zone" : "zones"}
        </span>{" "}
        {count === 1 ? label : (plural ?? label)}
      </span>
    </li>
  );
}
