import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Hono } from "hono";
import { writeFileAtomic } from "./files";

process.env.TRUST_PROXY = "1";
const { clientIp, rateLimit } = await import("./rate-limit");

test("proxy identity ignores spoofed prefix; limits cover clients and global spend", async () => {
  const app = new Hono();
  app.use("*", rateLimit({ name: "test", limit: 2, globalLimit: 3, windowMs: 60_000 }));
  app.get("/", c => c.text(clientIp(c)));
  const request = (ip: string) => app.request("/", { headers: { "x-forwarded-for": ip } });
  assert.equal(await (await request("spoof, real")).text(), "real");
  assert.equal((await request("other-spoof, real")).status, 200);
  const limited = await request("third-spoof, real");
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal((await request("second-client")).status, 200);
  assert.equal((await request("third-client")).status, 429);
});

test("expired rate windows allow requests again", async () => {
  const app = new Hono();
  app.use("*", rateLimit({ name: "test", limit: 1, windowMs: 10 }));
  app.get("/", c => c.text("ok"));
  assert.equal((await app.request("/")).status, 200);
  assert.equal((await app.request("/")).status, 429);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await app.request("/")).status, 200);
});

test("state replacement leaves complete private JSON and no temporary files", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-state-"));
  try {
    const file = path.join(dir, "wallets.json");
    writeFileAtomic(file, JSON.stringify({ version: 1 }), 0o600);
    writeFileAtomic(file, JSON.stringify({ version: 2 }), 0o600);
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { version: 2 });
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.deepEqual(readdirSync(dir), ["wallets.json"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
