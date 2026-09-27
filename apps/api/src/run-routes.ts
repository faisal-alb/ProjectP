import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventEmitter } from "node:events";
import { activeFault, SCENARIOS, type RunState } from "@gridflex/shared";
import { config } from "./env";
import { RunEngine } from "./run-engine";
import { RunStore } from "./run-store";
import { runServices } from "./run-services";
import { allMarkets } from "./markets";
import { rateLimit } from "./rate-limit";

const updates = new EventEmitter();
updates.setMaxListeners(200);
const store = new RunStore(config.dataDir);
store.importLegacy(allMarkets());
// Fast-forwarding saves every simulated minute. Dashboards re-render the whole run per
// snapshot, so send at most one per interval, always ending on the latest state.
const SNAPSHOT_INTERVAL_MS = 120;
let lastSnapshot = 0;
let trailingSnapshot: NodeJS.Timeout | undefined;
let latest: RunState | undefined;
const publish = (state: RunState) => {
  latest = state;
  if (trailingSnapshot) return;
  const wait = SNAPSHOT_INTERVAL_MS - (Date.now() - lastSnapshot);
  const send = () => {
    trailingSnapshot = undefined;
    lastSnapshot = Date.now();
    updates.emit("snapshot", latest);
  };
  if (wait <= 0) send();
  else trailingSnapshot = setTimeout(send, wait);
};
export const runs = new RunEngine(store, runServices, publish);
runs.startWorker();
export const runRoutes = new Hono();
const sessions = new Map<string, number>();
const codeFile = path.join(config.dataDir, "presenter-code");
const accessCode = () =>
  process.env.PRESENTER_ACCESS_CODE ||
  (process.env.NODE_ENV !== "production" && existsSync(codeFile)
    ? readFileSync(codeFile, "utf8").trim()
    : "");
const constantEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
runRoutes.post(
  "/unlock",
  rateLimit({
    name: "presenter unlock",
    limit: 5,
    globalLimit: 50,
    windowMs: 60_000,
  }),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (
      !accessCode() ||
      typeof body.code !== "string" ||
      !constantEqual(body.code, accessCode())
    )
      return c.json({ error: "Presenter access denied." }, 401);
    const token = randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    return c.json({ token });
  },
);
export function isPresenter(header: string | undefined) {
  const token = header?.replace(/^Bearer /, "") ?? "";
  if ((sessions.get(token) ?? 0) <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}
runRoutes.get("/assistant", (c) => {
  if (runs.state && activeFault(runs.state, "assistant-offline")) {
    runs.evidence(
      "assistant-offline",
      "Assistant session rejected during service outage; deterministic explanations remain available.",
    );
    runs.save();
    return c.json(
      {
        error: "Assistant unavailable. The decision record remains available.",
      },
      503,
    );
  }
  return c.json({ available: true });
});
runRoutes.get("/current", (c) => c.json({ run: runs.state }));
runRoutes.get("/scenarios", (c) => c.json({ scenarios: SCENARIOS }));
runRoutes.get("/preflight", async (c) => {
  if (!isPresenter(c.req.header("Authorization")))
    return c.json({ error: "Presenter access required." }, 401);
  return c.json({ errors: await runs.preflight() });
});
runRoutes.post("/control", async (c) => {
  if (!isPresenter(c.req.header("Authorization")))
    return c.json({ error: "Presenter access required." }, 401);
  const { action, value } = await c.req.json();
  try {
    return c.json({ run: await runs.control(action, value) });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 409);
  }
});
runRoutes.get("/stream", (c) =>
  streamSSE(c, async (stream) => {
    const send = (s: RunState) => {
      void stream.writeSSE({
        id: `${s.id}:${s.version}`,
        event: "snapshot",
        data: JSON.stringify({ run: s }),
      });
    };
    updates.on("snapshot", send);
    if (runs.state) send(runs.state);
    const timer = setInterval(
      () => void stream.writeSSE({ event: "ping", data: "{}" }),
      20_000,
    );
    await new Promise<void>((resolve) =>
      stream.onAbort(() => {
        clearInterval(timer);
        updates.off("snapshot", send);
        resolve();
      }),
    );
  }),
);
runRoutes.get("/:id/history", (c) => {
  const row = store.db
    .prepare("SELECT state FROM runs WHERE id=?")
    .get(c.req.param("id")) as { state: string } | undefined;
  return row
    ? c.json({ run: JSON.parse(row.state) })
    : c.json({ error: "Run not found" }, 404);
});
runRoutes.post(
  "/what-if",
  rateLimit({
    name: "analysis",
    limit: 20,
    globalLimit: 100,
    windowMs: 60_000,
  }),
  async (c) => {
    if (!runs.state) return c.json({ error: "No active run." }, 409);
    const input = await c.req.json();
    const copy = structuredClone(runs.state);
    if (
      typeof input.priceCapPerKwh === "number" &&
      Number.isFinite(input.priceCapPerKwh)
    )
      copy.priceCapPerKwh = Math.max(0.01, Math.min(1, input.priceCapPerKwh));
    const zone = copy.zones.find((z) => z.id === input.zone)?.id ?? "downtown";
    const delta = Math.max(
      -50,
      Math.min(50, Number(input.demandChangeKw) || 0),
    );
    copy.zones.find((z) => z.id === zone)!.loadKw += delta;
    for (const d of copy.devices) {
      if (d.id === input.offlineResource) d.available = false;
      if (Number.isFinite(input.reservePercent))
        d.reserve = Math.max(0.1, Math.min(1, input.reservePercent / 100));
    }
    return c.json({
      hypothetical: true,
      runId: copy.id,
      version: copy.version,
      decision: await runServices.decide(copy, zone),
    });
  },
);
