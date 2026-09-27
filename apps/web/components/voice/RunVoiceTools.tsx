"use client";
import { useEffect, useRef } from "react";
import {
  useConversationClientTool,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react";
import { virtualAt, type ZoneId } from "@gridflex/shared";
import { useRun } from "../dashboard/RunProvider";
import { API_URL } from "@/lib/api";

/** Read-only tools shared by the floating voice launcher and text conversation. */
export function RunVoiceTools({ role, zone }: { role: string; zone: ZoneId }) {
  const { run } = useRun();
  const ref = useRef(run);
  useEffect(() => {
    ref.current = run;
  }, [run]);
  const { sendContextualUpdate } = useConversationControls();
  const { status } = useConversationStatus();
  const snapshot = () => {
    const s = ref.current;
    if (!s) throw new Error("No active energy day.");
    return {
      runId: s.id,
      version: s.version,
      at: virtualAt(s),
      role,
      zone,
      conditions: s.zones.find((z) => z.id === zone),
      environment: s.environment,
      devices: s.devices.filter((d) => d.zone === zone),
      decisions: s.decisions.filter((d) => d.zone === zone).slice(-4),
      events: s.events
        .filter((e) => e.zone === zone)
        .map((e) =>
          role === "participant"
            ? {
                ...e,
                commitments: e.commitments.filter(
                  (c) =>
                    !c.resourceId.includes("-battery-") ||
                    c.resourceId.endsWith("-0"),
                ),
              }
            : e,
        ),
      sources: s.sources,
      readOnly: true,
    };
  };
  useConversationClientTool("get_grid_status", () =>
    JSON.stringify(snapshot()),
  );
  useConversationClientTool("get_my_resources", () =>
    JSON.stringify(snapshot().devices),
  );
  useConversationClientTool("get_available_flex", () =>
    JSON.stringify(snapshot().decisions.at(-1)),
  );
  useConversationClientTool("get_active_event", () =>
    JSON.stringify(
      snapshot().events.filter(
        (e) => !["completed", "canceled"].includes(e.phase),
      ),
    ),
  );
  useConversationClientTool("get_upcoming_events", () =>
    JSON.stringify(
      snapshot().events.filter((e) =>
        ["scheduled", "committing"].includes(e.phase),
      ),
    ),
  );
  useConversationClientTool("get_earnings", () =>
    JSON.stringify({
      runId: ref.current?.id,
      testTokens: true,
      paidBase: snapshot()
        .events.flatMap((e) => e.commitments)
        .reduce((n, c) => n + BigInt(c.paidBase ?? 0), 0n)
        .toString(),
    }),
  );
  useConversationClientTool("get_autoflex_settings", () =>
    JSON.stringify(
      snapshot().devices.map((d) => ({
        id: d.id,
        reserve: d.reserve,
        minPrice: d.minPrice,
      })),
    ),
  );
  useConversationClientTool("get_power_plan", () =>
    JSON.stringify(
      snapshot().decisions.at(-1) ?? { status: "Awaiting forecast" },
    ),
  );
  useConversationClientTool(
    "analyze_scenario",
    async (parameters: {
      reservePercent?: number;
      priceCapPerKwh?: number;
      demandChangeKw?: number;
      offlineResource?: string;
    }) => {
      const r = await fetch(`${API_URL}/runs/what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parameters, zone }),
      });
      if (!r.ok) throw new Error("Scenario analysis unavailable.");
      return JSON.stringify(await r.json());
    },
  );
  useConversationClientTool("highlight_element", () => {
    document
      .getElementById("run-decision")
      ?.scrollIntoView({ block: "nearest" });
    return "The current decision and events are on this page.";
  });
  useEffect(() => {
    if (status === "connected" && run)
      sendContextualUpdate(
        JSON.stringify({
          runId: run.id,
          version: run.version,
          role,
          zone,
          at: virtualAt(run),
          instruction:
            "State changed. Use tools for current facts. Never claim test tokens are real money or modeled readings are physical telemetry.",
        }),
      );
  }, [run?.id, run?.minute, role, zone, status, sendContextualUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
