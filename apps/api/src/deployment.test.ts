import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Hono } from "hono";
import { writeFileAtomic } from "./files";
import { loadKeypairSigner } from "@gridflex/solana/node";

process.env.TRUST_PROXY = "1";
const { clientIp, rateLimit } = await import("./rate-limit");

test("service keypairs support inline secrets and file fallback with safe errors", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "gridflex-keys-"));
  const variable = "GRIDFLEX_TEST_KEYPAIR_JSON";
  const previous = process.env[variable];
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const bytes = [...privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32),
      ...publicKey.export({ format: "der", type: "spki" }).subarray(-32)];
    const file = path.join(dir, "test.keypair.json");
    writeFileSync(file, JSON.stringify(bytes), { mode: 0o600 });
    const fromFile = await loadKeypairSigner(file);
    process.env[variable] = JSON.stringify(bytes);
    assert.equal((await loadKeypairSigner(path.join(dir, "missing"), variable)).address, fromFile.address);
    process.env[variable] = " ";
    assert.equal((await loadKeypairSigner(file, variable)).address, fromFile.address);
    await assert.rejects(loadKeypairSigner(path.join(dir, "missing"), variable), /Mount the existing keypair file or set GRIDFLEX_TEST_KEYPAIR_JSON/);
    for (const invalid of ["private-secret-not-json", "[]", JSON.stringify(Array(64).fill(256)),
      JSON.stringify(Array(64).fill(0.5)), JSON.stringify(Array(64).fill(0))]) {
      process.env[variable] = invalid;
      await assert.rejects(loadKeypairSigner(file, variable), error => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Invalid Solana keypair in GRIDFLEX_TEST_KEYPAIR_JSON/);
        assert.ok(!error.message.includes(invalid));
        return true;
      });
    }
  } finally {
    if (previous === undefined) delete process.env[variable];
    else process.env[variable] = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

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
