// Market lifecycle orchestration: the off-chain half of each step (matching,
// meter simulation) plus the on-chain calls, with state kept per market.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "./files";
import type { Address, Signature } from "@solana/kit";
import {
  clearMarket,
  downtown,
  flexOffers,
  homeLabel,
  homeResourceId,
  household,
  kwToWh,
  minEscrowBase,
  participantCommitments,
  payoutBase,
  priceToBasePerKwh,
  simulatedDeliveredKw,
  type ParticipantCommitment,
} from "@gridflex/shared";
import {
  acceptCommitments,
  buildCreateMarketTransaction,
  closeMarket,
  commitmentAddress,
  CommitmentStatus,
  fetchAllMaybeCommitment,
  fetchMaybeMarket,
  MarketStatus,
  settleCommitments,
  verifyDeliveries,
} from "@gridflex/solana";

import { client, cluster, config, keys } from "./env";
import { publish } from "./events";
import { getForecast, sizeHomes } from "./intelligence";
import { managedWallet } from "./wallets";

export type MarketPhase = "awaiting-signature" | "open" | "committed" | "verified" | "settled";

export interface PlannedCommitment extends ParticipantCommitment {
  /** Model baseline for the window (p50, kW). Only for model-sized households. */
  baselineKw?: number;
  /** The ResStock home standing in for this household. */
  modelHome?: string | null;
}

/**
 * Who commits how much, decided once and saved before anything goes on-chain,
 * so a retried confirm always records the same commitments. When the model
 * service sized the households, the hashes commit to its baselines.
 */
export interface CommitmentPlan {
  source: "model" | "placeholder" | "demo";
  commitments: PlannedCommitment[];
  window?: { start: string; end: string };
  baselineHash?: string;
  modelHash?: string | null;
  featuresHash?: string | null;
}

export interface CommitmentRecord extends PlannedCommitment {
  participant: Address;
  commitment?: Address;
  deliveredKw?: number;
  /** Meter reading against the committed baseline: delivered = baseline - actual. */
  meter?: { baselineKw: number; actualKw: number };
  /** The verify_delivery proof, exactly as hashed on-chain. */
  proof?: string;
  payoutBase?: bigint;
  signatures: { accept?: Signature; verify?: Signature; settle?: Signature };
}

export interface MarketRecord {
  id: string;
  marketId: bigint;
  address: Address;
  authority: Address;
  zone: string;
  window: string;
  requiredKw: number;
  maxPricePerKwh: number;
  escrowBase: bigint;
  phase: MarketPhase;
  commitments: CommitmentRecord[];
  plan?: CommitmentPlan;
  /** The model's view when the market was opened, for the record. */
  forecast?: { at: string; pSpike: number | null; lockedPricePerKwh: number | null; source: string };
  signatures: { create?: Signature; close?: Signature };
  paidBase?: bigint;
  refundBase?: bigint;
  createdAt: string;
  settledAt?: string;
}

export class HttpError extends Error {
  constructor(
    public status: 400 | 404 | 409 | 502,
    message: string,
  ) {
    super(message);
  }
}

// --- persistence ------------------------------------------------------------

const file = path.join(config.dataDir, `markets.${cluster}.json`);
const bigintKeys = new Set(["marketId", "escrowBase", "paidBase", "refundBase", "payoutBase"]);
const markets = new Map<string, MarketRecord>(
  existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8"), (k, v) =>
        bigintKeys.has(k) && typeof v === "string" ? BigInt(v) : v,
      ) as MarketRecord[]).map((m) => [m.id, m])
    : [],
);

