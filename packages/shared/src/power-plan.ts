// The household "Power Plan": a ranked list of what a home can do about a grid
// stress event, from the resources it owns. Deterministic on purpose: this
// module ranks, and the voice agent / UI only explain. Everything here is a
// demo model (fixed forecasts, flat prices), not a dispatch engine.

export type PlanPreference = "balanced" | "earnings" | "backup" | "emissions" | "grid";
export type PlanActionKind = "STORE_SOLAR" | "DISCHARGE_BATTERY" | "SHIFT_LOAD" | "RUN_GENERATOR" | "NO_ACTION";

/** `label` is the full name (used in the plan's explanation); `short` and `description` are for the picker. */
export const PLAN_PREFERENCES: { value: PlanPreference; label: string; short: string; description: string }[] = [
  {
    value: "balanced",
    label: "Balanced",
    short: "Balanced",
    description: "A mix of earnings, helping the grid, backup power and clean energy.",
  },
  {
    value: "earnings",
    label: "Maximum earnings",
    short: "Earn the most",
    description: "Picks whatever pays you the most tonight.",
  },
  {
    value: "backup",
    label: "Maximum backup protection",
    short: "Keep backup power",
    description: "Keeps your battery well charged in case the power goes out. Holds at least 80% in reserve.",
  },
  {
    value: "emissions",
    label: "Lowest emissions",
    short: "Cleanest energy",
    description: "Prefers solar and battery power and avoids running your generator.",
  },
  {
    value: "grid",
    label: "Maximum grid support",
    short: "Help the grid most",
    description: "Gives your neighborhood the most relief, even if it pays a little less.",
  },
];

/** Illustrative inputs the demo has no live source for. */
export const DEMO_SOLAR_SURPLUS_KWH = 3.1;
export const DEMO_GENERATOR = { kw: 6, fuelCostPerKwh: 0.28 };
/** Optional household loads (dishwasher, laundry) that can wait until after an event. */
export const BASE_SHIFTABLE_KWH = 1.4;

/** How high we let the battery charge ahead of an event. */
const STORE_TARGET_PERCENT = 95;
/** Reserve floor when the user wants backup protection or a storm is expected. */
const PROTECTED_RESERVE_PERCENT = 80;
/** Fraction of generator nameplate we'd run it at. */
const GENERATOR_LOAD = 0.75;
const HVAC_KWH_PER_DEGREE_HOUR = 0.5;
/** An EV isn't charging flat out for the whole event; assume it's drawing this share of the time. */
const EV_DUTY = 0.4;

export interface PlanInput {
  preference: PlanPreference;
  /** A hurricane or similar is expected: backup comes before earnings. */
  stormExpected: boolean;
  event: { pricePerKwh: number; durationHours: number };
  battery?: {
    kwh: number;
    chargePercent: number;
    maxDischargeKw: number;
    reservePercent: number;
    maxKwhPerEvent: number;
    minRatePerKwh: number;
  };
  /** Solar left over after the home's daytime use, that could be stored. */
  solar?: { surplusKwh: number };
  generator?: { kw: number; fuelCostPerKwh: number };
  ev?: { shiftableKw: number; delayMinutes: number };
  hvac?: { maxAdjustF: number; maxMinutes: number };
}

export interface PlanAction {
  kind: PlanActionKind;
  rank: number;
  /** 0-100. Not-recommended actions are 0. */
  score: number;
  recommended: boolean;
  /** Only worth doing if the grid asks for more than the rest can cover. */
  conditional: boolean;
  title: string;
  detail: string;
  kwh: number;
  /** Estimated pay for this action. Solar storage is 0: it pays through the battery discharge. */
  earnings: number;
  batteryAfterPercent?: number;
  reasons: string[];
  caveat?: string;
}

export interface PowerPlan {
  preference: PlanPreference;
  stormExpected: boolean;
  /** The reserve the plan actually protects (the user's, or higher). */
  reservePercent: number;
  actions: PlanAction[];
  /** One sentence on why the top action is on top. */
  why: string;
  /** Sum of earnings from recommended, non-conditional actions. */
  expectedEarnings: number;
}

