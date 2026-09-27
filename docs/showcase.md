# Shared energy day

The dashboard follows a single backend-owned run, with a UTC clock displayed in Austin time. Historical inputs are fixed to August 20, 2024; stress scenarios overlay documented changes. Viewers see the same state. Only a presenter can mutate it.

## Prepare and run

```sh
npm run intelligence:setup
npm run run:setup     # fund dedicated operator on the configured test network
npm run dev
```

Existing valid `ml/artifacts/`, including `run/`, need no retraining or preparation. To rebuild just the bundle, run `npm run run:prepare`. For first-time training, use Python 3.10+ (3.12 recommended), run `npm run intelligence:setup -- --training`, then `npm run ml:train`; training includes bundle preparation. Default setup installs only runtime and lightweight bundle-preparation dependencies.

**Deployment:** Docker installs the runtime itself; do not run local `intelligence:setup` for the deployed app. Copy the complete `ml/artifacts/` contents, including `run/`, into the deployment's `files/models/` volume and restart intelligence after changing them. Training and preparation are offline build steps, needed only when generating or updating those files. A Git deployment does not upload them because they are excluded from Git and Docker build context.

The bundle includes 96 quarter-hour observations, 50 ResStock homes, a scaled Travis County ComStock office shape, ERCOT South Central regional load, ERCOT LZ_AEN prices, and Open-Meteo weather reanalysis. Downloads occur during preparation, never during playback. Generated files stay in `ml/artifacts/run` and must be copied with the other model artifacts to the intelligence deployment volume.

The local presenter code is in `.data/presenter-code` (mode 0600). Production requires `PRESENTER_ACCESS_CODE`. Open controls by triple-tapping the header organization label or pressing **Ctrl Shift S**, then unlock. Controls include pause/start, 1×/24×/96×, manual playback, 15-minute steps, restart, scenario injection, readiness, coverage evidence and pending transactions. Restart preserves prior runs and all blockchain history; it refuses while commitments remain unresolved.

Select **Manual · next event** to pause automatic playback, then close the controls. A floating **Next event** button appears for the unlocked presenter. Each click processes the intervening minutes and stops at the next event transition, scenario, recovery, or service issue; real transactions still require confirmation. The clock remains paused between clicks. At the end of the day, continue resolving outstanding settlements until the button reads **Day complete**. To resume timed playback, select a numeric speed and press Start.

`run:setup` provisions the encrypted managed wallet `run-operator`; it does not replace deployer/verifier keys. The default per-event escrow limit is 100 test USDC and cumulative run reservation limit is 1,000. Set `RUN_EVENT_LIMIT_BASE` / `RUN_SPEND_LIMIT_BASE` in six-decimal token units to change these limits. Setup tops operator and verifier up to 1 test SOL each for persistent account rent as well as fees, using the configured deployer. The default remains devnet in deployment. Mainnet automation is rejected.

The worker starts paused after process restart. Starting requires a valid immutable data bundle, trained artifacts, reachable RPC, test tokens and fee SOL. Pending accounts reconcile by PDA/status before any resubmission. Confirmation can slow the nominal 15-minute playback; it is never fabricated or driven by virtual time. Transaction failures remain visible, with bounded retry backoff. Windows that expire before commitment are canceled and existing obligations are reconciled.

## Models and physical response

The regional load model trains through May 2024 and validates in June–July. Forecasts for each issue time recursively use prior-hour observations, lagged days and calendar features, not future actuals. Validation scores are recorded in the bundle manifest, alongside the persistence and daily seasonal baselines.

Household inference rebuilds causal features from prior ResStock intervals, using prior-hour weather persistence and a documented cloud assumption. This removes the future-weather-plus-noise method from run decisions. The original trained baseline model is retained; its error under these causal run inputs is separately reported as `baselineCausalMaeKw`. Building profiles remain 2018 physics simulations aligned by standard local clock, not actual 2024 meters. Regional-to-neighborhood downscaling and 55 kW area limits are explicitly modeled.

Every 15 virtual minutes, the intelligence service calculates a six-hour schedule using SciPy's linear/mixed-integer optimization interface. The current continuous-resource formulation is a linear program: no integer equipment switches are needed. It prioritizes unmet relief before offer cost, protects energy/fuel budgets, and holds the first-hour commitment constant. Reliability procurement uses a $0.35/kWh floor when a capacity breach requires relief; otherwise the price model supplies the offer. No feasible supply produces uncovered demand, not invented capacity.

Devices evolve every minute, independently of the predicted settlement baseline. Batteries include charge/discharge efficiency and reserve; EVs include connection windows, departure needs and modeled trip use; HVAC includes comfort and rebound; solar is irradiance-limited and only released curtailment counts as flexibility; generators are fuel-limited. Grid charging is bounded by available area headroom. These are simplified engineering models, not hardware connectors or validated utility power-flow models.

