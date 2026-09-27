import { getRole } from "@/lib/session";

/**
 * Issues a short-lived signed URL for the GridFlex voice agent, so the
 * ElevenLabs API key never reaches the browser. Available to both roles.
 */
export async function GET() {
  if (!(await getRole())) {
    return Response.json({ error: "Sign in to use the voice assistant." }, { status: 401 });
  }
  try {
    const health = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"}/runs/assistant`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    if (!health.ok) return Response.json({ error: "Assistant unavailable. The decision record remains available." }, { status: 503 });
  } catch {
    return Response.json({ error: "The energy service is unavailable. Reconnect before starting the assistant." }, { status: 503 });
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId) {
    return Response.json({ error: "Voice assistant is not configured." }, { status: 503 });
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": apiKey }, cache: "no-store" },
  );
  if (!res.ok) {
    console.error("ElevenLabs signed URL failed", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Couldn't start the voice assistant." }, { status: 502 });
  }
  const { signed_url } = (await res.json()) as { signed_url: string };
  return Response.json({ signedUrl: signed_url }, { headers: { "cache-control": "no-store" } });
}
