# GridFlex docs

GridFlex predicts local grid congestion, then lets a grid operator buy flexibility from nearby batteries, EVs, buildings, solar and generators, paid in USDC on Solana.

Start with [Shared energy day](showcase.md) for the current implementation, setup and validation. [Product](product.md) and [Architecture](architecture.md) retain the original product and system context.

## Contents

| Doc | Read it to learn | Status |
|---|---|---|
| [Shared energy day](showcase.md) | Historical inputs, causal models, shared clock, presenter controls and settlement | Built |
| [Product](product.md) | The problem, the users, what a "Flex" is, the demo scenario | Reference |
| [Architecture](architecture.md) | The components, what's built and what isn't, the boundaries between them | Reference |
| [API and data](api-and-data.md) | The running HTTP API and SSE events, plus the planned data model | API built, data model planned |
| [Deployment](deployment.md) | Docker Compose, Dokploy, secrets, persistence and operations | Devnet demo |
| [Solana settlement](solana.md) | The on-chain program, USDC escrow, wallets, and how to run it | Built |
| [Voice agent](voice-agent.md) | The household voice assistant and the Power Plan | Built |
| [Location map](location-map.md) | The onboarding zone map and its boundary data | Built |
| [Forecasting and simulation](forecasting-and-simulation.md) | The grid simulator and forecasting design | Original design; implemented behavior is in Shared energy day |
| [Model orchestration](model-orchestration.md) | The Python spike model, valuation, dispatch and event lifecycle | Partly built (models in `ml/`, served by the intelligence service) |
| [Intelligence service](intelligence.md) | How the trained models reach the app: the forecast, per-home baselines, the replay clock | Built |
| [Demo and pitch](demo-and-pitch.md) | The two-minute demo script and answers to judges' questions | Reference |
| [Archive](archive/) | The original 36-hour build plan | Historical |

The design system lives with the web app: [`apps/web/DESIGN.md`](../apps/web/DESIGN.md) (visual language) and [`apps/web/PRODUCT.md`](../apps/web/PRODUCT.md) (brand and positioning).

## What's built

- **Web app** (`apps/web`): landing page, onboarding for both roles, household and operator dashboards, wallet connection, the voice assistant, the Power Plan, and in-app notifications.
- **API** (`apps/api`): a durable SQLite shared run, minute-level device physics, scenario orchestration, autonomous devnet market lifecycle and SSE snapshots.
- **Solana program** (`programs/gridflex`): escrow, commitments, verification and payout in USDC.
- **Shared code** (`packages/shared`, `packages/solana`): unit maths, the Power Plan optimizer, onboarding data and the Solana client.
- **Models** (`ml/`): an ERCOT price-spike classifier, fair-value price statistics and a per-home baseline, trained on public Austin data.
- **Intelligence service** (`services/intelligence`): causal load and household forecasts, price-spike inference and constrained six-hour dispatch throughout a full historical day.

## What's not built

- Real utility or meter integrations.

Historical regional/weather inputs and devnet transactions are real; neighborhood topology, device response and meter delivery are modeled. Source dates and estimates remain visible. There are no connected pilots or physical customer meters.

## Conventions

- **Terms.** *Grid congestion* or *peak-demand event*, never "power surge" (a different problem). *Flex* is 1 kWh of verified relief ([Product](product.md#what-is-being-bought)). The operator is the *grid operator* and the household or business is a *participant*.
- **Resource categories.** The app calls them **Uses power**, **Makes power** and **Stores power** (`role` values `consumer`, `producer`, `storer` in `packages/shared/src/onboarding.ts`).
- **Names.** "GridFlex" in prose; `gridflex` for the program, package scope and code.
- **Status.** Say what's built and what's planned. Mark planned sections with a *Planned* note at the top.
- **Files.** Lowercase kebab-case names, no number prefixes. New docs go in the table above.
