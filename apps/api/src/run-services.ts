import { address } from "@solana/kit";
import {
  activeFault,
  virtualAt,
  type RunBundle,
  type RunEvent,
  type RunState,
  type Decision,
} from "@gridflex/shared";
import {
  acceptCommitments,
  closeMarket,
  commitmentAddress,
  CommitmentStatus,
  createMarket,
  fetchAllMaybeCommitment,
  fetchMaybeMarket,
  getUsdcBalance,
  marketAddress,
  MarketStatus,
  settleCommitments,
  verifyDeliveries,
} from "@gridflex/solana";
import { client, cluster, config, keys } from "./env";
import { managedSigner, managedWallet } from "./wallets";
import type { RunServices } from "./run-engine";

async function intelligence<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${config.intelligenceUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error("Intelligence inputs unavailable");
  return (await res.json()) as T;
}
async function operator() {
  await managedWallet("run-operator");
  return managedSigner("run-operator");
}

async function reconcile(run: RunState, event: RunEvent, persist: () => void) {
  if (cluster !== "devnet" && cluster !== "localnet")
    throw new Error("Autonomous settlement requires a test network.");
  for (const fault of [
    "rpc-timeout",
    "insufficient-funds",
    "expired-transaction",
    "delayed-confirmation",
  ]) {
    if (activeFault(run, fault))
      throw new Error(`Settlement pending: ${fault.replaceAll("-", " ")}.`);
  }
  if (
    ["verifying", "settling"].includes(event.phase) &&
    event.commitments.length &&
    event.commitments.every((c) => c.missing > 0)
  ) {
    const c = event.commitments[0];
    throw new Error(
      `Awaiting ${c.missing} validated interval readings for ${c.resourceId}.`,
    );
  }
  const signer = await operator();
  const marketId = BigInt(event.chainId);
  const market = await marketAddress(signer.address, marketId);
  event.address = market;
  let account = await fetchMaybeMarket(client.rpc, market, {
    commitment: "confirmed",
  });
  if (
    run.minute >= event.endMinute &&
    ["scheduled", "committing"].includes(event.phase)
  ) {
    event.canceled = true;
    event.cancellationReason =
      "Delivery window elapsed before commitments were ready.";
  }
  if (account.exists && account.data.status === MarketStatus.Closed) {
    event.refundBase = (
      account.data.escrowAmount - account.data.paidAmount
    ).toString();
    event.phase = event.canceled ? "canceled" : "completed";
    persist();
    return;
  }
  if (!account.exists) {
    if (event.canceled) {
      event.phase = "canceled";
      persist();
      return;
    }
    event.phase = "committing";
    persist();
    if (
      (await getUsdcBalance(client, signer.address)) < BigInt(event.escrowBase)
    )
      throw new Error("Operator test-token balance is below required escrow.");
    const created = await createMarket(client, signer, {
      marketId,
      zoneId: event.zone,
      requiredWh: BigInt(Math.ceil(event.requiredKw * 1000)),
      maxPrice: BigInt(Math.round(event.price * 1e6)),
      startTs: BigInt(
        Math.floor(Date.parse(run.start) / 1000) + event.startMinute * 60,
      ),
      endTs: BigInt(
        Math.floor(Date.parse(run.start) / 1000) + event.endMinute * 60,
      ),
      deposit: BigInt(event.escrowBase),
    });
    event.createSignature = created.signature;
    persist();
    account = await fetchMaybeMarket(client.rpc, market, {
      commitment: "confirmed",
    });
    if (!account.exists) throw new Error("Escrow confirmation pending.");
  }
  const pending = [];
  let remainingWh = Number(account.data.requiredWh - account.data.committedWh);
  for (const c of event.commitments) {
    c.participant ??= await managedWallet(c.resourceId);
    c.address ??= await commitmentAddress(market, c.resourceId);
  }
  const read = () =>
    fetchAllMaybeCommitment(
      client.rpc,
      event.commitments.map((c) => address(c.address!)),
      { commitment: "confirmed" },
    );
  const committed = await read();
  for (const [i, c] of event.commitments.entries()) {
    const existing = committed[i];
    if (!existing.exists && !event.canceled) {
      c.committedWh = Math.min(c.committedWh, remainingWh);
      c.kw = c.committedWh / 1000;
      remainingWh -= c.committedWh;
      if (c.committedWh > 0) pending.push(c);
    }
  }
  if (pending.length) {
    persist();
    await acceptCommitments(
      client,
      keys.verifier,
      market,
      pending
        .slice(0, activeFault(run, "partial-batch") ? 1 : undefined)
        .map((c) => ({
          resourceId: c.resourceId,
          participant: address(c.participant!),
          committedWh: BigInt(c.committedWh),
          price: BigInt(Math.round(c.price * 1e6)),
        })),
    );
    if (activeFault(run, "partial-batch"))
      throw new Error(
        "Commitment batch interrupted; recorded accounts will be reconciled.",
      );
  }
  if (event.phase === "scheduled" || event.phase === "committing") {
    // Clock waits at the commit barrier, keeping the signed window immutable.
    if (!event.canceled)
      for (const c of event.commitments) {
        const device = run.devices.find((d) => d.id === c.resourceId);
        if (device) device.eventsToday = (device.eventsToday ?? 0) + 1;
      }
    event.phase = event.canceled ? "verifying" : "dispatching";
    persist();
    if (!event.canceled) return;
  }
  if (
    event.phase === "verifying" ||
    event.phase === "settling" ||
    event.canceled
  ) {
    let records = await read();
    const toVerify = event.commitments.filter(
      (c, i) =>
        records[i].exists &&
        records[i].data.status === CommitmentStatus.Committed &&
        c.missing === 0,
    );
    for (const c of toVerify)
      c.proof ??= JSON.stringify({
        runId: run.id,
        eventId: event.id,
        baselineHash: c.baselineHash,
        deliveredWh: Math.floor(c.deliveredWh),
        samples: c.samples,
        window: [event.startMinute, event.endMinute],
        bundleVersion: run.bundleVersion,
      });
    persist();
    if (toVerify.length)
      await verifyDeliveries(
        client,
        keys.verifier,
        market,
        toVerify.map((c) => ({
          commitment: address(c.address!),
          deliveredWh: BigInt(Math.floor(c.deliveredWh)),
          proof: c.proof!,
        })),
      );
    records = await read();
    const toPay = event.commitments.filter(
      (c, i) =>
        records[i].exists &&
        records[i].data.status === CommitmentStatus.Verified,
    );
    if (toPay.length) {
      event.phase = "settling";
      persist();
      const signatures = await settleCommitments(
        client,
        keys.verifier,
        market,
        toPay.map((c) => ({
          commitment: address(c.address!),
          participant: address(c.participant!),
        })),
      );
      toPay.forEach((c, i) => (c.signature = signatures[i]));
      persist();
    }
    records = await read();
    for (let i = 0; i < event.commitments.length; i++) {
      const c = event.commitments[i];
      const chain = records[i];
      if (chain.exists && chain.data.status === CommitmentStatus.Paid) {
        c.paidBase = (
          (chain.data.payableWh * chain.data.price) /
          1000n
        ).toString();
        if (!c.signature) {
          const receipts = await client.rpc
            .getSignaturesForAddress(address(c.address!), {
              limit: 1,
              commitment: "confirmed",
            })
            .send();
          if (receipts[0] && !receipts[0].err)
            c.signature = receipts[0].signature;
        }
      }
    }
    persist();
    const awaiting = event.commitments.find(
      (c, i) =>
        records[i].exists && records[i].data.status !== CommitmentStatus.Paid,
    );
    if (awaiting)
      throw new Error(
        awaiting.missing
          ? `Awaiting ${awaiting.missing} validated interval readings for ${awaiting.resourceId}.`
          : "Payout confirmation pending.",
      );
    account = await fetchMaybeMarket(client.rpc, market, {
      commitment: "confirmed",
    });
    if (account.exists && account.data.status !== MarketStatus.Closed) {
      event.closeSignature = await closeMarket(
        client,
        signer,
        market,
        signer.address,
      );
      event.refundBase = (
        BigInt(event.escrowBase) -
        event.commitments.reduce((sum, c) => sum + BigInt(c.paidBase ?? 0), 0n)
      ).toString();
    }
    event.phase = event.canceled ? "canceled" : "completed";
    persist();
  }
}

