import { BatteryMedium } from "lucide-react";

function SegmentedGauge({ percent }: { percent: number }) {
  const segments = 12;
  const filled = Math.round((percent / 100) * segments);
  return (
    <div className="flex gap-1" role="img" aria-label={`Battery ${percent}%`}>
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={`h-2.5 flex-1 rounded-[2px] ${
            i < filled
              ? "bg-accent shadow-[0_0_6px_1px_rgba(87,214,255,0.6)]"
              : "bg-white/[0.07]"
          }`}
        />
      ))}
    </div>
  );
}

export function ParticipantEnergyCard() {
  return (
    <div className="rounded-2xl glass-panel p-5">
      <div className="flex items-center justify-between">
        <p className="tracked-caps text-xs font-medium text-muted">
          Home Energy
        </p>
        <BatteryMedium className="h-4 w-4 text-accent" aria-hidden="true" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Battery</p>
          <p className="text-2xl font-semibold text-foreground">78%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Available flex</p>
          <p className="font-mono text-lg font-semibold tabular text-accent">
            8.2 kWh
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SegmentedGauge percent={78} />
      </div>

      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">GridFlex event</dt>
          <dd className="font-medium text-foreground">7:30–8:30 PM</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Rate</dt>
          <dd className="font-mono font-medium tabular text-foreground">
            $0.31 / kWh
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Potential payout</dt>
          <dd className="font-mono font-semibold tabular text-accent">$2.54</dd>
        </div>
      </dl>

      <button
        type="button"
        className="mt-5 w-full rounded-full bg-accent py-2.5 text-sm font-semibold text-background transition-transform hover:scale-[1.01]"
      >
        Participate
      </button>
    </div>
  );
}

export function AutoFlexCard() {
  return (
    <div className="rounded-2xl glass-panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">AutoFlex</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Enabled
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Minimum battery reserve</dt>
          <dd className="font-mono font-medium tabular text-foreground">40%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Participate when price exceeds</dt>
          <dd className="font-mono font-medium tabular text-foreground">
            $0.18 / kWh
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Maximum discharge</dt>
          <dd className="font-mono font-medium tabular text-foreground">8 kWh</dd>
        </div>
      </dl>
    </div>
  );
}
