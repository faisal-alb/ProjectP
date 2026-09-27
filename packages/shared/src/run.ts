/** Shared run contracts. Observations, estimates and payment confirmations stay distinct. */
export type ZoneId = "downtown" | "north" | "south" | "east";
export const RUN_ZONES: ZoneId[] = ["downtown", "north", "south", "east"];
export type Origin = "historical" | "modeled" | "forecast" | "injected";
export interface Provenance {
  source: string;
  kind: Origin;
  units: string;
  geography: string;
  version: string;
  detail?: string;
}
export interface EnvironmentPoint {
  at: string;
  priceMwh: number;
  tempF: number;
  humidity: number;
  radiationWm2: number;
  regionalLoadMw: number;
  homesKw: number[];
  commercialKw: number[];
}
export interface RunBundle {
  version: string;
  start: string;
  end: string;
  points: EnvironmentPoint[];
  sources: Provenance[];
  modelHealth: Record<string, string>;
}
export type DeviceKind = "battery" | "ev" | "hvac" | "solar" | "generator";
export interface DeviceState {
  id: string;
  zone: ZoneId;
  kind: DeviceKind;
  capacityKwh: number;
  energyKwh: number;
  maxKw: number;
  reserve: number;
  minPrice: number;
  maxEventsPerDay: number;
  eventsToday: number;
  maxKwhPerEvent: number;
  available: boolean;
  optedOut: boolean;
  departureMinute: number;
  targetKwh: number;
  away?: boolean;
  temperatureF: number;
  comfortMaxF: number;
  fuelKwh: number;
  reboundKwh: number;
  baselineKw: number;
  powerKw: number;
  deliveredWh: number;
  status: string;
}
export interface ZoneState {
  id: ZoneId;
  loadKw: number;
  capacityKw: number;
  forecastKw: number;
  lowKw: number;
  highKw: number;
  reliefKw: number;
  requiredKw: number;
  status: "normal" | "watch" | "high";
}
export interface Dispatch {
  resourceId: string;
  kw: number;
  price: number;
  baselineKw: number;
}
export interface Decision {
  id: string;
  at: string;
  zone: ZoneId;
  source: string;
  modelVersion: string;
  pSpike: number;
  price: number;
  requiredKw: number;
  uncoveredKw: number;
  dispatch: Dispatch[];
  reasons: string[];
  horizonKw: number[];
  constraints: string[];
}
export type EventPhase =
  | "scheduled"
  | "committing"
  | "dispatching"
  | "verifying"
  | "settling"
  | "completed"
  | "canceled";
