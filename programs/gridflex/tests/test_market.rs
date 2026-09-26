//! Lifecycle and failure-path tests for the GridFlex market escrow, run in
//! LiteSVM against the built program (`anchor build` first).
#![allow(clippy::result_large_err)]

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, solana_program::system_program,
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    gridflex::{
        error::ErrorCode, state::CommitmentStatus, Commitment, Market, MarketStatus,
        COMMITMENT_SEED, CONFIG_SEED, MARKET_SEED, VAULT_SEED,
    },
    litesvm::LiteSVM,
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_option::COption,
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
    spl_token_interface::{
        state::{Account as TokenAccount, AccountState, Mint},
        ID as TOKEN_PROGRAM_ID,
    },
};

const USDC: u64 = 1_000_000; // 6 decimals
const KWH: u64 = 1_000; // Wh per kWh

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    verifier: Keypair,
    operator: Keypair,
    mint: Pubkey,
    operator_usdc: Pubkey,
}

impl Env {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        let bytes = include_bytes!(concat!(
            env!("CARGO_TARGET_TMPDIR"),
            "/../deploy/gridflex.so"
        ));
        svm.add_program(gridflex::id(), bytes).unwrap();

        let admin = Keypair::new();
        let verifier = Keypair::new();
        let operator = Keypair::new();
        for kp in [&admin, &verifier, &operator] {
            svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
        }

        let mint = create_mint(&mut svm);
        let operator_usdc = create_token_account(&mut svm, &mint, &operator.pubkey(), 1_000 * USDC);

        let mut env = Self {
            svm,
            admin,
            verifier,
            operator,
            mint,
            operator_usdc,
        };
        let ix = Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::InitializeConfig {
                verifier: env.verifier.pubkey(),
            }
            .data(),
            gridflex::accounts::InitializeConfig {
                admin: env.admin.pubkey(),
                config: config_pda(),
                usdc_mint: env.mint,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        let admin = env.admin.insecure_clone();
        env.send(&[ix], &admin, &[]).expect("initialize_config");
        env
    }

    fn send(
        &mut self,
        ixs: &[Instruction],
        payer: &Keypair,
        extra_signers: &[&Keypair],
    ) -> Result<(), litesvm::types::FailedTransactionMetadata> {
        let mut signers: Vec<&Keypair> = vec![payer];
        signers.extend_from_slice(extra_signers);
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
        let res = self.svm.send_transaction(tx).map(|_| ());
        self.svm.expire_blockhash();
        res
    }

    fn create_market(
        &mut self,
        market_id: u64,
        required_wh: u64,
        max_price: u64,
        deposit: u64,
    ) -> Result<Pubkey, litesvm::types::FailedTransactionMetadata> {
        let operator = self.operator.insecure_clone();
        let mint = self.mint;
        let from = self.operator_usdc;
        self.create_market_with(
            &operator,
            from,
            mint,
            market_id,
            required_wh,
            max_price,
            deposit,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn create_market_with(
        &mut self,
        authority: &Keypair,
        authority_token_account: Pubkey,
        mint: Pubkey,
        market_id: u64,
        required_wh: u64,
        max_price: u64,
        deposit: u64,
    ) -> Result<Pubkey, litesvm::types::FailedTransactionMetadata> {
        let market = market_pda(&authority.pubkey(), market_id);
        let ix = Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::CreateMarket {
                market_id,
                zone_hash: [7; 32],
                required_wh,
                max_price,
                start_ts: 1_000,
                end_ts: 4_600,
                deposit,
            }
            .data(),
            gridflex::accounts::CreateMarket {
                authority: authority.pubkey(),
                config: config_pda(),
                usdc_mint: mint,
                market,
                vault: vault_pda(&market),
                authority_token_account,
                token_program: TOKEN_PROGRAM_ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], authority, &[]).map(|_| market)
    }

    fn accept(
        &mut self,
        signer: &Keypair,
        market: Pubkey,
        resource: u8,
        participant: Pubkey,
        committed_wh: u64,
        price: u64,
    ) -> Result<Pubkey, litesvm::types::FailedTransactionMetadata> {
        let resource_hash = [resource; 32];
        let commitment = commitment_pda(&market, &resource_hash);
        let ix = Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::AcceptCommitment {
                resource_hash,
                participant,
                committed_wh,
                price,
            }
            .data(),
            gridflex::accounts::AcceptCommitment {
                signer: signer.pubkey(),
                config: config_pda(),
                market,
                commitment,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], signer, &[]).map(|_| commitment)
    }

