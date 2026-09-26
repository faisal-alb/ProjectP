use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ErrorCode,
    state::{payout, Commitment, CommitmentStatus, Config, Market, MarketStatus},
};

#[derive(Accounts)]
#[instruction(resource_hash: [u8; 32])]
pub struct AcceptCommitment<'info> {
    /// Market authority or the configured verifier (the off-chain matcher).
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = signer,
        space = 8 + Commitment::INIT_SPACE,
        seeds = [COMMITMENT_SEED, market.key().as_ref(), resource_hash.as_ref()],
        bump
    )]
    pub commitment: Account<'info, Commitment>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct CommitmentAccepted {
    pub market: Pubkey,
    pub commitment: Pubkey,
    pub participant: Pubkey,
    pub committed_wh: u64,
    pub price: u64,
}

pub fn handle_accept_commitment(
    ctx: Context<AcceptCommitment>,
    resource_hash: [u8; 32],
    participant: Pubkey,
    committed_wh: u64,
    price: u64,
) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let market = &mut ctx.accounts.market;
    require!(
        signer == market.authority || signer == ctx.accounts.config.verifier,
        ErrorCode::Unauthorized
    );
    require!(
        market.status == MarketStatus::Open,
        ErrorCode::MarketNotOpen
    );
    require!(committed_wh > 0 && price > 0, ErrorCode::ZeroAmount);
    require!(price <= market.max_price, ErrorCode::PriceAboveCap);

    let committed_total = market
        .committed_wh
        .checked_add(committed_wh)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        committed_total <= market.required_wh,
        ErrorCode::OverCommitted
    );

    let reserved_total = market
        .reserved_amount
        .checked_add(payout(committed_wh, price)?)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        reserved_total <= market.escrow_amount,
        ErrorCode::EscrowExceeded
    );

    market.committed_wh = committed_total;
    market.reserved_amount = reserved_total;
    market.open_commitments = market
        .open_commitments
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    let commitment = &mut ctx.accounts.commitment;
    commitment.market = market.key();
    commitment.participant = participant;
    commitment.resource_hash = resource_hash;
    commitment.committed_wh = committed_wh;
    commitment.price = price;
    commitment.delivered_wh = 0;
    commitment.payable_wh = 0;
    commitment.proof_hash = [0; 32];
    commitment.status = CommitmentStatus::Committed;
    commitment.bump = ctx.bumps.commitment;

    emit!(CommitmentAccepted {
        market: market.key(),
        commitment: commitment.key(),
        participant,
        committed_wh,
        price,
    });
    Ok(())
}
