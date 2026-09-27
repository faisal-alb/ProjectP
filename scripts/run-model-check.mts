/** Whole-day model/physics validation without submitting chain transactions. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { RunEngine } from "../apps/api/src/run-engine";
import { RunStore } from "../apps/api/src/run-store";
import { virtualAt, type Decision, type RunBundle } from "@gridflex/shared";
const bundle = JSON.parse(
  readFileSync("ml/artifacts/run/bundle.json", "utf8"),
) as RunBundle;
const dir = mkdtempSync(path.join(tmpdir(), "gridflex-model-check-"));
const store = new RunStore(dir);
try {
  const engine = new RunEngine(store, {
    bundle: async () => bundle,
    preflight: async () => [],
    decide: async (run, zone) => {
      const r = await fetch("http://localhost:8000/run/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          at: virtualAt(run),
          minute: run.minute,
          zone,
          devices: run.devices.filter((d) => d.zone === zone),
          state: run.zones.find((z) => z.id === zone),
          environment: run.environment,
          faults: run.faults
            .filter((f) => f.until > run.minute)
            .map((f) => f.id),
        }),
      });
      if (!r.ok) throw Error(await r.text());
      return (await r.json()) as Decision;
    },
    settle: async (s, e) => {
      if (e.phase === "scheduled") {
        e.phase = "dispatching";
        for (const c of e.commitments) {
          const d = s.devices.find((d) => d.id === c.resourceId)!;
          d.eventsToday++;
        }
      } else if (e.phase === "verifying" || e.phase === "settling") {
        if (e.commitments.some((c) => c.missing))
          throw Error("Awaiting 1 validated interval readings");
        for (const c of e.commitments)
          c.paidBase = String(
            Math.floor(Math.min(c.committedWh, c.deliveredWh) * c.price * 1000),
          );
        e.phase = e.canceled ? "canceled" : "completed";
      }
    },
  });
  await engine.restart("stress");
  for (let i = 0; i < 1440; i++) {
    await engine.advance();
    // Remove wall-clock backoff only in this synchronous chain test double.
    for (const e of engine.state!.events) e.retryAt = undefined;
    await engine.reconcile();
    if (i % 120 === 0) console.log(`Model day: ${i}/1440 minutes`);
  }
  const s = engine.state!;
  if (
    s.status !== "completed" ||
    s.events.some((e) => !["completed", "canceled"].includes(e.phase))
  )
    throw Error("Model day has unresolved commitments");
  if (s.devices.some((d) => d.eventsToday > d.maxEventsPerDay))
    throw Error("Daily participation limit exceeded");
  if (
    s.events.some(
      (e) =>
        e.commitments.reduce((n, c) => n + c.committedWh, 0) >
        Math.ceil(e.requiredKw * 1000),
    )
  )
    throw Error("Overcommitted energy");
  if (
    s.devices.some(
      (d) =>
        d.energyKwh < 0 || d.energyKwh > d.capacityKwh + 1e-8 || d.fuelKwh < 0,
    )
  )
    throw Error("Energy conservation violated");
  writeFileSync(
    ".data/model-day-report.json",
    JSON.stringify(
      {
        minute: s.minute,
        decisions: s.decisions.length,
        events: s.events.length,
        coverage: s.coverage,
        devices: s.devices,
      },
      null,
      2,
    ),
  );
  console.log(
    "Full day of real model inference and physical constraints passed. No chain transactions submitted.",
  );
} finally {
  store.close();
  rmSync(dir, { recursive: true, force: true });
}
