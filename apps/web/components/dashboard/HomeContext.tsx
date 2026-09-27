"use client";

import { createContext, useContext, useEffect } from "react";
import { RUN_ZONES, type DeviceKind, type ResourceKey, type ZoneId } from "@gridflex/shared";
import { useVoiceAssistant } from "../voice/context";

/** Which run devices belong to this household: the zone from their ZIP, the kinds from their onboarding picks. */
export interface Home {
  zoneId: ZoneId;
  zoneName: string;
  feeder: string;
  kinds: DeviceKind[];
  resources: Partial<Record<DeviceKind, ResourceKey>>;
  /** Everything they've added, including devices the run can't dispatch yet. */
  picked: ResourceKey[];
}

export const KIND_OF: Partial<Record<ResourceKey, DeviceKind>> = {
  battery: "battery",
  solarBattery: "battery",
  ev: "ev",
  bidirectionalEv: "ev",
  hvac: "hvac",
  heatPump: "hvac",
  miniSplit: "hvac",
  solar: "solar",
  generator: "generator",
  portableGenerator: "generator",
};

export function homeFrom(zone: string, feeder: string, picked: ResourceKey[]): Home {
  const id = zone.split(" ")[0].toLowerCase() as ZoneId;
  const resources: Home["resources"] = {};
  for (const key of picked) {
    const kind = KIND_OF[key];
    if (kind && !resources[kind]) resources[kind] = key;
  }
  if (picked.includes("solarBattery")) resources.solar ??= "solarBattery";
  return {
    zoneId: RUN_ZONES.includes(id) ? id : "downtown",
    zoneName: zone,
    feeder,
    kinds: Object.keys(resources) as DeviceKind[],
    resources,
    picked,
  };
}

const HomeContext = createContext<Home | null>(null);

export function HomeProvider({ home, children }: { home: Home; children: React.ReactNode }) {
  const { setZone } = useVoiceAssistant();
  // The assistant's tools and context follow the household's own neighborhood.
  useEffect(() => setZone(home.zoneId), [home.zoneId, setZone]);
  return <HomeContext.Provider value={home}>{children}</HomeContext.Provider>;
}

export function useHome() {
  const home = useContext(HomeContext);
  if (!home) throw new Error("useHome needs a HomeProvider");
  return home;
}
