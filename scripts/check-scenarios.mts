/** Exercise every injected branch with real inference and a fault-aware chain test double. */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  SCENARIOS,
  activeFault,
  virtualAt,
  type Decision,
  type RunBundle,
} from "@gridflex/shared";
import { RunEngine } from "../apps/api/src/run-engine";
import { RunStore } from "../apps/api/src/run-store";
const bundle = JSON.parse(
  readFileSync("ml/artifacts/run/bundle.json", "utf8"),
) as RunBundle;
const report = [];
for (const scenario of SCENARIOS) {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-scenario-"));
  const store = new RunStore(dir);
  try {
    const engine = new RunEngine(store, {
      bundle: async () => bundle,
      preflight: async () => [],
      decide: async (s, zone) => {
        const response = await fetch("http://localhost:8000/run/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            at: virtualAt(s),
            minute: s.minute,
            zone,
            devices: s.devices.filter((d) => d.zone === zone),
            state: s.zones.find((z) => z.id === zone),
            environment: s.environment,
            faults: s.faults.filter((f) => f.until > s.minute).map((f) => f.id),
          }),
        });
        if (!response.ok) return null;
        return (await response.json()) as Decision;
      },
      settle: async (s, e) => {
        for (const f of [
          "rpc-timeout",
          "insufficient-funds",
          "expired-transaction",
          "delayed-confirmation",
          "partial-batch",
        ])
          if (activeFault(s, f)) throw Error("Settlement pending: " + f);
        if (e.phase === "scheduled") e.phase = "dispatching";
        else if (e.phase === "verifying" || e.phase === "settling") {
          if (e.commitments.some((c) => c.missing))
            throw Error("Awaiting 1 validated interval readings");
          for (const c of e.commitments)
            c.paidBase = String(
              Math.floor(
                Math.min(c.committedWh, c.deliveredWh) * c.price * 1000,
              ),
            );
          e.phase = e.canceled ? "canceled" : "completed";
        }
      },
    });
    await engine.restart("historical");
    engine.state!.minute = 990;
    engine.inject("peak");
    // Delivery faults need existing commitments; eligibility faults act before selection.
    const delivery = [
      "missing-readings",
      "stale-readings",
      "duplicate-readings",
      "implausible-readings",
      "under-delivery",
      "over-delivery",
      "zero-delivery",
      "cancel-event",
      "device-offline",
      "hvac-limit",
      "generator-limit",
    ];
    if (delivery.includes(scenario.id)) {
      await engine.advance();
      await engine.reconcile();
    }
    engine.inject(scenario.id);
    for (let i = 0; i < 75; i++) {
      await engine.advance();
      for (const e of engine.state!.events) e.retryAt = undefined;
      await engine.reconcile();
    }
    const s = engine.state!;
    assert.ok(
      s.devices.every(
        (d) =>
          d.energyKwh >= 0 &&
          d.energyKwh <= d.capacityKwh + 1e-8 &&
          d.fuelKwh >= 0,
      ),
      scenario.id + " violates energy bounds",
    );
    assert.ok(
      s.events.every(
        (e) =>
          e.commitments.reduce((sum, c) => sum + c.committedWh, 0) <=
          Math.ceil(e.requiredKw * 1000),
      ),
      scenario.id + " overcommits",
    );
    assert.ok(
      s.events.every((e) =>
        e.commitments.every(
          (c) => Number(c.paidBase ?? 0) <= c.committedWh * c.price * 1000 + 1,
        ),
      ),
      scenario.id + " overpays",
    );
    const coverage = s.coverage.find((c) => c.scenario === scenario.id)!;
    if (scenario.id !== "assistant-offline")
      assert.equal(
        coverage.status,
        "observed",
        scenario.id + " has no observable result",
      );
    else
      assert.ok(
        s.log.some(
          (l) =>
            l.type === "scenario.injected" &&
            l.scenario === "assistant-offline",
        ),
      );
    report.push({
      scenario: scenario.id,
      status: "passed",
      evidence: coverage.evidence,
      scope:
        scenario.id === "assistant-offline"
          ? "fault lifetime; session-denial tested through API"
          : "model, physics and chain test double",
    });
    console.log(scenario.id + ": passed");
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
writeFileSync(".data/scenario-report.json", JSON.stringify(report, null, 2));
