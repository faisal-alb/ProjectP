import { Bell, Check, ChevronDown, ChevronRight, Info, Sparkles, UserRound, Wallet } from "lucide-react";
import {
  BATTERY_CHARGE_PERCENT,
  BATTERY_KWH,
  BATTERY_MAX_DISCHARGE_KW,
  defaultZip,
  household,
  resolveZip,
  zones,
} from "@/lib/demo-data";
import { Wordmark } from "./Logo";

/*
 * A static preview of the household dashboard's Tonight page (HouseholdView), in the
 * app's own tokens (.console-app). Figures are derived the same way the dashboard
 * derives them for a default participant, so the two stay in step.
 */

const reserve = household.defaults.reservePercent;
const availableKwh = ((BATTERY_CHARGE_PERCENT - reserve) / 100) * BATTERY_KWH;
const requestedKwh =
  Math.round(Math.min(household.defaults.maxKwhPerEvent, availableKwh, BATTERY_MAX_DISCHARGE_KW) * 10) / 10;
const batteryAfter = Math.round(BATTERY_CHARGE_PERCENT - (requestedKwh / BATTERY_KWH) * 100);
const rate = household.eventPricePerKwh;
const estimated = requestedKwh * rate;
const month = household.history
  .filter((h) => h.status === "paid")
  .reduce((sum, h) => sum + h.kwh * h.pricePerKwh, 0);
// Earned before this month, as in HouseholdState's EARLIER_EARNINGS.
const lifetime = month + 61.59;
const location = resolveZip(defaultZip);
const feeder = location?.feeder ?? "DT-A";
const zone = zones.find((z) => z.name === household.zone) ?? zones[0];

const money = (n: number) => `$${n.toFixed(2)}`;

const steps = ["Requested", "Accepted", "Delivering", "Verified", "Paid"];
const DONE = 2;

/** The voice meter's resting bars, as on the Ask GridFlex button. */
function Meter() {
  return (
    <span className="flex h-3 items-center gap-[2px]" aria-hidden="true">
      {[0.35, 0.6, 1, 0.6, 0.35].map((h, i) => (
        <span key={i} className="w-[2px] rounded-full bg-accent" style={{ height: `${h * 100}%` }} />
      ))}
    </span>
  );
}

function AskButton({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-accent/30 bg-accent/[0.08] px-3 py-1.5 text-[12px] font-medium text-foreground">
      <Meter />
      {label}
    </span>
  );
}

