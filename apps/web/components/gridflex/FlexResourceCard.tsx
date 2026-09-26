import type { LucideIcon } from "lucide-react";

export interface FlexResourceEntry {
  icon: LucideIcon;
  title: string;
  examples: string[];
  description: string;
}

/**
 * One instrument panel divided into readout zones, not four separate
 * cards: these are parallel categories on a single console, the way a
 * control room groups related gauges under one bezel.
 */
export function FlexInstrumentPanel({ items }: { items: FlexResourceEntry[] }) {
  return (
    <div className="grid grid-cols-1 divide-y divide-border rounded-lg panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      {items.map(({ icon: Icon, title, examples, description }) => (
        <div key={title} className="p-6">
          <Icon className="h-5 w-5 text-muted" strokeWidth={1.5} aria-hidden="true" />
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {title}
          </h3>
          <ul className="mt-3 space-y-1">
            {examples.map((example) => (
              <li key={example} className="text-sm text-foreground/75">
                {example}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>
      ))}
    </div>
  );
}
