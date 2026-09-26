# 36-Hour Build Plan

This plan assumes two people.

## Definition of done

The project is successful when this exact flow works:

1. Dashboard shows grid zones.
2. Downtown approaches congestion.
3. Forecast says Downtown will exceed capacity.
4. User creates or approves a flexibility market.
5. Resources are selected.
6. A real Solana transaction occurs.
7. Simulator applies the resources.
8. Dashboard load falls.
9. Delivery is verified.
10. Settlement is shown.

Everything else is secondary.

---

# Phase 1 — Foundation

## Person A

- Create Next.js app
- Create dashboard layout
- Build zone cards
- Build zone detail page
- Add charts
- Add mock state first

## Person B

- Create Hono API
- Add PostgreSQL/Drizzle
- Define shared schemas
- Build grid simulator
- Create grid/resource seed data

## Shared milestone

Frontend can display:

- 5 zones
- current load
- capacity
- resource availability

---

# Phase 2 — Congestion

## Person A

- Congestion warning UI
- Forecast panel
- "Resolve with GridFlex" flow
- Resource list

## Person B

- Forecast endpoint
- Basic forecast logic
- Risk calculation
- Flex requirement calculation
- Matching algorithm

### Minimum forecast

A deterministic formula is acceptable:

```text
forecast =
    baseline
  + time-of-day effect
  + temperature effect
  + event effect
  + random variation
```

Do not block progress waiting for ML.

---

# Phase 3 — Solana

## Person B primarily

Implement the smallest useful Anchor program.

Suggested instructions:

- create_market
- accept_commitment
- verify_delivery
- settle_market

Person A adds:

- transaction states
- wallet/tx UI
- explorer link if available

---

# Phase 4 — Full simulation

Implement the demo loop:

```text
Congestion predicted
        ↓
Create market
        ↓
Select resources
        ↓
Dispatch
        ↓
Grid load falls
        ↓
Verification
        ↓
Settlement
```

This is the point where the hackathon project becomes viable.

---

# Phase 5 — Polish

Only after the complete loop works.

Add:

- better animations
- map
- weather
- event data
- AI explanation
- mock USDC
- Grid Rescue mode
- city analytics
- participant auto-flex controls

---

# Last 4–6 hours

Stop adding architecture.

Do:

- fix demo bugs
- resettable demo seed
- loading states
- empty/error states
- rehearse pitch
- record backup demo
- check all Solana transactions
- prepare screenshots
- prepare architecture diagram
- prepare fallback if external API fails

---

# Hard feature cut line

If time is running out, cut in this order:

1. City/regulator dashboard
2. Map
3. Event API
4. Weather API
5. LLM explanation
6. Real ML model
7. Participant automation settings

Never cut:

- congestion prediction
- flex market
- resource matching
- Solana interaction
- simulated verification
- final settlement
