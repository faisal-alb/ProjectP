// Shared setup for the Solana scripts: loads `.env` then `.env.<cluster>`
// from the repo root, and resolves keys, RPC, and the USDC mint.
import path from "node:path";
import { address, airdropFactory, lamports, type Address, type TransactionSigner } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { createGridflexClient, sendInstructions } from "@gridflex/solana";
import { loadSolanaEnv } from "@gridflex/solana/node";

export const root = path.resolve(import.meta.dirname, "../..");
const env = loadSolanaEnv(root);
export const { cluster, clusterEnvFile, rpcUrl, loadKeys, setEnvValue } = env;

export function requireMint(): Address {
  if (!process.env.USDC_MINT) {
    throw new Error(`USDC_MINT is not set. Run \`npm run solana:setup\` (SOLANA_CLUSTER=${cluster}) first.`);
  }
  return address(process.env.USDC_MINT);
}

export const client = (usdcMint: Address) => createGridflexClient({ rpcUrl, cluster, usdcMint });

const LAMPORTS_PER_SOL = 1_000_000_000n;

/** Top a wallet up to `minSol`: airdrop on localnet, transfer from `funder` elsewhere. */
export async function ensureSol(
  c: ReturnType<typeof client>,
  funder: TransactionSigner,
  recipient: Address,
  minSol: number,
) {
  const want = BigInt(Math.round(minSol * 1e9));
  const { value: balance } = await c.rpc.getBalance(recipient).send();
  if (balance >= want) return;
  if (cluster === "localnet") {
    await airdropFactory(c)({
      recipientAddress: recipient,
      lamports: lamports(want - balance + LAMPORTS_PER_SOL),
      commitment: "confirmed",
    });
  } else {
    await sendInstructions(c, funder, [
      getTransferSolInstruction({ source: funder, destination: recipient, amount: want - balance }),
    ]);
  }
}
