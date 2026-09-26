use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Market window must end after it starts")]
    InvalidWindow,
    #[msg("Deposit does not cover the full need at the price cap")]
    InsufficientDeposit,
    #[msg("Only the market authority or the verifier can do this")]
    Unauthorized,
    #[msg("Market is not accepting commitments")]
    MarketNotOpen,
    #[msg("Market is already closed")]
    MarketClosed,
    #[msg("Offer price is above the market's price cap")]
    PriceAboveCap,
    #[msg("Commitments would exceed the flexibility required")]
    OverCommitted,
    #[msg("Commitments would exceed the escrowed USDC")]
    EscrowExceeded,
    #[msg("Commitment has already been verified")]
    AlreadyVerified,
    #[msg("Commitment must be verified before it can be paid")]
    NotVerified,
    #[msg("Every commitment must be paid before the market can close")]
    UnpaidCommitments,
    #[msg("Only the market authority can cancel a market with no commitments")]
    CancelRequiresAuthority,
}
