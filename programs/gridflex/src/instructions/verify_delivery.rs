use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Commitment, CommitmentStatus, Config, Market, MarketStatus},
};

#[derive(Accounts)]
pub struct VerifyDelivery<'info> {
    pub verifier: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = verifier)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [COMMITMENT_SEED, market.key().as_ref(), commitment.resource_hash.as_ref()],
        bump = commitment.bump,
        has_one = market
    )]
    pub commitment: Account<'info, Commitment>,
}

#[event]
pub struct DeliveryVerified {
    pub market: Pubkey,
    pub commitment: Pubkey,
    pub delivered_wh: u64,
    pub payable_wh: u64,
    pub proof_hash: [u8; 32],
}

/// Record metered delivery. v1 trusts the verifier and does not enforce the
/// market window, so demos can verify immediately after committing.
pub fn handle_verify_delivery(
    ctx: Context<VerifyDelivery>,
    delivered_wh: u64,
    proof_hash: [u8; 32],
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    require!(
        market.status != MarketStatus::Closed,
        ErrorCode::MarketClosed
    );
    let commitment = &mut ctx.accounts.commitment;
    require!(
        commitment.status == CommitmentStatus::Committed,
        ErrorCode::AlreadyVerified
    );

    market.status = MarketStatus::Verifying;
    commitment.delivered_wh = delivered_wh;
    commitment.payable_wh = delivered_wh.min(commitment.committed_wh);
    commitment.proof_hash = proof_hash;
    commitment.status = CommitmentStatus::Verified;

    emit!(DeliveryVerified {
        market: market.key(),
        commitment: commitment.key(),
        delivered_wh,
        payable_wh: commitment.payable_wh,
        proof_hash,
    });
    Ok(())
}
