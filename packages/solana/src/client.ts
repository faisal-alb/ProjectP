import {
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createDefaultRpcTransport,
  createSolanaRpcFromTransport,
  createSolanaRpcSubscriptions,
  isSolanaError,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isTransactionMessageWithinSizeLimit,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
  type Address,
  type Instruction,
  type RpcTransport,
  type Signature,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";

export type Cluster = "localnet" | "devnet" | "mainnet-beta";

export interface GridflexClientConfig {
  rpcUrl: string;
  /** Defaults to the RPC URL with ws(s) and, for localhost, port + 1. */
  wsUrl?: string;
  cluster: Cluster;
  /** The token treated as USDC. On devnet/localnet this is our mock mint. */
  usdcMint: Address;
}

/**
 * Retry rate-limited requests (HTTP 429) with exponential backoff. Public
 * devnet RPC throttles bursts, e.g. a settlement touching 24 accounts.
 */
function withRateLimitRetry<T extends RpcTransport>(transport: T, attempts = 6): T {
  return (async (...args: Parameters<RpcTransport>) => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await transport(...args);
      } catch (error) {
        const rateLimited =
          isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR) && error.context.statusCode === 429;
        if (!rateLimited || attempt >= attempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }) as T;
}

export function createGridflexClient(config: GridflexClientConfig) {
  const rpc = createSolanaRpcFromTransport(
    withRateLimitRetry(createDefaultRpcTransport({ url: config.rpcUrl })),
  );
  // Only used for localnet airdrops; confirmations poll over HTTP (below).
  const rpcSubscriptions = createSolanaRpcSubscriptions(config.wsUrl ?? toWsUrl(config.rpcUrl));
  return { ...config, rpc, rpcSubscriptions };
}

export type GridflexClient = ReturnType<typeof createGridflexClient>;

function toWsUrl(rpcUrl: string) {
  const url = new URL(rpcUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (url.port) url.port = String(Number(url.port) + 1);
  return url.toString();
}

/** Sign with every signer attached to the instructions, send, and confirm. */
export async function sendInstructions(
  client: GridflexClient,
  feePayer: TransactionSigner,
  instructions: readonly Instruction[],
): Promise<Signature> {
  const { value: blockhash } = await client.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  assertIsSendableTransaction(signed);
  assertIsTransactionWithBlockhashLifetime(signed);
  return sendAndConfirmByPolling(client, signed, blockhash.lastValidBlockHeight);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send and wait for "confirmed" using HTTP only. Public RPC WebSockets
 * (which subscription-based confirmation needs) drop connections under load;
 * polling the signature status doesn't. The same signed transaction is
 * re-sent every few seconds until it lands or its blockhash expires, which
 * is safe because a signature can only be processed once.
 */
export async function sendAndConfirmByPolling(
  client: GridflexClient,
  transaction: Transaction,
  lastValidBlockHeight: bigint,
): Promise<Signature> {
  const signature = getSignatureFromTransaction(transaction);
  const wire = getBase64EncodedWireTransaction(transaction);
  // The first send runs preflight so program errors surface with their logs.
  await client.rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();

  for (let poll = 1; ; poll++) {
    await sleep(750);
    const { value } = await client.rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status?.err) {
      throw new Error(
        `Transaction ${signature} failed: ${JSON.stringify(status.err, (_, v) => (typeof v === "bigint" ? v.toString() : v))}`,
      );
    }
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
    if (poll % 4 === 0) {
      const height = await client.rpc.getBlockHeight({ commitment: "confirmed" }).send();
      if (height > lastValidBlockHeight) throw new Error(`Transaction ${signature} expired before confirming`);
      await client.rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: true }).send().catch(() => {});
    }
  }
}

/**
 * Pack instruction groups into as few transactions as fit under the size
 * limit (a group is never split), send them in order, and return each
 * group's transaction signature.
 */
export async function sendInstructionGroups(
  client: GridflexClient,
  feePayer: TransactionSigner,
  groups: readonly (readonly Instruction[])[],
): Promise<Signature[]> {
  const fits = (ixs: readonly Instruction[]) =>
    isTransactionMessageWithinSizeLimit(
      pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(feePayer, m),
        (m) => appendTransactionMessageInstructions(ixs, m),
      ),
    );

  const batches: { instructions: Instruction[]; groupIndexes: number[] }[] = [];
  groups.forEach((group, i) => {
    const current = batches[batches.length - 1];
    if (current && fits([...current.instructions, ...group])) {
      current.instructions.push(...group);
      current.groupIndexes.push(i);
    } else {
      if (!fits(group)) throw new Error(`Instruction group ${i} does not fit in one transaction`);
      batches.push({ instructions: [...group], groupIndexes: [i] });
    }
  });

  const signatures: Signature[] = new Array(groups.length);
  for (const batch of batches) {
    const signature = await sendInstructions(client, feePayer, batch.instructions);
    for (const i of batch.groupIndexes) signatures[i] = signature;
  }
  return signatures;
}
