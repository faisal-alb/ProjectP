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

export const localUtility = "Austin Energy";

export interface GridZone {
  name: string;
  center: MapCoordinate;
  zips: string[];
  feeders: string[];
}

// GridFlex groupings of real Travis County ZIP areas, all inside Austin Energy's
// ERCOT load zone (LZ_AEN), where the forecasting models are trained. Feeder
// assignments and substations are illustrative, not Austin Energy network
// topology or municipal boundaries.
export const gridZones: GridZone[] = [
  { name: "Downtown Austin", center: [-97.7431, 30.2672], zips: ["78701", "78703", "78705", "78712"], feeders: ["DT-A", "DT-B", "DT-C"] },
  { name: "South Austin", center: [-97.7727, 30.2127], zips: ["78704", "78741", "78745", "78748"], feeders: ["SA-A", "SA-B"] },
  { name: "North Austin", center: [-97.7282, 30.3794], zips: ["78727", "78729", "78731", "78751", "78752", "78753", "78756", "78757", "78758", "78759"], feeders: ["NA-A", "NA-B"] },
  { name: "East Austin", center: [-97.6899, 30.2818], zips: ["78702", "78721", "78722", "78723", "78724"], feeders: ["EA-A", "EA-B"] },
];

// Representative points from the 2020 Census ZCTA Gazetteer, not street addresses.
// https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip
const zipCoordinates: Record<string, MapCoordinate> = {
  "78701": [-97.742589, 30.270569],
  "78702": [-97.714483, 30.263378],
  "78703": [-97.76605, 30.293268],
  "78704": [-97.765081, 30.243032],
  "78705": [-97.738516, 30.294331],
  "78712": [-97.731003, 30.282173],
  "78721": [-97.683557, 30.269969],
  "78722": [-97.7147, 30.289958],
  "78723": [-97.685713, 30.304269],
  "78724": [-97.617945, 30.292709],
  "78727": [-97.717796, 30.429937],
  "78729": [-97.755344, 30.458396],
  "78731": [-97.768139, 30.348244],
  "78741": [-97.714198, 30.230459],
  "78745": [-97.797381, 30.206851],
  "78748": [-97.82339, 30.166435],
  "78751": [-97.722749, 30.310788],
  "78752": [-97.704283, 30.331815],
  "78753": [-97.673638, 30.382024],
  "78756": [-97.740169, 30.322223],
  "78757": [-97.73257, 30.351537],
  "78758": [-97.706848, 30.387987],
  "78759": [-97.761038, 30.402667],
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
  const feederIndex = zone.name === "Downtown Austin"
    ? (["78701", "78703"].includes(clean) ? 0 : 1)
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

export const defaultZip = "78701";

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
