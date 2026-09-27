"use client";

import { Cpu } from "lucide-react";
import type { ForecastDto, ForecastState } from "@/lib/api";

const REASON_LABELS: Record<string, string> = {
  EVENING_PEAK: "Evening peak",
  SUMMER: "Summer",
  HIGH_TEMPERATURE: "High temperature",
  RECENT_PRICE_SPIKE: "Prices spiked in the last 24 hours",
};

const perKwh = (n: number | null | undefined) => (n == null ? "–" : `$${n.toFixed(2)}/kWh`);
const perMwh = (n: number | null | undefined) =>
  n == null ? "–" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}/MWh`;
const percent = (n: number | null | undefined) => (n == null ? "–" : `${Math.round(n * 100)}%`);

/** Replay times are Austin wall clock without an offset, so parse them as local. */
function wallClock(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

/**
 * The spike model's view of tonight's window: how likely prices are to spike,
 * what flexibility is worth, and the price that implies. Suggests a cap the
 * operator can apply; the market still clears cheapest first.
 */
export function ModelForecast({
  state,
  onUsePrice,
  priceLocked,
  maxCap,
}: {
  state: ForecastState;
  onUsePrice: (price: number) => void;
  priceLocked: boolean;
  maxCap: number;
}) {
  return (
    <section aria-labelledby="model-heading" className="panel rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="model-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Cpu className="h-4 w-4 text-muted" aria-hidden="true" />
          Price spike outlook
        </h2>
        {state.status === "ready" && <SourceBadge source={state.forecast.source} />}
      </div>

      {state.status === "loading" && <p className="mt-2 text-sm text-muted">Loading the forecast…</p>}
      {state.status === "unavailable" && (
        <p className="mt-2 text-sm text-muted">
          The forecasting service isn&rsquo;t running, so this page shows demo figures. Start it with{" "}
          <code className="font-mono text-foreground/85">npm run dev</code> once the models are set up.
        </p>
      )}
      {state.status === "ready" && (
        <Body forecast={state.forecast} onUsePrice={onUsePrice} priceLocked={priceLocked} maxCap={maxCap} />
      )}
    </section>
  );
}

function SourceBadge({ source }: { source: ForecastDto["source"] }) {
  const label = source === "model" ? "Trained models" : source === "mixed" ? "Partly placeholder" : "Placeholder models";
  const tone = source === "model" ? "text-normal" : "text-watch";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${source === "model" ? "bg-normal" : "bg-watch"}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Body({
  forecast,
  onUsePrice,
  priceLocked,
  maxCap,
}: {
  forecast: ForecastDto;
  onUsePrice: (price: number) => void;
  priceLocked: boolean;
  maxCap: number;
}) {
  const at = wallClock(forecast.at);
  const windowEnd = wallClock(forecast.window.end).time;
  const windowStart = wallClock(forecast.window.start).time;
  const locked = forecast.valuation.lockedPricePerKwh;
  const suggested = locked == null ? null : Math.min(maxCap, Math.max(0.05, Math.round(locked * 100) / 100));
  const { signals, valuation } = forecast;
  const windowHorizon = forecast.spike.find((s) => s.probability === forecast.pSpike)?.horizonH;

  return (
    <>
      <p className="mt-1 text-sm text-muted">
        {forecast.zoneName} · ERCOT load zone {forecast.settlementPoint} · replaying {at.date}, {at.time}
      </p>

      <div className="mt-5 grid gap-8 lg:grid-cols-3">
        <div className="min-w-0">
          <p className="font-mono text-4xl font-semibold tabular text-foreground">{percent(forecast.pSpike)}</p>
          <p className="mt-1 text-sm text-muted">
            chance the price tops $500/MWh before {windowEnd}, covering the {windowStart} window
          </p>
          <ol className="mt-4 flex h-20 items-end gap-1.5" aria-label="Chance of a spike by hours ahead">
            {forecast.spike.map((s) => (
              <li key={s.horizonH} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="sr-only">
                  Within {s.horizonH} hours: {percent(s.probability)}
                </span>
                <span
                  className={`w-full rounded-sm ${s.horizonH === windowHorizon ? "bg-risk" : "bg-chart-forecast/60"}`}
                  style={{ height: `${Math.max(4, (s.probability ?? 0) * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="text-[11px] text-muted-2 tabular" aria-hidden="true">
                  +{s.horizonH}h
                </span>
              </li>
            ))}
          </ol>
        </div>

        <dl className="min-w-0 text-sm">
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <dt className="text-muted">What flexibility is worth</dt>
            <dd className="font-mono tabular text-foreground">{perKwh(valuation.fairValuePerKwh)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border py-2">
            <dt className="text-muted">Risk buffer</dt>
            <dd className="font-mono tabular text-foreground/85">−{perKwh(valuation.riskBufferPerKwh)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border py-2">
            <dt className="text-muted">GridFlex fee</dt>
            <dd className="font-mono tabular text-foreground/85">−{perKwh(valuation.aggregatorFeePerKwh)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border-strong pt-2">
            <dt className="font-medium text-foreground">Price to offer participants</dt>
            <dd className="font-mono font-semibold tabular text-foreground">{perKwh(locked)}</dd>
          </div>
          <p className="mt-3 text-xs text-muted-2">
            Expected price if it spikes, weighted by the chance it does. Summer evenings from 2021 to May 2024.
          </p>
        </dl>

        <div className="min-w-0 text-sm">
          <p className={`font-medium ${forecast.recommendation.openEvent ? "text-risk" : "text-foreground"}`}>
            {forecast.recommendation.openEvent ? "Open a flexibility request" : "No request needed yet"}
          </p>
          <p className="mt-0.5 text-xs text-muted">{forecast.recommendation.reason}</p>

          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Why">
            {forecast.reasons.map((r) => (
              <li key={r} className="rounded-sm border border-border px-2 py-0.5 text-xs text-foreground/85">
                {REASON_LABELS[r] ?? r}
              </li>
            ))}
          </ul>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">Temperature now</dt>
            <dd className="text-right font-mono tabular text-foreground">{signals.tempF == null ? "–" : `${signals.tempF}°F`}</dd>
            <dt className="text-muted">Last price</dt>
            <dd className="text-right font-mono tabular text-foreground">{perMwh(signals.lastPriceMwh)}</dd>
            <dt className="text-muted">24-hour high</dt>
            <dd className="text-right font-mono tabular text-foreground">{perMwh(signals.recentMaxPriceMwh)}</dd>
          </dl>

          {suggested != null && (
            <button
              type="button"
              onClick={() => onUsePrice(suggested)}
              disabled={priceLocked}
              className="mt-4 rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-raised disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use ${suggested.toFixed(2)}/kWh as your price
            </button>
          )}
          {suggested != null && locked != null && suggested < locked && (
            <p className="mt-1 text-xs text-muted-2">Capped at ${maxCap.toFixed(2)}, the highest price you can set.</p>
          )}
        </div>
      </div>
    </>
  );
}
