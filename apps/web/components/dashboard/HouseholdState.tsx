"use client";

import { createContext, useContext, useState } from "react";
import {
  DEMO_GENERATOR,
  DEMO_SOLAR_SURPLUS_KWH,
  buildPowerPlan,
  windowHours,
  type PlanPreference,
} from "@gridflex/shared";
import {
  BATTERY_CHARGE_PERCENT,
  BATTERY_KWH,
  BATTERY_MAX_DISCHARGE_KW,
  EV_SHIFTABLE_KW,
  household,
  type ResourceKey,
} from "@/lib/demo-data";
import type { Emergency, ParticipantProfile } from "@/lib/profile";
import { usePublishVoiceSnapshot } from "@/lib/voice-snapshot";
import { useHousehold } from "./HouseholdProvider";
import type { EventState } from "./HouseholdEvent";

/** Earned before this month; the demo has no ledger to sum. */
const EARLIER_EARNINGS = 61.59;

export interface Rules {
  autoFlex: boolean;
  reserve: number;
  minRate: number;
  maxKwh: number;
  maxEvents: number;
  emergency: Emergency;
}

function useHouseholdModel(zone: string, feeder: string, profile: ParticipantProfile) {
  const live = useHousehold();
  const [rules, setRules] = useState<Rules>({
    autoFlex: profile.autoFlex,
    reserve: profile.reservePercent,
    minRate: profile.minRate,
    maxKwh: profile.maxKwhPerEvent,
    maxEvents: profile.maxEventsPerDay,
    emergency: profile.emergency,
  });
  const [optedOut, setOptedOut] = useState<Partial<Record<ResourceKey, boolean>>>({});
  const [choice, setChoice] = useState<"joined" | "declined" | null>(null);
  // Demo control: lets you see every event state without waiting for one.
  const [preview, setPreview] = useState<EventState | "live">("live");
  // Demo controls for the power plan: how the user wants to optimise, and a storm override.
  const [planPreference, setPlanPreference] = useState<PlanPreference>("balanced");
  const [storm, setStorm] = useState(false);

  const has = (k: ResourceKey) => profile.resources.includes(k);
  const batteryIn = has("battery") && !optedOut.battery;
  const evIn = has("ev") && !optedOut.ev;

  const rate = household.eventPricePerKwh;
  const availableKwh = batteryIn
    ? Math.max(0, ((BATTERY_CHARGE_PERCENT - rules.reserve) / 100) * BATTERY_KWH)
    : 0;
  const requestedKwh = Math.round(Math.min(rules.maxKwh, availableKwh, BATTERY_MAX_DISCHARGE_KW) * 10) / 10;
  const batteryAfter = Math.round(BATTERY_CHARGE_PERCENT - (requestedKwh / BATTERY_KWH) * 100);

  const paidTonight = live?.tonight?.phase === "settled" ? live.tonight : null;
  const rateOk = rate >= rules.minRate;

  // What would happen tonight, from the rules alone.
  let derived: EventState;
  if (paidTonight) derived = "settled";
  else if (requestedKwh <= 0) derived = "none";
  else if (choice === "declined") derived = "declined";
  else if (choice === "joined") derived = "accepted";
  else if (rules.autoFlex && rateOk) derived = "accepted";
  else derived = "awaiting";
  const state = preview === "live" ? derived : preview;
  const auto = choice !== "joined" && rules.autoFlex && rateOk;

  // Figures for the states past "accepted" are illustrative.
  const deliveredKwh =
    state === "active" ? Math.round(requestedKwh * 0.6 * 10) / 10
    : state === "partial" ? Math.round(requestedKwh * 0.7 * 10) / 10
    : state === "verifying" || state === "settled" ? requestedKwh
    : 0;
  const settledLive = state === "settled" && paidTonight ? paidTonight : null;
  const eventEarned = deliveredKwh * rate;

  const paidHistory = household.history.filter((h) => h.status === "paid");
  const livePayouts = live?.payouts ?? [];
  const monthBase =
    paidHistory.reduce((s, h) => s + h.kwh * h.pricePerKwh, 0) +
    livePayouts.reduce((s, p) => s + Number(p.amount.base) / 1e6, 0);
  // A settled preview counts toward today unless the live payout is already in the ledger.
  const todayExtra = (state === "settled" || state === "partial") && !settledLive ? eventEarned : 0;
  const today = settledLive ? Number(settledLive.payout?.base ?? 0) / 1e6 : todayExtra;
  const month = monthBase + todayExtra;
  const lifetime = month + EARLIER_EARNINGS;

  const plan = buildPowerPlan({
    preference: planPreference,
    stormExpected: storm,
    event: { pricePerKwh: rate, durationHours: windowHours(household.eventWindow) },
    battery: batteryIn
      ? {
          kwh: BATTERY_KWH,
          chargePercent: BATTERY_CHARGE_PERCENT,
          maxDischargeKw: BATTERY_MAX_DISCHARGE_KW,
          reservePercent: rules.reserve,
          maxKwhPerEvent: rules.maxKwh,
          minRatePerKwh: rules.minRate,
        }
      : undefined,
    solar: has("solar") && !optedOut.solar ? { surplusKwh: DEMO_SOLAR_SURPLUS_KWH } : undefined,
    generator: has("generator") && !optedOut.generator ? DEMO_GENERATOR : undefined,
    ev: evIn ? { shiftableKw: EV_SHIFTABLE_KW, delayMinutes: profile.ev.delayMinutes } : undefined,
    hvac: has("hvac") && !optedOut.hvac ? profile.hvac : undefined,
  });

  // Published from the layout, so the voice assistant sees the same figures on every page.
  usePublishVoiceSnapshot({
    zone,
    hasBattery: batteryIn,
    batteryKwh: BATTERY_KWH,
    chargePercent: BATTERY_CHARGE_PERCENT,
    maxDischargeKw: BATTERY_MAX_DISCHARGE_KW,
    autoFlex: rules.autoFlex,
    reservePercent: rules.reserve,
    minPricePerKwh: rules.minRate,
    maxKwhPerEvent: rules.maxKwh,
    availableKwh,
    event: {
      window: household.eventWindow,
      pricePerKwh: rate,
      plannedKwh: requestedKwh,
      estimatedEarnings: requestedKwh * rate,
      status: state,
      paid: settledLive?.payout?.formatted,
    },
    earnings: { monthTotal: month, eventCount: paidHistory.length + livePayouts.length },
    plan,
  });

  return {
    zone,
    feeder,
    profile,
    rules,
    setRules,
    optedOut,
    setOptedOut,
    setChoice,
    preview,
    setPreview,
    setPlanPreference,
    setStorm,
    batteryIn,
    evIn,
    rate,
    availableKwh,
    requestedKwh,
    batteryAfter,
    state,
    auto,
    deliveredKwh,
    settledLive,
    todayExtra,
    today,
    month,
    lifetime,
    livePayouts,
    plan,
  };
}

export type HouseholdState = ReturnType<typeof useHouseholdModel>;

const HouseholdStateContext = createContext<HouseholdState | null>(null);

/**
 * The household's rules, opt-outs and tonight's derived figures. Lives in the dashboard
 * layout so a change on one page (say, the reserve on Settings) shows on every other.
 */
export function HouseholdStateProvider({
  zone,
  feeder,
  profile,
  children,
}: {
  zone: string;
  feeder: string;
  profile: ParticipantProfile;
  children: React.ReactNode;
}) {
  const value = useHouseholdModel(zone, feeder, profile);
  return <HouseholdStateContext.Provider value={value}>{children}</HouseholdStateContext.Provider>;
}

export function useHouseholdState() {
  const ctx = useContext(HouseholdStateContext);
  if (!ctx) throw new Error("useHouseholdState needs a HouseholdStateProvider");
  return ctx;
}