function persist() {
  writeFileAtomic(
    file,
    JSON.stringify([...markets.values()], (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  );
}

// --- queries ----------------------------------------------------------------

export function getMarket(id: string): MarketRecord {
  const market = markets.get(id);
  if (!market) throw new HttpError(404, "Market not found");
  return market;
}

/** The most recent market that got past signing, if any. */
export function currentMarket(): MarketRecord | null {
  const live = [...markets.values()].filter((m) => m.phase !== "awaiting-signature");
  return live.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function allMarkets(): MarketRecord[] {
  return [...markets.values()];
}

// --- lifecycle --------------------------------------------------------------

const busy = new Set<string>();
let nextMarketId = [...markets.values()].reduce((max, m) => m.marketId > max ? m.marketId : max, 0n);

/** One lifecycle step at a time per market; double clicks get a 409. */
async function step<T>(
  id: string,
  expected: MarketPhase | MarketPhase[],
  run: (m: MarketRecord) => Promise<T>,
): Promise<T> {
  const market = getMarket(id);
  if (busy.has(id)) throw new HttpError(409, "This market is already being updated");
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(market.phase)) {
    throw new HttpError(409, `Market is ${market.phase}; this step needs it to be ${allowed.join(" or ")}`);
  }
  busy.add(id);
  try {
    return await run(market);
  } catch (error) {
    publish({ type: "market.failed", marketId: id, data: { message: "Market update failed; retry the operation." } });
    throw error instanceof HttpError ? error : new HttpError(502, (error as Error).message);
  } finally {
    busy.delete(id);
    persist();
  }
}

/** Build the operator's unsigned create_market transaction for the Downtown event. */
export async function openMarket(authority: Address, maxPricePerKwh: number) {
  if (!(maxPricePerKwh > 0 && maxPricePerKwh <= 1)) {
    throw new HttpError(400, "maxPricePerKwh must be between 0 and 1");
  }
  const requiredWh = kwToWh(downtown.requiredFlexKw);
  const maxPrice = priceToBasePerKwh(maxPricePerKwh);
  const escrowBase = minEscrowBase(requiredWh, maxPrice);
  const timestampId = BigInt(Date.now());
  nextMarketId = timestampId > nextMarketId ? timestampId : nextMarketId + 1n;
  const marketId = nextMarketId;
  const now = BigInt(Math.floor(Date.now() / 1000));

  const built = await buildCreateMarketTransaction(client, {
    authority,
    marketId,
    zoneId: "downtown",
    requiredWh,
    maxPrice,
    startTs: now,
    endTs: now + 3600n,
    deposit: escrowBase,
  });
  const forecast = await getForecast("downtown");

  const record: MarketRecord = {
    id: marketId.toString(),
    marketId,
    address: built.market,
    authority,
    zone: downtown.zone,
    window: downtown.window,
    requiredKw: downtown.requiredFlexKw,
    maxPricePerKwh,
    escrowBase,
    phase: "awaiting-signature",
    commitments: [],
    forecast: forecast
      ? {
          at: forecast.at,
          pSpike: forecast.pSpike,
          lockedPricePerKwh: forecast.valuation.lockedPricePerKwh,
          source: forecast.source,
        }
      : undefined,
    signatures: {},
    createdAt: new Date().toISOString(),
  };
  markets.set(record.id, record);
  persist();
  return { market: record, transaction: built.transaction };
}

/** Most homes the model may be asked to size for one event. */
const MAX_HOMES = 40;

/**
 * Turn cleared offers into commitments. Households are sized by the baseline
 * model when it's reachable: each commits what it can credibly deliver (p10
 * draw plus its battery), cheapest-first order is kept, and the last home is
 * trimmed so the total never exceeds what the market accepted. Otherwise every
 * home commits its battery's hourly limit, as before.
 */
async function planCommitments(rows: ReturnType<typeof clearMarket>["rows"]): Promise<CommitmentPlan> {
  const demo = participantCommitments(rows);
  const homeRow = rows.find((r) => r.offer.type === "Home batteries" && r.acceptedKw > 0);
  if (!homeRow) return { source: "demo", commitments: demo };

  const sizing = await sizeHomes({
    zone: "downtown",
    homes: Array.from({ length: MAX_HOMES }, (_, i) => homeResourceId(i)),
    generationKw: household.maxDischargeKw,
  });
  if (!sizing) return { source: "demo", commitments: demo };

  // Work in tenths of a kW so the running total can't drift.
  let remaining = Math.round(homeRow.acceptedKw * 10);
  const homes: PlannedCommitment[] = [];
  for (const [i, home] of sizing.homes.entries()) {
    if (remaining <= 0) break;
    const tenths = Math.min(Math.floor(home.offerableKw * 10), remaining);
    if (tenths <= 0) continue;
    remaining -= tenths;
    homes.push({
      resourceId: home.resourceId,
      label: homeLabel(i),
      type: homeRow.offer.type,
      kw: tenths / 10,
      pricePerKwh: homeRow.offer.pricePerKwh,
      isDemoHousehold: i === 0,
      baselineKw: home.baselineKw,
      modelHome: home.modelHome,
    });
  }
  if (remaining > 0) {
    console.warn(`Model-sized homes cover ${homeRow.acceptedKw - remaining / 10} of ${homeRow.acceptedKw} kW; using demo sizing`);
    return { source: "demo", commitments: demo };
  }

  const firstHome = demo.findIndex((c) => c.type === "Home batteries");
  const others = demo.filter((c) => c.type !== "Home batteries");
  return {
    source: sizing.source,
    commitments: [...others.slice(0, firstHome), ...homes, ...others.slice(firstHome)],
    window: sizing.window,
    baselineHash: sizing.baselineHash,
    modelHash: sizing.modelHash,
    featuresHash: sizing.featuresHash,
  };
}

/**
 * After the operator's wallet sends create_market: confirm the escrow exists
 * on-chain, then clear the market and record the accepted commitments.
 */
export function confirmMarket(id: string, signature: Signature | undefined) {
  // "open" too: if recording commitments failed partway, confirming again
  // picks up where it stopped.
  return step(id, ["awaiting-signature", "open"], async (market) => {
    if (market.phase === "awaiting-signature") {
      const onChain = await waitForMarket(market.address);
      if (onChain.authority !== market.authority) throw new HttpError(400, "Market authority mismatch");
      market.signatures.create = signature;
      market.phase = "open";
      publish({ type: "market.created", marketId: id });
    }

    if (!market.plan) {
      const { rows } = clearMarket(flexOffers, market.requiredKw, market.maxPricePerKwh);
      market.plan = await planCommitments(rows);
      // Saved before anything goes on-chain, so a retry records the same commitments.
      persist();
    }
    const participants = await Promise.all(
      market.plan.commitments.map(async (p) => ({
        ...p,
        participant: await managedWallet(p.resourceId),
        commitment: await commitmentAddress(market.address, p.resourceId),
      })),
    );
    // Retry-safe: only record commitments that aren't on-chain yet.
    const existing = await fetchAllMaybeCommitment(client.rpc, participants.map((p) => p.commitment));
    const missing = participants.filter((_, i) => !existing[i].exists);
    const accepted = await acceptCommitments(
      client,
      keys.verifier,
      market.address,
      missing.map((p) => ({
        resourceId: p.resourceId,
        participant: p.participant,
        committedWh: kwToWh(p.kw),
        price: priceToBasePerKwh(p.pricePerKwh),
      })),
    );
    const acceptSignature = new Map(accepted.map((a) => [a.resourceId, a.signature]));
    market.commitments = participants.map((p) => ({
      ...p,
      signatures: { accept: acceptSignature.get(p.resourceId) ?? market.commitments.find((c) => c.resourceId === p.resourceId)?.signatures.accept },
    }));
    market.phase = "committed";
    publish({ type: "commitment.accepted", marketId: id });
    return market;
  });
}

/** Commitments whose on-chain status is still `status`. */
async function withStatus(market: MarketRecord, status: CommitmentStatus) {
  const accounts = await fetchAllMaybeCommitment(
    client.rpc,
    market.commitments.map((c) => c.commitment!),
  );
  return market.commitments.filter((_, i) => {
    const account = accounts[i];
    return account.exists && account.data.status === status;
  });
}

async function waitForMarket(address: Address) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const account = await fetchMaybeMarket(client.rpc, address);
    if (account.exists) return account.data;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new HttpError(400, "The market wasn't found on-chain. Was the transaction sent?");
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Demo stand-in for meter data: record each participant's delivery. Model-sized
 * households are measured against the baseline committed when they were
 * accepted (delivered = baseline - metered draw); the draw itself is still
 * simulated.
 */
export function verifyMarket(id: string) {
  return step(id, "committed", async (market) => {
    for (const c of market.commitments) {
      const delivered = simulatedDeliveredKw(c);
      if (c.baselineKw === undefined) {
        c.deliveredKw = delivered;
        continue;
      }
      c.meter = { baselineKw: c.baselineKw, actualKw: round3(c.baselineKw - delivered) };
      c.deliveredKw = round3(c.meter.baselineKw - c.meter.actualKw);
    }
    // Retry-safe: only verify commitments still waiting for it on-chain.
    const pending = await withStatus(market, CommitmentStatus.Committed);
    const signatures = await verifyDeliveries(
      client,
      keys.verifier,
      market.address,
      pending.map((c) => {
        // Hashed on-chain and kept here so anyone can re-hash it. For
        // model-sized homes it ties the payout to the committed baseline.
        c.proof = JSON.stringify({
          market: market.address,
          resourceId: c.resourceId,
          deliveredKw: c.deliveredKw,
          ...(c.meter && { ...c.meter, baselineHash: market.plan?.baselineHash }),
        });
        return { commitment: c.commitment!, deliveredWh: kwToWh(c.deliveredKw!), proof: c.proof };
      }),
    );
    pending.forEach((c, i) => (c.signatures.verify = signatures[i]));
    market.phase = "verified";
    publish({ type: "verification.completed", marketId: id });
    return market;
  });
}

/** Pay every verified commitment, then refund the rest of the escrow. */
export function settleMarket(id: string) {
  return step(id, "verified", async (market) => {
    // Retry-safe: only pay commitments that are verified and not yet paid.
    const unpaid = await withStatus(market, CommitmentStatus.Verified);
    const signatures = await settleCommitments(
      client,
      keys.verifier,
      market.address,
      unpaid.map((c) => ({ commitment: c.commitment!, participant: c.participant })),
    );
    unpaid.forEach((c, i) => (c.signatures.settle = signatures[i]));
    market.commitments.forEach((c) => {
      c.payoutBase = payoutBase(
        kwToWh(Math.min(c.deliveredKw!, c.kw)),
        priceToBasePerKwh(c.pricePerKwh),
      );
    });
    market.paidBase = market.commitments.reduce((s, c) => s + (c.payoutBase ?? 0n), 0n);
    publish({ type: "settlement.completed", marketId: id });

    const onChain = await fetchMaybeMarket(client.rpc, market.address);
    if (onChain.exists && onChain.data.status !== MarketStatus.Closed) {
      market.signatures.close = await closeMarket(client, keys.verifier, market.address, market.authority);
    }
    market.refundBase = market.escrowBase - market.paidBase;
    market.phase = "settled";
    market.settledAt = new Date().toISOString();
    publish({ type: "market.closed", marketId: id });
    return market;
  });
}
