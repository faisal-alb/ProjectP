# GridFlex Hackathon Guide

## Goal

Build a convincing end-to-end demo of a local grid-flexibility market:

**Predict congestion → create a flexibility request → match local resources → simulate delivery → verify it → settle on Solana.**

This is a 36-hour hackathon project for a **2-person team**. The goal is not to build a production utility platform. The goal is to make one complete flow work extremely well.

---

## One-sentence pitch

**GridFlex uses AI-assisted forecasting to predict local electricity congestion, then lets utilities procure distributed grid flexibility from batteries, EVs, buildings, solar, and generators through a transparent Solana-based market.**

---

## Core demo story

1. A city grid has several zones.
2. One zone is forecast to exceed safe capacity.
3. GridFlex explains why the congestion is expected.
4. The utility launches a flexibility request.
5. Available local resources submit or expose offers.
6. GridFlex selects the cheapest valid resources.
7. The grid simulator shows the resources responding.
8. A verifier confirms the promised relief was delivered.
9. The Solana program records/settles the event.
10. The dashboard shows the congestion was avoided and participants were paid.

---

## What we are building

### Must-have

- Utility dashboard
- 4–5 simulated grid zones
- Live-ish load data
- Congestion prediction
- Flex request creation
- Distributed resources
- Resource matching
- Solana transaction/program interaction
- Simulated meter verification
- Settlement result
- Participant view
- Clean final demo

### Nice-to-have

- Weather input
- Event input
- LLM-generated explanation
- Map visualization
- Emergency/Grid Rescue mode
- Mock USDC
- Carbon/savings metrics

### Do not build during the hackathon

- Real utility integrations
- Real smart-meter integrations
- Full authentication
- Multiple production services
- Complex permission systems
- Real billing
- Real tokenomics
- Advanced machine learning infrastructure
- Kubernetes
- Redis/BullMQ unless absolutely necessary

---

## Recommended repo shape

```text
gridflex/
├── apps/
│   ├── web/              # Next.js dashboard
│   └── api/              # Hono API
├── services/
│   └── intelligence/     # Forecasting / AI service
├── programs/
│   └── gridflex/         # Solana Anchor program
├── packages/
│   ├── db/
│   ├── shared/
│   └── solana/
└── docs/
```

The simulator can live inside the API unless separating it is genuinely helpful.

---

## Recommended stack

- **Frontend:** Next.js + TypeScript + Tailwind
- **API:** Hono + Bun
- **Database:** PostgreSQL + Drizzle
- **Realtime:** Server-Sent Events
- **Forecasting:** Python + FastAPI
- **Solana:** Anchor + Rust
- **Client integration:** Solana TypeScript SDK
- **Charts:** Recharts
- **Map:** MapLibre or Mapbox only if time allows
- **AI explanations:** OpenAI API only after the deterministic demo works

---

## Team rule

If a feature does not improve the 2-minute demo, it is probably not worth building during the hackathon.
