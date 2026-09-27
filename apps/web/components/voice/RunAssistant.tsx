"use client";
import { useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationClientTool,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react";
import { activeFault, virtualAt, type ZoneId } from "@gridflex/shared";
import { useRun } from "../dashboard/RunProvider";
import { API_URL } from "@/lib/api";

export function RunAssistant({ role, zone }: { role: string; zone: ZoneId }) {
  const [messages, setMessages] = useState<{ source: string; text: string }[]>(
    [],
  );
  return (
    <ConversationProvider
      onMessage={({ source, message }) =>
        setMessages((m) => [...m.slice(-29), { source, text: message }])
      }
    >
      <AssistantBody role={role} zone={zone} messages={messages} />
    </ConversationProvider>
  );
}
function AssistantBody({
  role,
  zone,
  messages,
}: {
  role: string;
  zone: ZoneId;
  messages: { source: string; text: string }[];
}) {
  const { run } = useRun();
  const ref = useRef(run);
  useEffect(() => {
    ref.current = run;
  }, [run]);
  const { startSession, endSession, sendUserMessage, sendContextualUpdate } =
    useConversationControls();
  const { status } = useConversationStatus();
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const pending = useRef("");
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
      .getElementById("grid-assistant")
      ?.scrollIntoView({ block: "nearest" });
    return "The current decision and events are on this page.";
  });
  useEffect(() => {
    if (status === "connected" && pending.current) {
      sendUserMessage(pending.current);
      pending.current = "";
    }
  }, [status, sendUserMessage]);
  useEffect(() => {
    if (status === "connected" && run)
      sendContextualUpdate(
        JSON.stringify({
          runId: run.id,
          version: run.version,
          at: virtualAt(run),
          instruction:
            "State changed. Use tools for current facts. Never claim test tokens are real money or modeled readings are physical telemetry.",
        }),
      );
  }, [run?.id, run?.minute, status, sendContextualUpdate]); // eslint-disable-line react-hooks/exhaustive-deps
  async function begin(textOnly: boolean, prompt = "") {
    if (run && activeFault(run, "assistant-offline")) {
      setError("Assistant unavailable. The decision record remains available.");
      return;
    }
    setError("");
    setOpening(true);
    pending.current = prompt;
    try {
      const res = await fetch("/api/voice/session");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await startSession({
        signedUrl: data.signedUrl,
        connectionType: "websocket",
        textOnly,
        overrides: { conversation: { textOnly } },
        dynamicVariables: { role, zone },
      });
      sendContextualUpdate(
        "You are a read-only GridFlex assistant. Call tools for all facts and calculations. Explain recorded decisions and constrained what-if results. Never change settings, execute actions, invent amounts, or describe test-token payouts as real money.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }
  const decision = run?.decisions.filter((d) => d.zone === zone).at(-1);
  return (
    <section id="grid-assistant" className="border-t border-border pt-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Ask GridFlex</h2>
        <button
          className="rounded-md border border-border-strong px-3 py-2 text-sm disabled:opacity-50"
          disabled={opening}
          onClick={() =>
            status === "connected" ? void endSession() : void begin(false)
          }
        >
          {status === "connected" ? "End conversation" : "Use voice"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Understand a decision or explore a what-if. The assistant can read and
        analyze this system; it cannot change it.
      </p>
      {messages.length > 0 && (
        <ol
          aria-live="polite"
          className="mt-4 max-h-72 space-y-3 overflow-y-auto text-sm"
        >
          {messages.map((m, i) => (
            <li key={i}>
              <span className="font-medium">
                {m.source === "user" ? "You" : "GridFlex"}:{" "}
              </span>
              {m.text}
            </li>
          ))}
        </ol>
      )}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          if (status === "connected") sendUserMessage(question);
          else void begin(true, question);
          setQuestion("");
        }}
      >
        <label className="sr-only" htmlFor="assistant-question">
          Question for GridFlex
        </label>
        <input
          id="assistant-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why did you choose these resources?"
          className="min-w-0 flex-1 rounded-md border border-border bg-background-raised px-3 py-2 text-base"
        />
        <button
          disabled={opening || !question.trim()}
          className="rounded-md border border-border-strong px-4 py-2 text-sm disabled:opacity-50"
        >
          Ask
        </button>
      </form>
      {error && (
        <p role="status" className="mt-3 text-sm text-watch">
          {error}
        </p>
      )}
      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer">Latest explanation</summary>
        <p className="mt-2">
          {decision?.reasons.join(". ") ?? "No decision has been recorded yet."}
        </p>
      </details>
    </section>
  );
}
