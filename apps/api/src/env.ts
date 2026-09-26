import path from "node:path";
import { randomBytes } from "node:crypto";
import { address } from "@solana/kit";
import { createGridflexClient, explorerUrl } from "@gridflex/solana";
import { loadSolanaEnv } from "@gridflex/solana/node";

export const root = path.resolve(import.meta.dirname, "../../..");
const env = loadSolanaEnv(root);
export const { cluster, rpcUrl } = env;

if (!process.env.USDC_MINT) {
  throw new Error(
    `USDC_MINT is not set for ${cluster}. Start a validator and run \`npm run solana:setup\` first.`,
  );
}

// Managed household wallets are encrypted with this key. Generated once per
// cluster for local development; set it explicitly anywhere real.
if (!process.env.WALLET_ENCRYPTION_KEY) {
  if (cluster === "mainnet-beta") throw new Error("WALLET_ENCRYPTION_KEY must be set on mainnet.");
  env.setEnvValue(env.clusterEnvFile, "WALLET_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  console.log(`Generated WALLET_ENCRYPTION_KEY → ${env.clusterEnvFile}`);
}

export const config = {
  port: Number(process.env.API_PORT ?? 8787),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  encryptionKey: Buffer.from(process.env.WALLET_ENCRYPTION_KEY!, "base64"),
  dataDir: path.join(root, ".data"),
};

export const keys = await env.loadKeys();
export const client = createGridflexClient({ rpcUrl, cluster, usdcMint: address(process.env.USDC_MINT) });

export const txUrl = (signature: string | undefined) =>
  signature ? explorerUrl("tx", signature, cluster, rpcUrl) : undefined;
export const addressUrl = (value: string) => explorerUrl("address", value, cluster, rpcUrl);
