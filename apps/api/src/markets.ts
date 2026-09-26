// Market lifecycle orchestration: the off-chain half of each step (matching,
// meter simulation) plus the on-chain calls, with state kept per market.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Address, Signature } from "@solana/kit";
import {
  clearMarket,
  downtown,
  flexOffers,
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
import { managedWallet } from "./wallets";

export type MarketPhase = "awaiting-signature" | "open" | "committed" | "verified" | "settled";

export interface CommitmentRecord extends ParticipantCommitment {
  participant: Address;
  commitment?: Address;
  deliveredKw?: number;
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
  mkdirSync(config.dataDir, { recursive: true });
  writeFileSync(
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

/** One lifecycle step at a time per market; double clicks get a 409. */
async function step<T>(id: string, expected: MarketPhase, run: (m: MarketRecord) => Promise<T>): Promise<T> {
  const market = getMarket(id);
  if (busy.has(id)) throw new HttpError(409, "This market is already being updated");
  if (market.phase !== expected) {
    throw new HttpError(409, `Market is ${market.phase}; this step needs it to be ${expected}`);
  }
  busy.add(id);
  try {
    return await run(market);
  } catch (error) {
    publish({ type: "market.failed", marketId: id, data: { message: (error as Error).message } });
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
  const marketId = BigInt(Date.now());
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
    signatures: {},
    createdAt: new Date().toISOString(),
  };
  markets.set(record.id, record);
  persist();
  return { market: record, transaction: built.transaction };
}

/**
 * After the operator's wallet sends create_market: confirm the escrow exists
 * on-chain, then clear the market and record the accepted commitments.
 */
export function confirmMarket(id: string, signature: Signature | undefined) {
  return step(id, "awaiting-signature", async (market) => {
    const onChain = await waitForMarket(market.address);
    if (onChain.authority !== market.authority) throw new HttpError(400, "Market authority mismatch");
    market.signatures.create = signature;
    market.phase = "open";
    publish({ type: "market.created", marketId: id });

    const { rows } = clearMarket(flexOffers, market.requiredKw, market.maxPricePerKwh);
    const participants = await Promise.all(
      participantCommitments(rows).map(async (p) => ({
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

/** Demo stand-in for meter data: record each participant's delivery. */
export function verifyMarket(id: string) {
  return step(id, "committed", async (market) => {
    for (const c of market.commitments) c.deliveredKw = simulatedDeliveredKw(c);
    // Retry-safe: only verify commitments still waiting for it on-chain.
    const pending = await withStatus(market, CommitmentStatus.Committed);
    const signatures = await verifyDeliveries(
      client,
      keys.verifier,
      market.address,
      pending.map((c) => ({
        commitment: c.commitment!,
        deliveredWh: kwToWh(c.deliveredKw!),
        proof: JSON.stringify({ market: market.address, resourceId: c.resourceId, deliveredKw: c.deliveredKw }),
      })),
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