    fn verify(
        &mut self,
        signer: &Keypair,
        market: Pubkey,
        commitment: Pubkey,
        delivered_wh: u64,
    ) -> Result<(), litesvm::types::FailedTransactionMetadata> {
        let ix = Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::VerifyDelivery {
                delivered_wh,
                proof_hash: [9; 32],
            }
            .data(),
            gridflex::accounts::VerifyDelivery {
                verifier: signer.pubkey(),
                config: config_pda(),
                market,
                commitment,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], signer, &[])
    }

    fn settle(
        &mut self,
        market: Pubkey,
        commitment: Pubkey,
        participant_usdc: Pubkey,
    ) -> Result<(), litesvm::types::FailedTransactionMetadata> {
        let ix = Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::SettleCommitment {}.data(),
            gridflex::accounts::SettleCommitment {
                config: config_pda(),
                usdc_mint: self.mint,
                market,
                vault: vault_pda(&market),
                commitment,
                participant_token_account: participant_usdc,
                token_program: TOKEN_PROGRAM_ID,
            }
            .to_account_metas(None),
        );
        // Settlement is permissionless: the verifier just pays the fee here.
        let payer = self.verifier.insecure_clone();
        self.send(&[ix], &payer, &[])
    }

    fn close(
        &mut self,
        signer: &Keypair,
        market: Pubkey,
    ) -> Result<(), litesvm::types::FailedTransactionMetadata> {
        let ix = Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::CloseMarket {}.data(),
            gridflex::accounts::CloseMarket {
                signer: signer.pubkey(),
                config: config_pda(),
                usdc_mint: self.mint,
                market,
                vault: vault_pda(&market),
                authority_token_account: self.operator_usdc,
                market_authority: self.operator.pubkey(),
                token_program: TOKEN_PROGRAM_ID,
            }
            .to_account_metas(None),
        );
        self.send(&[ix], signer, &[])
    }

    fn balance(&self, token_account: &Pubkey) -> u64 {
        let acc = self.svm.get_account(token_account).unwrap();
        TokenAccount::unpack(&acc.data).unwrap().amount
    }

    fn market(&self, market: &Pubkey) -> Market {
        let acc = self.svm.get_account(market).unwrap();
        Market::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn commitment(&self, commitment: &Pubkey) -> Commitment {
        let acc = self.svm.get_account(commitment).unwrap();
        Commitment::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn participant(&mut self) -> (Pubkey, Pubkey) {
        let owner = Pubkey::new_unique();
        let mint = self.mint;
        let usdc = create_token_account(&mut self.svm, &mint, &owner, 0);
        (owner, usdc)
    }
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &gridflex::id()).0
}

fn market_pda(authority: &Pubkey, market_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[MARKET_SEED, authority.as_ref(), &market_id.to_le_bytes()],
        &gridflex::id(),
    )
    .0
}

fn vault_pda(market: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[VAULT_SEED, market.as_ref()], &gridflex::id()).0
}

fn commitment_pda(market: &Pubkey, resource_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(
        &[COMMITMENT_SEED, market.as_ref(), resource_hash.as_ref()],
        &gridflex::id(),
    )
    .0
}

