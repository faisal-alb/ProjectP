use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::*,
    error::ErrorCode,
    state::{payout, Config, Market, MarketStatus},
};

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, authority.key().as_ref(), &market_id.to_le_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = authority,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = market,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = authority,
        token::token_program = token_program
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub required_wh: u64,
    pub max_price: u64,
    pub escrow_amount: u64,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_create_market(
    ctx: Context<CreateMarket>,
    market_id: u64,
    zone_hash: [u8; 32],
    required_wh: u64,
    max_price: u64,
    start_ts: i64,
    end_ts: i64,
    deposit: u64,
) -> Result<()> {
    require!(required_wh > 0 && max_price > 0, ErrorCode::ZeroAmount);
    require!(start_ts < end_ts, ErrorCode::InvalidWindow);
    require!(
        deposit >= payout(required_wh, max_price)?,
        ErrorCode::InsufficientDeposit
    );

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.authority_token_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        deposit,
        ctx.accounts.usdc_mint.decimals,
    )?;

    let market = &mut ctx.accounts.market;
    market.authority = ctx.accounts.authority.key();
    market.market_id = market_id;
    market.zone_hash = zone_hash;
    market.required_wh = required_wh;
    market.max_price = max_price;
    market.start_ts = start_ts;
    market.end_ts = end_ts;
    market.status = MarketStatus::Open;
    market.escrow_amount = deposit;
    market.reserved_amount = 0;
    market.committed_wh = 0;
    market.paid_amount = 0;
    market.open_commitments = 0;
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.vault;

    emit!(MarketCreated {
        market: market.key(),
        authority: market.authority,
        required_wh,
        max_price,
        escrow_amount: deposit,
    });
    Ok(())
}
