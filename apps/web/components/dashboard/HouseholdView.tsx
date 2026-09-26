"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import { household } from "@/lib/demo-data";
import { useHousehold } from "./HouseholdProvider";
import { Switch, SliderRow } from "@/components/onboarding/controls";
import { TxLink } from "./TxLink";

const money = (n: number) => `$${n.toFixed(2)}`;
const price = (n: number) => `$${n.toFixed(2)}/kWh`;

type Choice = "default" | "skipped" | "joined";

const shortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today";

export function HouseholdView({
  zone = household.zone,
  hasBattery = true,
  defaults = household.defaults,
}: {
  zone?: string;
  hasBattery?: boolean;
  defaults?: typeof household.defaults;
}) {
  const live = useHousehold();
  const [autoFlex, setAutoFlex] = useState(defaults.autoFlex);
  const [reserve, setReserve] = useState(defaults.reservePercent);
  const [minPrice, setMinPrice] = useState(defaults.minPricePerKwh);
  const [maxKwh, setMaxKwh] = useState(defaults.maxKwhPerEvent);
  const [choice, setChoice] = useState<Choice>("default");

  const { batteryKwh, chargePercent, maxDischargeKw, eventPricePerKwh } = household;
  const availableKwh = hasBattery ? Math.max(0, ((chargePercent - reserve) / 100) * batteryKwh) : 0;
  const plannedKwh = Math.round(Math.min(maxKwh, availableKwh, maxDischargeKw) * 10) / 10;
  const earnings = plannedKwh * eventPricePerKwh;
  const afterPercent = Math.round(chargePercent - (plannedKwh / batteryKwh) * 100);

  const priceOk = eventPricePerKwh >= minPrice;
  const hasEnergy = plannedKwh > 0;

  const paidTonight = live?.tonight?.phase === "settled" ? live.tonight : null;
  let state: "in" | "skipped" | "low-price" | "no-energy" | "manual" | "paid";
  if (paidTonight) state = "paid";
  else if (!hasEnergy) state = "no-energy";
  else if (choice === "skipped") state = "skipped";
  else if (choice === "joined") state = "in";
  else if (!autoFlex) state = "manual";
  else if (!priceOk) state = "low-price";
  else state = "in";

  const paid = household.history.filter((h) => h.status === "paid");
  const livePayouts = live?.payouts ?? [];
  const monthTotal =
    paid.reduce((s, h) => s + h.kwh * h.pricePerKwh, 0) +
    livePayouts.reduce((s, p) => s + Number(p.amount.base) / 1e6, 0);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your home</h1>
        <p className="mt-1 text-sm text-muted">
          {zone} zone{hasBattery ? ` · ${batteryKwh} kWh home battery` : " · no battery connected"}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {/* Tonight */}
          <section aria-labelledby="tonight-heading" className="panel rounded-lg p-5 sm:p-6">
            <StatusLine state={state} />
            <h2 id="tonight-heading" className="mt-2 text-xl font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
              {state === "paid"
                ? `You earned ${paidTonight!.payout?.formatted} tonight`
                : state === "in"
                  ? `Tonight, your battery will earn about ${money(earnings)}`
                  : state === "no-energy"
                    ? "Your battery has nothing to share tonight"
                    : `Tonight's event could earn you about ${money(earnings)}`}
            </h2>
            {state === "paid" ? (
              <div className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                <p>
                  Your meter confirmed what your battery shared during the event, and the payment is in your GridFlex
                  wallet.
                </p>
                <div className="mt-1">
                  <TxLink href={paidTonight!.url} label="View payment" />
                </div>
              </div>
            ) : (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                <StateMessage state={state} plannedKwh={plannedKwh} reserve={reserve} minPrice={minPrice} />
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              {state === "in" && (
                <button
                  type="button"
                  onClick={() => setChoice("skipped")}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
                >
                  Skip tonight&rsquo;s event
                </button>
              )}
              {(state === "skipped" || state === "low-price" || state === "manual") && (
                <button
                  type="button"
                  onClick={() => setChoice("joined")}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-white"
                >
                  {state === "skipped" ? "Rejoin tonight's event" : "Join tonight's event"}
                </button>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
              <Fact label="When" value={household.eventWindow} />
              <Fact
                label={state === "in" || state === "paid" ? "Energy shared" : "You could share"}
                value={`${plannedKwh.toFixed(1)} kWh`}
                mono
              />
              <Fact label="Rate" value={price(eventPricePerKwh)} mono />
              <Fact
                label="Battery afterwards"
                value={state === "in" || state === "paid" ? `About ${afterPercent}%` : `${chargePercent}%, unused`}
                mono
              />
            </dl>

            <BatteryBar
              charge={chargePercent}
              after={state === "in" || state === "paid" ? afterPercent : chargePercent}
              reserve={reserve}
            />

            <div className="mt-6 flex gap-2.5 rounded-md border border-border bg-background-raised p-3 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <p>
                <span className="font-medium text-foreground">Why tonight?</span> Downtown Miami&rsquo;s power lines are
                expected to be overloaded around 7:20 PM. Energy from home batteries nearby helps avoid an outage. You
                get paid once your meter confirms what you shared, and the payment is recorded on Solana.
              </p>
            </div>
          </section>

          {/* Earnings */}
          <section aria-labelledby="earnings-heading" className="panel rounded-lg p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="earnings-heading" className="text-lg font-semibold text-foreground">
                Earnings
              </h2>
              <p className="text-sm text-muted">
                September so far:{" "}
                <span className="font-semibold text-foreground">{money(monthTotal)}</span> from{" "}
                {paid.length + livePayouts.length} events
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="hidden pb-2 pr-3 font-medium sm:table-cell">Time</th>
                    <th className="pb-2 pr-3 text-right font-medium">Shared</th>
                    <th className="pb-2 pr-3 text-right font-medium">Earned</th>
                    <th className="pb-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {livePayouts.map((p) => (
                    <tr key={p.marketId} className="border-t border-border">
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap text-foreground">{shortDate(p.settledAt)}</td>
                      <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">{p.window}</td>
                      <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground/85">
                        {p.deliveredKw !== undefined ? `${p.deliveredKw.toFixed(1)} kWh` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground">
                        {p.amount.formatted}
                      </td>
                      <td className="py-2.5 pl-3 text-xs">
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-medium text-normal">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Paid
                          </span>
                          <TxLink href={p.url} label="Receipt" />
                        </span>
                      </td>
                    </tr>
                  ))}
                  {household.history.map((h) => (
                    <tr key={h.date} className="border-t border-border">
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap text-foreground">{h.date}</td>
                      <td className="hidden py-2.5 pr-3 text-muted sm:table-cell">{h.window}</td>
                      <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground/85">
                        {h.status === "paid" ? `${h.kwh.toFixed(1)} kWh` : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono whitespace-nowrap tabular text-foreground">
                        {h.status === "paid" ? money(h.kwh * h.pricePerKwh) : "—"}
                      </td>
                      <td className="py-2.5 pl-3 text-xs">
                        {h.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 font-medium text-normal">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Paid
                          </span>
                        ) : (
                          <span className="text-muted">Skipped, rate was {price(h.pricePerKwh)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Settings */}
        <section aria-labelledby="settings-heading" className="panel h-fit rounded-lg p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="settings-heading" className="text-lg font-semibold text-foreground">
                AutoFlex
              </h2>
              <p className="mt-1 text-sm text-muted">
                {autoFlex ? "Joins events for you when they match your rules." : "Off. You'll decide on each event yourself."}
              </p>
            </div>
            <Switch
              checked={autoFlex}
              onChange={(v) => {
                setAutoFlex(v);
                setChoice("default");
              }}
              label="AutoFlex"
            />
          </div>

          <div className="mt-6 space-y-6 border-t border-border pt-5">
            <SliderRow
              label="Always keep at least"
              value={reserve}
              display={`${reserve}%`}
              min={20}
              max={80}
              step={5}
              onChange={setReserve}
              hint="Charge kept for your home, for example during an outage."
            />
            <SliderRow
              label="Only join when paid at least"
              value={minPrice}
              display={price(minPrice)}
              min={0.05}
              max={0.3}
              step={0.01}
              onChange={(v) => setMinPrice(Math.round(v * 100) / 100)}
              hint={`Tonight pays ${price(eventPricePerKwh)}.`}
            />
            <SliderRow
              label="Share at most"
              value={maxKwh}
              display={`${maxKwh.toFixed(1)} kWh`}
              min={1}
              max={5}
              step={0.5}
              onChange={setMaxKwh}
              hint={`Per event. Your battery can deliver up to ${maxDischargeKw} kWh in an hour.`}
            />
          </div>
          <p className="mt-6 text-xs text-muted-2">Changes apply to tonight and future events.</p>
        </section>
      </div>
    </div>
  );
}

function StatusLine({ state }: { state: string }) {
  const map: Record<string, { label: string; dot: string; text: string }> = {
    paid: { label: "Paid", dot: "bg-normal", text: "text-normal" },
    in: { label: "You're taking part", dot: "bg-normal", text: "text-normal" },
    skipped: { label: "You're sitting this one out", dot: "bg-muted-2", text: "text-muted" },
    "low-price": { label: "Not joining automatically", dot: "bg-watch", text: "text-watch" },
    manual: { label: "Waiting for your decision", dot: "bg-watch", text: "text-watch" },
    "no-energy": { label: "Not taking part", dot: "bg-muted-2", text: "text-muted" },
  };
  const s = map[state];
  return (
    <p className={`flex items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </p>
  );
}

function StateMessage({
  state,
  plannedKwh,
  reserve,
  minPrice,
}: {
  state: string;
  plannedKwh: number;
  reserve: number;
  minPrice: number;
}) {
  const kwh = `${plannedKwh.toFixed(1)} kWh`;
  switch (state) {
    case "in":
      return (
        <>
          Between {household.eventWindow.replace(" – ", " and ")}, your battery will share {kwh} with the local grid
          while demand peaks. It won&rsquo;t go below your {reserve}% reserve.
        </>
      );
    case "skipped":
      return <>Your battery won&rsquo;t be used tonight. You can rejoin any time before 7:00 PM.</>;
    case "low-price":
      return (
        <>
          This event pays {price(household.eventPricePerKwh)}, below your minimum of {price(minPrice)}, so AutoFlex
          won&rsquo;t join it. You can still join tonight&rsquo;s event yourself.
        </>
      );
    case "manual":
      return <>AutoFlex is off, so nothing happens unless you join. Joining shares {kwh} from your battery.</>;
    default:
      return (
        <>
          Your battery is at {household.chargePercent}%, and you&rsquo;ve asked to keep at least {reserve}%. Lower your
          reserve if you&rsquo;d like to take part.
        </>
      );
  }
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-foreground ${mono ? "font-mono tabular" : ""}`}>{value}</dd>
    </div>
  );
}

function BatteryBar({ charge, after, reserve }: { charge: number; after: number; reserve: number }) {
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>Battery</span>
        <span>
          <span className="font-mono tabular text-foreground">{charge}%</span> now
        </span>
      </div>
      <div
        className="relative mt-2 h-3 rounded-sm bg-white/[0.06]"
        role="img"
        aria-label={`Battery at ${charge}%. After tonight about ${after}%. Reserve kept at ${reserve}%.`}
      >
        <div className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70" style={{ width: `${after}%` }} />
        {after < charge && (
          <div
            className="absolute inset-y-0 rounded-r-sm bg-chart-flex"
            style={{ left: `${after}%`, width: `${charge - after}%` }}
          />
        )}
        <span className="absolute -top-1 -bottom-1 w-px bg-watch" style={{ left: `${reserve}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {after < charge && (
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-chart-flex" aria-hidden="true" />
            Shared tonight
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-watch" aria-hidden="true" />
          Your reserve ({reserve}%)
        </span>
      </div>
    </div>
  );
}
