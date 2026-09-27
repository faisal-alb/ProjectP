import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_GENERATOR,
  DEMO_SOLAR_SURPLUS_KWH,
  buildPowerPlan,
  windowHours,
  type PlanInput,
} from "./power-plan";

const home: PlanInput = {
  preference: "balanced",
  stormExpected: false,
  event: { pricePerKwh: 0.41, durationHours: 1.5 },
  battery: { kwh: 13.5, chargePercent: 78, maxDischargeKw: 5, reservePercent: 40, maxKwhPerEvent: 6, minRatePerKwh: 0.12 },
  solar: { surplusKwh: DEMO_SOLAR_SURPLUS_KWH },
  generator: DEMO_GENERATOR,
  ev: undefined,
  hvac: undefined,
};
const kinds = (p: ReturnType<typeof buildPowerPlan>) => p.actions.map((a) => a.kind);
const get = (p: ReturnType<typeof buildPowerPlan>, kind: string) => p.actions.find((a) => a.kind === kind)!;

test("windowHours", () => {
  assert.equal(windowHours("7:30 – 9:00 PM"), 1.5);
  assert.equal(windowHours("7:00 – 8:00 PM"), 1);
  assert.equal(windowHours("nonsense"), 1);
});

test("plan has every applicable action, ranked and numbered", () => {
  const plan = buildPowerPlan(home);
  assert.deepEqual(plan.actions.map((a) => a.rank), [1, 2, 3, 4, 5]);
  assert.ok(plan.actions.every((a, i, all) => i === 0 || all[i - 1].score >= a.score));
  assert.equal(new Set(kinds(plan)).size, 5);
});

test("battery discharge never goes below the protected reserve", () => {
  for (const preference of ["balanced", "earnings", "backup", "emissions", "grid"] as const) {
    for (const stormExpected of [false, true]) {
      const plan = buildPowerPlan({ ...home, preference, stormExpected });
      const d = get(plan, "DISCHARGE_BATTERY");
      assert.ok((d.batteryAfterPercent ?? 100) >= plan.reservePercent - 1, `${preference} storm=${stormExpected}`);
    }
  }
});

test("storing solar happens before, and raises what the battery can share", () => {
  const withSolar = get(buildPowerPlan(home), "DISCHARGE_BATTERY");
  const without = get(buildPowerPlan({ ...home, solar: undefined }), "DISCHARGE_BATTERY");
  assert.ok(withSolar.kwh > without.kwh);
});

test("a storm puts backup first: no discharge, no generator, store or do nothing on top", () => {
  const plan = buildPowerPlan({ ...home, stormExpected: true });
  assert.equal(plan.reservePercent, 80);
  assert.equal(get(plan, "RUN_GENERATOR").recommended, false);
  assert.ok(["STORE_SOLAR", "NO_ACTION", "SHIFT_LOAD"].includes(plan.actions[0].kind));
  assert.notEqual(plan.actions[0].kind, "DISCHARGE_BATTERY");
});

test("preference changes the ranking", () => {
  const earnings = buildPowerPlan({ ...home, preference: "earnings" });
  const backup = buildPowerPlan({ ...home, preference: "backup" });
  assert.equal(earnings.actions[0].kind, "DISCHARGE_BATTERY");
  assert.notEqual(backup.actions[0].kind, "DISCHARGE_BATTERY");
  assert.ok(earnings.expectedEarnings > backup.expectedEarnings);
});

test("generator is not recommended when fuel costs more than the payment", () => {
  const plan = buildPowerPlan({ ...home, event: { pricePerKwh: 0.2, durationHours: 1.5 } });
  const g = get(plan, "RUN_GENERATOR");
  assert.equal(g.recommended, false);
  assert.equal(g.score, 0);
  assert.equal(g.earnings, 0);
});

test("battery below the user's minimum rate is not offered", () => {
  const plan = buildPowerPlan({ ...home, event: { pricePerKwh: 0.1, durationHours: 1 } });
  assert.equal(get(plan, "DISCHARGE_BATTERY").recommended, false);
});

test("a home with no devices can still shift load or do nothing", () => {
  const plan = buildPowerPlan({
    preference: "balanced",
    stormExpected: false,
    event: { pricePerKwh: 0.14, durationHours: 1 },
  });
  assert.deepEqual(kinds(plan).sort(), ["NO_ACTION", "SHIFT_LOAD"]);
  assert.equal(plan.actions[0].kind, "SHIFT_LOAD");
});

test("generator carries the interconnection caveat", () => {
  assert.match(get(buildPowerPlan(home), "RUN_GENERATOR").caveat ?? "", /interconnection/);
});

test("backup preference keeps generator fuel in reserve", () => {
  const g = get(buildPowerPlan({ ...home, preference: "backup" }), "RUN_GENERATOR");
  assert.equal(g.recommended, false);
});
