// Illustrative demo data only. Not real grid, customer, or market data.

export type ZoneStatus = "normal" | "watch" | "high";

export interface Zone {
  name: string;
  capacityMw: number;
  currentMw: number;
  forecastMw: number;
  peakTime: string;
  status: ZoneStatus;
}

export const zones: Zone[] = [
  { name: "Downtown Austin", capacityMw: 12.0, currentMw: 10.8, forecastMw: 12.8, peakTime: "7:20 PM", status: "high" },
  { name: "South Austin", capacityMw: 8.0, currentMw: 5.1, forecastMw: 6.0, peakTime: "6:50 PM", status: "normal" },
  { name: "North Austin", capacityMw: 7.0, currentMw: 5.9, forecastMw: 6.6, peakTime: "7:40 PM", status: "watch" },
  { name: "East Austin", capacityMw: 10.0, currentMw: 6.4, forecastMw: 7.1, peakTime: "8:10 PM", status: "normal" },
];

export const downtown = {
  zone: "Downtown Austin",
  capacityMw: 12.0,
  currentLoadMw: 10.8,
  forecastLoadMw: 12.8,
  requiredFlexKw: 800,
  /** Probability that load exceeds capacity during the window. */
  riskPercent: 91,
  flexAvailableMw: 1.4,
  window: "7:00 – 8:00 PM",
  peakTime: "7:20 PM",
};

export const forecastUpdatedAt = "5:00 PM";

/** Minutes since midnight, for charting. */
export const NOW_MINUTES = 17 * 60;
export const WINDOW_START_MINUTES = 19 * 60;
export const WINDOW_END_MINUTES = 20 * 60;

/** Downtown Austin load: measured up to now, forecast after. MW. */
export const downtownLoadCurve: { minutes: number; mw: number }[] = [
  { minutes: 14 * 60, mw: 9.4 },
  { minutes: 14 * 60 + 30, mw: 9.7 },
  { minutes: 15 * 60, mw: 10.0 },
  { minutes: 15 * 60 + 30, mw: 10.3 },
  { minutes: 16 * 60, mw: 10.5 },
  { minutes: 16 * 60 + 30, mw: 10.8 },
  { minutes: 17 * 60, mw: 11.0 },
  { minutes: 17 * 60 + 30, mw: 11.3 },
  { minutes: 18 * 60, mw: 11.5 },
  { minutes: 18 * 60 + 30, mw: 11.7 },
  { minutes: 19 * 60, mw: 12.0 },
  { minutes: 19 * 60 + 20, mw: 12.8 },
  { minutes: 19 * 60 + 30, mw: 12.7 },
  { minutes: 20 * 60, mw: 12.0 },
  { minutes: 20 * 60 + 30, mw: 11.4 },
  { minutes: 21 * 60, mw: 10.9 },
  { minutes: 21 * 60 + 30, mw: 10.4 },
  { minutes: 22 * 60, mw: 9.9 },
  { minutes: 22 * 60 + 30, mw: 9.5 },
  { minutes: 23 * 60, mw: 9.1 },
];

/** What adds up to the 12.8 MW peak forecast. MW. */
export const forecastDrivers = {
  baselineMw: 11.0,
  baselineLabel: "Typical load for this time of day",
  items: [
    { label: "Heat", detail: "Around 40°C (104°F), so air conditioning runs harder", mw: 0.9 },
    { label: "Arena event", detail: "About 15,000 people expected from 7:30 PM", mw: 0.5 },
    { label: "EV charging", detail: "Cars plugging in after the evening commute", mw: 0.2 },
    { label: "Less solar", detail: "Rooftop solar fades before sunset at 8:05 PM", mw: 0.2 },
  ],
};

export type FlexType =
  | "EV charging"
  | "Building load"
  | "Solar export"
  | "Home batteries"
  | "Commercial battery"
  | "Generator";

export interface FlexOffer {
  label: string;
  type: FlexType;
  kw: number;
  pricePerKwh: number;
}