function Tile({ label, link, children }: { label: string; link?: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="tracked-caps flex items-center gap-1.5 truncate text-[10px] font-medium text-muted">{label}</p>
        {link && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-muted">
            {link}
            <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Stat({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] text-muted">{label}</p>
      <p className={`mt-1 text-[13px] font-semibold text-foreground ${mono ? "font-mono tabular" : ""}`}>{value}</p>
    </div>
  );
}

export function HeroConsole() {
  return (
    <div className="relative">
      {/* Lit top edge of the frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(closest-side,rgba(127,180,204,0.26),transparent)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-px left-[12%] right-[12%] z-10 h-px bg-gradient-to-r from-transparent via-[#cfe6f0] to-transparent"
      />

      <div
        role="img"
        aria-label={`Preview of a household's GridFlex dashboard: ${household.zone} needs flexibility tonight from ${household.eventWindow}. AutoFlex accepted ${requestedKwh} kWh from the home battery at ${money(rate)} per kWh, an estimated ${money(estimated)}, keeping the battery above its ${reserve}% reserve.`}
        className="console-app relative overflow-hidden rounded-[20px] border border-white/[0.09] shadow-[0_40px_120px_-40px_rgba(127,180,204,0.25)]"
      >
        <div aria-hidden="true">
          {/* Header, as DashboardHeader */}
          <div className="border-b border-border">
            <div className="flex h-12 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Wordmark className="scale-90 origin-left" />
                <span className="hidden h-3.5 w-px bg-border sm:block" />
                <span className="hidden truncate text-[12px] text-muted sm:block">My energy</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 text-[11px] text-muted md:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-normal" />
                  Solana devnet
                </span>
                <span className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground sm:flex">
                  <Wallet className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
                  <span className="font-mono tabular">{lifetime.toFixed(2)}</span>
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted">
                  <Bell className="h-3.5 w-3.5" strokeWidth={1.5} />
                </span>
                <span className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-muted">
                  <UserRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <ChevronDown className="h-3 w-3" />
                </span>
              </div>
            </div>
            <div className="flex gap-4 px-4 text-[12px] font-medium sm:px-6">
              {["Tonight", "Devices", "Earnings", "Settings"].map((t, i) => (
                <span
                  key={t}
                  className={`py-2 ${i === 0 ? "border-b-2 border-foreground text-foreground" : "text-muted"}`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="px-4 pt-6 pb-8 sm:px-6">
            {/* Page header */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-foreground">Good evening</p>
                <p className="mt-1 text-[12px] text-muted">Your energy is ready to support the grid.</p>
              </div>
              <span className="hidden sm:block">
                <AskButton label="Ask GridFlex" />
              </span>
            </div>

            {/* At a glance */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Tile label="Your available flex" link="Devices">
                <p className="font-mono text-2xl font-semibold tabular text-foreground">{availableKwh.toFixed(1)} kWh</p>
                <p className="mt-1 text-[10.5px] text-muted">From your battery, above your reserve</p>
              </Tile>
              <Tile label="Earned this month" link="History">
                <p className="font-mono text-2xl font-semibold tabular text-foreground">{money(month)}</p>
                <p className="mt-1 text-[10.5px] text-muted">
                  Today $0.00 · Lifetime {money(lifetime)}
                </p>
              </Tile>
              <Tile label={`Grid status · ${household.zone} ${feeder}`}>
                <p className="text-2xl font-semibold tracking-tight text-watch">WATCH</p>
                <p className="mt-1 text-[10.5px] text-muted">
                  Load {zone.currentMw.toFixed(1)} MW, peaking {zone.peakTime}
                </p>
              </Tile>
            </div>

            {/* Tonight's event, as HouseholdEvent */}
            <div className="panel mt-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="tracked-caps text-[10px] font-medium text-muted">GridFlex event</p>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-normal">
                  <span className="h-1.5 w-1.5 rounded-full bg-normal" />
                  Automatically accepted
                </p>
              </div>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                {household.zone} needs flexibility tonight
              </p>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="When" value={household.eventWindow.replace(" – ", "–")} mono={false} />
                <Stat label="Requested from you" value={`${requestedKwh.toFixed(1)} kWh`} />
                <Stat label="Rate" value={`${money(rate)}/kWh`} />
                <Stat label="Estimated earnings" value={money(estimated)} />
              </div>

              <p className="mt-4 text-[12px] text-muted">
                AutoFlex accepted this for you because it matches your rules. Your battery stays above {reserve}% and
                ends around {batteryAfter}%.
              </p>

              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {steps.map((step, i) => (
                  <div key={step}>
                    <div className={`h-0.5 rounded-full ${i < DONE ? "bg-normal" : "bg-white/[0.1]"}`} />
                    <p className={`mt-1.5 flex min-w-0 items-center gap-1 text-[9.5px] sm:text-[10.5px] ${i < DONE ? "text-foreground" : "text-muted-2"}`}>
                      {i === 0 && <Check className="hidden h-3 w-3 shrink-0 text-muted sm:block" />}
                      <span className="truncate">{step}</span>
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2 rounded-md border border-border p-3 text-[11.5px]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.5} />
                <p className="text-muted">
                  <span className="font-medium text-foreground">Why this event?</span> {household.zone}&rsquo;s demand is
                  expected to exceed local capacity around 7:00 and 8:00 PM. Your battery is connected to the affected grid
                  zone, so it can help.
                </p>
              </div>
            </div>

            {/* Tonight's Power Plan, as PowerPlan (fades out below) */}
            <div className="panel mt-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="tracked-caps flex items-center gap-1.5 text-[10px] font-medium text-accent">
                    <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                    Energy copilot
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">Tonight&rsquo;s Power Plan</p>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    Grid stress 7:00 to 8:00 PM · about <span className="font-mono text-foreground">$0.90</span> if you follow it
                  </p>
                </div>
                <AskButton label="Explain plan" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-3 border-t border-border pt-4">
                <div className="flex gap-3">
                  <span className="text-[11px] text-muted-2">1</span>
                  <div>
                    <p className="text-[12.5px] font-medium text-foreground">
                      Discharge your battery{" "}
                      <span className="tracked-caps ml-1 text-[9px] font-semibold text-accent">Best</span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      Share {requestedKwh.toFixed(1)} kWh during the event. Battery ends around {batteryAfter}%, above your{" "}
                      {reserve}% reserve.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[12.5px] font-semibold tabular text-foreground">+{money(estimated)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
