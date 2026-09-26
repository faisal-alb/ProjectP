"use client";

import { useCallback, useState } from "react";
import {
  ConversationProvider,
  useConversationClientTool,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
} from "@elevenlabs/react";
import { Mic, X } from "lucide-react";
import { useVoiceSnapshotRef } from "@/lib/voice-snapshot";

const money = (n: number) => `$${n.toFixed(2)}`;

/** Sections the agent may point at. Ids live on the dashboard sections. */
const HIGHLIGHTABLE = { tonight: "voice-tonight", earnings: "voice-earnings", autoflex: "voice-autoflex" } as const;

/** A voice agent for households: talk to it, and it reads (never changes) GridFlex data. */
export function GridAssistant() {
  return (
    <ConversationProvider>
      <AssistantTools />
      <AssistantButton />
    </ConversationProvider>
  );
}

/**
 * Read-only tools. Names must match the client tools configured on the ElevenLabs
 * agent (see docs/voice-agent.md). Each returns a small JSON string, not the whole dashboard.
 */
function AssistantTools() {
  const ref = useVoiceSnapshotRef();
  const read = () => {
    const s = ref.current;
    if (!s) throw new Error("The dashboard hasn't loaded yet.");
    return s;
  };

  useConversationClientTool("get_grid_status", () => {
    const s = read();
    return JSON.stringify({
      zone: s.zone,
      eventTonight: true,
      window: s.event.window,
      reason: "Power lines in the zone are expected to be overloaded, and nearby home batteries help avoid an outage.",
    });
  });

  useConversationClientTool("get_my_resources", () => {
    const s = read();
    return JSON.stringify(
      s.hasBattery
        ? {
            battery: {
              capacityKwh: s.batteryKwh,
              chargePercent: s.chargePercent,
              maxDischargeKwPerHour: s.maxDischargeKw,
              reservePercent: s.reservePercent,
            },
          }
        : { battery: null },
    );
  });

  useConversationClientTool("get_available_flex", () => {
    const s = read();
    return JSON.stringify({
      availableKwhAboveReserve: Number(s.availableKwh.toFixed(1)),
      reservePercent: s.reservePercent,
      wouldShareKwh: s.event.plannedKwh,
    });
  });

  const activeEvent = () => {
    const s = read();
    return JSON.stringify({
      window: s.event.window,
      pricePerKwh: s.event.pricePerKwh,
      plannedKwh: s.event.plannedKwh,
      estimatedEarnings: money(s.event.estimatedEarnings),
      yourStatus: s.event.status,
      paid: s.event.paid ?? null,
    });
  };
  useConversationClientTool("get_active_event", activeEvent);
  useConversationClientTool("get_upcoming_events", activeEvent);

  useConversationClientTool("get_earnings", () => {
    const s = read();
    return JSON.stringify({ thisMonth: money(s.earnings.monthTotal), events: s.earnings.eventCount });
  });

  useConversationClientTool("get_autoflex_settings", () => {
    const s = read();
    return JSON.stringify({
      autoFlex: s.autoFlex,
      keepAtLeastPercent: s.reservePercent,
      minPricePerKwh: s.minPricePerKwh,
      maxKwhPerEvent: s.maxKwhPerEvent,
    });
  });

  // UI control: scroll to and briefly ring a dashboard section.
  useConversationClientTool("highlight_element", ({ element }: { element?: unknown }) => {
    const id = HIGHLIGHTABLE[element as keyof typeof HIGHLIGHTABLE];
    const node = id ? document.getElementById(id) : null;
    if (!node) return `Unknown element. Use one of: ${Object.keys(HIGHLIGHTABLE).join(", ")}.`;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("voice-highlight");
    setTimeout(() => node.classList.remove("voice-highlight"), 2500);
    return "Highlighted.";
  });

  return null;
}

function AssistantButton() {
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [error, setError] = useState<string | null>(null);
  const active = status === "connected" || status === "connecting";

  const start = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/voice/session", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't start the voice assistant.");
      await navigator.mediaDevices.getUserMedia({ audio: true });
      startSession({ signedUrl: json.signedUrl, connectionType: "websocket" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the voice assistant.");
    }
  }, [startSession]);

  const label =
    status === "connecting" ? "Connecting…" : active ? (isSpeaking ? "Speaking…" : "Listening…") : "Ask GridFlex";

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-2 sm:right-8 sm:bottom-8">
      {error && (
        <p role="alert" className="panel max-w-64 rounded-md px-3 py-2 text-xs text-muted">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={active ? endSession : start}
        aria-pressed={active}
        className="flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition-colors hover:bg-white"
      >
        {active ? <X className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        <span aria-live="polite">{label}</span>
      </button>
    </div>
  );
}
