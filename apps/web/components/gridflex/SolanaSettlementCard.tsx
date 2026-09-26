import type { LucideIcon } from "lucide-react";
import { FileCheck2, ShieldCheck, ListChecks, HandCoins } from "lucide-react";

const points: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: FileCheck2,
    title: "Market commitments",
    description: "Record who committed flexibility and when.",
  },
  {
    icon: ShieldCheck,
    title: "Verification",
    description: "Attach proof of delivered grid relief.",
  },
  {
    icon: HandCoins,
    title: "Settlement",
    description: "Programmatically settle verified participation.",
  },
  {
    icon: ListChecks,
    title: "Auditability",
    description: "Provide a shared transaction history across independent participants.",
  },
];

export function SolanaSettlementCard() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {points.map(({ icon: Icon, title, description }) => (
        <div
          key={title}
          className="rounded-2xl border border-border bg-white p-5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft text-primary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>
      ))}
    </div>
  );
}

export function SettlementFlow() {
  const steps = ["Grid systems", "GridFlex", "Solana", "Settlement"];
  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <div className="flex flex-col items-center gap-2">
        {steps.map((step, i) => (
          <div key={step} className="flex flex-col items-center gap-2">
            <span className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
              {step}
            </span>
            {i < steps.length - 1 && (
              <span className="h-4 w-px bg-border" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-sm text-muted">
        Electricity remains on the physical grid.
        <br />
        Solana coordinates the market and settlement layer.
      </p>
    </div>
  );
}
