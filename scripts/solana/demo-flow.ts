// The known-good flow (docs/05): one Downtown flexibility event from escrow to
// refund, without the UI. Prints every signature and checks the balances.
//   npm run solana:demo            (SOLANA_CLUSTER=devnet to run on devnet)
import assert from "node:assert/strict";
import { generateKeyPairSigner } from "@solana/kit";
import {
  clearMarket,
  defaultPriceCap,
  downtown,
  DEMO_HOUSEHOLD_RESOURCE_ID,
  flexOffers,
  formatUsdc,
  kwToWh,
  minEscrowBase,
  participantCommitments,
  payoutBase,
  priceToBasePerKwh,
  simulatedDeliveredKw,
  usdToBase,
} from "@gridflex/shared";
import {
  acceptCommitments,
  closeMarket,
  createMarket,
  explorerUrl,
  fetchMarket,
  findVaultPda,
  getUsdcBalance,
  MarketStatus,
  mintMockUsdc,
  settleCommitments,
  verifyDeliveries,
} from "@gridflex/solana";
import { client, cluster, ensureSol, loadKeys, requireMint, rpcUrl } from "./env";

const link = (sig: string) => explorerUrl("tx", sig, cluster, rpcUrl);
const step = (title: string) => console.log(`\n▸ ${title}`);

const keys = await loadKeys();
const c = client(requireMint());

// A fresh operator wallet per run, funded like a utility would be.
const operator = await generateKeyPairSigner();
await ensureSol(c, keys.deployer, operator.address, cluster === "localnet" ? 2 : 0.05);
await mintMockUsdc(c, keys.deployer, keys.mintAuthority, operator.address, usdToBase(500));
const operatorStart = await getUsdcBalance(c, operator.address);
console.log(`Operator ${operator.address} holds ${formatUsdc(operatorStart)}`);

step("Open the flexibility request (escrow at the price cap)");
const requiredWh = kwToWh(downtown.requiredFlexKw);
const maxPrice = priceToBasePerKwh(defaultPriceCap);
const deposit = minEscrowBase(requiredWh, maxPrice);
const now = BigInt(Math.floor(Date.now() / 1000));
const created = await createMarket(c, operator, {
  marketId: BigInt(Date.now()),
  zoneId: "downtown",
  requiredWh,
  maxPrice,
  startTs: now,
  endTs: now + 3600n,
  deposit,
});
const market = created.market;
console.log(`  ${formatUsdc(deposit)} locked in market ${market}\n  ${link(created.signature)}`);

step("Accept offers (cheapest first, off-chain) → commitments on-chain");
const { rows } = clearMarket(flexOffers, downtown.requiredFlexKw, defaultPriceCap);
const participants = await Promise.all(
  participantCommitments(rows).map(async (p) => ({ ...p, wallet: (await generateKeyPairSigner()).address })),
);
const accepted = await acceptCommitments(
  c,
  keys.verifier,
  market,
  participants.map((p) => ({
    resourceId: p.resourceId,
    participant: p.wallet,
    committedWh: kwToWh(p.kw),
    price: priceToBasePerKwh(p.pricePerKwh),
  })),
);
for (const sig of new Set(accepted.map((a) => a.signature))) console.log(`  ${link(sig)}`);
console.log(`  ${accepted.length} commitments (${participants.filter((p) => p.type === "Home batteries").length} homes)`);

step("Verify metered delivery");
const deliveredKw = simulatedDeliveredKw;
const verified = await verifyDeliveries(
  c,
  keys.verifier,
  market,
  participants.map((p, i) => ({
    commitment: accepted[i].commitment,
    deliveredWh: kwToWh(deliveredKw(p)),
    proof: JSON.stringify({ resourceId: p.resourceId, deliveredKw: deliveredKw(p), window: downtown.window }),
  })),
);
for (const sig of new Set(verified)) console.log(`  ${link(sig)}`);

step("Pay participants from escrow");
const settled = await settleCommitments(
  c,
  keys.verifier,
  market,
  participants.map((p, i) => ({ commitment: accepted[i].commitment, participant: p.wallet })),
);
for (const sig of new Set(settled)) console.log(`  ${link(sig)}`);

step("Close the market and refund unused escrow");
const closed = await closeMarket(c, keys.verifier, market, operator.address);
console.log(`  ${link(closed)}`);

// Reconcile every base unit.
let expectedPaid = 0n;
for (const p of participants) {
  const payable = Math.min(deliveredKw(p), p.kw);
  const expected = payoutBase(kwToWh(payable), priceToBasePerKwh(p.pricePerKwh));
  assert.equal(await getUsdcBalance(c, p.wallet), expected, `${p.label} payout`);
  expectedPaid += expected;
}
const household = participants.find((p) => p.resourceId === DEMO_HOUSEHOLD_RESOURCE_ID)!;
const finalMarket = await fetchMarket(c.rpc, market);
const operatorEnd = await getUsdcBalance(c, operator.address);
assert.equal(finalMarket.data.status, MarketStatus.Closed);
assert.equal(finalMarket.data.paidAmount, expectedPaid);
assert.equal(operatorEnd, operatorStart - expectedPaid, "operator refunded everything unpaid");
const [vaultAddress] = await findVaultPda({ market });
const vault = await c.rpc.getAccountInfo(vaultAddress).send();
assert.equal(vault.value, null, "vault closed");

console.log(`
✔ Settled.
  Escrowed     ${formatUsdc(deposit)}
  Paid out     ${formatUsdc(expectedPaid)} to ${participants.length} participants
  Refunded     ${formatUsdc(deposit - expectedPaid)} to the operator
  Demo home    ${formatUsdc(await getUsdcBalance(c, household.wallet))} → ${household.wallet}
  Market       ${explorerUrl("address", market, cluster, rpcUrl)}`);