type Weights = { financial: number; grid: number; reliability: number; emissions: number };
const WEIGHTS: Record<PlanPreference, Weights> = {
  balanced: { financial: 0.3, grid: 0.3, reliability: 0.25, emissions: 0.15 },
  earnings: { financial: 0.6, grid: 0.15, reliability: 0.15, emissions: 0.1 },
  backup: { financial: 0.15, grid: 0.1, reliability: 0.65, emissions: 0.1 },
  emissions: { financial: 0.15, grid: 0.2, reliability: 0.15, emissions: 0.5 },
  grid: { financial: 0.1, grid: 0.65, reliability: 0.15, emissions: 0.1 },
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => `$${n.toFixed(2)}`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Candidate extends Omit<PlanAction, "rank" | "score"> {
  /** What the action is worth for ranking; differs from earnings for solar storage. */
  value: number;
  /** kWh of relief it gives the grid during the event. */
  gridKwh: number;
  reliability: number;
  emissions: number;
}

export function buildPowerPlan(input: PlanInput): PowerPlan {
  const { event, battery, solar, generator, ev, hvac } = input;
  const rate = event.pricePerKwh;
  const hours = event.durationHours;
  const protect = input.stormExpected || input.preference === "backup";
  const reserve = battery ? (protect ? Math.max(battery.reservePercent, PROTECTED_RESERVE_PERCENT) : battery.reservePercent) : 0;
  const candidates: Candidate[] = [];

  // Solar surplus -> battery, before the event.
  let stored = 0;
  let chargeAfterStore = battery?.chargePercent ?? 0;
  if (battery && solar) {
    const headroom = Math.max(0, ((STORE_TARGET_PERCENT - battery.chargePercent) / 100) * battery.kwh);
    stored = r1(Math.min(solar.surplusKwh, headroom));
    chargeAfterStore = battery.chargePercent + (stored / battery.kwh) * 100;
    if (stored >= 0.1) {
      candidates.push({
        kind: "STORE_SOLAR",
        recommended: true,
        conditional: false,
        title: "Store excess solar",
        detail: `Charge your battery toward ${Math.round(chargeAfterStore)}% before the event. +${stored.toFixed(1)} kWh for tonight.`,
        kwh: stored,
        earnings: 0,
        reasons: [
          "Solar output falls off before the evening peak, so this energy is worth more stored than exported now.",
          "Costs nothing and adds to your backup as well as your flexibility.",
        ],
        value: stored * rate,
        gridKwh: stored * 0.9,
        reliability: 1,
        emissions: 1,
      });
    }
  }

  // Battery discharge during the event.
  if (battery) {
    const usable = battery.kwh * (1 - reserve / 100);
    const spare = Math.max(0, ((chargeAfterStore - reserve) / 100) * battery.kwh);
    const kwh = r1(Math.max(0, Math.min(spare, battery.maxKwhPerEvent, battery.maxDischargeKw * hours)));
    const rateOk = rate >= battery.minRatePerKwh;
    const recommended = kwh >= 0.1 && rateOk;
    const after = Math.round(chargeAfterStore - (kwh / battery.kwh) * 100);
    candidates.push({
      kind: "DISCHARGE_BATTERY",
      recommended,
      conditional: false,
      title: "Discharge your battery",
      detail: recommended
        ? `Share ${kwh.toFixed(1)} kWh during the event. Battery ends around ${after}%, above your ${reserve}% reserve.`
        : kwh < 0.1
          ? `Nothing to share above your ${reserve}% reserve.`
          : `Tonight pays ${money(rate)}/kWh, below your ${money(battery.minRatePerKwh)}/kWh minimum.`,
      kwh: recommended ? kwh : 0,
      earnings: recommended ? r2(kwh * rate) : 0,
      batteryAfterPercent: after,
      reasons: recommended
        ? [
            "High grid value during the event.",
            `Stays above your ${reserve}% reserve${reserve > battery.reservePercent ? " (raised to protect your backup)" : ""}.`,
            "Cheaper and cleaner than running a generator.",
          ]
        : [kwh < 0.1 ? "No charge above your reserve." : "Rate is below your minimum."],
      value: recommended ? kwh * rate : 0,
      gridKwh: recommended ? kwh : 0,
      reliability: usable > 0 ? clamp01(1 - kwh / usable) : 0,
      emissions: stored >= 0.1 ? 0.75 : 0.6,
    });
  }

  // Household load, moved until after the event.
  const evKwh = ev ? ev.shiftableKw * EV_DUTY * (Math.min(ev.delayMinutes, hours * 60) / 60) : 0;
  const hvacKwh = hvac ? HVAC_KWH_PER_DEGREE_HOUR * hvac.maxAdjustF * (Math.min(hvac.maxMinutes, hours * 60) / 60) : 0;
  const shiftKwh = r1(BASE_SHIFTABLE_KWH + evKwh + hvacKwh);
  const shiftParts = ["dishwasher and laundry", ev && "EV charging", hvac && "AC"].filter(Boolean) as string[];
  candidates.push({
    kind: "SHIFT_LOAD",
    recommended: true,
    conditional: false,
    title: "Shift household demand",
    detail: `Delay ${shiftParts.join(", ")} until after the event. About ${shiftKwh.toFixed(1)} kWh less during it.`,
    kwh: shiftKwh,
    earnings: r2(shiftKwh * rate),
    reasons: ["Costs nothing and doesn't touch your battery.", "Only moves optional loads; nothing you need is switched off."],
    value: shiftKwh * rate,
    gridKwh: shiftKwh,
    reliability: 1,
    emissions: 0.9,
  });

  // Generator, powering the home (not exporting).
  if (generator) {
    const net = rate - generator.fuelCostPerKwh;
    const kw = generator.kw * GENERATOR_LOAD;
    const kwh = r1(kw * hours);
    const recommended = net > 0 && !protect;
    candidates.push({
      kind: "RUN_GENERATOR",
      recommended,
      conditional: true,
      title: "Run your generator",
      detail: recommended
        ? `Only if the grid asks for more than your battery can cover. About ${kw.toFixed(1)} kW, netting ${money(net)}/kWh after fuel.`
        : protect
          ? "Keep your fuel for a possible outage."
          : `Fuel costs ${money(generator.fuelCostPerKwh)}/kWh, more than tonight pays.`,
      kwh: recommended ? kwh : 0,
      earnings: recommended ? r2(kwh * net) : 0,
      reasons: recommended
        ? ["Profitable tonight, but the battery is cheaper and cleaner, so it goes first."]
        : [protect ? "Fuel is your backup if the grid goes down." : "Fuel costs more than the payment."],
      caveat: "This powers your home. Sending generator power to the grid needs approved interconnection equipment.",
      value: recommended ? kwh * net : 0,
      gridKwh: recommended ? kwh * 0.6 : 0,
      reliability: 0.75,
      emissions: 0.1,
    });
  }

  candidates.push({
    kind: "NO_ACTION",
    recommended: true,
    conditional: false,
    title: "Take no extra action",
    detail: "Keep everything as it is and keep your full backup.",
    kwh: 0,
    earnings: 0,
    reasons: ["Keeps your maximum backup capacity."],
    value: 0,
    gridKwh: 0,
    reliability: 1,
    emissions: 0.5,
  });

  // Score. Storms multiply the weight on reliability, then weights renormalise.
  const w = { ...WEIGHTS[input.preference] };
  if (input.stormExpected) w.reliability *= 3;
  const total = w.financial + w.grid + w.reliability + w.emissions;
  const maxValue = Math.max(...candidates.map((c) => c.value));
  const maxGrid = Math.max(...candidates.map((c) => c.gridKwh));
  const scored = candidates.map((c) => {
    const s =
      (w.financial * (maxValue > 0 ? c.value / maxValue : 0) +
        w.grid * (maxGrid > 0 ? c.gridKwh / maxGrid : 0) +
        w.reliability * c.reliability +
        w.emissions * c.emissions) /
      total;
    const { value, gridKwh, reliability, emissions, ...action } = c;
    void value, gridKwh, reliability, emissions;
    return { ...action, score: c.recommended ? Math.round(s * 100) : 0 };
  });
  scored.sort((a, b) => b.score - a.score);
  const actions: PlanAction[] = scored.map((a, i) => ({ ...a, rank: i + 1 }));

  const top = actions[0];
  const prefLabel = PLAN_PREFERENCES.find((p) => p.value === input.preference)!.label;
  const context = input.stormExpected
    ? "With a storm expected, backup comes before earnings."
    : `For your "${prefLabel}" setting:`;
  const why =
    top.kind === "NO_ACTION"
      ? "Protecting your backup matters more than the payment tonight, so the safest plan is to leave things as they are."
      : `${context} ${top.title.toLowerCase()} ranks first. ${top.reasons[0]}`;

  return {
    preference: input.preference,
    stormExpected: input.stormExpected,
    reservePercent: reserve,
    actions,
    why,
    expectedEarnings: r2(actions.filter((a) => a.recommended && !a.conditional).reduce((s, a) => s + a.earnings, 0)),
  };
}

/** Hours between the ends of a window like "7:30 – 9:00 PM". Falls back to one hour. */
export function windowHours(window: string): number {
  const m = window.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return 1;
  const start = Number(m[1]) * 60 + Number(m[2]);
  let end = Number(m[3]) * 60 + Number(m[4]);
  while (end <= start) end += 12 * 60;
  return Math.round(((end - start) / 60) * 100) / 100;
}