Baseline hashes freeze the prediction before dispatch. Interval delivery and simulator ground truth remain separate. Invalid readings are quarantined; the deterministic simulator retains the original evidence for corrected resend after fault recovery. A real missing reading would have to remain pending. Proof JSON is saved before verification; payments use integer Wh and six-decimal token amounts, capped to commitments.

## APIs and persistence

- `GET /runs/current`: authoritative snapshot, run id and revision.
- `GET /runs/stream`: SSE snapshots, sequence id `runId:version`; clients reload state on reconnect.
- `GET /runs/:id/history`: retained snapshot, timeseries, events and decision/evidence log.
- `GET /runs/scenarios`: supported injection catalog.
- `GET /runs/assistant`: assistant availability, including injected outages.
- `POST /runs/unlock`: access code → expiring bearer session.
- `GET /runs/preflight`, `POST /runs/control`: presenter-only readiness and controls.
- `POST /runs/what-if`: bounded copied-snapshot analysis; no mutation or transactions.

All legacy market/faucet mutations now require presenter authorization too. Existing market JSON is imported once into `legacy_markets` without executing transactions. SQLite WAL stores run checkpoints and history atomically in `.data/runs.sqlite`. Run only one API worker against this file. Do not scale workers horizontally without introducing a shared database and leader lease.

Earnings are confirmed payouts for the selected run. The participant view includes its designated battery and companion resources; operator totals cover the selected area. Account balances can include previous runs, while run earnings never do. Event/transaction status is independent of virtual time.

## Assistant

```sh
node scripts/configure-run-agent.mjs
```

This updates the configured ElevenLabs agent with a grounded read-only prompt and missing power-plan/what-if client tools. It preserves the previous configuration in `.data/voice-agent-before.json`. Both roles can use voice or text. Tools read the latest run snapshot. What-if calculations accept reserve percentage, price cap, demand change, or an unavailable resource and operate on a copy. The assistant cannot submit transactions or change preferences. Deterministic decision explanations remain visible when the assistant is unavailable.

The floating **Ask GridFlex** button starts voice and shows connecting/listening/speaking state with the audio meter. Tap it again to end. The adjacent chat button opens text without requesting microphone permission. One session persists across dashboard routes and follows the selected area. The SDK connection is asynchronous: context updates and the first question wait for its connected state. Provider quota errors are surfaced; both voice and text require available ElevenLabs credits.

## Validation and coverage

```sh
npm test -w @gridflex/shared
npm run test:run
npm run test:deployment
npm run test:run-models    # complete day, real models, chain test double
npm run test:run-scenarios # 37 individual fault branches, chain test double
.venv/bin/python -m unittest services.intelligence.test_optimizer
npm run lint -w web
npm run build -w web
npx tsx apps/web/e2e/run.mts
CHECK_VOICE_TEXT=1 npm run test:run-ui # includes a live assistant answer
MOCK_VOICE=1 CHECK_VOICE_TEXT=1 CHECK_VOICE_AUDIO=1 npm run test:run-ui # SDK/tools/audio lifecycle without provider credits
npm run test:run-api   # idle run only; leaves a fresh paused stress day
node scripts/run-rehearsal.mjs       # full day, real devnet settlement, fast stepping
RUN_SOAK=1 node scripts/run-rehearsal.mjs  # actual 24-hour clock soak
```

Do not build into the same `.next` directory while a dev server is using it. Stop dev first or use `NEXT_DIST_DIR` for a separate build.

The rehearsal records `.data/rehearsal-report.json`, including chain addresses, payouts, refunds, unresolved errors and coverage evidence. Use `RUN_RESUME=1` to continue an interrupted rehearsal without resetting obligations. The model and scenario checks produce `.data/model-day-report.json` and `.data/scenario-report.json`. An injected scenario is not automatically covered: `pending`, `injected`, and `observed` are separate. Some faults need a compatible active event; select a matching preset/time before injecting. The stress run schedules extra demand windows before telemetry faults. A complete catalog audit includes individual branches as well as the default stress run; a fast full-day test does not substitute for the real-time soak.

The app reports estimates and source dates instead of presenting public historical/regional data as connected neighborhood measurements. There are no connected utility accounts or physical device controls, and no real-dollar payouts.

### Latest local validation

On September 27, 2026, the stepped 24-hour run completed all 40 events on Solana devnet with no unresolved commitments: 64.6066 test USDC paid and 308.828173 refunded. It also recovered across API process restarts. Its retained run ID is `cac20207-1fdb-41a5-b775-7e057e04da64`.

The 37-case individual scenario audit, complete model/physics day, shared/API/Python tests, presenter authorization, what-if isolation, assistant outage handling, desktop/mobile browser checks, live ElevenLabs text answer, lint, type checks and production build passed. Scenario fault branches use a chain test double; the separate whole-day rehearsal uses real devnet transactions. A real-time 24-hour soak and microphone/audio conversation remain unverified. The local app is left on a fresh paused stress day, with earlier runs retained in SQLite.
