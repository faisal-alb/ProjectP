// Demo data behind onboarding. Everything here is illustrative: a real
// deployment would resolve the utility, feeder and devices from the customer's
// address and their device accounts.

export type ResourceKey = "battery" | "ev" | "solar" | "hvac" | "generator" | "building";

export interface DemoDevice {
  key: ResourceKey;
  /** What onboarding shows as "connected". */
  device: string;
  /** Short spec line, e.g. "13.5 kWh". */
  spec: string;
}

export const demoDevices: Record<ResourceKey, DemoDevice> = {
  battery: { key: "battery", device: "Tesla Powerwall", spec: "13.5 kWh · up to 5 kW" },
  ev: { key: "ev", device: "Electric vehicle + 11 kW charger", spec: "60 kWh · charges at up to 11 kW" },
  solar: { key: "solar", device: "Rooftop solar", spec: "8.4 kW system" },
  hvac: { key: "hvac", device: "Smart thermostat", spec: "Central air conditioning" },
  generator: { key: "generator", device: "Backup generator", spec: "6 kW" },
  building: { key: "building", device: "Flexible building load", spec: "Up to 15 kW can shift" },
};

export const BATTERY_KWH = 13.5;
export const BATTERY_CHARGE_PERCENT = 78;
export const BATTERY_MAX_DISCHARGE_KW = 5;
export const EV_SHIFTABLE_KW = 7.2;

export interface GridLocation {
  zip: string;
  utility: string;
  zone: string;
  substation: string;
  feeder: string;
}

const rows: [string[], string, string, string][] = [
  [["33132", "33130"], "Downtown", "Downtown Substation", "DT-A"],
  [["33131", "33128"], "Downtown", "Downtown Substation", "DT-B"],
  [["33137", "33138"], "North", "North Substation", "N-A"],
  [["33150", "33147"], "North", "North Substation", "N-B"],
  [["33135", "33145"], "West", "West Substation", "W-A"],
  [["33155", "33165"], "West", "West Substation", "W-B"],
  [["33133", "33143"], "South", "South Substation", "S-A"],
  [["33156", "33176"], "South", "South Substation", "S-B"],
];

/** Fake resolution of a ZIP code to a utility, substation, feeder and GridFlex zone. */
export function resolveZip(zip: string): GridLocation | null {
  const clean = zip.trim();
  for (const [zips, zone, substation, feeder] of rows) {
    if (zips.includes(clean)) return { zip: clean, utility: "Demo Energy", zone, substation, feeder };
  }
  return null;
}

/** Feeders per substation for the demo network. */
export const demoNetworkFeeders: Record<string, string[]> = {
  Downtown: ["DT-A", "DT-B", "DT-C"],
  North: ["N-A", "N-B"],
  West: ["W-A", "W-B"],
  South: ["S-A", "S-B"],
};

export const defaultZip = "33132";

// Illustrative $/kWh range shown as "potential earnings" until a real event pays.
const HIGH_RATE = 0.25;

export interface FlexEstimate {
  /** One line per connected resource. */
  offers: { key: ResourceKey; label: string; value: string }[];
  /** Energy one event could draw from the battery, in kWh. */
  batteryKwh: number;
  earningsLow: number;
  earningsHigh: number;
}

/** What a participant could offer per event, given their limits. */
export function estimateFlex(input: {
  resources: ResourceKey[];
  reservePercent: number;
  maxKwhPerEvent: number;
  minRate: number;
}): FlexEstimate {
  const has = (key: ResourceKey) => input.resources.includes(key);
  const above = Math.max(0, ((BATTERY_CHARGE_PERCENT - input.reservePercent) / 100) * BATTERY_KWH);
  const batteryKwh = has("battery")
    ? Math.round(Math.min(input.maxKwhPerEvent, above, BATTERY_MAX_DISCHARGE_KW) * 10) / 10
    : 0;
  const evKw = has("ev") ? EV_SHIFTABLE_KW : 0;

  const offers: FlexEstimate["offers"] = [];
  if (has("battery")) offers.push({ key: "battery", label: "Battery", value: `${batteryKwh.toFixed(1)} kWh` });
  if (has("ev")) offers.push({ key: "ev", label: "EV charging", value: `${evKw.toFixed(1)} kW shiftable` });
  if (has("solar")) offers.push({ key: "solar", label: "Solar", value: "8.4 kW system" });
  if (has("hvac")) offers.push({ key: "hvac", label: "HVAC", value: "Up to 1.5 kW reduction" });
  if (has("generator")) offers.push({ key: "generator", label: "Generator", value: "6 kW backup" });
  if (has("building")) offers.push({ key: "building", label: "Building load", value: "Up to 15 kW shiftable" });

  // One-hour event: battery energy plus the EV charge that could move.
  const kwh = batteryKwh + evKw;
  return {
    offers,
    batteryKwh,
    earningsLow: kwh * input.minRate,
    earningsHigh: kwh * Math.max(input.minRate, HIGH_RATE),
  };
}
