/** Reconcile the existing ElevenLabs agent with the read-only run tools. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
process.loadEnvFile(".env");
const id = process.env.ELEVENLABS_AGENT_ID,
  key = process.env.ELEVENLABS_API_KEY;
if (!id || !key) throw Error("Set ELEVENLABS_AGENT_ID and ELEVENLABS_API_KEY.");
const headers = { "xi-api-key": key, "Content-Type": "application/json" };
const url = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(id)}`;
const response = await fetch(url, { headers });
if (!response.ok) throw Error(`Agent read failed: ${response.status}`);
const agent = await response.json();
mkdirSync(".data", { recursive: true });
if (!existsSync(".data/voice-agent-before.json"))
  writeFileSync(
    ".data/voice-agent-before.json",
    JSON.stringify(agent, null, 2),
    { mode: 0o600 },
  );
const definitions = [
  {
    type: "client",
    name: "get_power_plan",
    description:
      "Read the latest recorded optimizer decision, constraints, forecast, selected resources and reasons. Never invent a plan.",
    expects_response: true,
    response_timeout_secs: 10,
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "client",
    name: "analyze_scenario",
    description:
      "Calculate a hypothetical change against a copied snapshot. Does not change the running system or submit transactions.",
    expects_response: true,
    response_timeout_secs: 20,
    parameters: {
      type: "object",
      properties: {
        priceCapPerKwh: {
          type: "number",
          description:
            "Hypothetical maximum procurement price in test USDC/kWh between 0.01 and 1",
        },
        reservePercent: {
          type: "number",
          description: "Hypothetical reserve from 10 to 100 percent",
        },
        demandChangeKw: {
          type: "number",
          description: "Hypothetical load adjustment between -50 and 50 kW",
        },
        offlineResource: {
          type: "string",
          description:
            "Resource ID from get_my_resources to take offline in the hypothetical calculation",
        },
      },
      required: [],
    },
  },
];
const ids = [...(agent.conversation_config.agent.prompt.tool_ids ?? [])];
for (const tool of definitions) {
  const existing = agent.conversation_config.agent.prompt.tools?.find(
    (t) => t.name === tool.name,
  );
  if (existing) {
    for (const toolId of ids) {
      const current = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${encodeURIComponent(toolId)}`,
        { headers },
      );
      if (!current.ok) continue;
      const body = await current.json();
      if (body.tool_config?.name !== tool.name) continue;
      const updatedTool = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${encodeURIComponent(toolId)}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ tool_config: tool }),
        },
      );
      if (!updatedTool.ok)
        throw Error(`Tool update failed: ${updatedTool.status}`);
      break;
    }
    continue;
  }
  const r = await fetch("https://api.elevenlabs.io/v1/convai/tools", {
    method: "POST",
    headers,
    body: JSON.stringify({ tool_config: tool }),
  });
  if (!r.ok) throw Error(`Tool ${tool.name} registration failed: ${r.status}`);
  const d = await r.json();
  ids.push(d.id);
}
const prompt = `You are GridFlex's read-only energy assistant for grid operators and households. Explain the shared energy day clearly and briefly. Always call get_grid_status for current facts, then use the appropriate client tools. Tool responses identify the run, version and virtual timestamp; use those timestamps rather than wall-clock time. Use get_power_plan for decisions and constraints. Use analyze_scenario for what-if calculations; call them hypothetical and never claim they changed the running system. Never invent readings, decisions, prices, amounts, frequency, or renewable percentages that tools do not provide. Neighborhood loads and devices are modeled from historical public inputs, not connected customer meters. Payments are Solana devnet test tokens, not real money; paid means on-chain confirmation. Distinguish forecast, measured/model-derived delivery, and confirmed settlement. No actions or settings can be changed through this assistant. Do not call this product a demo. If a service fails, explain the available decision record and the specific unavailable capability. Do not mention developer setup commands. Respect the current user's role and selected area returned by tools.`;
const patch = {
  conversation_config: {
    agent: {
      first_message: "What would you like to understand about this energy day?",
      prompt: { prompt, tool_ids: ids },
    },
    conversation: {
      client_events: [
        ...new Set([
          ...(agent.conversation_config.conversation?.client_events ?? []),
          "agent_response",
          "user_transcript",
          "client_tool_call",
        ]),
      ],
    },
  },
};
const updated = await fetch(url, {
  method: "PATCH",
  headers,
  body: JSON.stringify(patch),
});
if (!updated.ok) throw Error(`Agent update failed: ${updated.status}`);
console.log(
  "Read-only run agent configured; prior configuration retained in .data/voice-agent-before.json.",
);
