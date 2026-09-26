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

/**
 * Solana purple is reserved for this section's icons only, marking the
 * boundary the product itself draws: off-chain intelligence vs. the
 * on-chain settlement layer.
 */
export function SolanaSettlementCard() {
  return (
    <div
      className="panel grid grid-cols-1 divide-y divide-border rounded-lg sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"
    >
      {points.map(({ icon: Icon, title, description }) => (
        <div key={title} className="p-5">
          <Icon className="h-5 w-5 text-solana-purple" strokeWidth={1.5} aria-hidden="true" />
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
    <div className="panel rounded-lg p-6">
      <div className="flex flex-col items-center">
        {steps.map((step, i) => (
          <div key={step} className="flex flex-col items-center">
            <span className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground">
              {step}
            </span>
            {i < steps.length - 1 && (
              <span className="h-5 w-px bg-border-strong" aria-hidden="true" />
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
