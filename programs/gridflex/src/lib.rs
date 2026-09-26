pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("A7ocTy3qXyedzhxVDcyGbAyN6rNvu69XP9NnDAy4QWaf");

/// Flexibility-market escrow. An operator locks USDC per request, accepted
/// offers become commitments, a trusted verifier records metered delivery,
/// and each participant is paid for what they delivered (up to what they
/// committed). Whatever is left is refunded when the market closes.
#[program]
pub mod gridflex {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, verifier: Pubkey) -> Result<()> {
        crate::instructions::initialize_config::handle_initialize_config(ctx, verifier)
    }

    pub fn set_verifier(ctx: Context<SetVerifier>, verifier: Pubkey) -> Result<()> {
        crate::instructions::set_verifier::handle_set_verifier(ctx, verifier)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        zone_hash: [u8; 32],
        required_wh: u64,
        max_price: u64,
        start_ts: i64,
        end_ts: i64,
        deposit: u64,
    ) -> Result<()> {
        crate::instructions::create_market::handle_create_market(
            ctx,
            market_id,
            zone_hash,
            required_wh,
            max_price,
            start_ts,
            end_ts,
            deposit,
        )
    }

    pub fn accept_commitment(
        ctx: Context<AcceptCommitment>,
        resource_hash: [u8; 32],
        participant: Pubkey,
        committed_wh: u64,
        price: u64,
    ) -> Result<()> {
        crate::instructions::accept_commitment::handle_accept_commitment(
            ctx,
            resource_hash,
            participant,
            committed_wh,
            price,
        )
    }

    pub fn verify_delivery(
        ctx: Context<VerifyDelivery>,
        delivered_wh: u64,
        proof_hash: [u8; 32],
    ) -> Result<()> {
        crate::instructions::verify_delivery::handle_verify_delivery(ctx, delivered_wh, proof_hash)
    }

    pub fn settle_commitment(ctx: Context<SettleCommitment>) -> Result<()> {
        crate::instructions::settle_commitment::handle_settle_commitment(ctx)
    }

    pub fn close_market(ctx: Context<CloseMarket>) -> Result<()> {
        crate::instructions::close_market::handle_close_market(ctx)
    }
}
