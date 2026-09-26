import { downtown, dispatchStack } from "@/lib/demo-data";

const drivers = [
  { label: "High cooling demand", weight: "HIGH" },
  { label: "Large nearby event", weight: "MEDIUM" },
  { label: "Reduced solar generation", weight: "MEDIUM" },
  { label: "EV charging peak", weight: "MEDIUM" },
];

export function GridIntelligencePanel() {
  return (
    <div className="rounded-lg panel p-6">
      <p className="tracked-caps text-xs font-medium text-muted">
        Grid Intelligence
      </p>

      <p className="mt-3 text-lg font-semibold text-foreground">
        {downtown.zone} congestion likely
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
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
        <p className="tracked-caps text-xs font-medium text-muted-2">
          Primary drivers
        </p>
        <ul className="mt-3 space-y-2.5">
          {drivers.map((driver) => (
            <li
              key={driver.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground/85">{driver.label}</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                  driver.weight === "HIGH"
                    ? "bg-watch-soft text-watch"
                    : "bg-white/[0.06] text-muted-2"
                }`}
              >
                {driver.weight}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="tracked-caps text-xs font-medium text-muted-2">
          Recommended dispatch
        </p>
        <ul className="mt-3 space-y-2">
          {dispatchStack.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground/85">{item.label}</span>
              <span className="font-mono tabular text-foreground">{item.kw} kW</span>
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
      <p className="text-[11px] text-muted-2">{label}</p>
      <p
        className={`mt-1 font-mono font-semibold tabular ${
          small ? "text-sm" : "text-lg"
        } ${highlight ? "text-accent" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
