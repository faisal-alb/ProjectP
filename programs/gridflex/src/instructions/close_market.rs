use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{Config, Market, MarketStatus},
};

#[derive(Accounts)]
pub struct CloseMarket<'info> {
    /// Market authority or the configured verifier.
    pub signer: Signer<'info>,
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
    /// Receives the unused escrow.
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = market.authority,
        token::token_program = token_program
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,
    /// Receives the vault's rent, since it paid for it.
    #[account(mut, address = market.authority)]
    pub market_authority: SystemAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[event]
pub struct MarketClosed {
    pub market: Pubkey,
    pub paid_amount: u64,
    pub refunded_amount: u64,
}

/// Refund what's left in the vault and close it. The market and commitment
/// accounts stay open as the audit record. With no commitments this is a
/// cancellation, which only the market authority may do.
pub fn handle_close_market(ctx: Context<CloseMarket>) -> Result<()> {
    let signer = ctx.accounts.signer.key();
    let market = &ctx.accounts.market;
    require!(
        market.status != MarketStatus::Closed,
        ErrorCode::MarketClosed
    );
    require!(
        signer == market.authority || signer == ctx.accounts.config.verifier,
        ErrorCode::Unauthorized
    );
    require!(market.open_commitments == 0, ErrorCode::UnpaidCommitments);
    if market.status == MarketStatus::Open {
        require!(
            signer == market.authority,
            ErrorCode::CancelRequiresAuthority
        );
    }

    let market_id = market.market_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        MARKET_SEED,
        market.authority.as_ref(),
        &market_id,
        &[market.bump],
    ];
    let refund = ctx.accounts.vault.amount;
    if refund > 0 {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.authority_token_account.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                &[seeds],
            ),
            refund,
            ctx.accounts.usdc_mint.decimals,
        )?;
    }
    token_interface::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.market_authority.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),
        },
        &[seeds],
    ))?;

    let market = &mut ctx.accounts.market;
    market.status = MarketStatus::Closed;

    emit!(MarketClosed {
        market: market.key(),
        paid_amount: market.paid_amount,
        refunded_amount: refund,
    });
    Ok(())
}
