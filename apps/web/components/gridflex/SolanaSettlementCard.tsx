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
 * Solana's own purple/green duotone is reserved for this section only,
 * marking the boundary the product itself draws: cyan is GridFlex's
 * off-chain intelligence, purple/green is the on-chain settlement layer.
 */
export function SolanaSettlementCard() {
  return (
    <div
      className="grid grid-cols-1 divide-y divide-solana-purple/15 rounded-2xl border p-0 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4"
      style={{ borderColor: "rgba(153,69,255,0.22)", background: "rgba(153,69,255,0.04)" }}
    >
      {points.map(({ icon: Icon, title, description }) => (
        <div key={title} className="p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-solana-purple/30 bg-solana-soft text-solana-purple">
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
    <div
      className="rounded-2xl border p-6"
      style={{ borderColor: "rgba(153,69,255,0.22)", background: "rgba(153,69,255,0.04)" }}
    >
      <div className="flex flex-col items-center">
        {steps.map((step, i) => (
          <div key={step} className="flex flex-col items-center">
            <span
              className="rounded-full border px-4 py-2 text-sm font-medium text-foreground"
              style={{ borderColor: "rgba(153,69,255,0.3)" }}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <span
                className="h-5 w-px"
                style={{
                  background:
                    "linear-gradient(to bottom, var(--solana-purple), var(--solana-green))",
                }}
                aria-hidden="true"
              />
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
