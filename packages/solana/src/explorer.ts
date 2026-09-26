import type { Cluster } from "./client";

/** A Solana Explorer link for a transaction or account. */
export function explorerUrl(kind: "tx" | "address", value: string, cluster: Cluster, rpcUrl?: string) {
  const base = `https://explorer.solana.com/${kind}/${value}`;
  if (cluster === "mainnet-beta") return base;
  if (cluster === "devnet") return `${base}?cluster=devnet`;
  return `${base}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl ?? "http://localhost:8899")}`;
}
