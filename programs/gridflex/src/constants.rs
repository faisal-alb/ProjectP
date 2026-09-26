use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const MARKET_SEED: &[u8] = b"market";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const COMMITMENT_SEED: &[u8] = b"commitment";

/// Energy is tracked in Wh; prices are USDC base units per kWh.
#[constant]
pub const WH_PER_KWH: u64 = 1_000;
