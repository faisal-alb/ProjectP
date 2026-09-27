"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export interface Money {
  base: string;
  formatted: string;
}

export type MarketPhase = "awaiting-signature" | "open" | "committed" | "verified" | "settled";

export interface MarketDto {
  id: string;
  address: string;
  addressUrl: string;
  phase: MarketPhase;
  maxPricePerKwh: number;
  requiredKw: number;
  escrow: Money;
  paid?: Money;
  refund?: Money;
  committedKw: number;
  transactions: Partial<Record<"create" | "accept" | "verify" | "settle" | "close", string>>;
  commitments: {
    resourceId: string;
    label: string;
    type: string;
    kw: number;
    pricePerKwh: number;
    participant: string;
    deliveredKw?: number;
    /** Model baseline for the window, for model-sized households. */
    baselineKw?: number;
    meter?: { baselineKw: number; actualKw: number };
    payout?: Money;
    settleUrl?: string;
  }[];
  /** How commitments were sized; the hashes commit to the model's baselines. */
  plan?: {
    source: "model" | "placeholder" | "demo";
    window?: { start: string; end: string };
    baselineHash?: string;
    modelHash?: string | null;
    featuresHash?: string | null;
  };
  settledAt?: string;
}

export interface HealthDto {
  cluster: "localnet" | "devnet" | "mainnet-beta";
  /** Only sent on localnet. */
  rpcUrl?: string;
  programId: string;
  usdcMint: string;
  intelligence?: "online" | "offline";
}

/** The model forecast for a zone (services/intelligence, via the API). */
export interface ForecastDto {
  zone: string;
  zoneName: string;
  settlementPoint: string;
  /** Replay time, Austin wall clock without an offset. */
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
    stratum: string;
  };
  recommendation: { openEvent: boolean; threshold: number; reason: string };
  reasons: string[];
  signals: Partial<Record<"tempF" | "forecastTempF" | "lastPriceMwh" | "recentMaxPriceMwh", number | null>>;
}

export interface HouseholdDto {
  resourceId: string;
  wallet: string;
  walletUrl: string;
  balance: Money;
  payouts: {
    marketId: string;
    window: string;
    deliveredKw?: number;
    amount: Money;
    url?: string;
    settledAt?: string;
  }[];
  tonight: { marketId: string; phase: MarketPhase; payout?: Money; url?: string } | null;
}

export class ApiError extends Error {}

export async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "content-type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("gridflex-presenter") ?? ""}` } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

/** The wallet-standard chain id for the API's cluster. */
export function chainFor(cluster: HealthDto["cluster"]): `solana:${string}` {
  return cluster === "mainnet-beta" ? "solana:mainnet" : `solana:${cluster}`;
}

const MARKET_EVENTS = [
  "market.created",
  "commitment.accepted",
  "verification.completed",
  "settlement.completed",
  "market.closed",
  "market.failed",
];

/** Call `onEvent` whenever the API reports a market change. */
export function useMarketEvents(onEvent: () => void, enabled: boolean) {
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  });
  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`${API_URL}/stream`);
    const handler = () => latest.current();
    MARKET_EVENTS.forEach((type) => source.addEventListener(type, handler));
    return () => source.close();
  }, [enabled]);
}

/** Like `useMarketEvents`, but hands over each event's type, market id and data. */
export function useMarketStream(
  onEvent: (event: { type: string; marketId: string; data?: unknown }) => void,
  enabled: boolean,
) {
  const latest = useRef(onEvent);
  useEffect(() => {
    latest.current = onEvent;
  });
  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`${API_URL}/stream`);
    const handler = (e: MessageEvent<string>) => {
      try {
        latest.current(JSON.parse(e.data));
      } catch {}
    };
    MARKET_EVENTS.forEach((type) => source.addEventListener(type, handler as EventListener));
    return () => source.close();
  }, [enabled]);
}

export type ApiStatus = "loading" | "online" | "offline";

/** Whether the settlement API is reachable, and which cluster it's on. */
export function useApiHealth() {
  const [state, setState] = useState<{ status: ApiStatus; health: HealthDto | null }>({
    status: "loading",
    health: null,
  });
  useEffect(() => {
    let cancelled = false;
    api<HealthDto>("/health")
      .then((health) => !cancelled && setState({ status: "online", health }))
      .catch(() => !cancelled && setState({ status: "offline", health: null }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export type ForecastState =
  | { status: "loading" }
  | { status: "ready"; forecast: ForecastDto }
  /** The API or the model service is down; the page stays on demo data. */
  | { status: "unavailable" };

/** The model forecast for a zone, fetched once when the API is online. */
export function useForecast(zone: string, enabled: boolean): ForecastState {
  const [state, setState] = useState<ForecastState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api<{ forecast: ForecastDto | null }>(`/forecast/${zone}`)
      .then(({ forecast }) => !cancelled && setState(forecast ? { status: "ready", forecast } : { status: "unavailable" }))
      .catch(() => !cancelled && setState({ status: "unavailable" }));
    return () => {
      cancelled = true;
    };
  }, [zone, enabled]);
  return enabled ? state : { status: "unavailable" };
}

/** The current market from the API, kept fresh from the event stream. */
export function useCurrentMarket(enabled: boolean) {
  const [market, setMarket] = useState<MarketDto | null>(null);
  const refresh = useCallback(
    () =>
      api<{ market: MarketDto | null }>("/markets/current")
        .then(({ market }) => setMarket(market))
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api<{ market: MarketDto | null }>("/markets/current")
      .then(({ market }) => !cancelled && setMarket(market))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  useMarketEvents(() => void refresh(), enabled);
  return { market, setMarket, refresh };
}

export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

export const shortAddress = (value: string) => `${value.slice(0, 4)}…${value.slice(-4)}`;

/** Solana Explorer link for an address on the API's cluster. */
export function explorerAddressUrl(health: HealthDto, address: string) {
  const base = `https://explorer.solana.com/address/${address}`;
  if (health.cluster === "mainnet-beta") return base;
  if (health.cluster === "devnet") return `${base}?cluster=devnet`;
  return `${base}?cluster=custom&customUrl=${encodeURIComponent(health.rpcUrl ?? "http://localhost:8899")}`;
}

export const clusterLabel = (cluster: HealthDto["cluster"]) =>
  cluster === "mainnet-beta" ? "Mainnet" : cluster === "devnet" ? "Devnet" : "Localnet";
