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

/** Mapbox / GeoJSON coordinate order: longitude, latitude. */
export type MapCoordinate = [number, number];

export const localUtility = "Florida Power & Light";

export interface GridZone {
  name: string;
  center: MapCoordinate;
  zips: string[];
  feeders: string[];
}

// GridFlex groupings of real ZIP areas. Feeder assignments and substations
// are illustrative, not FPL network topology or municipal boundaries.
export const gridZones: GridZone[] = [
  { name: "Downtown Miami", center: [-80.1937, 25.7743], zips: ["33130", "33131", "33132", "33136"], feeders: ["DT-A", "DT-B", "DT-C"] },
  { name: "Miami Beach", center: [-80.13, 25.815], zips: ["33139", "33140", "33141"], feeders: ["MB-A", "MB-B"] },
  { name: "Fort Lauderdale", center: [-80.1373, 26.1224], zips: ["33301", "33304", "33305", "33306", "33308", "33309", "33311", "33312", "33313", "33314", "33315", "33316"], feeders: ["FL-A", "FL-B"] },
  { name: "Coral Gables", center: [-80.2684, 25.7215], zips: ["33133", "33134", "33143", "33146"], feeders: ["CG-A", "CG-B"] },
];

// Representative points from the 2020 Census ZCTA Gazetteer, not street addresses.
// https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip
// 33302, 33303, 33307 and 33310 have no ZCTA and are intentionally excluded.
const zipCoordinates: Record<string, MapCoordinate> = {
  "33130": [-80.203359, 25.768524],
  "33131": [-80.184275, 25.766561],
  "33132": [-80.172412, 25.777404],
  "33133": [-80.240995, 25.728632],
  "33134": [-80.270379, 25.753332],
  "33136": [-80.205296, 25.787247],
  "33139": [-80.151566, 25.779391],
  "33140": [-80.133711, 25.819714],
  "33141": [-80.138726, 25.851854],
  "33143": [-80.297375, 25.703032],
  "33146": [-80.272571, 25.72085],
  "33301": [-80.127909, 26.121323],
  "33304": [-80.121184, 26.140411],
  "33305": [-80.11944, 26.153361],
  "33306": [-80.113853, 26.165442],
  "33308": [-80.104988, 26.18851],
  "33309": [-80.172721, 26.18599],
  "33311": [-80.172785, 26.144208],
  "33312": [-80.181783, 26.08817],
  "33313": [-80.227397, 26.15152],
  "33314": [-80.222641, 26.067582],
  "33315": [-80.152994, 26.087022],
  "33316": [-80.12184, 26.098696],
};

export interface GridLocation {
  zip: string;
  utility: string;
  zone: string;
  substation: string;
  feeder: string;
  coordinates: MapCoordinate;
}

/** Resolve a mapped ZIP to its illustrative GridFlex network assignment. */
export function resolveZip(zip: string): GridLocation | null {
  const clean = zip.trim();
  const zone = gridZones.find((candidate) => candidate.zips.includes(clean));
  const coordinates = zipCoordinates[clean];
  if (!zone || !coordinates) return null;
  // Retain DT-A for the default household; assignments are sample topology.
  const feederIndex = zone.name === "Downtown Miami"
    ? (["33130", "33132"].includes(clean) ? 0 : 1)
    : zone.zips.indexOf(clean) % zone.feeders.length;
  return {
    zip: clean,
    utility: localUtility,
    zone: zone.name,
    substation: `${zone.name} Substation`,
    feeder: zone.feeders[feederIndex],
    coordinates,
  };
}

/** Illustrative feeders per zone, shared by both onboarding flows. */
export const demoNetworkFeeders: Record<string, string[]> = Object.fromEntries(
  gridZones.map((zone) => [zone.name, zone.feeders]),
);

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
