# Architecture

Keep it simple: one web app, one API, one Solana program. Anything that can be a function inside the API should start as one; split it out only when the language requires it or two people need to work on it independently.

## What runs today

```text
┌───────────────────────┐   HTTP + SSE    ┌──────────────────┐    RPC     ┌────────────────┐
│ Web (Next.js)         │◄───────────────►│ API (Hono, Node) │───────────►│ Solana program │
│ dashboards, onboarding│                 │ market lifecycle │            │ (Anchor)       │
└───────┬───────────────┘                 └────────┬─────────┘            └────────────────┘
        │                                          │
        │ signed URL                               │ HTTP (internal)     in-memory state,
        ▼                                          ▼                     mirrored to .data/*.json
┌───────────────────────┐                 ┌──────────────────────┐
│ ElevenLabs voice agent│                 │ Intelligence (Python)│  spike, fair value, home
└───────────────────────┘                 │ services/intelligence│  baselines from ml/
                                          └──────────────────────┘
```

| Component | Where | Does |
|---|---|---|
| Web app | `apps/web` | Landing page, onboarding, household and operator dashboards, wallet connection, voice assistant, notifications |
| API | `apps/api` | Creates markets, records commitments, verifies delivery, settles, and streams events |
| Solana program | `programs/gridflex` | Holds the USDC escrow and enforces commitments, verification and payouts |
| Shared packages | `packages/shared`, `packages/solana` | Code used by more than one app (below) |
| Intelligence service | `services/intelligence`, models in `ml/` | Price-spike forecast, fair value and per-home baselines for the API. Optional: the API falls back to demo values without it. See [Intelligence service](intelligence.md) |

## Web app

The web app renders both dashboards and calls the API directly (`NEXT_PUBLIC_API_URL`). It holds no settlement logic.

- **Sessions.** better-auth with anonymous sessions in SQLite (`.data/auth.db`). A session starts when someone finishes onboarding and ends on sign out.
- **Profile.** Onboarding answers (role, resources, ZIP, AutoFlex limits) live in a cookie for now. Parsers clamp every value so a stale or edited cookie can't break a page.
- **Route handlers.** `/api/auth` for sessions and `/api/voice/session` to mint a signed URL for the voice agent.
- **Wallets.** Operators connect a Wallet Standard wallet in the browser and sign the escrow transaction. Participant wallets are held by the API.
- **Notifications.** The bell in the dashboard header turns market events from the SSE stream into notifications. They are stored per role in the browser (`localStorage`) and shown with role-specific wording. The mapping is in `apps/web/lib/notifications.ts`.
- **Voice.** A conversational agent on the household dashboard that reads dashboard state through client-side tools. See [Voice agent](voice-agent.md).

## API

The API is the orchestrator for settlement. It creates markets, clears them cheapest-first, records commitments on-chain, verifies simulated meter readings, pays participants, and publishes an SSE event after every step. Endpoints are in [API and data](api-and-data.md); the on-chain side is in [Solana settlement](solana.md).

## Shared packages

- `packages/shared`: illustrative demo data, market clearing, integer unit maths that mirrors the program, the Power Plan optimizer, and onboarding data such as ZIP-to-zone.
- `packages/solana`: the Solana client, program bindings generated from the IDL, and mock USDC helpers.

## Solana program

Only the parts that need to be trusted go on-chain: create the market and escrow, record commitments, record verification, settle, and refund. There's no order book, governance or token design.

## Realtime

The API streams server-sent events at `GET /stream`. The dashboard refetches the market when one arrives, and the notification bell turns it into a notification. The event list is in [API and data](api-and-data.md#sse-events).

## The off-chain / on-chain line

Keep fast-moving data off-chain (telemetry, forecasts, weather, private participant data). Keep the trust-critical data on-chain (escrow, commitments, verified deliveries, payouts). Don't blur that line for convenience.

## Intelligence service

A small internal Python service that serves the trained models (spike, fair value, home baseline) on a replayed real evening in Austin. The API calls it when the dashboard loads a forecast, when a market opens and when commitments are sized, never during settlement. Models predict; the API decides what to commit. Details in [Intelligence service](intelligence.md).

## Planned

These are designed but not built. The dashboards use static demo data in their place.

- **Zone load forecast.** The intelligence service forecasts prices and household baselines; zone load, congestion risk and required flexibility are still demo data. Design in [Forecasting and simulation](forecasting-and-simulation.md). The forecast itself comes from a model, never from an LLM.
- **Grid simulator.** Zone load that responds to weather, time and dispatched flexibility.
- **Orchestrator.** A simulated 15-minute clock that builds features, evaluates models, locks event terms and dispatches resources before handing the event to the chain worker. Design in [Model orchestration](model-orchestration.md).
- **Database.** PostgreSQL to replace in-memory state and cookies. The tables are sketched in [API and data](api-and-data.md#planned-data-model).
