# Solana Program Scope

## Objective

Use Solana for a small, defensible part of the system:

**commitment + auditability + settlement**

Do not put grid telemetry or forecasting on-chain.

---

# Suggested account

## FlexMarket

Conceptual fields:

```rust
pub struct FlexMarket {
    pub authority: Pubkey,
    pub zone_hash: [u8; 32],
    pub required_flex_wh: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub status: u8,
    pub total_committed_wh: u64,
    pub bump: u8,
}
```

Use integer units.

Avoid floating point.

---

# Suggested instructions

## create_market

Creates the market.

Inputs:

```text
zone hash
required flexibility
start time
end time
```

---

## accept_commitment

Records a participant/resource commitment.

Inputs:

```text
market
participant wallet
committed amount
price
resource hash/id
```

For the hackathon, the matching can happen off-chain.

The accepted result is recorded on-chain.

---

## verify_delivery

Called by the trusted hackathon verifier.

Inputs:

```text
commitment
delivered amount
proof hash
```

The proof hash can point to an off-chain verification payload.

---

## settle_market

Marks the commitment/market settled.

If implementing token payment becomes risky, use a simple SOL transfer or even record settlement state on-chain and clearly explain that production would use a stablecoin.

A functioning demo is more important than adding complicated token plumbing.

---

# What not to build

Do not build:

- on-chain forecasting
- on-chain smart-meter data
- complex bid order books
- token governance
- custom tokenomics
- staking
- NFTs
- DAO voting

They distract from the grid problem.

---

# Verification model

For the hackathon:

```text
Simulator
    ↓
Backend verifier
    ↓
Signed/authorized verification
    ↓
Solana program
```

The verifier is trusted.

This is acceptable because the demo is proving the market workflow.

Later versions could integrate:

- utility meter feeds
- trusted hardware
- decentralized oracle networks
- signed device telemetry

---

# Development safety

Test the program independently before wiring it into the full UI.

Suggested order:

1. create_market works
2. accept_commitment works
3. verify_delivery works
4. settle_market works
5. then connect API
6. then connect UI

Keep one known working script that can run the full Solana flow without the frontend.
