"use client";

import { household } from "@/lib/demo-data";
import { AskGridFlexButton } from "@/components/voice/AskButton";
import { useHouseholdState } from "./HouseholdState";
import { PageHeader } from "./PageHeader";
import { TxLink } from "./TxLink";

const money = (n: number) => `$${n.toFixed(2)}`;
const price = (n: number) => `$${n.toFixed(2)}/kWh`;

const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today";

export function HouseholdEarnings() {
  const { zone, month, today, lifetime, todayExtra, livePayouts } = useHouseholdState();

  return (
    <div>
      <PageHeader title="Earnings" subtitle="What you've been paid for supporting the grid.">
        <AskGridFlexButton prompt="How much have I earned this month, and where did it come from?" label="Ask" className="!px-3 !py-1.5 text-xs" />
      </PageHeader>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Total label="This month" value={month} />
        <Total label="Today" value={today} />
        <Total label="Lifetime" value={lifetime} />
      </dl>

      <section id="voice-earnings" aria-labelledby="earnings-heading" className="panel mt-6 rounded-lg p-5">
        <h2 id="earnings-heading" className="tracked-caps text-xs font-medium text-muted">
          Recent earnings
        </h2>
        <ul className="mt-3 divide-y divide-border">
          {todayExtra > 0 && <Row title={`${zone} Flex Event`} sub="Today" amount={todayExtra} status="Paid" />}
          {livePayouts.map((p) => (
            <Row
              key={p.marketId}
              title={`${zone} Flex Event`}
              sub={`${shortDate(p.settledAt)}${p.deliveredKw !== undefined ? ` · ${p.deliveredKw.toFixed(1)} kWh` : ""}`}
              amount={Number(p.amount.base) / 1e6}
              status="Paid"
              url={p.url}
            />
          ))}
          {household.history.map((h) =>
            h.status === "paid" ? (
              <Row
                key={h.date}
                title="Battery dispatch"
                sub={`${h.date} · ${h.kwh.toFixed(1)} kWh at ${price(h.pricePerKwh)}`}
                amount={h.kwh * h.pricePerKwh}
                status="Paid"
              />
            ) : (
              <li key={h.date} className="flex items-baseline justify-between gap-3 py-3 text-sm text-muted">
                <span>
                  Skipped
                  <span className="block text-xs text-muted-2">
                    {h.date} · rate was {price(h.pricePerKwh)}
                  </span>
                </span>
                <span className="font-mono tabular">$0.00</span>
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel rounded-lg p-5">
      <dt className="tracked-caps text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-3 font-mono text-3xl font-semibold tabular text-foreground">{money(value)}</dd>
    </div>
  );
}

function Row({
  title,
  sub,
  amount,
  status,
  url,
}: {
  title: string;
  sub: string;
  amount: number;
  status: string;
  url?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-3 text-sm">
      <span className="min-w-0">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted">
          {sub} · <span className="text-normal">{status}</span>
          {url && (
            <>
              {" · "}
              <TxLink href={url} label="Receipt" />
            </>
          )}
        </span>
      </span>
      <span className="shrink-0 font-mono font-semibold tabular text-normal">+{money(amount)}</span>
    </li>
  );
}
