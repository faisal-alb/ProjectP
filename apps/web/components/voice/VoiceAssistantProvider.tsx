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

/** After GridFlex finishes speaking, how long it waits to hear from you before ending the session. */
const IDLE_END_MS = 10_000;
/** How long before that the floating button says the session is about to end. */
const IDLE_WARN_MS = 3_000;
/** How far the mic level has to rise above the room's noise floor to count as you talking. */
const SPEECH_MARGIN = 0.06;
/** Server events that mean the conversation is still moving: you talking, or the agent working on a reply. */
const ACTIVITY_EVENTS = new Set([
  "tentative_user_transcript",
  "user_transcript",
  "agent_response",
  "agent_chat_response_part",
  "agent_tool_request",
  "agent_tool_response",
  "client_tool_call",
  "interruption",
]);

/**
 * One voice conversation for the whole dashboard. Inline buttons start it or ask into it;
 * only the floating button shows the live state and ends it. It also ends on its own once
 * it's gone quiet (see Controller), or when the agent hangs up with its end_call tool.
 */
export function VoiceAssistantProvider({ children }: { children: React.ReactNode }) {
  // When the conversation last showed signs of life. Written from SDK events, read by the idle timer.
  const lastActivityRef = useRef(0);
  const markActivity = () => {
    lastActivityRef.current = performance.now();
  };
  return (
    <VoiceSnapshotProvider>
      <ConversationProvider
        onVadScore={({ vadScore }) => {
          if (vadScore > 0.5) markActivity();
        }}
        onIncomingEvent={(event: { type?: string } | undefined) => {
          if (event?.type && ACTIVITY_EVENTS.has(event.type)) markActivity();
        }}
      >
        <VoiceTools />
        <Controller lastActivityRef={lastActivityRef}>
          {children}
          <FloatingAskButton />
        </Controller>
      </ConversationProvider>
    </VoiceSnapshotProvider>
  );
}

function Controller({
  children,
  lastActivityRef,
}: {
  children: React.ReactNode;
  lastActivityRef: React.RefObject<number>;
}) {
  const { startSession, endSession, sendUserMessage, getInputVolume } = useConversationControls();
  const { status } = useConversationStatus();
  const { mode } = useConversationMode();
  const [error, setError] = useState<string | null>(null);
  // Covers the signed-URL fetch and the mic permission prompt, before the socket opens.
  const [preparing, setPreparing] = useState(false);
  const [endingSoon, setEndingSoon] = useState(false);
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

  // End the session once it's gone quiet. The clock starts each time GridFlex finishes speaking
  // and resets whenever you talk (your mic rising above the room's noise floor, or the server
  // hearing you) or the agent is working on a reply, so a pause to think or a slow lookup
  // doesn't cut you off.
  useEffect(() => {
    if (state !== "listening") return;
    lastActivityRef.current = performance.now();
    let floor = 1;
    let ended = false;
    const tick = setInterval(() => {
      let level = 0;
      try {
        level = getInputVolume();
      } catch {
        // Not connected yet; treat as quiet.
      }
      // The floor drops straight to quiet moments and creeps up slowly, so it follows the room, not your voice.
      floor = level < floor ? level : floor + (level - floor) * 0.02;
      if (level > floor + SPEECH_MARGIN) lastActivityRef.current = performance.now();

      const quietFor = performance.now() - lastActivityRef.current;
      setEndingSoon(quietFor > IDLE_END_MS - IDLE_WARN_MS);
      if (quietFor > IDLE_END_MS && !ended) {
        ended = true;
        endSession();
      }
    }, 100);
    return () => clearInterval(tick);
  }, [state, getInputVolume, endSession, lastActivityRef]);

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

  const ask = useCallback(
    (prompt?: string) => {
      if (state === "idle") void start(prompt);
      else if (!prompt) return;
      else if (status === "connected") sendUserMessage(prompt);
      else pendingPrompt.current = prompt;
    },
    [state, status, start, sendUserMessage],
  );

  const value = useMemo(
    () => ({
      state,
      toggle,
      ask,
      endingSoon: endingSoon && state === "listening",
      error: error ?? (status === "error" ? "The voice connection failed." : null),
    }),
    [state, toggle, ask, endingSoon, error, status],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
