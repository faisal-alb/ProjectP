"use client";

import type { Role } from "@/lib/profile";
import { HouseholdProvider } from "./HouseholdProvider";
import { OperatorWalletProvider } from "./OperatorWallet";
import { SolanaProvider } from "./SolanaProvider";

export function DashboardProviders({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <SolanaProvider>
      {role === "participant" ? (
        <HouseholdProvider>{children}</HouseholdProvider>
      ) : (
        <OperatorWalletProvider>{children}</OperatorWalletProvider>
      )}
    </SolanaProvider>
  );
}
