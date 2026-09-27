# Solana settlement

The `gridflex` program and the API's use of it. Solana covers a small, defensible part of the system: **commitment, auditability and settlement, paid in USDC**.

Grid telemetry and forecasting stay off-chain. What goes on-chain is the money and the promises around it: the operator's escrow, each accepted commitment, each verified delivery, each payout, and the refund.

## How a flexibility event settles

```text
Grid operator wallet                GridFlex API (verifier key)            Program (gridflex)
────────────────────                ───────────────────────────            ──────────────────
sign create_market  ─────────────►  broadcast ──────────────────────────►  USDC → market vault
                                    clear market off-chain (cheapest first)
                                    accept_commitment × N ──────────────►  Commitment accounts
                                    meter data → proof hash
                                    verify_delivery × N ────────────────►  payable = min(delivered, committed)
                                    settle_commitment × N ──────────────►  vault → each participant
                                    close_market ───────────────────────►  rest of vault → operator
```

The operator signs exactly one transaction (the escrow). Everything after that is signed by the GridFlex verifier key held by the API.

Demo numbers (Downtown Miami, 800 kW for 1 hour, $0.20/kWh cap): **$160.00 escrowed**, **$93.60 paid** to 24 participants (20 of them individual homes), **$66.40 refunded**. The demo household is paid **$0.70** (5 kWh × $0.14).

## Units

Everything on-chain is an integer:

| Quantity | Unit | Example |
|---|---|---|
| Energy | Wh (`u64`) | 800 kW × 1 h = `800_000` |
| USDC | base units, 6 decimals (`u64`) | $160.00 = `160_000_000` |
| Price | USDC base units per kWh (`u64`) | $0.14/kWh = `140_000` |

`payout = wh × price / 1000`, computed in `u128`, floored. The TypeScript side mirrors this exactly in `packages/shared/src/units.ts` (`payoutBase`, `minEscrowBase`), and a test checks the two agree for the demo market.

## Accounts

| Account | Seeds | Holds |
|---|---|---|
| `Config` | `["config"]` | `admin`, `verifier`, `usdc_mint` |
| `Market` | `["market", authority, market_id (u64 LE)]` | zone hash, required Wh, price cap, window, status, escrow / reserved / paid amounts, committed Wh, open commitment count |
| Vault (token account) | `["vault", market]` | the escrowed USDC; authority is the market PDA |
| `Commitment` | `["commitment", market, resource_hash]` | participant wallet, committed Wh, price, delivered Wh, payable Wh, proof hash, status |

`zone_hash` and `resource_hash` are SHA-256 of the off-chain ids (`packages/solana/src/ids.ts`). Market and commitment accounts stay open after settlement as the audit record; only the vault is closed.

## Instructions

Names from the [model orchestration spec](model-orchestration.md) are in brackets.

| Instruction | Signer | What it does |
|---|---|---|
| `initialize_config(verifier)` | admin (once) | Records the verifier and which mint is USDC. |
| `set_verifier(verifier)` | admin | Rotates the verifier key. |
| `create_market(...)` [`open_event`] | operator | Moves `deposit` USDC into the vault. Requires `deposit ≥ required_wh × max_price / 1000`. |
| `accept_commitment(resource_hash, participant, wh, price)` | market authority **or** verifier | Records an accepted offer. Enforces `price ≤ cap`, total committed `≤ required`, total reserved `≤ escrow`. Rejected once verification starts. |
| `verify_delivery(delivered_wh, proof_hash)` [`submit_contribution`] | verifier only | Stores the metered delivery and `payable = min(delivered, committed)`. Once per commitment. |
| `settle_commitment()` [`claim_payout`] | anyone | Pays the participant from the vault. Once per commitment. Amount and recipient are fixed on-chain, which is why it can be permissionless. |
| `close_market()` [`close_event`] | market authority or verifier | Needs every commitment paid. Refunds the vault to the operator and closes it. With no commitments this is a cancellation, which only the authority may do. |

Source: `programs/gridflex/src/`. Events are emitted for every step (`MarketCreated`, `CommitmentAccepted`, `DeliveryVerified`, `CommitmentSettled`, `MarketClosed`).

## USDC

The program never hardcodes a mint: `Config.usdc_mint` decides what counts as USDC, and every token account is checked against it.

