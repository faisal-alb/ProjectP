use anchor_lang::prelude::*;

use crate::{constants::WH_PER_KWH, error::ErrorCode};

/// Program-wide settings: who may verify delivery and which mint is "USDC".
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub verifier: Pubkey,
    pub usdc_mint: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum MarketStatus {
    /// Escrow funded; commitments can be accepted.
    Open,
    /// Delivery is being verified and paid; no new commitments.
    Verifying,
    /// Every commitment paid (or none were made) and the remainder refunded.
    Closed,
}

/// One flexibility request for a zone and time window, with its USDC escrow.
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub market_id: u64,
    pub zone_hash: [u8; 32],
    pub required_wh: u64,
    /// Highest price the operator will pay, in USDC base units per kWh.
    pub max_price: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub status: MarketStatus,
    /// USDC deposited into the vault at creation.
    pub escrow_amount: u64,
    /// Worst-case payout of all accepted commitments.
    pub reserved_amount: u64,
    pub committed_wh: u64,
    pub paid_amount: u64,
    /// Commitments accepted but not yet paid.
    pub open_commitments: u32,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CommitmentStatus {
    Committed,
    Verified,
    Paid,
}

/// A resource's accepted offer within a market.
#[account]
#[derive(InitSpace)]
pub struct Commitment {
    pub market: Pubkey,
    /// Wallet that receives the payout.
    pub participant: Pubkey,
    pub resource_hash: [u8; 32],
    pub committed_wh: u64,
    /// USDC base units per kWh.
    pub price: u64,
    pub delivered_wh: u64,
    /// min(delivered, committed): delivery above the commitment isn't paid.
    pub payable_wh: u64,
    /// Hash of the off-chain meter-reading payload backing `delivered_wh`.
    pub proof_hash: [u8; 32],
    pub status: CommitmentStatus,
    pub bump: u8,
}

/// USDC owed for `wh` at `price` (base units per kWh). Floors.
pub fn payout(wh: u64, price: u64) -> Result<u64> {
    let amount = (wh as u128)
        .checked_mul(price as u128)
        .ok_or(ErrorCode::MathOverflow)?
        / WH_PER_KWH as u128;
    u64::try_from(amount).map_err(|_| ErrorCode::MathOverflow.into())
}
