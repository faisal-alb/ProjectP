export type ZoneStatus = "normal" | "watch" | "high";

export interface Zone {
  name: string;
  capacityMw: number;
  currentMw: number;
  forecastMw: number;
  status: ZoneStatus;
}

export const zones: Zone[] = [
  { name: "Downtown", capacityMw: 12.0, currentMw: 10.8, forecastMw: 12.8, status: "high" },
  { name: "North", capacityMw: 8.0, currentMw: 5.1, forecastMw: 6.0, status: "normal" },
  { name: "West", capacityMw: 7.0, currentMw: 5.9, forecastMw: 6.6, status: "watch" },
  { name: "South", capacityMw: 10.0, currentMw: 6.4, forecastMw: 7.1, status: "normal" },
];

export const downtown = {
  zone: "Downtown",
  capacityMw: 12.0,
  currentLoadMw: 10.8,
  forecastLoadMw: 12.8,
  requiredFlexKw: 800,
  riskPercent: 91,
  flexAvailableMw: 1.4,
  window: "7:00 – 8:00 PM",
  peakTime: "7:20 PM",
};

export interface FlexResource {
  label: string;
  type: "Battery" | "EV" | "Building" | "Solar" | "Generator";
  kw: number;
  pricePerKwh: number;
}

export const flexResources: FlexResource[] = [
  { label: "Battery #82", type: "Battery", kw: 100, pricePerKwh: 0.14 },
  { label: "EV Fleet #4", type: "EV", kw: 180, pricePerKwh: 0.08 },
  { label: "Tower HVAC", type: "Building", kw: 170, pricePerKwh: 0.09 },
  { label: "Solar Group #9", type: "Solar", kw: 100, pricePerKwh: 0.11 },
  { label: "Battery #17", type: "Battery", kw: 250, pricePerKwh: 0.16 },
];

export const marketTotals = {
  requestedKw: 800,
  committedKw: 800,
  estimatedCost: 104.8,
};

export const dispatchStack = [
  { label: "Battery", kw: 300, pricePerKwh: 0.14 },
  { label: "EV Charging Shift", kw: 180, pricePerKwh: 0.08 },
  { label: "Commercial HVAC", kw: 170, pricePerKwh: 0.09 },
  { label: "Solar Export", kw: 100, pricePerKwh: 0.11 },
  { label: "Generator", kw: 250, pricePerKwh: 0.32 },
];

export const withoutGridFlexResources = [
  { label: "Battery", kw: 300 },
  { label: "EVs", kw: 180 },
  { label: "HVAC", kw: 170 },
  { label: "Solar", kw: 100 },
];
