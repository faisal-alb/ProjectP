import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { virtualAt, type RunBundle } from "@gridflex/shared";
import { RunStore } from "./run-store";
import { RunEngine, type RunServices } from "./run-engine";
const bundle: RunBundle = {
  version: "test",
  start: "2024-08-20T05:00:00Z",
  end: "2024-08-21T05:00:00Z",
  sources: [
    {
      source: "test fixture",
      kind: "modeled",
      units: "kW",
      geography: "test",
      version: "1",
    },
  ],
  modelHealth: { test: "model" },
  points: Array.from({ length: 96 }, (_, i) => ({
    at: virtualAt({ start: "2024-08-20T05:00:00Z", minute: i * 15 }),
    priceMwh: 50,
    tempF: 95,
    humidity: 30,
    radiationWm2: 0,
    regionalLoadMw: 14000,
    homesKw: Array(50).fill(2),
    commercialKw: [10, 10, 10, 10],
  })),
};
const services: RunServices = {
  bundle: async () => bundle,
  preflight: async () => [],
  decide: async (s, zone) => ({
    id: "",
    at: virtualAt(s),
    zone,
    source: "test",
    modelVersion: "test",
    pSpike: 0.6,
    price: 0.3,
    requiredKw: 2,
    uncoveredKw: 0,
    dispatch: [
      {
        resourceId: s.devices.find((d) => d.zone === zone)!.id,
        kw: 2,
        price: 0.1,
        baselineKw: 2,
      },
    ],
    reasons: [],
    constraints: [],
    horizonKw: [60],
  }),
  settle: async (s, e) => {
    if (e.phase === "scheduled") {
      e.phase = "dispatching";
      e.startMinute = s.minute;
      e.endMinute = Math.min(1440, s.minute + 60);
    } else if (e.phase === "verifying") {
      if (e.commitments.some((c) => c.missing)) throw new Error("missing");
      e.phase = "completed";
      for (const c of e.commitments)
        c.paidBase = String(
          Math.floor(Math.min(c.committedWh, c.deliveredWh) * c.price * 1000),
        );
    }
  },
};