export interface RunCommitment extends Dispatch {
  committedWh: number;
  deliveredWh: number;
  physicalWh: number;
  baselineHash: string;
  samples: number;
  missing: number;
  quarantined?: { minute: number; wh: number; reason: string }[];
  participant?: string;
  address?: string;
  paidBase?: string;
  signature?: string;
  proof?: string;
}
export interface RunEvent {
  id: string;
  zone: ZoneId;
  startMinute: number;
  endMinute: number;
  phase: EventPhase;
  decisionId: string;
  price: number;
  requiredKw: number;
  commitments: RunCommitment[];
  chainId: string;
  address?: string;
  createSignature?: string;
  closeSignature?: string;
  escrowBase: string;
  refundBase?: string;
  error?: string;
  attempts: number;
  retryAt?: number;
  canceled?: boolean;
  cancellationReason?: string;
}
export interface RunLog {
  seq: number;
  at: string;
  type: string;
  message: string;
  eventId?: string;
  scenario?: string;
}
export interface Coverage {
  scenario: string;
  status: "pending" | "injected" | "observed";
  evidence: number[];
}
export interface RunState {
  id: string;
  version: number;
  seed: number;
  bundleVersion: string;
  start: string;
  minute: number;
  speed: 1 | 24 | 96;
  status: "paused" | "running" | "draining" | "completed";
  preset: "stress" | "historical";
  devices: DeviceState[];
  zones: ZoneState[];
  environment: EnvironmentPoint | null;
  decisions: Decision[];
  events: RunEvent[];
  faults: { id: string; until: number }[];
  log: RunLog[];
  coverage: Coverage[];
  sources: Provenance[];
  health: string[];
  spentBase: string;
  priceCapPerKwh: number;
  series: { at: string; zones: ZoneState[] }[];
}
export interface Scenario {
  id: string;
  label: string;
  minute: number;
  duration: number;
  category: string;
}
export const SCENARIOS: Scenario[] = [
  ["missing-readings", "Missing readings", 135, 15, "Telemetry"],
  ["stale-readings", "Stale readings", 180, 10, "Telemetry"],
  ["ev-departure", "Early EV departure", 390, 45, "Devices"],
  ["opt-out", "Participant opts out", 435, 30, "Participation"],
  ["reserve", "Protected battery reserve", 465, 30, "Devices"],
  ["negative-price", "Negative energy prices", 600, 30, "Market"],
  ["solar-drop", "Cloud front", 675, 30, "Environment"],
  ["demand-surge", "Demand surge", 750, 60, "Environment"],
  ["device-offline", "Device unavailable", 765, 30, "Devices"],
  ["price-ineligible", "Offers above price cap", 810, 30, "Participation"],
  ["storm", "Storm reserve protection", 855, 30, "Devices"],
  ["partial-procurement", "Insufficient flexibility", 915, 45, "Market"],
  ["peak", "Evening demand peak", 990, 90, "Environment"],
  ["under-delivery", "Partial delivery", 1035, 20, "Delivery"],
  ["over-delivery", "Excess delivery", 1060, 15, "Delivery"],
  ["duplicate-readings", "Duplicate readings", 1110, 15, "Telemetry"],
  ["implausible-readings", "Implausible readings", 1140, 15, "Telemetry"],
  ["rpc-timeout", "RPC unavailable", 1200, 15, "Settlement"],
  [
    "forecast-offline",
    "Forecast service unavailable",
    1260,
    15,
    "Intelligence",
  ],
  ["assistant-offline", "Assistant unavailable", 1320, 15, "Intelligence"],
  ["zero-procurement", "No eligible resources", -1, 60, "Market"],
  ["zero-delivery", "Confirmed zero delivery", -1, 60, "Delivery"],
  ["declined", "Participation declined", -1, 60, "Participation"],
  ["unanswered", "Participation unanswered", -1, 60, "Participation"],
  ["full-battery", "Battery fully charged", -1, 30, "Devices"],
  ["empty-battery", "Battery at reserve", -1, 60, "Devices"],
  ["hvac-limit", "Comfort limit reached", -1, 60, "Devices"],
  ["generator-limit", "Generator fuel exhausted", -1, 60, "Devices"],
  ["cancel-event", "Cancel current event", -1, 1, "Market"],
  ["forecast-error", "Demand forecast error", -1, 60, "Intelligence"],
  ["corrupt-model", "Invalid model artifact", -1, 30, "Intelligence"],
  ["incomplete-data", "Missing environmental inputs", -1, 15, "Intelligence"],
  ["optimizer-infeasible", "No feasible schedule", -1, 30, "Intelligence"],
  ["insufficient-funds", "Insufficient settlement funds", -1, 15, "Settlement"],
  ["expired-transaction", "Expired transaction", -1, 5, "Settlement"],
  ["delayed-confirmation", "Delayed confirmation", -1, 15, "Settlement"],
  ["partial-batch", "Interrupted commitment batch", -1, 5, "Settlement"],
].map(([id, label, minute, duration, category]) => ({
  id: String(id),
  label: String(label),
  minute: Number(minute),
  duration: Number(duration),
  category: String(category),
}));

export function virtualAt(run: Pick<RunState, "start" | "minute">): string {
  return new Date(Date.parse(run.start) + run.minute * 60_000).toISOString();
}
export const activeFault = (
  run: Pick<RunState, "faults" | "minute">,
  id: string,
) => run.faults.some((f) => f.id === id && f.until > run.minute);
export const rounded = (n: number) => Math.round(n * 1000) / 1000;

export function createDevices(seed = 7): DeviceState[] {
  return RUN_ZONES.flatMap((zone, z) =>
    Array.from({ length: 10 }, (_, i) => {
      const kind: DeviceKind =
        i < 6
          ? "battery"
          : i === 6
            ? "ev"
            : i === 7
              ? "hvac"
              : i === 8
                ? "solar"
                : "generator";
      return {
        id: `${zone}-${kind}-${i}`,
        zone,
        kind,
        capacityKwh: kind === "ev" ? 60 : 13.5,
        energyKwh: kind === "ev" ? 30 : 7 + ((seed + i + z) % 4),
        maxKw: kind === "ev" ? 7.2 : 5,
        maxEventsPerDay: 6,
        eventsToday: 0,
        maxKwhPerEvent: 5,
        reserve: 0.2,
        minPrice: kind === "generator" ? 0.32 : 0.08 + i * 0.01,
        available: true,
        optedOut: false,
        departureMinute: 480,
        targetKwh: 48,
        temperatureF: 74,
        comfortMaxF: 78,
        fuelKwh: 30,
        reboundKwh: 0,
        baselineKw: 0,
        powerKw: 0,
        deliveredWh: 0,
        status: "Available",
      };
    }),
  );
}

