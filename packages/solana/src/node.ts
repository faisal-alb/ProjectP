// Node-only helpers (filesystem). Import from "@gridflex/solana/node".
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";

import type { Cluster } from "./client";

/** Load a Solana CLI keypair file (JSON array of 64 bytes). */
export async function loadKeypairSigner(file: string): Promise<KeyPairSigner> {
  const bytes = Uint8Array.from(JSON.parse(readFileSync(file, "utf8")) as number[]);
  return createKeyPairSignerFromBytes(bytes);
}

/**
 * Load `.env` then `.env.<cluster>` from the repo root (existing variables
 * win) and resolve the cluster, RPC URL and service keypair paths.
 */
export function loadSolanaEnv(root: string) {
  const load = (file: string) => {
    const full = path.join(root, file);
    if (existsSync(full)) process.loadEnvFile(full);
  };
  load(".env");
  const cluster = (process.env.SOLANA_CLUSTER ?? "localnet") as Cluster;
  const clusterEnvFile = `.env.${cluster}`;
  load(clusterEnvFile);

  const rpcUrl =
    process.env.SOLANA_RPC_URL ??
    (cluster === "devnet" ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899");
  const keyPath = (name: string, envVar: string) =>
    path.resolve(root, process.env[envVar] ?? `.keys/${name}.keypair.json`);

  return {
    cluster,
    clusterEnvFile,
    rpcUrl,
    loadKeys: async () => ({
      deployer: await loadKeypairSigner(keyPath("deployer", "DEPLOYER_KEYPAIR_PATH")),
      verifier: await loadKeypairSigner(keyPath("verifier", "VERIFIER_KEYPAIR_PATH")),
      mintAuthority: await loadKeypairSigner(keyPath("mint-authority", "MINT_AUTHORITY_KEYPAIR_PATH")),
    }),
    /** Write or replace KEY=value in a repo-root env file. */
    setEnvValue(file: string, key: string, value: string) {
      const full = path.join(root, file);
      const lines = existsSync(full) ? readFileSync(full, "utf8").split("\n").filter(Boolean) : [];
      writeFileSync(full, [...lines.filter((l) => !l.startsWith(`${key}=`)), `${key}=${value}`].join("\n") + "\n");
      process.env[key] = value;
    },
  };
}
