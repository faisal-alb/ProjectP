import { type Address, type Signature, type TransactionSigner } from "@solana/kit";

import { sendInstructions, type GridflexClient } from "./client";
import { fetchMaybeConfig, findConfigPda, getInitializeConfigInstructionAsync } from "./generated";

/** One-time program setup: which mint is USDC and who verifies delivery. */
export async function initializeConfig(
  client: GridflexClient,
  admin: TransactionSigner,
  verifier: Address,
): Promise<Signature | null> {
  const [config] = await findConfigPda();
  const existing = await fetchMaybeConfig(client.rpc, config);
  if (existing.exists) return null;
  return sendInstructions(client, admin, [
    await getInitializeConfigInstructionAsync({ admin, usdcMint: client.usdcMint, verifier }),
  ]);
}
