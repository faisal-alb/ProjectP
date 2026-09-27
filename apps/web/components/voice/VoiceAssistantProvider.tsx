"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import { activeFault, type ZoneId } from "@gridflex/shared";
import { useRun } from "../dashboard/RunProvider";
import { FloatingAskButton } from "./AskButton";
import { VoiceContext, type VoiceState } from "./context";
import { RunVoiceTools } from "./RunVoiceTools";
import { RunAssistant } from "./RunAssistant";

/** After GridFlex finishes speaking, how long it waits to hear you before ending the session. */
const IDLE_END_MS = 10_000;
/**
 * The ceiling. However noisy the room, the session ends once this long passes (while listening)
 * with no real turn: nothing you said was transcribed, GridFlex didn't reply, no tool was used.
 */
const NO_TURN_END_MS = 30_000;
/** How long before either limit the floating button says the session is about to end. */
const IDLE_WARN_MS = 3_000;
/** How far the mic level has to rise above the room's noise floor to count as you talking... */
const SPEECH_MARGIN = 0.08;
/** ...and for how many 100 ms ticks in a row, so a cough or a click doesn't. */
const SPEECH_TICKS = 3;
/** After a goodbye, how long GridFlex stays quiet before hanging up. Talking cancels it. */
const FAREWELL_GRACE_MS = 1_500;

/** A real turn: something you said got transcribed, GridFlex replied, or a tool ran. Resets both clocks. */
const TURN_EVENTS = new Set([
  "user_transcript",
  "agent_response",
  "agent_tool_request",
  "agent_tool_response",
  "client_tool_call",
]);
/** Signs you're mid-sentence before a transcript lands. Only reset the short clock. */
const SPEAKING_EVENTS = new Set(["tentative_user_transcript", "interruption"]);
/** You signing off. Checked against what you said, not what GridFlex said. */
const USER_FAREWELL =
  /\b(good ?bye|bye|that'?s all|that'?s it|i'?m done|nothing else|talk (to you )?later|see you)\b/i;
/** GridFlex signing off. Narrower, since it says "that's all" about plans too. */
const AGENT_FAREWELL = /\b(good ?bye|bye)\b/i;

/** What the idle clocks read. Times are performance.now(); written from SDK callbacks and the Controller. */
type Activity = {
  /** Last real turn (see TURN_EVENTS). */
  turn: number;
  /** Last sign of you talking: a turn, a speaking event, VAD, or sustained mic level. */
  speech: number;
  /** "said": you said goodbye and GridFlex hasn't answered yet. "done": the goodbye is over. */
  farewell: "none" | "said" | "done";
  farewellAt: number;
};

/**
 * One voice conversation for the whole dashboard. Inline buttons start it or ask into it;
 * only the floating button shows the live state and ends it. It also ends on its own after a
 * goodbye, once it's gone quiet, or when the agent hangs up with its end_call tool (see Controller).
 */
export function VoiceAssistantProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role: string;
}) {
  const [zone, setZone] = useState<ZoneId>("downtown");
  const [messages, setMessages] = useState<{ source: string; text: string }[]>(
    [],
  );
  const activityRef = useRef<Activity>({
    turn: 0,
    speech: 0,
    farewell: "none",
    farewellAt: 0,
  });
  const mark = (turn: boolean) => {
    const now = performance.now();
    activityRef.current.speech = now;
    if (turn) activityRef.current.turn = now;
  };
  return (
    <ConversationProvider
      onVadScore={({ vadScore }) => {
        if (vadScore > 0.5) mark(false);
      }}
      onIncomingEvent={(event: { type?: string } | undefined) => {
        if (!event?.type) return;
        if (TURN_EVENTS.has(event.type)) mark(true);
        else if (SPEAKING_EVENTS.has(event.type)) mark(false);
      }}
      onMessage={({ message, role }) => {
        setMessages((previous) => [
          ...previous.slice(-29),
          { source: role, text: message },
        ]);
        mark(true);
        const a = activityRef.current;
        if (role === "user") {
          // Anything else you say after a goodbye ("actually, one more thing") calls it off.
          a.farewell = USER_FAREWELL.test(message) ? "said" : "none";
        } else if (a.farewell === "said" || AGENT_FAREWELL.test(message)) {
          a.farewell = "done";
          a.farewellAt = performance.now();
        }
      }}
    >
      <RunVoiceTools role={role} zone={zone} />
      <Controller
        activityRef={activityRef}
        role={role}
        zone={zone}
        setZone={setZone}
        messages={messages}
      >
        {children}
        <RunAssistant />
        <FloatingAskButton />
      </Controller>
    </ConversationProvider>
  );
}

