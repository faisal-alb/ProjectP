import { Sparkles } from "lucide-react";
import { downtown, dispatchStack } from "@/lib/demo-data";

const drivers = [
  { label: "High cooling demand", weight: "HIGH" },
  { label: "Large nearby event", weight: "MEDIUM" },
  { label: "Reduced solar generation", weight: "MEDIUM" },
  { label: "EV charging peak", weight: "MEDIUM" },
];

export function GridIntelligencePanel() {
  return (
    <div className="rounded-2xl border border-dark-border bg-white/[0.03] p-6 backdrop-blur">
      <div className="flex items-center gap-2 text-bright">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide uppercase">
          Grid Intelligence
        </span>
      </div>

      <p className="mt-3 text-lg font-semibold text-white">
        {downtown.zone} congestion likely
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-dark-border py-4 sm:grid-cols-4">
        <Metric label="Expected window" value={downtown.window} small />
        <Metric label="Forecast load" value={`${downtown.forecastLoadMw} MW`} />
        <Metric label="Available capacity" value={`${downtown.capacityMw} MW`} />
        <Metric
          label="Required flexibility"
          value={`${downtown.requiredFlexKw} kW`}
          highlight
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium tracking-wide text-dark-muted uppercase">
          Primary drivers
        </p>
        <ul className="mt-3 space-y-2.5">
          {drivers.map((driver) => (
            <li
              key={driver.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white/85">{driver.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  driver.weight === "HIGH"
                    ? "bg-warning/15 text-warning"
                    : "bg-white/[0.06] text-dark-muted"
                }`}
              >
                {driver.weight}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium tracking-wide text-dark-muted uppercase">
          Recommended dispatch
        </p>
        <ul className="mt-3 space-y-2">
          {dispatchStack.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white/85">{item.label}</span>
              <span className="font-mono text-white">{item.kw} kW</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  small = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] text-dark-muted">{label}</p>
      <p
        className={`mt-1 font-mono font-semibold ${
          small ? "text-sm" : "text-lg"
        } ${highlight ? "text-bright" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
