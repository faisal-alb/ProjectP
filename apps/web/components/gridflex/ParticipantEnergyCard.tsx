import { BatteryMedium } from "lucide-react";

export function ParticipantEnergyCard() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">
          Home Energy
        </p>
        <BatteryMedium className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Battery</p>
          <p className="text-2xl font-semibold text-foreground">78%</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Available flex</p>
          <p className="font-mono text-lg font-semibold text-primary">
            8.2 kWh
          </p>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border/70">
        <div className="h-full w-[78%] rounded-full bg-bright" />
      </div>

      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">GridFlex event</dt>
          <dd className="font-medium text-foreground">7:30–8:30 PM</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Rate</dt>
          <dd className="font-mono font-medium text-foreground">
            $0.31 / kWh
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Potential payout</dt>
          <dd className="font-mono font-semibold text-primary">$2.54</dd>
        </div>
      </dl>

      <button
        type="button"
        className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        Participate
      </button>
    </div>
  );
}

export function AutoFlexCard() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">AutoFlex</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-bright" />
          Enabled
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Minimum battery reserve</dt>
          <dd className="font-mono font-medium text-foreground">40%</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Participate when price exceeds</dt>
          <dd className="font-mono font-medium text-foreground">
            $0.18 / kWh
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Maximum discharge</dt>
          <dd className="font-mono font-medium text-foreground">8 kWh</dd>
        </div>
      </dl>
    </div>
  );
}