fn create_mint(svm: &mut LiteSVM) -> Pubkey {
    let address = Pubkey::new_unique();
    let mint = Mint {
        mint_authority: COption::Some(Pubkey::new_unique()),
        supply: 1_000_000 * USDC,
        decimals: 6,
        is_initialized: true,
        freeze_authority: COption::None,
    };
    let mut data = vec![0; Mint::LEN];
    Mint::pack(mint, &mut data).unwrap();
    set_token_program_account(svm, address, data);
    address
}

fn create_token_account(svm: &mut LiteSVM, mint: &Pubkey, owner: &Pubkey, amount: u64) -> Pubkey {
    let address = Pubkey::new_unique();
    let account = TokenAccount {
        mint: *mint,
        owner: *owner,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    };
    let mut data = vec![0; TokenAccount::LEN];
    TokenAccount::pack(account, &mut data).unwrap();
    set_token_program_account(svm, address, data);
    address
}

fn set_token_program_account(svm: &mut LiteSVM, address: Pubkey, data: Vec<u8>) {
    let lamports = svm.minimum_balance_for_rent_exemption(data.len());
    svm.set_account(
        address,
        Account {
            lamports,
            data,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

/// Assert a transaction failed with one of this program's own error codes.
fn assert_err(
    res: Result<impl std::fmt::Debug, litesvm::types::FailedTransactionMetadata>,
    expected: ErrorCode,
) {
    let err = res.expect_err("transaction should fail");
    let name = format!("{expected:?}");
    let code = anchor_lang::error::ERROR_CODE_OFFSET + expected as u32;
    let rendered = format!("{:?}", err.err);
    assert!(
        rendered.contains(&format!("Custom({code})")),
        "expected {name} (Custom({code})), got {rendered}\nlogs: {:#?}",
        err.meta.logs
    );
}

// ---------------------------------------------------------------------------

/// The Downtown demo event, end to end: $160 escrow at a $0.20/kWh cap, five
/// accepted offers, one over-delivery (paid only what was committed) and one
/// under-delivery (paid only what was delivered).
#[test]
fn full_lifecycle_pays_verified_delivery_and_refunds_the_rest() {
    let mut env = Env::new();
    let deposit = 160 * USDC;
    let market = env.create_market(1, 800 * KWH, 200_000, deposit).unwrap();
    assert_eq!(env.balance(&vault_pda(&market)), deposit);
    assert_eq!(env.balance(&env.operator_usdc), 840 * USDC);

    // (committed kWh, price per kWh in base units, delivered kWh)
    let offers = [
        (180, 80_000, 190),  // EV fleet: over-delivers, paid for 180
        (170, 90_000, 170),  // Tower HVAC
        (100, 110_000, 90),  // Solar: under-delivers, paid for 90
        (100, 140_000, 100), // Home batteries
        (250, 160_000, 250), // Commercial battery
    ];
    let verifier = env.verifier.insecure_clone();
    let mut rows = vec![];
    for (i, (committed, price, delivered)) in offers.iter().enumerate() {
        let (owner, usdc) = env.participant();
        let commitment = env
            .accept(
                &verifier,
                market,
                i as u8 + 1,
                owner,
                committed * KWH,
                *price,
            )
            .unwrap();
        rows.push((commitment, usdc, *committed, *price, *delivered));
    }
    let m = env.market(&market);
    assert_eq!(m.committed_wh, 800 * KWH);
    assert_eq!(m.open_commitments, 5);
    assert_eq!(m.status, MarketStatus::Open);

    for (commitment, _, _, _, delivered) in &rows {
        env.verify(&verifier, market, *commitment, delivered * KWH)
            .unwrap();
    }
    assert_eq!(env.market(&market).status, MarketStatus::Verifying);

    let mut paid = 0;
    for (commitment, usdc, committed, price, delivered) in &rows {
        env.settle(market, *commitment, *usdc).unwrap();
        let expected = delivered.min(committed) * price; // kWh × base-units/kWh
        assert_eq!(env.balance(usdc), expected);
        assert_eq!(env.commitment(commitment).status, CommitmentStatus::Paid);
        paid += expected;
    }
    // 14.40 + 15.30 + 9.90 + 14.00 + 40.00
    assert_eq!(paid, 93_600_000);

    env.close(&verifier, market).unwrap();
    let m = env.market(&market);
    assert_eq!(m.status, MarketStatus::Closed);
    assert_eq!(m.paid_amount, paid);
    assert_eq!(env.balance(&env.operator_usdc), 1_000 * USDC - paid);
    assert!(
        env.svm
            .get_account(&vault_pda(&market))
            .is_none_or(|a| a.lamports == 0),
        "vault should be closed"
    );
}

#[test]
fn create_market_requires_deposit_to_cover_the_cap() {
    let mut env = Env::new();
    // 800 kWh at $0.20 needs $160.
    assert_err(
        env.create_market(1, 800 * KWH, 200_000, 160 * USDC - 1),
        ErrorCode::InsufficientDeposit,
    );
    assert_err(
        env.create_market(2, 0, 200_000, 160 * USDC),
        ErrorCode::ZeroAmount,
    );
}

#[test]
fn create_market_rejects_a_mint_other_than_the_configured_usdc() {
    let mut env = Env::new();
    let fake_mint = create_mint(&mut env.svm);
    let operator = env.operator.insecure_clone();
    let fake_account =
        create_token_account(&mut env.svm, &fake_mint, &operator.pubkey(), 1_000 * USDC);
    let res = env.create_market_with(
        &operator,
        fake_account,
        fake_mint,
        1,
        800 * KWH,
        200_000,
        160 * USDC,
    );
    assert!(
        res.is_err(),
        "config has_one usdc_mint must reject a foreign mint"
    );
}

#[test]
fn only_authority_or_verifier_can_accept_commitments() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let stranger = Keypair::new();
    env.svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    let (owner, _) = env.participant();
    assert_err(
        env.accept(&stranger, market, 1, owner, 100 * KWH, 100_000),
        ErrorCode::Unauthorized,
    );

    // The operator may record commitments itself, too.
    let operator = env.operator.insecure_clone();
    env.accept(&operator, market, 2, owner, 100 * KWH, 100_000)
        .unwrap();
}

#[test]
fn commitments_respect_the_price_cap_and_the_need() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let (owner, _) = env.participant();

    assert_err(
        env.accept(&verifier, market, 1, owner, 100 * KWH, 200_001),
        ErrorCode::PriceAboveCap,
    );
    env.accept(&verifier, market, 2, owner, 700 * KWH, 100_000)
        .unwrap();
    assert_err(
        env.accept(&verifier, market, 3, owner, 101 * KWH, 100_000),
        ErrorCode::OverCommitted,
    );
    env.accept(&verifier, market, 4, owner, 100 * KWH, 100_000)
        .unwrap();
}

#[test]
fn only_the_verifier_can_verify_and_only_once() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let operator = env.operator.insecure_clone();
    let (owner, _) = env.participant();
    let commitment = env
        .accept(&verifier, market, 1, owner, 100 * KWH, 100_000)
        .unwrap();

    // The operator can't mark its own market's deliveries.
    assert!(env
        .verify(&operator, market, commitment, 100 * KWH)
        .is_err());
    env.verify(&verifier, market, commitment, 100 * KWH)
        .unwrap();
    assert_err(
        env.verify(&verifier, market, commitment, 100 * KWH),
        ErrorCode::AlreadyVerified,
    );
}

