"use client";

import { useConversationClientTool } from "@elevenlabs/react";
import { useRouter } from "next/navigation";
import { useVoiceSnapshotRef } from "@/lib/voice-snapshot";

const money = (n: number) => `$${n.toFixed(2)}`;

/** Sections the agent may point at, and the dashboard page each lives on. Ids live on the sections. */
const HIGHLIGHTABLE = {
  tonight: { id: "voice-tonight", path: "/dashboard" },
  plan: { id: "voice-plan", path: "/dashboard" },
  earnings: { id: "voice-earnings", path: "/dashboard/earnings" },
  autoflex: { id: "voice-autoflex", path: "/dashboard/settings" },
} as const;

function ring(node: HTMLElement) {
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  node.classList.add("voice-highlight");
  setTimeout(() => node.classList.remove("voice-highlight"), 2500);
}

/**
 * Read-only tools. Names must match the client tools configured on the ElevenLabs
 * agent (see docs/voice-agent.md). Each returns a small JSON string, not the whole dashboard.
 */
export function VoiceTools() {
  const ref = useVoiceSnapshotRef();
  const router = useRouter();
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

  // UI control: open the section's page if needed, then scroll to and briefly ring it.
  useConversationClientTool("highlight_element", ({ element }: { element?: unknown }) => {
    const target = HIGHLIGHTABLE[element as keyof typeof HIGHLIGHTABLE];
    if (!target) return `Unknown element. Use one of: ${Object.keys(HIGHLIGHTABLE).join(", ")}.`;
    const here = window.location.pathname === target.path ? document.getElementById(target.id) : null;
    if (here) {
      ring(here);
      return "Highlighted.";
    }
    router.push(target.path);
    // Wait for the new page to render the section, for up to about three seconds.
    let tries = 0;
    const poll = setInterval(() => {
      const node = document.getElementById(target.id);
      if (node || ++tries > 30) clearInterval(poll);
      if (node) ring(node);
    }, 100);
    return "Opened that page and highlighted it.";
  });

  return null;
}
