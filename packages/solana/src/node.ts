// Node-only helpers (filesystem). Import from "@gridflex/solana/node".
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";

import type { Cluster } from "./client";

/** Load a Solana CLI keypair file (JSON array of 64 bytes). */
export async function loadKeypairSigner(file: string, jsonEnvVar?: string): Promise<KeyPairSigner> {
  const inline = jsonEnvVar ? process.env[jsonEnvVar]?.trim() : undefined;
  const source = inline ? jsonEnvVar! : file;
  let json: string;
  if (inline) {
    json = inline;
  } else {
    try {
      json = readFileSync(file, "utf8");
    } catch {
      throw new Error(`Cannot read Solana keypair at ${file}. Mount the existing keypair file${jsonEnvVar ? ` or set ${jsonEnvVar} to its JSON array` : ""}.`);
    }
  }
  // Never include input or parser errors: they can expose private key bytes.
  let bytes: unknown;
  try { bytes = JSON.parse(json); } catch {
    throw new Error(`Invalid Solana keypair in ${source}: expected a JSON array of 64 bytes.`);
  }
  if (!Array.isArray(bytes) || bytes.length !== 64 ||
      !bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    throw new Error(`Invalid Solana keypair in ${source}: expected a JSON array of 64 bytes.`);
  }
  try {
    return await createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  } catch {
    throw new Error(`Invalid Solana keypair in ${source}: key bytes do not form a valid keypair.`);
  }
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
      deployer: await loadKeypairSigner(keyPath("deployer", "DEPLOYER_KEYPAIR_PATH"), "DEPLOYER_KEYPAIR_JSON"),
      verifier: await loadKeypairSigner(keyPath("verifier", "VERIFIER_KEYPAIR_PATH"), "VERIFIER_KEYPAIR_JSON"),
      mintAuthority: await loadKeypairSigner(keyPath("mint-authority", "MINT_AUTHORITY_KEYPAIR_PATH"), "MINT_AUTHORITY_KEYPAIR_JSON"),
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
