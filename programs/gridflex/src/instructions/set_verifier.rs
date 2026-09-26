use anchor_lang::prelude::*;

use crate::{constants::*, state::Config};

#[derive(Accounts)]
pub struct SetVerifier<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

/// Rotate the trusted verifier key.
pub fn handle_set_verifier(ctx: Context<SetVerifier>, verifier: Pubkey) -> Result<()> {
    ctx.accounts.config.verifier = verifier;
    Ok(())
}
