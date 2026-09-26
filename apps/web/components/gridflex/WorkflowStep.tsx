import type { LucideIcon } from "lucide-react";

export function WorkflowStep({
  index,
  icon: Icon,
  title,
  description,
  children,
}: {
  index: number;
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft text-primary">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="font-mono text-xs text-muted">
          Step {index.toString().padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {description}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
