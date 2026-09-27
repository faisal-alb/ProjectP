/** Full-day integration rehearsal against the running API, with actual devnet settlement.
 * Starts only when no commitments are outstanding; preserves every earlier run.
 * RUN_SOAK=1 uses the real-time worker for a 24-hour soak instead of stepping.
 */
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.RUN_API_URL ?? "http://localhost:8787";
const code =
  process.env.PRESENTER_ACCESS_CODE ??
  readFileSync(".data/presenter-code", "utf8").trim();
const unlock = await fetch(base + "/runs/unlock", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code }),
});
const { token } = await unlock.json();
if (!token) throw Error("Presenter unlock failed");
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
async function action(action, value) {
  const r = await fetch(base + "/runs/control", {
    method: "POST",
    headers,
    body: JSON.stringify({ action, value }),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error);
  return d.run;
}
await action("pause");
let run =
  process.env.RUN_RESUME === "1"
    ? (await (await fetch(base + "/runs/current")).json()).run
    : await action("restart", "stress");
const began = Date.now();
if (process.env.RUN_SOAK === "1") {
  await action("speed", 1);
  await action("start", "once");
}
while (run.minute < 1440) {
  if (process.env.RUN_SOAK === "1") {
    await new Promise((r) => setTimeout(r, 30_000));
    run = (await (await fetch(base + "/runs/current")).json()).run;
  } else run = await action("step", 60);
  console.log(
    JSON.stringify({
      minute: run.minute,
      events: run.events.length,
      completed: run.events.filter((e) =>
        ["completed", "canceled"].includes(e.phase),
      ).length,
    }),
  );
}
if (run.status !== "completed") await action("start", "once");
const deadline = Date.now() + 10 * 60_000;
while (run.status !== "completed" && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 1000));
  run = (await (await fetch(base + "/runs/current")).json()).run;
}
const report = {
  runId: run.id,
  mode: process.env.RUN_SOAK === "1" ? "real-time" : "stepped",
  elapsedSeconds: (Date.now() - began) / 1000,
  status: run.status,
  events: run.events.map((e) => ({
    id: e.id,
    phase: e.phase,
    address: e.address,
    paidBase: e.commitments
      .reduce((n, c) => n + BigInt(c.paidBase ?? 0), 0n)
      .toString(),
    refundBase: e.refundBase,
    error: e.error,
  })),
  coverage: run.coverage,
};
writeFileSync(".data/rehearsal-report.json", JSON.stringify(report, null, 2));
if (run.status !== "completed")
  throw Error(
    "Rehearsal has unresolved commitments; inspect .data/rehearsal-report.json",
  );
console.log("Full day completed; report saved to .data/rehearsal-report.json");