/** Offers submitted for the Downtown Austin 7–8 PM request. */
export const flexOffers: FlexOffer[] = [
  { label: "EV Fleet #4", type: "EV charging", kw: 180, pricePerKwh: 0.08 },
  { label: "Tower HVAC", type: "Building load", kw: 170, pricePerKwh: 0.09 },
  { label: "Solar Group #9", type: "Solar export", kw: 100, pricePerKwh: 0.11 },
  { label: "Downtown Austin home batteries", type: "Home batteries", kw: 100, pricePerKwh: 0.14 },
  { label: "Battery #17", type: "Commercial battery", kw: 250, pricePerKwh: 0.16 },
  { label: "Backup Generator #3", type: "Generator", kw: 250, pricePerKwh: 0.32 },
];

export const defaultPriceCap = 0.2;

export type OfferOutcome = "accepted" | "partial" | "not-needed" | "above-cap";

/** Accept offers cheapest first, up to the price cap, until the need is covered. */
export function clearMarket(offers: FlexOffer[], needKw: number, priceCap: number) {
  let remaining = needKw;
  const rows = [...offers]
    .sort((a, b) => a.pricePerKwh - b.pricePerKwh)
    .map((offer) => {
      if (offer.pricePerKwh > priceCap) {
        return { offer, acceptedKw: 0, outcome: "above-cap" as OfferOutcome };
      }
      const acceptedKw = Math.min(offer.kw, remaining);
      remaining -= acceptedKw;
      const outcome: OfferOutcome =
        acceptedKw === 0 ? "not-needed" : acceptedKw < offer.kw ? "partial" : "accepted";
      return { offer, acceptedKw, outcome };
    });
  const committedKw = needKw - remaining;
  const cost = rows.reduce((sum, r) => sum + r.acceptedKw * r.offer.pricePerKwh, 0);
  return { rows, committedKw, shortfallKw: remaining, cost };
}

const cleared = clearMarket(flexOffers, downtown.requiredFlexKw, defaultPriceCap);
const acceptedRows = cleared.rows.filter((r) => r.acceptedKw > 0);

/** Accepted resources at the default cap, for the marketing page. */
export const flexResources = acceptedRows.map((r) => ({
  label: r.offer.label,
  type: r.offer.type,
  kw: r.acceptedKw,
  pricePerKwh: r.offer.pricePerKwh,
}));

export const marketTotals = {
  requestedKw: downtown.requiredFlexKw,
  committedKw: cleared.committedKw,
  estimatedCost: cleared.cost,
};

export const dispatchStack = flexResources.map((r) => ({
  label: r.type,
  kw: r.kw,
  pricePerKwh: r.pricePerKwh,
}));

export const withoutGridFlexResources = [
  { label: "Batteries", kw: 350 },
  { label: "EVs", kw: 180 },
  { label: "HVAC", kw: 170 },
  { label: "Solar", kw: 100 },
];

/** A household in the Downtown Austin home-battery group. */
export const household = {
  zone: "Downtown Austin",
  group: "Downtown Austin home batteries",
  batteryKwh: 13.5,
  chargePercent: 78,
  maxDischargeKw: 5,
  eventWindow: "7:00 – 8:00 PM",
  eventPricePerKwh: 0.14,
  defaults: {
    autoFlex: true,
    reservePercent: 40,
    minPricePerKwh: 0.12,
    maxKwhPerEvent: 5,
  },
  history: [
    { date: "Sep 24", window: "7:00 – 8:00 PM", kwh: 4.8, pricePerKwh: 0.14, status: "paid" as const },
    { date: "Sep 22", window: "6:30 – 7:30 PM", kwh: 5.0, pricePerKwh: 0.13, status: "paid" as const },
    { date: "Sep 19", window: "7:00 – 8:00 PM", kwh: 0, pricePerKwh: 0.1, status: "skipped" as const },
    { date: "Sep 17", window: "7:30 – 8:30 PM", kwh: 5.0, pricePerKwh: 0.15, status: "paid" as const },
    { date: "Sep 12", window: "6:00 – 7:00 PM", kwh: 3.9, pricePerKwh: 0.14, status: "paid" as const },
    { date: "Sep 8", window: "7:00 – 8:00 PM", kwh: 5.0, pricePerKwh: 0.12, status: "paid" as const },
  ],
};
