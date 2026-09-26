// Account profiles captured at onboarding. Stored in a cookie for the demo;
// real auth and a database replace this later. Parsers clamp every value, so a
// tampered or stale cookie can never put the dashboards in a broken state.
import { RESOURCE_KEYS, defaultZip, localUtility, type ResourceKey } from "@gridflex/shared";

export type Role = "participant" | "operator";

export const ROLE_COOKIE = "gridflex_role";
export const PROFILE_COOKIE = "gridflex_profile";

export type Emergency = "ask" | "allow" | "never";

export interface ParticipantProfile {
  resources: ResourceKey[];
  /** They picked "Not sure yet"; connect devices later from the dashboard. */
  notSure: boolean;
  zip: string;
  autoFlex: boolean;
  reservePercent: number;
  maxKwhPerEvent: number;
  maxEventsPerDay: number;
  minRate: number;
  emergency: Emergency;
  ev: { readyBy: string; minCharge: number; delayMinutes: number };
  hvac: { maxAdjustF: number; maxMinutes: number };
}

export type OrgType = "utility" | "municipality" | "microgrid" | "campus" | "aggregator" | "commercial";
export type Strategy = "balanced" | "cost" | "carbon" | "reliability";

export interface OperatorProfile {
  orgName: string;
  orgType: OrgType;
  region: string;
  warningPercent: number;
  strategy: Strategy;
  maxNormalPrice: number;
  maxEmergencyPrice: number;
  minRiskPercent: number;
  autoRecommend: boolean;
  autoLaunch: boolean;
}

export const defaultParticipantProfile: ParticipantProfile = {
  resources: ["battery"],
  notSure: false,
  zip: defaultZip,
  autoFlex: true,
  reservePercent: 40,
  maxKwhPerEvent: 5,
  maxEventsPerDay: 2,
  minRate: 0.12,
  emergency: "ask",
  ev: { readyBy: "07:00", minCharge: 50, delayMinutes: 90 },
  hvac: { maxAdjustF: 2, maxMinutes: 60 },
};

export const defaultOperatorProfile: OperatorProfile = {
  orgName: localUtility,
  orgType: "utility",
  region: "South Florida",
  warningPercent: 85,
  strategy: "balanced",
  maxNormalPrice: 0.2,
  maxEmergencyPrice: 0.9,
  minRiskPercent: 85,
  autoRecommend: true,
  autoLaunch: false,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown, min: number, max: number, fallback: number, step = 0) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  const clamped = Math.min(max, Math.max(min, v));
  return step ? Math.round(clamped / step) * step : clamped;
};
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
const text = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

export function parseParticipantProfile(input: unknown): ParticipantProfile {
  const d = defaultParticipantProfile;
  const p = isRecord(input) ? input : {};
  const ev = isRecord(p.ev) ? p.ev : {};
  const hvac = isRecord(p.hvac) ? p.hvac : {};
  const resources = Array.isArray(p.resources)
    ? RESOURCE_KEYS.filter((k) => (p.resources as unknown[]).includes(k))
    : d.resources;
  return {
    resources,
    notSure: p.notSure === true,
    zip: typeof p.zip === "string" && /^\d{5}$/.test(p.zip.trim()) ? p.zip.trim() : d.zip,
    autoFlex: p.autoFlex !== false,
    reservePercent: num(p.reservePercent, 20, 80, d.reservePercent, 5),
    maxKwhPerEvent: num(p.maxKwhPerEvent, 1, 6, d.maxKwhPerEvent, 0.5),
    maxEventsPerDay: num(p.maxEventsPerDay, 1, 3, d.maxEventsPerDay, 1),
    minRate: num(p.minRate, 0.05, 0.3, d.minRate, 0.01),
    emergency: oneOf(p.emergency, ["ask", "allow", "never"], d.emergency),
    ev: {
      readyBy: typeof ev.readyBy === "string" && /^\d{2}:\d{2}$/.test(ev.readyBy) ? ev.readyBy : d.ev.readyBy,
      minCharge: num(ev.minCharge, 20, 90, d.ev.minCharge, 5),
      delayMinutes: num(ev.delayMinutes, 30, 180, d.ev.delayMinutes, 15),
    },
    hvac: {
      maxAdjustF: num(hvac.maxAdjustF, 1, 4, d.hvac.maxAdjustF, 1),
      maxMinutes: num(hvac.maxMinutes, 30, 120, d.hvac.maxMinutes, 15),
    },
  };
}

export function parseOperatorProfile(input: unknown): OperatorProfile {
  const d = defaultOperatorProfile;
  const p = isRecord(input) ? input : {};
  return {
    orgName: text(p.orgName, 60, d.orgName),
    orgType: oneOf(p.orgType, ["utility", "municipality", "microgrid", "campus", "aggregator", "commercial"], d.orgType),
    region: text(p.region, 60, d.region),
    warningPercent: num(p.warningPercent, 60, 95, d.warningPercent, 5),
    strategy: oneOf(p.strategy, ["balanced", "cost", "carbon", "reliability"], d.strategy),
    maxNormalPrice: num(p.maxNormalPrice, 0.05, 0.4, d.maxNormalPrice, 0.01),
    maxEmergencyPrice: num(p.maxEmergencyPrice, 0.2, 1, d.maxEmergencyPrice, 0.05),
    minRiskPercent: num(p.minRiskPercent, 50, 95, d.minRiskPercent, 5),
    autoRecommend: p.autoRecommend !== false,
    autoLaunch: p.autoLaunch === true,
  };
}