export const runServices: RunServices = {
  bundle: () => intelligence<RunBundle>("/run/bundle"),
  async decide(run, zone) {
    try {
      return await intelligence<Decision>("/run/decide", {
        at: virtualAt(run),
        minute: run.minute,
        maxPricePerKwh: run.priceCapPerKwh ?? 0.6,
        zone,
        devices: run.devices.filter((d) => d.zone === zone),
        state: run.zones.find((z) => z.id === zone),
        environment: run.environment,
        faults: run.faults.filter((f) => f.until > run.minute).map((f) => f.id),
      });
    } catch {
      return null;
    }
  },
  settle: reconcile,
  async preflight() {
    const errors: string[] = [];
    if (!["devnet", "localnet"].includes(cluster))
      errors.push("A test network is required.");
    try {
      const signer = await operator();
      const [balance, sol, verifierSol] = await Promise.all([
        getUsdcBalance(client, signer.address),
        client.rpc.getBalance(signer.address).send(),
        client.rpc.getBalance(keys.verifier.address).send(),
      ]);
      if (balance < BigInt(process.env.RUN_EVENT_LIMIT_BASE ?? "100000000"))
        errors.push(
          "Fund the run operator with at least the per-event limit in test tokens.",
        );
      if (sol.value < 50_000_000n || verifierSol.value < 50_000_000n)
        errors.push(
          "Operator and verifier each require at least 0.05 SOL for fees.",
        );
    } catch {
      errors.push("Solana RPC or operator wallet unavailable.");
    }
    return errors;
  },
};
