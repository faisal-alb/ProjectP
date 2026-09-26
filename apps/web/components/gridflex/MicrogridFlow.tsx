import { Sun, Battery, Zap, Home, Network } from "lucide-react";

const priorities = ["Solar", "Stored energy", "Grid supply", "Generator backup"];

export function MicrogridFlow() {
  return (
    <div className="rounded-2xl glass-panel p-6 sm:p-8">
      <div className="grid grid-cols-3 items-center gap-3 text-center">
        <SourceNode icon={Sun} label="Solar" />
        <div />
        <SourceNode icon={Battery} label="Battery" />

        <div />
        <ConnectorNode />
        <div />

        <div />
        <span className="rounded-full border border-accent/30 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent sm:text-sm">
          GridFlex Coordination
        </span>
        <div />

        <div />
        <ConnectorNode />
        <div />

        <SourceNode icon={Home} label="Community Demand" />
        <div />
        <SourceNode icon={Zap} label="Generator" />
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p className="tracked-caps text-xs font-medium text-muted">
          Dispatch priority
        </p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {priorities.map((label, i) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-background-raised px-3 py-1.5 text-xs font-medium text-foreground"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-background">
                {i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          Dispatch policy can optimize for cost, reliability, emissions, or a
          combination.
        </p>
      </div>
    </div>
  );
}

function SourceNode({ icon: Icon, label }: { icon: typeof Sun; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-xs font-medium text-foreground">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/25 bg-accent-soft text-accent">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {label}
    </div>
  );
}

function ConnectorNode() {
  return (
    <span className="mx-auto flex h-4 w-4 items-center justify-center text-muted-2">
      <Network className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
