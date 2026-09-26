"use client";

import { createContext, useContext } from "react";
import { useApiHealth, type ApiStatus, type HealthDto } from "@/lib/api";

const SolanaContext = createContext<{ apiStatus: ApiStatus; health: HealthDto | null }>({
  apiStatus: "loading",
  health: null,
});

/** Whether live settlement is available, shared by the header and the page. */
export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const { status, health } = useApiHealth();
  return <SolanaContext.Provider value={{ apiStatus: status, health }}>{children}</SolanaContext.Provider>;
}

export const useSolana = () => useContext(SolanaContext);
