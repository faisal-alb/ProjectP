import type { LucideIcon } from "lucide-react";

export interface WorkflowStepData {
  icon: LucideIcon;
  title: string;
  description: string;
  readout?: React.ReactNode;
}

/**
 * A connected rail, not a row of identical cards: the sequence itself
 * carries meaning (predict before you procure), so the stations share one
 * baseline instead of five repeated boxes.
 */
export function WorkflowRail({ steps }: { steps: WorkflowStepData[] }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch">
      {steps.map((step, i) => (
        <div
          key={step.title}
          className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-stretch"
        >
          <Station index={i + 1} {...step} />
          {i < steps.length - 1 && <Connector />}
        </div>
      ))}
    </div>
  );
}

function Station({
  index,
  icon: Icon,
  title,
  description,
  readout,
}: WorkflowStepData & { index: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 py-2 lg:pr-4">
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background-raised text-muted">
          <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <span className="font-mono text-xs tabular text-muted-2">
          {index.toString().padStart(2, "0")}
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {description}
        </p>
      </div>
      {readout && <div className="mt-auto">{readout}</div>}
    </div>
  );
}

function Connector() {
  return (
    <div
      className="my-4 h-px w-full shrink-0 bg-border lg:my-0 lg:mx-5 lg:h-auto lg:w-px lg:self-stretch"
      aria-hidden="true"
    />
  );
}

export function WorkflowReadout({
  rows,
}: {
  rows: { label: string; value: string; accent?: boolean }[];
}) {
  return (
    <dl className="space-y-1.5 rounded-lg border border-border bg-background-raised px-3 py-2.5 text-xs">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <dt className="text-muted">{row.label}</dt>
          <dd
            className={`font-mono font-medium tabular ${row.accent ? "text-accent" : "text-foreground"}`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