/** One-minute physical evolution. Meter outcomes do not depend on predicted baselines. */
export function evolveDevice(
  d: DeviceState,
  requestKw: number,
  minute: number,
  tempF: number,
  radiation: number,
  faults: string[],
  chargeLimitKw = d.maxKw,
) {
  const has = (id: string) => faults.includes(id);
  const reserve =
    has("storm") || has("reserve") ? Math.max(d.reserve, 0.8) : d.reserve;
  const offline =
    !d.available ||
    d.optedOut ||
    (has("device-offline") && d.kind === "battery");
  const requested =
    offline || has("zero-delivery")
      ? 0
      : Math.max(0, requestKw) *
        (has("under-delivery") ? 0.5 : has("over-delivery") ? 1.1 : 1);
  let relief = 0;
  let consumption = d.baselineKw;
  if (d.kind === "battery") {
    relief = Math.min(
      requested,
      d.maxKw,
      Math.max(0, d.energyKwh - d.capacityKwh * reserve) * 60 * 0.95,
    );
    d.energyKwh -= relief / (60 * 0.95);
    if (!offline && requested === 0 && (minute < 300 || radiation > 350)) {
      const charge = Math.min(
        d.maxKw,
        chargeLimitKw,
        ((d.capacityKwh - d.energyKwh) * 60) / 0.95,
      );
      d.energyKwh += (charge / 60) * 0.95;
      consumption += charge;
    }
  } else if (d.kind === "ev") {
    const connected =
      minute < (has("ev-departure") ? 390 : d.departureMinute) ||
      minute >= 1080;
    const desired =
      connected && !offline
        ? Math.min(d.maxKw, (Math.max(0, d.targetKwh - d.energyKwh) * 60) / 0.9)
        : 0;
    if (!connected && !d.away) {
      d.energyKwh = Math.max(0, d.energyKwh - 18);
      d.away = true;
    }
    if (connected) d.away = false;
    const left = Math.max(
      1,
      (minute >= 1080 ? d.departureMinute + 1440 : d.departureMinute) - minute,
    );
    const needed = (Math.max(0, d.targetKwh - d.energyKwh) * 60) / (left * 0.9);
    relief = Math.min(requested, Math.max(0, desired - needed));
    d.energyKwh = Math.min(
      d.capacityKwh,
      d.energyKwh + ((desired - relief) / 60) * 0.9,
    );
    consumption = desired;
  } else if (d.kind === "hvac") {
    const cooling = Math.min(
      d.maxKw,
      Math.max(0, (tempF - 74) * 0.13) + Math.min(d.reboundKwh, 1),
    );
    relief =
      d.temperatureF >= d.comfortMaxF || has("hvac-limit")
        ? 0
        : Math.min(requested, cooling);
    d.temperatureF +=
      (tempF - d.temperatureF) * 0.006 - (cooling - relief) * 0.04;
    d.reboundKwh = Math.max(
      0,
      d.reboundKwh +
        relief / 60 -
        (requested === 0 ? Math.min(d.reboundKwh, 1) / 60 : 0),
    );
    consumption = cooling;
  } else if (d.kind === "solar") {
    // Solar generation reduces the native load; only released curtailment is flexibility.
    const generation = Math.min(
      d.maxKw,
      (d.maxKw * Math.max(0, radiation)) / 1000,
    );
    consumption = -generation * 0.8;
    relief = Math.min(requested, generation * 0.2);
  } else {
    relief = has("generator-limit")
      ? 0
      : Math.min(requested, d.maxKw, d.fuelKwh * 60);
    d.fuelKwh = Math.max(0, d.fuelKwh - relief / 60);
  }
  d.powerKw = rounded(relief);
  d.deliveredWh += (relief * 1000) / 60;
  d.status = offline ? "Unavailable" : relief > 0 ? "Delivering" : "Available";
  return {
    consumptionKw: consumption - relief,
    reliefKw: relief,
    counterfactualKw: consumption,
  };
}
