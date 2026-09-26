// End-to-end check of the API over HTTP, playing the operator's wallet:
// faucet → POST /markets → sign & send the returned transaction → confirm →
// verify → settle → household payout. Needs the API running.
//   npm run solana:api-smoke
import assert from "node:assert/strict";
import {
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  signTransaction,
} from "@solana/kit";
import { DEMO_HOUSEHOLD_RESOURCE_ID } from "@gridflex/shared";
import { client, requireMint } from "./env";

const api = process.env.API_URL ?? "http://localhost:8787";
async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.error}`);
  return json as T;
}

const c = client(requireMint());
const operator = await generateKeyPairSigner();
const householdBefore = await call("GET", `/households/${DEMO_HOUSEHOLD_RESOURCE_ID}`);

const faucet = await call("POST", "/faucet", { wallet: operator.address });
console.log(`faucet: operator has ${faucet.balance.formatted}`);

const opened = await call("POST", "/markets", { operatorWallet: operator.address, maxPricePerKwh: 0.2 });
console.log(`POST /markets: escrow ${opened.market.escrow.formatted}, phase ${opened.market.phase}`);

// What the operator's wallet does with the returned transaction.
const tx = getTransactionDecoder().decode(getBase64Encoder().encode(opened.transaction));
const signed = await signTransaction([operator.keyPair], tx);
const signature = await c.rpc
  .sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64" })
  .send();
console.log(`wallet sent create_market: ${signature}`);

const id = opened.market.id;
const confirmed = await call("POST", `/markets/${id}/confirm`, { signature });
console.log(`confirm: ${confirmed.market.phase}, ${confirmed.market.commitments.length} commitments`);
const verified = await call("POST", `/markets/${id}/verify`);
console.log(`verify: ${verified.market.phase}`);
const settled = await call("POST", `/markets/${id}/settle`);
console.log(`settle: ${settled.market.phase}, paid ${settled.market.paid.formatted}, refunded ${settled.market.refund.formatted}`);

await assert.rejects(call("POST", `/markets/${id}/settle`), /409/, "settling twice is rejected");

const household = await call("GET", `/households/${DEMO_HOUSEHOLD_RESOURCE_ID}`);
const gained = BigInt(household.balance.base) - BigInt(householdBefore.balance.base);
assert.equal(gained, 700_000n, "demo household paid $0.70");
assert.equal(household.tonight.phase, "settled");
const operatorAfter = await call("GET", `/wallets/${operator.address}/usdc`);
assert.equal(operatorAfter.balance.formatted, "$406.40");
console.log(`household ${household.wallet}: ${household.balance.formatted} (+$0.70), payment ${household.tonight.url}`);
console.log("✔ API flow OK");
