"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEMO_HOUSEHOLD_RESOURCE_ID } from "@gridflex/shared";
import { api, useMarketEvents, type HouseholdDto } from "@/lib/api";
import { useSolana } from "./SolanaProvider";

const HouseholdContext = createContext<HouseholdDto | null>(null);

/** The household's managed wallet and payouts, kept fresh from the event stream. */
export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { apiStatus } = useSolana();
  const [data, setData] = useState<HouseholdDto | null>(null);
  const load = useCallback(
    () =>
      api<HouseholdDto>(`/households/${DEMO_HOUSEHOLD_RESOURCE_ID}`)
        .then(setData)
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    if (apiStatus !== "online") return;
    let cancelled = false;
    api<HouseholdDto>(`/households/${DEMO_HOUSEHOLD_RESOURCE_ID}`)
      .then((d) => !cancelled && setData(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apiStatus]);
  useMarketEvents(() => void load(), apiStatus === "online");
  return <HouseholdContext.Provider value={data}>{children}</HouseholdContext.Provider>;
}

export const useHousehold = () => useContext(HouseholdContext);
