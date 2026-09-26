import type { LucideIcon } from "lucide-react";

export function FlexResourceCard({
  icon: Icon,
  title,
  examples,
  description,
}: {
  icon: LucideIcon;
  title: string;
  examples: string[];
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-soft text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">
        {title}
      </h3>
      <ul className="mt-3 space-y-1">
        {examples.map((example) => (
          <li key={example} className="text-sm text-foreground/80">
            {example}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
    </div>
  );
}
