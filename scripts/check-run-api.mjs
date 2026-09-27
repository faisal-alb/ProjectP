/** Presenter/session integration checks. Leaves a fresh, paused stress day. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const base = process.env.RUN_API_URL ?? "http://localhost:8787";
const snapshot = async () =>
  (await (await fetch(base + "/runs/current")).json()).run;
const original = await snapshot();
assert.ok(
  !original ||
    (["paused", "completed"].includes(original.status) &&
      original.events.every((e) =>
        ["completed", "canceled"].includes(e.phase),
      )),
  "Finish current commitments before API integration checks.",
);
const code =
  process.env.PRESENTER_ACCESS_CODE ??
  readFileSync(".data/presenter-code", "utf8").trim();
const unlock = await fetch(base + "/runs/unlock", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code }),
});
assert.equal(unlock.status, 200);
const { token } = await unlock.json();
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};
async function control(action, value) {
  const r = await fetch(base + "/runs/control", {
    method: "POST",
    headers,
    body: JSON.stringify({ action, value }),
  });
  assert.equal(r.status, 200, await r.text());
}
for (const route of ["/runs/control", "/markets", "/faucet"]) {
  const r = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(r.status, 401, route + " allows unauthenticated mutation");
}
await control("pause");
await control("restart", "historical");
const before = await snapshot();
const analysis = await fetch(base + "/runs/what-if", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    zone: "downtown",
    reservePercent: 80,
    demandChangeKw: 40,
    priceCapPerKwh: 0.2,
  }),
});
assert.equal(analysis.status, 200);
const result = await analysis.json();
assert.equal(result.hypothetical, true);
assert.ok(result.decision);
assert.deepEqual(
  await snapshot(),
  before,
  "What-if changed authoritative state",
);
assert.equal((await fetch(base + "/runs/assistant")).status, 200);
await control("inject", "assistant-offline");
assert.equal((await fetch(base + "/runs/assistant")).status, 503);
assert.equal(
  (await snapshot()).coverage.find((c) => c.scenario === "assistant-offline")
    .status,
  "observed",
);
await control("restart", "stress");
writeFileSync(
  ".data/api-integration-report.json",
  JSON.stringify(
    {
      presenterAuthorization: "passed",
      whatIfIsolation: "passed",
      assistantOutage: "passed",
      readyRunId: (await snapshot()).id,
    },
    null,
    2,
  ),
);
console.log(
  "Authorization, copied-state analysis and assistant outage checks passed; fresh stress day ready.",
);
