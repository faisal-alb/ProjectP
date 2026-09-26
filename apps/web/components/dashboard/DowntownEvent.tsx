"use client";

import { useId, useState } from "react";
import { AlertCircle, Check, Circle } from "lucide-react";
import {
  clearMarket,
  defaultPriceCap,
  downtown,
  downtownLoadCurve,
  flexOffers,
  forecastDrivers,
  NOW_MINUTES,
  WINDOW_END_MINUTES,
  WINDOW_START_MINUTES,
  type OfferOutcome,
} from "@/lib/demo-data";
import { useCurrentMarket, type MarketDto } from "@/lib/api";
import { rangeFill } from "@/components/onboarding/controls";
import { EscrowCard } from "./EscrowCard";
import { LoadForecastChart } from "./LoadForecastChart";
import { useSolana } from "./SolanaProvider";
import { TxLink } from "./TxLink";

const money = (n: number) => `$${n.toFixed(2)}`;
const price = (n: number) => `$${n.toFixed(2)}/kWh`;

/** The lowest cap that covers the whole need, cheapest offers first. */
const coveringCap = Math.max(
  ...clearMarket(flexOffers, downtown.requiredFlexKw, Infinity)
    .rows.filter((r) => r.acceptedKw > 0)
    .map((r) => r.offer.pricePerKwh),
);

