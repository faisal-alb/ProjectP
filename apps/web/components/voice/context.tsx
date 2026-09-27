"use client";

import { createContext, useContext } from "react";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking";

export interface VoiceAssistant {
  state: VoiceState;
  error: string | null;
  /** Start the assistant (optionally opening with a question), or end it if it's running. */
  toggle: (prompt?: string) => void;
  /** Start the assistant with a question, or ask it into the running session. Never ends it. */
  ask: (prompt?: string) => void;
  /** The session has been quiet long enough that it's about to end on its own. */
  endingSoon: boolean;
}

export const VoiceContext = createContext<VoiceAssistant | null>(null);

export function useVoiceAssistant() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceAssistant needs a VoiceAssistantProvider");
  return ctx;
}

export const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Ask GridFlex",
  connecting: "Connecting…",
  listening: "Listening",
  speaking: "Speaking",
};
