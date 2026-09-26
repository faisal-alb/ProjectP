"use client";

import { createContext, useContext, useEffect, useRef, type MutableRefObject } from "react";

/** What the voice agent's read-only tools can see. Published by the dashboard, never sent wholesale to the model. */
export interface VoiceSnapshot {
  zone: string;
  hasBattery: boolean;
  batteryKwh: number;
  chargePercent: number;
  maxDischargeKw: number;
  autoFlex: boolean;
  reservePercent: number;
  minPricePerKwh: number;
  maxKwhPerEvent: number;
  availableKwh: number;
  event: {
    window: string;
    pricePerKwh: number;
    plannedKwh: number;
    estimatedEarnings: number;
    /** in | skipped | low-price | no-energy | manual | paid */
    status: string;
    paid?: string;
  };
  earnings: { monthTotal: number; eventCount: number };
}

const SnapshotContext = createContext<MutableRefObject<VoiceSnapshot | null> | null>(null);

export function VoiceSnapshotProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<VoiceSnapshot | null>(null);
  return <SnapshotContext.Provider value={ref}>{children}</SnapshotContext.Provider>;
}

/** A ref, so tool calls always read the latest values without re-rendering the assistant. */
export function useVoiceSnapshotRef() {
  const ref = useContext(SnapshotContext);
  if (!ref) throw new Error("useVoiceSnapshotRef needs a VoiceSnapshotProvider");
  return ref;
}

/** Call from the dashboard view with its current values. No-op outside the provider. */
export function usePublishVoiceSnapshot(snapshot: VoiceSnapshot) {
  const ref = useContext(SnapshotContext);
  useEffect(() => {
    if (ref) ref.current = snapshot;
  });
}
