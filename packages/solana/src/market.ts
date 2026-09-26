import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import {
  fetchMaybeToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";

import { sendInstructionGroups, sendInstructions, type GridflexClient } from "./client";
import {
  findCommitmentPda,
  findMarketPda,
  getAcceptCommitmentInstructionAsync,
  getCloseMarketInstructionAsync,
  getCreateMarketInstructionAsync,
  getSettleCommitmentInstructionAsync,
  getVerifyDeliveryInstructionAsync,
} from "./generated";
import { hash32 } from "./ids";

/** The owner's associated USDC token account. */
export async function usdcAccount(client: GridflexClient, owner: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    owner,
    mint: client.usdcMint,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return ata;
}

/** USDC balance in base units; 0 when the account doesn't exist yet. */
export async function getUsdcBalance(client: GridflexClient, owner: Address): Promise<bigint> {
  const account = await fetchMaybeToken(client.rpc, await usdcAccount(client, owner));
  return account.exists ? account.data.amount : 0n;
}

export interface CreateMarketParams {
  authority: Address;
  marketId: bigint;
  zoneId: string;
  requiredWh: bigint;
  /** USDC base units per kWh. */
  maxPrice: bigint;
  startTs: bigint;
  endTs: bigint;
  /** USDC base units to lock in escrow; at least requiredWh × maxPrice / 1000. */
  deposit: bigint;
}

async function createMarketInstruction(
  client: GridflexClient,
  authority: TransactionSigner,
  p: CreateMarketParams,
) {
  return getCreateMarketInstructionAsync({
    authority,
    usdcMint: client.usdcMint,
    authorityTokenAccount: await usdcAccount(client, p.authority),
    marketId: p.marketId,
    zoneHash: await hash32(p.zoneId),
    requiredWh: p.requiredWh,
    maxPrice: p.maxPrice,
    startTs: p.startTs,
    endTs: p.endTs,
    deposit: p.deposit,
  });
}

export async function marketAddress(authority: Address, marketId: bigint): Promise<Address> {
  const [market] = await findMarketPda({ authority, marketId });
  return market;
}

/**
 * An unsigned create_market transaction (base64 wire format) for the
 * operator's wallet to sign and send. The operator pays fees and rent.
 */
export async function buildCreateMarketTransaction(client: GridflexClient, p: CreateMarketParams) {
  const authority = createNoopSigner(p.authority);
  const ix = await createMarketInstruction(client, authority, p);
  const { value: blockhash } = await client.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(authority, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([ix], m),
  );
  return {
    transaction: getBase64EncodedWireTransaction(compileTransaction(message)),
    market: await marketAddress(p.authority, p.marketId),
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  };
}

/** Server-side create_market when the authority's key is available (scripts, tests). */
export async function createMarket(
  client: GridflexClient,
  authority: TransactionSigner,
  p: Omit<CreateMarketParams, "authority">,
) {
  const params = { ...p, authority: authority.address };
  const signature = await sendInstructions(client, authority, [
    await createMarketInstruction(client, authority, params),
  ]);
  return { signature, market: await marketAddress(authority.address, p.marketId) };
}

export interface CommitmentInput {
  resourceId: string;
  participant: Address;
  committedWh: bigint;
  /** USDC base units per kWh. */
  price: bigint;
}

export async function commitmentAddress(market: Address, resourceId: string): Promise<Address> {
  const [commitment] = await findCommitmentPda({ market, resourceHash: await hash32(resourceId) });
  return commitment;
}

/** Record accepted offers on-chain, packed into as few transactions as fit. */
export async function acceptCommitments(
  client: GridflexClient,
  signer: TransactionSigner,
  market: Address,
  items: readonly CommitmentInput[],
): Promise<{ resourceId: string; commitment: Address; signature: Signature }[]> {
  const groups = await Promise.all(
    items.map(async (item) => [
      await getAcceptCommitmentInstructionAsync({
        signer,
        market,
        resourceHash: await hash32(item.resourceId),
        participant: item.participant,
        committedWh: item.committedWh,
        price: item.price,
      }),
    ]),
  );
  const signatures = await sendInstructionGroups(client, signer, groups);
  return Promise.all(
    items.map(async (item, i) => ({
      resourceId: item.resourceId,
      commitment: await commitmentAddress(market, item.resourceId),
      signature: signatures[i],
    })),
  );
}

export interface DeliveryInput {
  commitment: Address;
  deliveredWh: bigint;
  /** The off-chain meter-reading payload; its SHA-256 is stored on-chain. */
  proof: string;
}

export async function verifyDeliveries(
  client: GridflexClient,
  verifier: TransactionSigner,
  market: Address,
  items: readonly DeliveryInput[],
): Promise<Signature[]> {
  const groups = await Promise.all(
    items.map(async (item) => [
      await getVerifyDeliveryInstructionAsync({
        verifier,
        market,
        commitment: item.commitment,
        deliveredWh: item.deliveredWh,
        proofHash: await hash32(item.proof),
      }),
    ]),
  );
  return sendInstructionGroups(client, verifier, groups);
}

/**
 * Pay verified commitments. Creates each participant's USDC account first if
 * needed (the payer covers that rent), so households never need to set up
 * anything themselves.
 */
export async function settleCommitments(
  client: GridflexClient,
  payer: TransactionSigner,
  market: Address,
  items: readonly { commitment: Address; participant: Address }[],
): Promise<Signature[]> {
  const groups = await Promise.all(
    items.map(async (item) => [
      await getCreateAssociatedTokenIdempotentInstructionAsync({
        payer,
        owner: item.participant,
        mint: client.usdcMint,
      }),
      await getSettleCommitmentInstructionAsync({
        usdcMint: client.usdcMint,
        market,
        commitment: item.commitment,
        participantTokenAccount: await usdcAccount(client, item.participant),
      }),
    ]),
  );
  return sendInstructionGroups(client, payer, groups);
}

/** Refund unused escrow to the market authority and close the vault. */
export async function closeMarket(
  client: GridflexClient,
  signer: TransactionSigner,
  market: Address,
  marketAuthority: Address,
): Promise<Signature> {
  return sendInstructions(client, signer, [
    await getCloseMarketInstructionAsync({
      signer,
      usdcMint: client.usdcMint,
      market,
      authorityTokenAccount: await usdcAccount(client, marketAuthority),
      marketAuthority,
    }),
  ]);
}
