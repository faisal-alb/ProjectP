"use client";

import { useConversationClientTool } from "@elevenlabs/react";
import { useVoiceSnapshotRef } from "@/lib/voice-snapshot";

const money = (n: number) => `$${n.toFixed(2)}`;

/** Sections the agent may point at. Ids live on the dashboard sections. */
const HIGHLIGHTABLE = { tonight: "voice-tonight", earnings: "voice-earnings", autoflex: "voice-autoflex", plan: "voice-plan" } as const;

/**
 * Read-only tools. Names must match the client tools configured on the ElevenLabs
 * agent (see docs/voice-agent.md). Each returns a small JSON string, not the whole dashboard.
 */
export function VoiceTools() {
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

  useConversationClientTool("get_power_plan", () => {
    const { plan } = read();
    return JSON.stringify({
      optimizingFor: plan.preference,
      stormExpected: plan.stormExpected,
      protectedReservePercent: plan.reservePercent,
      expectedEarnings: money(plan.expectedEarnings),
      why: plan.why,
      actions: plan.actions.map((a) => ({
        rank: a.rank,
        action: a.title,
        recommended: a.recommended,
        onlyIfMoreIsRequested: a.conditional,
        kwh: a.kwh,
        estimatedEarnings: money(a.earnings),
        batteryAfterPercent: a.batteryAfterPercent ?? null,
        detail: a.detail,
        reasons: a.reasons,
        caveat: a.caveat ?? null,
      })),
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
