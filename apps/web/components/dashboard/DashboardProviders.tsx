"use client";

import type { ParticipantProfile, Role } from "@/lib/profile";
import { VoiceAssistantProvider } from "@/components/voice/VoiceAssistantProvider";
import { HouseholdProvider } from "./HouseholdProvider";
import { HouseholdStateProvider } from "./HouseholdState";
import { NotificationsProvider } from "./Notifications";
import { OperatorWalletProvider } from "./OperatorWallet";
import { SimulatorPanel, SimulatorProvider } from "./Simulator";
import { SolanaProvider } from "./SolanaProvider";

export function DashboardProviders({
  role,
  household,
  children,
}: {
  role: Role;
  household?: { zone: string; feeder: string; profile: ParticipantProfile };
  children: React.ReactNode;
}) {
  return (
    <SolanaProvider>
      <NotificationsProvider role={role}>
        <SimulatorProvider>
        {role === "participant" && household ? (
          <HouseholdProvider>
            <VoiceAssistantProvider>
              <HouseholdStateProvider {...household}>
                {children}
                <SimulatorPanel />
              </HouseholdStateProvider>
            </VoiceAssistantProvider>
          </HouseholdProvider>
        ) : (
          <OperatorWalletProvider>{children}</OperatorWalletProvider>
        )}
        </SimulatorProvider>
      </NotificationsProvider>
    </SolanaProvider>
  );
}
