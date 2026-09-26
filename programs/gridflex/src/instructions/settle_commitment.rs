use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{payout, Commitment, CommitmentStatus, Config, Market},
};

/// Permissionless: anyone may pay a verified commitment, since the amount and
/// recipient are fixed on-chain.
#[derive(Accounts)]
pub struct SettleCommitment<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [COMMITMENT_SEED, market.key().as_ref(), commitment.resource_hash.as_ref()],
        bump = commitment.bump,
        has_one = market
    )]
    pub commitment: Account<'info, Commitment>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = commitment.participant,
        token::token_program = token_program
    )]
    pub participant_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[event]
pub struct CommitmentSettled {
    pub market: Pubkey,
    pub commitment: Pubkey,
    pub participant: Pubkey,
    pub amount: u64,
}

pub fn handle_settle_commitment(ctx: Context<SettleCommitment>) -> Result<()> {
    let commitment = &mut ctx.accounts.commitment;
    require!(
        commitment.status == CommitmentStatus::Verified,
        ErrorCode::NotVerified
    );
    let amount = payout(commitment.payable_wh, commitment.price)?;

    let market = &ctx.accounts.market;
    let market_id = market.market_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        MARKET_SEED,
        market.authority.as_ref(),
        &market_id,
        &[market.bump],
    ];
    if amount > 0 {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.participant_token_account.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;
    }

    commitment.status = CommitmentStatus::Paid;
    let market = &mut ctx.accounts.market;
    market.paid_amount = market
        .paid_amount
        .checked_add(amount)
        .ok_or(ErrorCode::MathOverflow)?;
    market.open_commitments = market
        .open_commitments
        .checked_sub(1)
        .ok_or(ErrorCode::MathOverflow)?;

    emit!(CommitmentSettled {
        market: market.key(),
        commitment: commitment.key(),
        participant: commitment.participant,
        amount,
    });
    Ok(())
}
