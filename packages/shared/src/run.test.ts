import test from "node:test";
import assert from "node:assert/strict";
import { createDevices, evolveDevice, virtualAt } from "./run";

test("battery conserves energy including losses and cannot cross reserve", () => {
  const d = createDevices()[0];
  const before = d.energyKwh;
  let output = 0;
  for (let i = 0; i < 180; i++)
    output += evolveDevice(d, 5, 1000 + i, 98, 0, []).reliefKw / 60;
  assert.ok(d.energyKwh >= d.capacityKwh * d.reserve - 1e-9);
  assert.ok(Math.abs(before - d.energyKwh - output / 0.95) < 1e-8);
});
test("zero delivery does not inherit requested dispatch and solar cannot create energy at night", () => {
  const d = createDevices()[0];
  assert.equal(evolveDevice(d, 5, 1000, 95, 0, ["zero-delivery"]).reliefKw, 0);
  const solar = createDevices().find((d) => d.kind === "solar")!;
  assert.equal(evolveDevice(solar, 5, 0, 80, 0, []).reliefKw, 0);
});
test("EV departure and HVAC comfort limit constrain response", () => {
  const ev = createDevices().find((d) => d.kind === "ev")!;
  assert.equal(evolveDevice(ev, 7, 500, 90, 0, []).reliefKw, 0);
  const hvac = createDevices().find((d) => d.kind === "hvac")!;
  hvac.temperatureF = 80;
  assert.equal(evolveDevice(hvac, 5, 500, 98, 0, []).reliefKw, 0);
});
test("virtual clock crosses midnight without changing the real clock", () => {
  assert.equal(
    virtualAt({ start: "2024-08-20T05:00:00Z", minute: 1440 }),
    "2024-08-21T05:00:00.000Z",
  );
});
