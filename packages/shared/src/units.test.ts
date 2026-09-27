import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearMarket,
  defaultPriceCap,
  downtown,
  flexOffers,
  formatUsdc,
  kwToWh,
  minEscrowBase,
  payoutBase,
  priceToBasePerKwh,
  usdToBase,
} from "./index";

test("demo escrow: 800 kWh at the $0.20 cap locks $160", () => {
  const escrow = minEscrowBase(kwToWh(downtown.requiredFlexKw), priceToBasePerKwh(defaultPriceCap));
  assert.equal(escrow, 160_000_000n);
  assert.equal(formatUsdc(escrow), "$160.00");
});

test("integer payouts for the default market sum to the displayed $94.70", () => {
  const { rows, cost } = clearMarket(flexOffers, downtown.requiredFlexKw, defaultPriceCap);
  const total = rows.reduce(
    (sum, r) => sum + payoutBase(kwToWh(r.acceptedKw), priceToBasePerKwh(r.offer.pricePerKwh)),
    0n,
  );
  assert.equal(total, 94_700_000n);
  assert.equal(total, usdToBase(cost));
});

test("a 5 kWh home payout at $0.14/kWh is $0.70", () => {
  assert.equal(payoutBase(5_000n, priceToBasePerKwh(0.14)), 700_000n);
});

test("payouts floor like the program", () => {
  assert.equal(payoutBase(1n, 1_999n), 1n);
  assert.equal(payoutBase(999n, 1n), 0n);
});

test("formatUsdc", () => {
  assert.equal(formatUsdc(0n), "$0.00");
  assert.equal(formatUsdc(1_234_567_890n), "$1,234.56");
});

test("home batteries split into 5 kW homes, the demo household included", async () => {
  const { participantCommitments, DEMO_HOUSEHOLD_RESOURCE_ID } = await import("./index");
  const { rows } = clearMarket(flexOffers, downtown.requiredFlexKw, defaultPriceCap);
  const commitments = participantCommitments(rows);
  const homes = commitments.filter((c) => c.type === "Home batteries");
  assert.equal(homes.length, 20);
  assert.ok(homes.every((h) => h.kw === 5));
  assert.equal(commitments.reduce((s, c) => s + c.kw, 0), downtown.requiredFlexKw);
  const demo = commitments.find((c) => c.resourceId === DEMO_HOUSEHOLD_RESOURCE_ID);
  assert.ok(demo?.isDemoHousehold);
  assert.equal(payoutBase(kwToWh(demo!.kw), priceToBasePerKwh(demo!.pricePerKwh)), 700_000n);
});

test("zip lookup resolves demo addresses and rejects others", async () => {
  const { resolveZip, estimateFlex } = await import("./index");
  assert.deepEqual(resolveZip("78701"), {
    zip: "78701",
    utility: "Austin Energy",
    zone: "Downtown Austin",
    substation: "Downtown Austin Substation",
    feeder: "DT-A",
    coordinates: [-97.742589, 30.270569],
  });
  assert.equal(resolveZip("10001"), null);
  // 78% charge, 40% reserve: 5.13 kWh above the reserve, capped by the per-event limit.
  assert.equal(estimateFlex({ resources: ["battery"], reservePercent: 40, maxKwhPerEvent: 6, minRate: 0.18 }).batteryKwh, 5);
  assert.equal(estimateFlex({ resources: ["battery"], reservePercent: 40, maxKwhPerEvent: 3, minRate: 0.18 }).batteryKwh, 3);
  assert.equal(estimateFlex({ resources: ["ev"], reservePercent: 40, maxKwhPerEvent: 3, minRate: 0.18 }).batteryKwh, 0);
});
