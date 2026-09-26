"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import { VoiceSnapshotProvider } from "@/lib/voice-snapshot";
import { FloatingAskButton } from "./AskButton";
import { VoiceContext, type VoiceState } from "./context";
import { VoiceTools } from "./VoiceTools";

/**
 * One voice conversation for the whole dashboard. Any button (the floating one or an
 * inline one) drives the same session, so they all show the same state.
 */
export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  return (
    <VoiceSnapshotProvider>
      <ConversationProvider>
        <VoiceTools />
        <Controller>
          {children}
          <FloatingAskButton />
        </Controller>
      </ConversationProvider>
    </VoiceSnapshotProvider>
  );
}

function Controller({ children }: { children: React.ReactNode }) {
  const { startSession, endSession, sendUserMessage } = useConversationControls();
  const { status } = useConversationStatus();
  const { mode } = useConversationMode();
  const [error, setError] = useState<string | null>(null);
  // Covers the signed-URL fetch and the mic permission prompt, before the socket opens.
  const [preparing, setPreparing] = useState(false);
  const pendingPrompt = useRef<string | undefined>(undefined);

  const state: VoiceState =
    preparing || status === "connecting"
      ? "connecting"
      : status === "connected"
        ? mode === "speaking"
          ? "speaking"
          : "listening"
        : "idle";

  // An inline button's question goes out once the session is open.
  useEffect(() => {
    if (status === "connected" && pendingPrompt.current) {
      sendUserMessage(pendingPrompt.current);
      pendingPrompt.current = undefined;
    }
  }, [status, sendUserMessage]);

  const start = useCallback(
    async (prompt?: string) => {
      setError(null);
      setPreparing(true);
      pendingPrompt.current = prompt;
      try {
        const res = await fetch("/api/voice/session", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Couldn't start the voice assistant.");
        await navigator.mediaDevices.getUserMedia({ audio: true });
        startSession({ signedUrl: json.signedUrl, connectionType: "websocket" });
      } catch (e) {
        pendingPrompt.current = undefined;
        setError(e instanceof Error ? e.message : "Couldn't start the voice assistant.");
      } finally {
        setPreparing(false);
      }
    },
    [startSession],
  );

  const toggle = useCallback(
    (prompt?: string) => {
      if (state === "idle") void start(prompt);
      else endSession();
    },
    [state, start, endSession],
  );

  const value = useMemo(
    () => ({ state, toggle, error: error ?? (status === "error" ? "The voice connection failed." : null) }),
    [state, toggle, error, status],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
