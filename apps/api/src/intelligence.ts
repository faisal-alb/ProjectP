// Client for the intelligence service (services/intelligence): the forecast and
// the per-home baselines. Every call has a short timeout and returns null when
// the service is down, so the market lifecycle never waits on it and falls back
// to the demo values.
import { config } from "./env";

export interface Forecast {
  zone: string;
  zoneName: string;
  settlementPoint: string;
  /** Replay time the forecast was made at (local Austin time, no offset). */
  at: string;
  window: { start: string; end: string };
  source: "model" | "placeholder" | "mixed";
  spike: { horizonH: number; probability: number | null }[];
  pSpike: number | null;
  valuation: {
    fairValuePerKwh: number | null;
    riskBufferPerKwh: number | null;
    aggregatorFeePerKwh: number | null;
    lockedPricePerKwh: number | null;
    expectedSpikePricePerKwh: number | null;
    expectedCalmPricePerKwh: number | null;
    stratum: string;
  };
  recommendation: { openEvent: boolean; threshold: number; reason: string };
  reasons: string[];
  signals: Partial<Record<"tempF" | "forecastTempF" | "lastPriceMwh" | "recentMaxPriceMwh", number | null>>;
}

export interface HomeSizing {
  resourceId: string;
  /** The ResStock building standing in for this household, or null for placeholders. */
  modelHome: string | null;
  /** p50 baseline per 15-minute interval of the window. */
  intervalsKwh: number[];
  /** p50 baseline averaged over the window: what settlement measures against. */
  baselineKw: number;
  /** What the home can credibly commit: p10 draw plus its battery. */
  offerableKw: number;
}

export interface Sizing {
  zone: string;
  at: string;
  window: { start: string; end: string };
  source: "model" | "placeholder";
  homes: HomeSizing[];
  baselineHash: string;
  modelHash: string | null;
  featuresHash: string | null;
}

async function call<T>(path: string, timeoutMs: number, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${config.intelligenceUrl}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`intelligence ${path} → ${res.status} ${await res.text().catch(() => "")}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`intelligence ${path} unavailable: ${(error as Error).message}`);
    return null;
  }
}

export const getForecast = (zone: string) => call<Forecast>(`/forecast/${encodeURIComponent(zone)}`, 2000);

export const sizeHomes = (input: { zone: string; homes: string[]; generationKw: number }) =>
  call<Sizing>("/events/size", 5000, input);

export async function intelligenceStatus(): Promise<"online" | "offline"> {
  return (await call<{ ok: boolean }>("/health", 1000))?.ok ? "online" : "offline";
}
