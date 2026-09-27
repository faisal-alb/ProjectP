import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import {
  address,
  isAddress,
  type Address,
  type Base64EncodedWireTransaction,
  type Signature,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { DEMO_HOUSEHOLD_RESOURCE_ID, formatUsdc, usdToBase } from "@gridflex/shared";
import { GRIDFLEX_PROGRAM_ADDRESS, getUsdcBalance, mintMockUsdc, sendInstructions } from "@gridflex/solana";

import { addressUrl, client, cluster, config, keys, rpcUrl, txUrl } from "./env";
import { bus, type MarketEvent } from "./events";
import { getForecast, intelligenceStatus } from "./intelligence";
import {
  allMarkets,
  confirmMarket,
  currentMarket,
  getMarket,
  HttpError,
  openMarket,
  settleMarket,
  verifyMarket,
  type MarketRecord,
} from "./markets";
import { rateLimit } from "./rate-limit";
import { managedWallet } from "./wallets";

const app = new Hono();
app.use("*", cors({ origin: config.webOrigin }));
app.use("*", bodyLimit({ maxSize: 64 * 1024 }));

app.onError((error, c) => {
  const status = error instanceof HttpError || error instanceof HTTPException ? error.status : 500;
  if (status >= 500) console.error(error);
  return c.json({ error: status >= 500 ? "The service could not complete the request. Please retry." : error.message }, status);
});

// Bound public demo operations and service-wallet spending; see rate-limit.ts.
const HOUR = 60 * 60 * 1000;
const faucetLimit = rateLimit({ name: "faucet", limit: 3, globalLimit: 30, windowMs: HOUR });
const openLimit = rateLimit({ name: "new market", limit: 10, globalLimit: 60, windowMs: HOUR });
const stepLimit = rateLimit({ name: "market update", limit: 60, globalLimit: 300, windowMs: HOUR });

const money = (base: bigint | undefined) =>
  base === undefined ? undefined : { base: base.toString(), formatted: formatUsdc(base) };

function serializeMarket(m: MarketRecord) {
  return {
    id: m.id,
    address: m.address,
    addressUrl: addressUrl(m.address),
    authority: m.authority,
    zone: m.zone,
    window: m.window,
    requiredKw: m.requiredKw,
    maxPricePerKwh: m.maxPricePerKwh,
    phase: m.phase,
    escrow: money(m.escrowBase),
    paid: money(m.paidBase),
    refund: money(m.refundBase),
    committedKw: m.commitments.reduce((s, c) => s + c.kw, 0),
    transactions: {
      create: txUrl(m.signatures.create),
      accept: txUrl(m.commitments[0]?.signatures.accept),
      verify: txUrl(m.commitments[0]?.signatures.verify),
      settle: txUrl(m.commitments[0]?.signatures.settle),
      close: txUrl(m.signatures.close),
    },
    commitments: m.commitments.map((c) => ({
      resourceId: c.resourceId,
      label: c.label,
      type: c.type,
      kw: c.kw,
      pricePerKwh: c.pricePerKwh,
      participant: c.participant,
      deliveredKw: c.deliveredKw,
      baselineKw: c.baselineKw,
      meter: c.meter,
      payout: money(c.payoutBase),
      settleUrl: txUrl(c.signatures.settle),
    })),
    plan: m.plan && {
      source: m.plan.source,
      window: m.plan.window,
      baselineHash: m.plan.baselineHash,
      modelHash: m.plan.modelHash,
      featuresHash: m.plan.featuresHash,
    },
    forecast: m.forecast,
    createdAt: m.createdAt,
    settledAt: m.settledAt,
  };
}

const parseAddress = (value: unknown, field: string): Address => {
  if (typeof value !== "string" || !isAddress(value)) throw new HttpError(400, `${field} must be a Solana address`);
  return address(value);
};

// --- routes -------------------------------------------------------------------

app.get("/health", async (c) =>
  c.json({
    ok: true,
    cluster,
    // Paid RPC providers put their API key in the URL, so it's only shared on
    // localnet, where the web app needs it for explorer links.
    rpcUrl: cluster === "localnet" ? rpcUrl : undefined,
    programId: GRIDFLEX_PROGRAM_ADDRESS,
    usdcMint: client.usdcMint,
    verifier: keys.verifier.address,
    intelligence: await intelligenceStatus(),
  }),
);

/** The model forecast for a zone, or null (with the dashboard on demo data) when the model service is down. */
app.get("/forecast/:zone", async (c) => c.json({ forecast: await getForecast(c.req.param("zone")) }));

app.get("/markets/current", (c) => {
  const market = currentMarket();
  return c.json({ market: market ? serializeMarket(market) : null });
});

app.get("/markets/:id", (c) => c.json({ market: serializeMarket(getMarket(c.req.param("id"))) }));

/** Returns an unsigned create_market transaction for the operator's wallet. */
app.post("/markets", openLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const authority = parseAddress(body.operatorWallet, "operatorWallet");
  const { market, transaction } = await openMarket(authority, Number(body.maxPricePerKwh));
  return c.json({ market: serializeMarket(market), transaction }, 201);
});

