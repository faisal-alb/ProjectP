# Architecture

## Keep it simple

There are only four meaningful components for the hackathon:

1. Next.js web app
2. Hono API
3. Intelligence service
4. Solana program

PostgreSQL supports the API.

The simulator should stay inside the API unless separating it makes development easier.

---

## System diagram

```text
                         External Inputs
                       ┌─────────────────┐
                       │ Weather / Event │
                       └────────┬────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ Intelligence Service │
                    │ forecast + risk      │
                    └──────────┬───────────┘
                               │
                               ▼
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│ Next.js Web  │◄─────►│ Hono API         │◄─────►│ PostgreSQL   │
│ Dashboard    │  SSE  │ Orchestrator     │       │              │
└──────────────┘       └───────┬──────────┘       └──────────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      Grid Simulator     Match Engine      Solana Client
                                                   │
                                                   ▼
                                         ┌─────────────────┐
                                         │ Anchor Program  │
                                         └─────────────────┘
```

---

## Frontend responsibilities

The Next.js app should:

- render utility dashboard
- render participant dashboard
- show live zone load
- show forecasts
- show warnings
- trigger market creation
- show offers/resources
- show dispatch progress
- show Solana status
- show final settlement

The frontend should not contain grid business logic.

---

## API responsibilities

The API is the orchestrator.

It should:

- expose grid state
- maintain simulator state
- call intelligence service
- create markets
- select resources
- trigger simulated dispatch
- verify simulated delivery
- call Solana
- publish SSE updates
- persist important state

---

## Intelligence responsibilities

The intelligence service should:

- receive zone state
- produce a demand forecast
- calculate congestion risk
- estimate required flexibility
- optionally generate feature importance/reason codes

The LLM is optional and should not determine the actual numeric forecast.

---

## Solana responsibilities

The Solana program should only cover the parts judges need to see are actually on-chain.

Recommended:

- create market
- register/accept commitment
- record verification result
- settle market

Do not build an elaborate decentralized exchange.

---

## Realtime

Use Server-Sent Events.

Suggested stream:

```text
GET /api/stream
```

Possible events:

```text
grid.updated
forecast.updated
market.created
resource.selected
dispatch.started
dispatch.updated
verification.completed
settlement.completed
```

---

## Important architectural rule

If a component can be represented as a function inside the API during the hackathon, do that first.

Split it into another service only when:

- the language requires it, or
- both teammates need to work independently on it.
