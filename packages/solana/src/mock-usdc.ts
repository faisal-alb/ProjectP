import { generateKeyPairSigner, type Address, type Signature, type TransactionSigner } from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

import { sendInstructions, type GridflexClient } from "./client";
import { usdcAccount } from "./market";

/** Create a 6-decimal stand-in for USDC. Devnet/localnet only. */
export async function createMockUsdcMint(
  client: Omit<GridflexClient, "usdcMint">,
  payer: TransactionSigner,
  mintAuthority: Address,
): Promise<{ mint: Address; signature: Signature }> {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();
  const signature = await sendInstructions({ ...client, usdcMint: mint.address }, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({ mint: mint.address, decimals: 6, mintAuthority }),
  ]);
  return { mint: mint.address, signature };
}

/** Mint mock USDC to a wallet, creating its token account if needed. */
export async function mintMockUsdc(
  client: GridflexClient,
  payer: TransactionSigner,
  mintAuthority: TransactionSigner,
  owner: Address,
  amount: bigint,
): Promise<Signature> {
  return sendInstructions(client, payer, [
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer, owner, mint: client.usdcMint }),
    getMintToInstruction({
      mint: client.usdcMint,
      token: await usdcAccount(client, owner),
      mintAuthority,
      amount,
    }),
  ]);
}