function Controller({
  children,
  activityRef,
  role,
  zone,
  setZone,
  messages,
}: {
  children: React.ReactNode;
  activityRef: React.RefObject<Activity>;
  role: string;
  zone: ZoneId;
  setZone: (zone: ZoneId) => void;
  messages: { source: string; text: string }[];
}) {
  const { run } = useRun();
  const { startSession, endSession, sendUserMessage, getInputVolume } =
    useConversationControls();
  const { status, message: connectionError } = useConversationStatus();
  const { mode } = useConversationMode();
  const [error, setError] = useState<string | null>(null);
  // Covers the signed-URL fetch and the mic permission prompt, before the socket opens.
  const [preparing, setPreparing] = useState(false);
  const [endingSoon, setEndingSoon] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const request = useRef(0);
  const opening = useRef(false);
  const pendingPrompt = useRef<string | undefined>(undefined);

  const state: VoiceState =
    preparing || status === "connecting"
      ? "connecting"
      : status === "connected"
        ? textOnly
          ? "chatting"
          : mode === "speaking"
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

  // End the session on its own while it's listening, the first of:
  //  - a goodbye: once GridFlex has answered it and you've stayed quiet for a moment;
  //  - quiet: IDLE_END_MS with no sign of you talking (a pause to think or a slow lookup is fine);
  //  - the ceiling: NO_TURN_END_MS with no real turn at all, so a noisy mic can't hold it open.
  // Both clocks restart each time GridFlex finishes speaking.
  useEffect(() => {
    if (state !== "listening") return;
    const a = activityRef.current;
    const began = performance.now();
    a.turn = Math.max(a.turn, began);
    a.speech = Math.max(a.speech, began);
    let floor = 1;
    let loudTicks = 0;
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      endSession();
    };
    const tick = setInterval(() => {
      let level = 0;
      try {
        level = getInputVolume();
      } catch {
        // Not connected yet; treat as quiet.
      }
      // The floor drops straight to quiet moments and creeps up slowly, so it follows the room, not your voice.
      floor = level < floor ? level : floor + (level - floor) * 0.02;
      loudTicks = level > floor + SPEECH_MARGIN ? loudTicks + 1 : 0;
      const now = performance.now();
      if (loudTicks >= SPEECH_TICKS) a.speech = now;

      if (
        a.farewell === "done" &&
        now - Math.max(a.speech, a.farewellAt) > FAREWELL_GRACE_MS
      )
        return end();
      const left = Math.min(
        IDLE_END_MS - (now - a.speech),
        NO_TURN_END_MS - (now - a.turn),
      );
      setEndingSoon(left < IDLE_WARN_MS);
      if (left <= 0) end();
    }, 100);
    return () => clearInterval(tick);
  }, [state, getInputVolume, endSession, activityRef]);

  const start = useCallback(
    async (prompt?: string, text = false) => {
      if (opening.current) return;
      if (run && activeFault(run, "assistant-offline")) {
        setError(
          "Assistant unavailable. The decision record remains available.",
        );
        return;
      }
      const attempt = ++request.current;
      opening.current = true;
      setError(null);
      setPreparing(true);
      setTextOnly(text);
      pendingPrompt.current = prompt;
      activityRef.current.farewell = "none";
      try {
        const res = await fetch("/api/voice/session", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(json.error ?? "Couldn't start the voice assistant.");
        if (attempt !== request.current) return;
        if (!text) {
          const permission = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          permission.getTracks().forEach((track) => track.stop());
        }
        if (attempt !== request.current) return;
        // The React SDK returns immediately; tools/context/pending prompts wait
        // for status === "connected", rather than treating this as a promise.
        startSession({
          signedUrl: json.signedUrl,
          connectionType: "websocket",
          textOnly: text,
          overrides: { conversation: { textOnly: text } },
          dynamicVariables: { role, zone },
        });
      } catch (e) {
        if (attempt !== request.current) return;
        pendingPrompt.current = undefined;
        setError(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Microphone access was denied. Allow it in your browser or type a question."
            : e instanceof Error
              ? e.message
              : "Couldn't start the voice assistant.",
        );
      } finally {
        opening.current = false;
        if (attempt === request.current) {
          setPreparing(false);
        }
      }
    },
    [startSession, activityRef, run, role, zone],
  );

  const toggle = useCallback(
    (prompt?: string) => {
      if (state === "idle") void start(prompt);
      else {
        request.current++;
        pendingPrompt.current = undefined;
        setPreparing(false);
        void endSession();
      }
    },
    [state, start, endSession],
  );

  const askText = useCallback(
    (prompt: string) => {
      if (state === "idle") void start(prompt, true);
      else if (status === "connected") sendUserMessage(prompt);
      else pendingPrompt.current = prompt;
    },
    [state, status, start, sendUserMessage],
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
      error:
        error ??
        (status === "error"
          ? (connectionError ?? "The voice connection failed. Try again.")
          : null),
      zone,
      setZone,
      textOpen,
      setTextOpen,
      askText,
      messages,
    }),
    [
      state,
      toggle,
      ask,
      endingSoon,
      error,
      status,
      connectionError,
      zone,
      setZone,
      textOpen,
      askText,
      messages,
    ],
  );

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}