- **localnet / devnet:** a 6-decimal **mock USDC** mint that `npm run solana:setup` creates. The mint authority is `.keys/mint-authority.keypair.json`, so the faucet can hand out test USDC freely.
- **Production:** initialize the config with the real USDC mint (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` on mainnet). No code changes; the faucet refuses to run on mainnet.

## Wallets

- **Grid operator:** connects Phantom, Solflare or any Wallet Standard wallet (header, or the USDC escrow card at the top of the dashboard) and signs the escrow transaction. The wallet only signs; the API broadcasts it to its own RPC, so the same flow works on localnet and devnet.
- **Households and other participants:** wallets created and held by GridFlex (`apps/api/src/wallets.ts`). Payouts only need the address. The 32-byte seed is stored AES-256-GCM encrypted (`WALLET_ENCRYPTION_KEY`) in `.data/wallets.<cluster>.json`, ready for a future "withdraw to my own wallet" feature.
- **Service keys** (`.keys/`, gitignored): `deployer` (program upgrade authority, config admin, faucet funder), `verifier` (signs commitments, verification, settlement; pays those fees), `mint-authority` (mock USDC).

## Trust model (v1)

The verifier is trusted: it matches offers, reports meter readings, and triggers payment. The program guarantees the rest — the operator can never be charged more than the escrow, nobody is paid more than they committed, nobody is paid twice, and the remainder always returns to the operator.

Known follow-ups:

- Enforce the market window on-chain (`now ≥ end_ts` before verification). v1 skips it so demos can verify immediately.
- Replace the trusted verifier with signed meter data (per-device keys, utility feeds, or an oracle), as the orchestration spec's `meter_signature` anticipates.

## Running it

Tools: Rust (rustup), the Solana CLI (Agave), Anchor 1.1.2 via `avm`. Versions are pinned in `rust-toolchain.toml`, `Anchor.toml` and `programs/gridflex/Cargo.toml`.

### Build and test the program

```bash
anchor build                  # builds, writes target/idl + target/types
cargo test -p gridflex        # 12 LiteSVM tests: lifecycle + every failure path
npm run solana:generate       # regenerate packages/solana/src/generated from the IDL
```

### Local end to end

```bash
solana-test-validator --reset --ledger test-ledger \
  --bpf-program A7ocTy3qXyedzhxVDcyGbAyN6rNvu69XP9NnDAy4QWaf target/deploy/gridflex.so

npm run solana:setup          # fund keys, create mock USDC, init config → .env.localnet
npm run solana:demo           # the known-good flow, no UI, balances asserted
npm run dev                   # API on :8787 + web on :3000
npm run solana:api-smoke      # same flow over HTTP
npm run e2e -w web            # same flow in a browser with a test wallet (WEB_URL to target another port)
```

### Devnet

```bash
solana airdrop 2 $(solana-keygen pubkey .keys/deployer.keypair.json) -u devnet
#   rate-limited? use https://faucet.solana.com (about 3 SOL needed)
anchor deploy --provider.cluster devnet
SOLANA_CLUSTER=devnet npm run solana:setup
SOLANA_CLUSTER=devnet npm run solana:demo
SOLANA_CLUSTER=devnet npm run dev
```

Set Phantom to devnet, open `/onboarding`, choose **Set up your grid** and click through the setup, connect a wallet in the USDC escrow card, use **Get test USDC**, then **Fund request**. To see the payout land in the household's header wallet, sign out from the account menu and choose **Provide flexibility**.

Current devnet deployment:

| | Address |
|---|---|
| Program | `A7ocTy3qXyedzhxVDcyGbAyN6rNvu69XP9NnDAy4QWaf` (upgrade authority: `.keys/deployer`) |
| Mock USDC mint | `CNSgJz5KExDyzAqnkmSy4BYVdwzQszxGzKmB4Fuw4jRx` |
| Verifier | `6EQXfQ2sGz4rukeyFPUiMBGNtpsTM7KaqYFc1oLbqKX7` |

### Reliability on public RPC

Public devnet RPC rate-limits bursts and drops WebSocket connections, so the client (`packages/solana/src/client.ts`):

- retries HTTP 429 responses with exponential backoff;
- confirms transactions by polling signature status over HTTP (re-sending the same signed transaction until it lands or its blockhash expires) instead of WebSocket subscriptions.

Each API lifecycle step reads on-chain state first and only acts on commitments that still need it, so a step that failed halfway (for example, some payouts landed before a network error) can simply be run again. The program's own checks (a commitment can't be verified or paid twice) back this up.

Keep `npm run solana:demo` working at all times: it's the fallback if the UI or API breaks during a demo.

## Out of scope

These distract from the grid problem, so the program doesn't include them: on-chain forecasting, on-chain smart-meter data, complex bid order books, token governance, custom tokenomics, staking, NFTs and DAO voting.
