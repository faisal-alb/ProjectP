import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/gridflex/Logo";
import { CongestionAlert } from "@/components/gridflex/CongestionAlert";
import { GridMapPreview } from "@/components/gridflex/GridMapPreview";
import { GridIntelligencePanel } from "@/components/gridflex/GridIntelligencePanel";
import { MarketTable } from "@/components/gridflex/MarketTable";
import { ZoneStatusCard } from "@/components/gridflex/ZoneStatusCard";
import { zones } from "@/lib/demo-data";

export const metadata = {
  title: "GridFlex Demo — Live Grid Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <Link href="/">
              <Wordmark />
            </Link>
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span className="hidden tracked-caps text-[11px] font-medium text-muted sm:inline">
              Grid Operations
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-normal" />
              Live
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded border border-border px-3.5 py-1.5 text-sm font-medium text-foreground/90 transition-colors hover:border-border-strong"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to site
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-8 sm:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Miami Grid Overview
            </h1>
            <p className="mt-1 text-sm text-muted">
              Four zones monitored · Downtown flagged for predicted congestion
            </p>
          </div>
        </div>

        <div className="mt-6">
          <CongestionAlert />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GridMapPreview />
          </div>
          <div>
            <GridIntelligencePanel />
          </div>
        </div>

        <div className="mt-8">
          <h2 className="tracked-caps text-xs font-medium text-muted">Zone status</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {zones.map((zone) => (
              <ZoneStatusCard
                key={zone.name}
                zone={zone}
                highlighted={zone.status === "high"}
              />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="tracked-caps text-xs font-medium text-muted">Active flexibility market</h2>
          <div className="mt-3">
            <MarketTable />
          </div>
        </div>
      </main>
    </div>
  );
}
