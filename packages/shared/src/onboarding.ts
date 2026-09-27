// Demo data behind onboarding. Everything here is illustrative: a real
// deployment would resolve the utility, feeder and devices from the customer's
// address and their device accounts.

/**
 * What a resource does for the grid. Many do more than one: an EV draws power to
 * charge and holds it in its battery; a water heater uses power and stores it as heat.
 */
export type ResourceRole = "consumer" | "producer" | "storer";

export const RESOURCE_ROLES: { role: ResourceRole; label: string; description: string }[] = [
  { role: "consumer", label: "Uses power", description: "Can run later or use less when the grid is busy." },
  { role: "producer", label: "Makes power", description: "Generates electricity right where you are." },
  { role: "storer", label: "Stores power", description: "Saves energy to use or share later." },
];

export interface ResourceType {
  /** Name in the picker. */
  name: string;
  /** One line under the name, e.g. makes or examples. */
  description: string;
  roles: ResourceRole[];
  /** Shown up front in onboarding; everything else is found by search. */
  common?: boolean;
  /** Extra search terms: brands, other names. */
  keywords?: string;
  /** What onboarding and the dashboard show as "connected". */
  device: string;
  /** Short spec line, e.g. "13.5 kWh". */
  spec: string;
  /** What it could offer one event. */
  offer: string;
}

