"use client";

import type { ParticipantProfile, Role } from "@/lib/profile";
import { RunProvider } from "./RunProvider";
import { NotificationsProvider } from "./Notifications";
import { OperatorWalletProvider } from "./OperatorWallet";
import { SimulatorPanel, SimulatorProvider } from "./Simulator";
import { SolanaProvider } from "./SolanaProvider";
import { VoiceAssistantProvider } from "../voice/VoiceAssistantProvider";

export function DashboardProviders({
  role,
  children,
}: {
  role: Role;
  household?: { zone: string; feeder: string; profile: ParticipantProfile };
  children: React.ReactNode;
}) {
  return (
    <SolanaProvider>
      <RunProvider>
        <NotificationsProvider role={role}>
          <SimulatorProvider>
            <OperatorWalletProvider>
              <VoiceAssistantProvider role={role}>
                {children}
                <SimulatorPanel />
              </VoiceAssistantProvider>
            </OperatorWalletProvider>
          </SimulatorProvider>
        </NotificationsProvider>
      </RunProvider>
    </SolanaProvider>
  );
}