#[test]
fn no_new_commitments_once_verification_starts() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let (owner, _) = env.participant();
    let commitment = env
        .accept(&verifier, market, 1, owner, 100 * KWH, 100_000)
        .unwrap();
    env.verify(&verifier, market, commitment, 100 * KWH)
        .unwrap();
    assert_err(
        env.accept(&verifier, market, 2, owner, 100 * KWH, 100_000),
        ErrorCode::MarketNotOpen,
    );
}

#[test]
fn settlement_needs_verification_pays_once_and_only_to_the_participant() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let (owner, usdc) = env.participant();
    let commitment = env
        .accept(&verifier, market, 1, owner, 100 * KWH, 140_000)
        .unwrap();

    assert_err(env.settle(market, commitment, usdc), ErrorCode::NotVerified);
    env.verify(&verifier, market, commitment, 100 * KWH)
        .unwrap();

    // A token account owned by someone else is rejected.
    let (_, someone_elses) = env.participant();
    assert!(env.settle(market, commitment, someone_elses).is_err());

    env.settle(market, commitment, usdc).unwrap();
    assert_eq!(env.balance(&usdc), 14 * USDC);
    assert_err(env.settle(market, commitment, usdc), ErrorCode::NotVerified);
    assert_eq!(env.balance(&usdc), 14 * USDC, "paid exactly once");
}