export const resourceCatalog = {
  // Most common. battery, ev, solar, hvac and generator feed the power plan.
  battery: { name: "Home battery", description: "Powerwall, Enphase, or similar", roles: ["storer"], common: true, keywords: "tesla powerwall enphase lg franklin sonnen storage", device: "Tesla Powerwall", spec: "13.5 kWh · up to 5 kW", offer: "Up to 5 kW" },
  solar: { name: "Solar panels", description: "Rooftop or ground-mounted", roles: ["producer"], common: true, keywords: "pv photovoltaic rooftop sunpower", device: "Rooftop solar", spec: "8.4 kW system", offer: "8.4 kW system" },
  ev: { name: "EV / EV charger", description: "Charging that can wait", roles: ["consumer", "storer"], common: true, keywords: "electric vehicle car tesla wallbox chargepoint level 2", device: "Electric vehicle + 11 kW charger", spec: "60 kWh · charges at up to 11 kW", offer: "7.2 kW shiftable" },
  hvac: { name: "AC / smart thermostat", description: "Cooling that can ease off", roles: ["consumer"], common: true, keywords: "hvac air conditioning nest ecobee honeywell thermostat central air", device: "Smart thermostat", spec: "Central air conditioning", offer: "Up to 1.5 kW reduction" },
  waterHeater: { name: "Electric water heater", description: "Heats ahead of time, holds it as hot water", roles: ["consumer", "storer"], common: true, keywords: "hot water tank rheem ao smith", device: "Electric water heater", spec: "50 gal · 4.5 kW", offer: "Up to 4.5 kW shiftable" },
  generator: { name: "Backup generator", description: "Generac, Kohler, or similar", roles: ["producer"], common: true, keywords: "generac kohler standby propane natural gas diesel", device: "Backup generator", spec: "6 kW", offer: "6 kW backup" },

  // Homes
  solarBattery: { name: "Solar + battery system", description: "One system that makes and stores power", roles: ["producer", "storer"], keywords: "hybrid inverter enphase iq tesla solar", device: "Solar with battery", spec: "7.6 kW solar · 10 kWh", offer: "Up to 5 kW" },
  bidirectionalEv: { name: "Bidirectional EV charger", description: "Can power your home from the car (V2H/V2G)", roles: ["consumer", "storer", "producer"], keywords: "v2g v2h vehicle to grid ford lightning intelligent backup", device: "Bidirectional charger", spec: "Up to 9.6 kW both ways", offer: "Up to 9.6 kW" },
  heatPump: { name: "Heat pump", description: "Heating and cooling", roles: ["consumer"], keywords: "mitsubishi daikin carrier heating", device: "Heat pump", spec: "3 ton", offer: "Up to 2 kW reduction" },
  heatPumpWaterHeater: { name: "Heat pump water heater", description: "Efficient hot water that can pre-heat", roles: ["consumer", "storer"], keywords: "hybrid water heater rheem", device: "Heat pump water heater", spec: "65 gal", offer: "Up to 1 kW shiftable" },
  miniSplit: { name: "Mini-split AC", description: "Ductless room units", roles: ["consumer"], keywords: "ductless air conditioning", device: "Mini-split AC", spec: "2 zones", offer: "Up to 1 kW reduction" },
  poolPump: { name: "Pool pump", description: "Runs on a schedule that can move", roles: ["consumer"], keywords: "swimming pool variable speed pentair hayward", device: "Pool pump", spec: "1.5 kW variable speed", offer: "Up to 1.5 kW shiftable" },
  hotTub: { name: "Hot tub / spa", description: "Keeps its heat for hours", roles: ["consumer", "storer"], keywords: "jacuzzi spa heater", device: "Hot tub", spec: "5.5 kW heater", offer: "Up to 5.5 kW shiftable" },
  dryer: { name: "Clothes dryer", description: "Loads can wait until later", roles: ["consumer"], keywords: "laundry electric dryer", device: "Electric dryer", spec: "5 kW", offer: "Up to 5 kW shiftable" },
  washer: { name: "Washing machine", description: "Smart start or delay", roles: ["consumer"], keywords: "laundry washer", device: "Washing machine", spec: "0.5 kW", offer: "0.5 kW shiftable" },
  dishwasher: { name: "Dishwasher", description: "Delay start", roles: ["consumer"], keywords: "kitchen appliance", device: "Dishwasher", spec: "1.8 kW", offer: "1.8 kW shiftable" },
  fridge: { name: "Smart fridge / freezer", description: "Can pre-cool and coast", roles: ["consumer", "storer"], keywords: "refrigerator freezer kitchen", device: "Smart refrigerator", spec: "0.2 kW", offer: "0.2 kW shiftable" },
  dehumidifier: { name: "Dehumidifier", description: "Whole-home or portable", roles: ["consumer"], keywords: "humidity", device: "Dehumidifier", spec: "0.7 kW", offer: "0.7 kW shiftable" },
  wellPump: { name: "Well pump", description: "Fills a pressure tank that can wait", roles: ["consumer"], keywords: "water pump irrigation", device: "Well pump", spec: "1.1 kW", offer: "1.1 kW shiftable" },
  ebike: { name: "E-bike / scooter charger", description: "Small charging that can wait", roles: ["consumer", "storer"], keywords: "electric bike scooter motorcycle", device: "E-bike charger", spec: "0.3 kW", offer: "0.3 kW shiftable" },
  powerStation: { name: "Portable power station", description: "EcoFlow, Jackery, or similar", roles: ["storer"], keywords: "ecoflow jackery bluetti anker goal zero portable battery", device: "Portable power station", spec: "3.6 kWh", offer: "Up to 1.8 kW" },
  ups: { name: "UPS / battery backup", description: "For computers or a home office", roles: ["storer"], keywords: "uninterruptible power supply apc", device: "UPS", spec: "1.5 kWh", offer: "Up to 1 kW" },
  portableGenerator: { name: "Portable generator", description: "Gas, propane, or dual fuel", roles: ["producer"], keywords: "honda champion inverter generator", device: "Portable generator", spec: "3.5 kW", offer: "3.5 kW backup" },
  windTurbine: { name: "Small wind turbine", description: "Rooftop or tower", roles: ["producer"], keywords: "wind power", device: "Wind turbine", spec: "5 kW", offer: "Up to 5 kW" },
  fuelCell: { name: "Fuel cell", description: "Natural gas or hydrogen", roles: ["producer"], keywords: "hydrogen bloom", device: "Fuel cell", spec: "5 kW", offer: "5 kW" },

  // Businesses and campuses
  building: { name: "Flexible building load", description: "Pumps, lighting, equipment", roles: ["consumer"], keywords: "commercial bms building management", device: "Flexible building load", spec: "Up to 15 kW can shift", offer: "Up to 15 kW shiftable" },
  commercialBattery: { name: "Commercial battery", description: "Behind-the-meter storage for a site", roles: ["storer"], keywords: "bess energy storage megapack", device: "Commercial battery", spec: "250 kWh · 125 kW", offer: "Up to 125 kW" },
  evFleet: { name: "EV fleet depot", description: "Buses, vans, or trucks that charge overnight", roles: ["consumer", "storer"], keywords: "electric bus van truck fleet charging depot", device: "EV fleet depot", spec: "12 chargers · 240 kW", offer: "Up to 120 kW shiftable" },
  coldStorage: { name: "Cold storage", description: "Refrigerated rooms that can coast", roles: ["consumer", "storer"], keywords: "refrigeration warehouse freezer grocery", device: "Cold storage", spec: "80 kW refrigeration", offer: "Up to 30 kW reduction" },
  thermalStorage: { name: "Ice / thermal storage", description: "Makes ice at night to cool by day", roles: ["consumer", "storer"], keywords: "ice bank chilled water thermal energy storage", device: "Ice storage", spec: "500 ton-hours", offer: "Up to 100 kW shift" },
  lighting: { name: "Commercial lighting", description: "Dimmable lighting controls", roles: ["consumer"], keywords: "led dimming controls", device: "Lighting controls", spec: "40 kW", offer: "Up to 10 kW reduction" },
  industrialProcess: { name: "Industrial process load", description: "Motors, compressors, or batch processes", roles: ["consumer"], keywords: "factory manufacturing compressor motor pump", device: "Industrial load", spec: "500 kW", offer: "Up to 150 kW reduction" },
  irrigation: { name: "Irrigation pumps", description: "Watering that can be rescheduled", roles: ["consumer"], keywords: "agriculture farm water pump", device: "Irrigation pumps", spec: "60 kW", offer: "Up to 60 kW shiftable" },
  dataCenter: { name: "Server room / data center", description: "Flexible compute and cooling", roles: ["consumer"], keywords: "servers computing it crypto mining", device: "Server room", spec: "100 kW", offer: "Up to 20 kW reduction" },
  chp: { name: "Combined heat and power", description: "On-site CHP or microturbine", roles: ["producer"], keywords: "chp cogeneration microturbine capstone", device: "CHP unit", spec: "200 kW", offer: "Up to 200 kW" },
  solarCarport: { name: "Solar carport", description: "Parking-lot solar canopy", roles: ["producer"], keywords: "pv canopy parking", device: "Solar carport", spec: "150 kW", offer: "150 kW system" },
} satisfies Record<string, ResourceType>;

export type ResourceKey = keyof typeof resourceCatalog;
export const RESOURCE_KEYS = Object.keys(resourceCatalog) as ResourceKey[];

export const resourceType = (key: ResourceKey): ResourceType => resourceCatalog[key];

/** Case-insensitive match on name, description, roles and keywords. */
export function matchesResource(key: ResourceKey, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const r = resourceType(key);
  const roles = RESOURCE_ROLES.filter((x) => r.roles.includes(x.role)).map((x) => x.label);
  const haystack = [r.name, r.description, r.keywords ?? "", ...roles].join(" ").toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

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
  for (const key of input.resources) {
    if (key !== "battery" && key !== "ev") offers.push({ key, label: resourceCatalog[key].name, value: resourceCatalog[key].offer });
  }

  // One-hour event: battery energy plus the EV charge that could move.
  const kwh = batteryKwh + evKw;
  return {
    offers,
    batteryKwh,
    earningsLow: kwh * input.minRate,
    earningsHigh: kwh * Math.max(input.minRate, HIGH_RATE),
  };
}