/**
 * The operator's wallet signed the create_market transaction. Either send us
 * the signed bytes (we broadcast them to our RPC, which works on any cluster)
 * or the signature of a transaction the wallet already sent.
 */
app.post("/markets/:id/confirm", stepLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  let signature = typeof body.signature === "string" ? (body.signature as Signature) : undefined;
  if (typeof body.signedTransaction === "string") {
    signature = await client.rpc
      .sendTransaction(body.signedTransaction as Base64EncodedWireTransaction, { encoding: "base64" })
      .send()
      .catch(() => {
        throw new HttpError(400, "The network rejected the signed transaction");
      });
  }
  return c.json({ market: serializeMarket(await confirmMarket(c.req.param("id"), signature)) });
});

app.post("/markets/:id/verify", stepLimit, async (c) =>
  c.json({ market: serializeMarket(await verifyMarket(c.req.param("id"))) }),
);

app.post("/markets/:id/settle", stepLimit, async (c) =>
  c.json({ market: serializeMarket(await settleMarket(c.req.param("id"))) }),
);

/** A managed household: its wallet, live USDC balance, and payouts. */
app.get("/households/:resourceId", async (c) => {
  const resourceId = c.req.param("resourceId");
  if (!/^downtown-home-\d{2}$/.test(resourceId)) throw new HttpError(404, "Household not found");
  const wallet = await managedWallet(resourceId);
  const payouts = allMarkets()
    .flatMap((m) =>
      m.commitments
        .filter((cm) => cm.resourceId === resourceId && cm.payoutBase !== undefined)
        .map((cm) => ({
          marketId: m.id,
          window: m.window,
          deliveredKw: cm.deliveredKw,
          amount: money(cm.payoutBase),
          url: txUrl(cm.signatures.settle),
          settledAt: m.settledAt,
        })),
    )
    .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""));
  const current = currentMarket();
  const tonight = current?.commitments.find((cm) => cm.resourceId === resourceId);
  return c.json({
    resourceId,
    wallet,
    walletUrl: addressUrl(wallet),
    balance: money(await getUsdcBalance(client, wallet)),
    payouts,
    tonight: current && tonight
      ? { marketId: current.id, phase: current.phase, payout: money(tonight.payoutBase), url: txUrl(tonight.signatures.settle) }
      : null,
  });
});

/** Mock USDC + fee SOL for an operator wallet. Never on mainnet. */
app.post("/faucet", faucetLimit, async (c) => {
  if (cluster === "mainnet-beta") throw new HttpError(400, "No faucet on mainnet");
  const body = await c.req.json().catch(() => ({}));
  const owner = parseAddress(body.wallet, "wallet");
  const { value: lamports } = await client.rpc.getBalance(owner).send();
  const minLamports = cluster === "localnet" ? 1_000_000_000n : 50_000_000n;
  if (lamports < minLamports) {
    await sendInstructions(client, keys.deployer, [
      getTransferSolInstruction({ source: keys.deployer, destination: owner, amount: minLamports - lamports }),
    ]);
  }
  const signature = await mintMockUsdc(client, keys.deployer, keys.mintAuthority, owner, usdToBase(500));
  return c.json({ url: txUrl(signature), balance: money(await getUsdcBalance(client, owner)) });
});

app.get("/wallets/:address/usdc", async (c) => {
  const owner = parseAddress(c.req.param("address"), "address");
  return c.json({ balance: money(await getUsdcBalance(client, owner)) });
});

/** Server-sent market events; the dashboard refetches on each one. */
app.get("/stream", (c) =>
  streamSSE(c, async (stream) => {
    const forward = (event: MarketEvent) => {
      void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    };
    bus.on("event", forward);
    const ping = setInterval(() => void stream.writeSSE({ event: "ping", data: "{}" }), 20_000);
    stream.onAbort(() => {
      bus.off("event", forward);
      clearInterval(ping);
    });
    await stream.writeSSE({ event: "ready", data: JSON.stringify({ cluster }) });
    await new Promise<void>((resolve) => stream.onAbort(resolve));
  }),
);

// Make sure the demo household's wallet exists before anyone asks for it.
await managedWallet(DEMO_HOUSEHOLD_RESOURCE_ID);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`GridFlex API on http://localhost:${info.port} · ${cluster}`);
});