#[test]
fn zero_delivery_settles_for_nothing_and_still_lets_the_market_close() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let (owner, usdc) = env.participant();
    let commitment = env
        .accept(&verifier, market, 1, owner, 100 * KWH, 140_000)
        .unwrap();
    env.verify(&verifier, market, commitment, 0).unwrap();
    env.settle(market, commitment, usdc).unwrap();
    assert_eq!(env.balance(&usdc), 0);
    env.close(&verifier, market).unwrap();
    assert_eq!(env.balance(&env.operator_usdc), 1_000 * USDC);
}

#[test]
fn market_cannot_close_with_unpaid_commitments() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let (owner, usdc) = env.participant();
    let commitment = env
        .accept(&verifier, market, 1, owner, 100 * KWH, 100_000)
        .unwrap();

    assert_err(env.close(&verifier, market), ErrorCode::UnpaidCommitments);
    env.verify(&verifier, market, commitment, 100 * KWH)
        .unwrap();
    assert_err(env.close(&verifier, market), ErrorCode::UnpaidCommitments);
    env.settle(market, commitment, usdc).unwrap();
    env.close(&verifier, market).unwrap();
    // The vault is gone after closing, so a second close can't even load it.
    let again = env
        .close(&verifier, market)
        .expect_err("second close must fail");
    assert!(
        format!("{:?}", again.err).contains("Custom(3012)"),
        "AccountNotInitialized"
    );
}

#[test]
fn only_the_authority_can_cancel_an_empty_market_and_gets_everything_back() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let verifier = env.verifier.insecure_clone();
    let operator = env.operator.insecure_clone();

    assert_err(
        env.close(&verifier, market),
        ErrorCode::CancelRequiresAuthority,
    );
    env.close(&operator, market).unwrap();
    assert_eq!(env.balance(&env.operator_usdc), 1_000 * USDC);
    assert_eq!(env.market(&market).status, MarketStatus::Closed);
}

#[test]
fn admin_can_rotate_the_verifier() {
    let mut env = Env::new();
    let market = env
        .create_market(1, 800 * KWH, 200_000, 160 * USDC)
        .unwrap();
    let old = env.verifier.insecure_clone();
    let new = Keypair::new();
    env.svm.airdrop(&new.pubkey(), 1_000_000_000).unwrap();

    let ix = |admin: Pubkey| {
        Instruction::new_with_bytes(
            gridflex::id(),
            &gridflex::instruction::SetVerifier {
                verifier: new.pubkey(),
            }
            .data(),
            gridflex::accounts::SetVerifier {
                admin,
                config: config_pda(),
            }
            .to_account_metas(None),
        )
    };
    // Not the admin.
    assert!(env.send(&[ix(old.pubkey())], &old, &[]).is_err());
    let admin = env.admin.insecure_clone();
    env.send(&[ix(admin.pubkey())], &admin, &[]).unwrap();

    let (owner, _) = env.participant();
    let commitment = env
        .accept(&new, market, 1, owner, 100 * KWH, 100_000)
        .unwrap();
    assert!(env.verify(&old, market, commitment, 100 * KWH).is_err());
    env.verify(&new, market, commitment, 100 * KWH).unwrap();
}
