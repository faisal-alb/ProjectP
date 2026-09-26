# GridFlex docs

GridFlex predicts local grid congestion, then lets a grid operator buy flexibility from nearby batteries, EVs, buildings, solar and generators, paid in USDC on Solana.

Start with [Product](product.md) for what we're building and why, then [Architecture](architecture.md) for how the pieces fit.

## Contents

| Doc | Read it to learn | Status |
|---|---|---|
| [Product](product.md) | The problem, the users, what a "Flex" is, the demo scenario | Reference |
| [Architecture](architecture.md) | The components, what's built and what isn't, the boundaries between them | Reference |
| [API and data](api-and-data.md) | The running HTTP API and SSE events, plus the planned data model | API built, data model planned |
| [Solana settlement](solana.md) | The on-chain program, USDC escrow, wallets, and how to run it | Built |
| [Voice agent](voice-agent.md) | The household voice assistant and the Power Plan | Built |
| [Location map](location-map.md) | The onboarding zone map and its boundary data | Built |
| [Forecasting and simulation](forecasting-and-simulation.md) | The grid simulator and forecasting design | Planned (the dashboard uses static demo data) |
| [Model orchestration](model-orchestration.md) | The Python spike model, valuation, dispatch and event lifecycle | Partly built (`ml/` has the spike model) |
| [Demo and pitch](demo-and-pitch.md) | The two-minute demo script and answers to judges' questions | Reference |
| [Archive](archive/) | The original 36-hour build plan | Historical |

The design system lives with the web app: [`apps/web/DESIGN.md`](../apps/web/DESIGN.md) (visual language) and [`apps/web/PRODUCT.md`](../apps/web/PRODUCT.md) (brand and positioning).

## What's built

- **Web app** (`apps/web`): landing page, onboarding for both roles, household and operator dashboards, wallet connection, the voice assistant, the Power Plan, and in-app notifications.
- **API** (`apps/api`): the market lifecycle (create, commit, verify, settle) over HTTP, with live events over SSE.
- **Solana program** (`programs/gridflex`): escrow, commitments, verification and payout in USDC.
- **Shared code** (`packages/shared`, `packages/solana`): unit maths, the Power Plan optimizer, onboarding data and the Solana client.
- **Spike model** (`ml/`): ERCOT price-spike features, a LightGBM classifier and walk-forward evaluation.

## What's not built

- A database. State is in memory and mirrored to `.data/` files; sessions use SQLite (better-auth).
- The intelligence service, the grid simulator and the orchestrator. Zone loads, forecasts and resource lists on the dashboards are illustrative demo data from `packages/shared/src/demo-data.ts`.
- Real utility or meter integrations.

Everything shown in the product is illustrative. Don't present it as real pilots, customers or measurements.

## Conventions

- **Terms.** *Grid congestion* or *peak-demand event*, never "power surge" (a different problem). *Flex* is 1 kWh of verified relief ([Product](product.md#what-is-being-bought)). The operator is the *grid operator* and the household or business is a *participant*.
- **Resource categories.** The app calls them **Uses power**, **Makes power** and **Stores power** (`role` values `consumer`, `producer`, `storer` in `packages/shared/src/onboarding.ts`).
- **Names.** "GridFlex" in prose; `gridflex` for the program, package scope and code.
- **Status.** Say what's built and what's planned. Mark planned sections with a *Planned* note at the top.
- **Files.** Lowercase kebab-case names, no number prefixes. New docs go in the table above.
