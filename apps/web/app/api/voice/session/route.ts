import { getRole } from "@/lib/session";

/**
 * Issues a short-lived signed URL for the GridFlex voice agent, so the
 * ElevenLabs API key never reaches the browser. Households only.
 */
export async function GET() {
  if ((await getRole()) !== "participant") {
    return Response.json({ error: "Sign in as a household to use the voice assistant." }, { status: 401 });
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
