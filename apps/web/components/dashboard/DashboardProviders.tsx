"use client";

import type { Role } from "@/lib/profile";
import { GridAssistant } from "@/components/voice/GridAssistant";
import { VoiceSnapshotProvider } from "@/lib/voice-snapshot";
import { HouseholdProvider } from "./HouseholdProvider";
import { OperatorWalletProvider } from "./OperatorWallet";
import { SolanaProvider } from "./SolanaProvider";

export function DashboardProviders({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <SolanaProvider>
      {role === "participant" ? (
        <HouseholdProvider>
          <VoiceSnapshotProvider>
            {children}
            <GridAssistant />
          </VoiceSnapshotProvider>
        </HouseholdProvider>
      ) : (
        <OperatorWalletProvider>{children}</OperatorWalletProvider>
      )}
    </SolanaProvider>
  );
}