test("manual playback pauses and stops at each event transition without skipping delivery", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-manual-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, services);
    await engine.restart("historical");
    await engine.control("start");
    await engine.control("speed", 0);
    assert.equal(engine.state!.status, "paused");
    await assert.rejects(engine.control("start"), /manual playback/);
    await engine.control("next-event");
    assert.equal(engine.state!.minute, 1);
    assert.ok(engine.state!.events.every((e) => e.phase === "scheduled"));
    await engine.control("next-event");
    assert.equal(engine.state!.minute, 1);
    assert.ok(engine.state!.events.every((e) => e.phase === "dispatching"));
    await engine.control("next-event");
    assert.equal(engine.state!.minute, 61);
    assert.ok(engine.state!.events.every((e) => e.phase === "verifying"));
    assert.equal(engine.state!.events[0].commitments[0].samples, 60);
    await engine.control("next-event");
    assert.ok(engine.state!.events.every((e) => e.phase === "completed"));
    assert.equal(engine.state!.status, "paused");
    const restored = new RunEngine(store, services);
    assert.equal(restored.state!.speed, 0);
    await engine.control("speed", 24);
    await assert.rejects(engine.control("next-event"), /manual playback/);
    await engine.control("start");
    assert.equal(engine.state!.status, "running");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manual playback stops at scenarios and completes a quiet day", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-manual-quiet-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, {
      ...services,
      decide: async (s, zone) => ({ ...(await services.decide(s, zone))!, requiredKw: 0, dispatch: [] }),
    });
    await engine.restart("stress");
    await engine.control("speed", 0);
    await engine.control("next-event");
    assert.equal(engine.state!.minute, 121);
    assert.equal(engine.state!.log.filter((e) => e.type === "scenario.injected").at(-1)?.scenario, "demand-surge");
    await engine.restart("historical");
    await engine.control("speed", 0);
    await engine.control("next-event");
    assert.equal(engine.state!.minute, 1440);
    assert.equal(engine.state!.status, "completed");
    await engine.control("next-event");
    assert.equal(engine.state!.minute, 1440);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("manual playback honors readiness and pending transaction barriers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-manual-pending-"));
  const store = new RunStore(dir);
  let ready = false;
  try {
    const engine = new RunEngine(store, {
      ...services,
      preflight: async () => ready ? [] : ["RPC unavailable"],
      settle: async () => {},
    });
    await engine.restart("historical");
    await engine.control("speed", 0);
    await assert.rejects(engine.control("next-event"), /RPC unavailable/);
    assert.equal(engine.state!.minute, 0);
    ready = true;
    await engine.control("next-event");
    await assert.rejects(engine.control("next-event"), /Waiting for transaction confirmation/);
    assert.equal(engine.state!.minute, 1);
    assert.equal(engine.state!.status, "paused");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("24-hour run persists, drains, and isolates new-run earnings", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-run-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, services);
    await engine.restart("historical");
    for (let i = 0; i < 1440; i++) {
      await engine.advance();
      await engine.reconcile();
    }
    assert.equal(engine.state!.minute, 1440);
    assert.equal(engine.state!.status, "completed");
    assert.ok(engine.state!.events.length > 0);
    assert.ok(engine.state!.events.every((e) => e.phase === "completed"));
    const previous = engine.state!.id;
    await engine.restart();
    assert.notEqual(engine.state!.id, previous);
    assert.equal(engine.state!.events.length, 0);
    const restored = new RunEngine(store, services);
    assert.equal(restored.state!.status, "paused");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("quarantined readings recover once after a fault expires", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-meter-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, services);
    await engine.restart("historical");
    await engine.advance();
    await engine.reconcile();
    engine.inject("missing-readings");
    for (let i = 0; i < 17; i++) await engine.advance();
    const c = engine.state!.events[0].commitments[0];
    assert.equal(c.missing, 0);
    assert.equal(c.samples, 17);
    assert.equal(c.quarantined?.length, 0);
    assert.ok(
      engine.state!.coverage.find((c) => c.scenario === "missing-readings")!
        .evidence.length,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rounding never allocates more integer Wh than the market can accept", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-rounding-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, {
      ...services,
      decide: async (s, zone) => ({
        ...(await services.decide(s, zone))!,
        requiredKw: 1,
        dispatch: [
          {
            resourceId: s.devices[0].id,
            kw: 0.3336,
            price: 0.1,
            baselineKw: 2,
          },
          {
            resourceId: s.devices[1].id,
            kw: 0.3336,
            price: 0.1,
            baselineKw: 2,
          },
          {
            resourceId: s.devices[2].id,
            kw: 0.3336,
            price: 0.1,
            baselineKw: 2,
          },
        ],
      }),
    });
    await engine.restart("historical");
    await engine.advance();
    for (const e of engine.state!.events)
      assert.ok(
        e.commitments.reduce((sum, c) => sum + c.committedWh, 0) <= 1000,
      );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("what-if copies cannot alter authoritative device state and control inputs validate", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-control-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, services);
    await engine.restart();
    const copy = structuredClone(engine.state!);
    copy.devices[0].reserve = 0.9;
    assert.equal(engine.state!.devices[0].reserve, 0.2);
    await assert.rejects(
      engine.control("resource", {
        id: engine.state!.devices[0].id,
        reservePercent: 101,
      }),
    );
    await engine.control("resource", {
      id: engine.state!.devices[0].id,
      reservePercent: 80,
    });
    assert.equal(engine.state!.devices[0].reserve, 0.8);
    await assert.rejects(engine.control("price-cap", -1));
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cancellation preserves signed delivery window and settles completed intervals", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-cancel-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, services);
    await engine.restart("historical");
    await engine.advance();
    await engine.reconcile();
    const event = engine.state!.events[0];
    const window = [event.startMinute, event.endMinute];
    await engine.advance();
    engine.inject("cancel-event");
    assert.deepEqual([event.startMinute, event.endMinute], window);
    assert.equal(event.phase, "verifying");
    assert.ok(event.commitments[0].deliveredWh > 0);
    const delivered = event.commitments[0].deliveredWh;
    await engine.advance();
    assert.equal(event.commitments[0].deliveredWh, delivered);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