export function DowntownEvent({ initialCap = defaultPriceCap }: { initialCap?: number }) {
  const [chosenCap, setCap] = useState(initialCap);
  const capId = useId();
  const { apiStatus } = useSolana();
  const { market: current, setMarket } = useCurrentMarket(apiStatus === "online");
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const live = current && current.id !== dismissedId ? current : null;
  // Once a request is funded its price is fixed on-chain.
  const locked = live !== null && live.phase !== "settled";
  const cap = locked ? live.maxPricePerKwh : chosenCap;
  const market = clearMarket(flexOffers, downtown.requiredFlexKw, cap);
  const covered = market.shortfallKw === 0;
  const avgPrice = market.committedKw ? market.cost / market.committedKw : 0;

  return (
    <div className="space-y-6">
      {/* Situation */}
      <section aria-labelledby="downtown-heading" className="panel rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-1.5 text-sm font-medium text-risk">
              <span className="h-1.5 w-1.5 rounded-full bg-risk" aria-hidden="true" />
              Needs flexibility
            </p>
            <h2 id="downtown-heading" className="mt-2 text-xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
              Downtown Miami is forecast to go over capacity tonight
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              Load is expected to peak at{" "}
              <strong className="font-semibold text-foreground">{downtown.forecastLoadMw} MW</strong> at{" "}
              {downtown.peakTime}, above the zone&rsquo;s {downtown.capacityMw.toFixed(1)} MW limit (
              {downtown.riskPercent}% likely). Covering{" "}
              <strong className="font-semibold text-foreground">{downtown.requiredFlexKw} kW</strong> from{" "}
              {downtown.window.replace(" – ", " to ")} keeps it within capacity.
            </p>
          </div>

          <EscrowCard
            market={live}
            cap={cap}
            requiredKw={downtown.requiredFlexKw}
            plannedKw={market.committedKw}
            covered={covered}
            onMarket={setMarket}
            onReset={() => live && setDismissedId(live.id)}
          />
        </div>

        <Progress
          covered={covered}
          committedKw={market.committedKw}
          liveMode={apiStatus === "online"}
          market={live}
        />

        <div className="mt-6 grid gap-8 border-t border-border pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Load forecast for tonight</h3>
            <div className="mt-3">
              <LoadForecastChart
                curve={downtownLoadCurve}
                capacityMw={downtown.capacityMw}
                committedKw={market.committedKw}
                nowMinutes={NOW_MINUTES}
                windowStart={WINDOW_START_MINUTES}
                windowEnd={WINDOW_END_MINUTES}
              />
            </div>
          </div>
          <Drivers />
        </div>
      </section>

      {/* Market */}
      <section aria-labelledby="market-heading" className="panel rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="market-heading" className="text-lg font-semibold text-foreground">
              Flexibility request
            </h2>
            <p className="mt-1 text-sm text-muted">
              Downtown Miami · {downtown.window} · {downtown.requiredFlexKw} kW needed. Offers are accepted
              cheapest first until the need is covered.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={capId} className="text-sm font-medium text-foreground">
                Highest price you&rsquo;ll pay
              </label>
              <span className="font-mono text-sm font-semibold tabular text-foreground">{price(cap)}</span>
            </div>
            <input
              id={capId}
              type="range"
              min={0.05}
              max={0.4}
              step={0.01}
              value={cap}
              onChange={(e) => setCap(Math.round(Number(e.target.value) * 100) / 100)}
              style={rangeFill(cap, 0.05, 0.4)}
              className="mt-1 w-full"
              disabled={locked}
              aria-describedby={`${capId}-hint`}
            />
            <div id={`${capId}-hint`} className="flex justify-between text-xs text-muted-2">
              {locked ? (
                <span>Fixed while this request is funded</span>
              ) : (
                <>
                  <span>$0.05</span>
                  <span>$0.40</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p
          className={`mt-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
            covered ? "border-border bg-background-raised text-foreground" : "border-watch/40 bg-background-raised text-foreground"
          }`}
          role="status"
        >
          {covered ? (
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-normal" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-watch" aria-hidden="true" />
          )}
          <span>
            {covered ? (
              <>
                Fully covered for <strong className="font-semibold">{money(market.cost)}</strong> for the hour, an
                average of {price(avgPrice)}.
              </>
            ) : (
              <>
                <strong className="font-semibold">{market.shortfallKw} kW short.</strong> Downtown Miami would still go over
                capacity. Raise your price to at least {price(coveringCap)} to cover the full {downtown.requiredFlexKw}{" "}
                kW.
              </>
            )}
          </span>
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-2 pr-3 font-medium">Resource</th>
                <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Type</th>
                <th className="pb-2 pr-3 text-right font-medium">Price</th>
                <th className="hidden pb-2 pr-3 text-right font-medium sm:table-cell">Offered</th>
                <th className="pb-2 pr-3 text-right font-medium">Accepted</th>
                <th className="pb-2 pl-3 font-medium">Status</th>
                {live?.phase === "settled" && <th className="pb-2 pl-3 text-right font-medium">Paid</th>}
              </tr>
            </thead>
            <tbody>
              {market.rows.map(({ offer, acceptedKw, outcome }) => (
                <tr key={offer.label} className="border-t border-border">
                  <td className={`py-2.5 pr-3 font-medium ${acceptedKw ? "text-foreground" : "text-muted"}`}>
                    {offer.label}
                  </td>
                  <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">{offer.type}</td>
                  <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground/85">
                    {price(offer.pricePerKwh)}
                  </td>
                  <td className="hidden py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground/85 sm:table-cell">{offer.kw} kW</td>
                  <td
                    className={`py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular ${
                      acceptedKw ? "font-semibold text-foreground" : "text-muted-2"
                    }`}
                  >
                    {acceptedKw ? `${acceptedKw} kW` : "—"}
                  </td>
                  <td className="py-2.5 pl-3">
                    <OutcomeLabel outcome={outcome} />
                  </td>
                  {live?.phase === "settled" && (
                    <td className="py-2.5 pl-3 text-right font-mono whitespace-nowrap tabular text-foreground">
                      {paidFor(live, offer.label, offer.type)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-strong">
                <td className="pt-3 pr-3 font-medium text-foreground sm:hidden" colSpan={2}>
                  Total accepted
                </td>
                <td className="hidden pt-3 pr-3 font-medium text-foreground sm:table-cell" colSpan={4}>
                  Total accepted
                </td>
                <td className="pt-3 pr-3 text-right font-mono font-semibold whitespace-nowrap tabular text-foreground">
                  {market.committedKw} kW
                </td>
                <td className="pt-3 pl-3 text-muted">
                  <span className="font-mono tabular text-foreground">{money(market.cost)}</span> for the hour
                </td>
                {live?.phase === "settled" && (
                  <td className="pt-3 pl-3 text-right font-mono font-semibold whitespace-nowrap tabular text-foreground">
                    {live.paid?.formatted}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

      </section>
    </div>
  );
}

type StepState = "done" | "attention" | "upcoming";

/** Sum of payouts for an offer; home batteries are paid per household. */
function paidFor(market: MarketDto, label: string, type: string) {
  const rows = market.commitments.filter((c) =>
    type === "Home batteries" ? c.type === "Home batteries" : c.label === label,
  );
  if (!rows.length) return "—";
  const base = rows.reduce((s, c) => s + BigInt(c.payout?.base ?? "0"), 0n);
  return `$${(Number(base) / 1e6).toFixed(2)}`;
}

const PHASE_ORDER = ["awaiting-signature", "open", "committed", "verified", "settled"] as const;

function Progress({
  covered,
  committedKw,
  liveMode,
  market,
}: {
  covered: boolean;
  committedKw: number;
  /** When the settlement API is reachable, steps follow the real market. */
  liveMode: boolean;
  market: MarketDto | null;
}) {
  const reached = (phase: (typeof PHASE_ORDER)[number]) =>
    market !== null && PHASE_ORDER.indexOf(market.phase) >= PHASE_ORDER.indexOf(phase);

  const steps: { label: string; detail: string; state: StepState; href?: string }[] = liveMode
    ? [
        { label: "Overload forecast", detail: `${downtown.riskPercent}% likely at ${downtown.peakTime}`, state: "done" },
        reached("open")
          ? { label: "Request opened", detail: `${market!.escrow.formatted} USDC in escrow`, state: "done", href: market!.transactions.create }
          : { label: "Open the request", detail: "Waiting for you to fund it", state: "attention" },
        reached("committed")
          ? { label: "Resources committed", detail: `${market!.committedKw} of ${downtown.requiredFlexKw} kW`, state: "done", href: market!.transactions.accept }
          : { label: "Commit resources", detail: covered ? "Cheapest offers first" : `${committedKw} of ${downtown.requiredFlexKw} kW at this price`, state: covered ? "upcoming" : "attention" },
        reached("verified")
          ? { label: "Delivery verified", detail: "Meter readings recorded", state: "done", href: market!.transactions.verify }
          : { label: "Verify delivery", detail: "From meter data after 8:00 PM", state: "upcoming" },
        reached("settled")
          ? { label: "Payments settled", detail: `${market!.paid?.formatted} paid · ${market!.refund?.formatted} refunded`, state: "done", href: market!.transactions.close }
          : { label: "Settle payments", detail: "USDC on Solana once verified", state: "upcoming" },
      ]
    : [
        { label: "Overload forecast", detail: `${downtown.riskPercent}% likely at ${downtown.peakTime}`, state: "done" },
        { label: "Request opened", detail: `${downtown.requiredFlexKw} kW, ${downtown.window}`, state: "done" },
        {
          label: covered ? "Resources committed" : "Committing resources",
          detail: `${committedKw} of ${downtown.requiredFlexKw} kW`,
          state: covered ? "done" : "attention",
        },
        { label: "Verify delivery", detail: "From meter data after 8:00 PM", state: "upcoming" },
        { label: "Settle payments", detail: "Recorded on Solana once verified", state: "upcoming" },
      ];

  return (
    <ol className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
      {steps.map((step, i) => (
        <li key={step.label} className="flex gap-2.5 lg:pr-4">
          <StepIcon state={step.state} />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${step.state === "upcoming" ? "text-muted" : "text-foreground"}`}>
              <span className="sr-only">
                Step {i + 1}, {step.state === "done" ? "complete" : step.state === "attention" ? "needs attention" : "upcoming"}:{" "}
              </span>
              {step.label}
            </p>
            <p className="mt-0.5 text-xs text-muted-2">{step.detail}</p>
            {step.href && (
              <div className="mt-0.5">
                <TxLink href={step.href} label="View transaction" />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-normal text-background">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === "attention") {
    return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-watch" aria-hidden="true" />;
  }
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />;
}

function Drivers() {
  const { baselineMw, baselineLabel, items } = forecastDrivers;
  const max = Math.max(...items.map((d) => d.mw));
  const total = baselineMw + items.reduce((s, d) => s + d.mw, 0);

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground">Why the forecast is high</h3>
      <p className="mt-1 text-xs text-muted">What adds up to the {downtown.peakTime} peak</p>

      <dl className="mt-4 text-sm">
        <div className="flex items-baseline justify-between gap-3 pb-3">
          <dt className="text-muted">{baselineLabel}</dt>
          <dd className="font-mono tabular text-foreground">{baselineMw.toFixed(1)} MW</dd>
        </div>
        {items.map((d) => (
          <div key={d.label} className="border-t border-border py-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium text-foreground">{d.label}</dt>
              <dd className="font-mono tabular text-foreground">+{d.mw.toFixed(1)} MW</dd>
            </div>
            <p className="mt-0.5 text-xs text-muted">{d.detail}</p>
            <div className="mt-2 h-1 rounded-sm bg-white/[0.05]">
              <div className="h-full rounded-sm bg-chart-forecast/80" style={{ width: `${(d.mw / max) * 100}%` }} />
            </div>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-border-strong pt-3">
          <dt className="font-medium text-foreground">Forecast peak</dt>
          <dd className="font-mono font-semibold tabular text-foreground">{total.toFixed(1)} MW</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="text-muted">Zone capacity</dt>
          <dd className="font-mono tabular text-muted">{downtown.capacityMw.toFixed(1)} MW</dd>
        </div>
      </dl>
    </div>
  );
}

function OutcomeLabel({ outcome }: { outcome: OfferOutcome }) {
  const config: Record<OfferOutcome, { label: string; className: string }> = {
    accepted: { label: "Accepted", className: "text-normal" },
    partial: { label: "Partly accepted", className: "text-normal" },
    "not-needed": { label: "Not needed", className: "text-muted" },
    "above-cap": { label: "Above your price", className: "text-watch" },
  };
  const { label, className } = config[outcome];
  return <span className={`text-xs font-medium ${className}`}>{label}</span>;
}
