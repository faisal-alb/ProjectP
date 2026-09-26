# Demo and Pitch Guide

## Demo objective

A judge should understand the product in under two minutes.

Do not start with architecture.

Start with the problem.

---

# 2-minute demo

## 1. Show the grid

"GridFlex monitors local grid capacity and distributed resources."

Show:

```text
Downtown
Current: 10.8 MW
Capacity: 12.0 MW
```

---

## 2. Trigger the forecast

"Our forecasting system predicts Downtown will reach 12.8 MW during the upcoming peak."

Show:

```text
Predicted: 12.8 MW
Capacity: 12.0 MW
Required relief: 800 kW
Risk: HIGH
```

If AI explanation exists:

"High temperatures, evening demand, and a large nearby event are driving the forecast."

---

## 3. Create a market

"Instead of waiting for overload, the utility buys 800 kW of local flexibility."

Click:

**Resolve with GridFlex**

---

## 4. Show matching

Show resources selected:

```text
EV charging shift      180 kW
Commercial HVAC        170 kW
Battery discharge      300 kW
Solar export           100 kW
Generator               50 kW
                      --------
Total                   800 kW
```

"GridFlex selects available resources in the affected area."

---

## 5. Show Solana

"The commitment is recorded on Solana so the market and settlement are auditable."

Show transaction confirmation.

Do not spend 30 seconds explaining wallets.

---

## 6. Dispatch

Show the simulator reacting.

```text
Before: 12.8 MW
After:  12.0 MW
```

"Those resources now respond to the grid request."

---

## 7. Verify and settle

"Our simulated meter verifier confirms delivery."

Show:

```text
Committed: 800 kW
Delivered: 806 kW
Verified
Settled
```

Then show payout/transaction.

---

# Pitch structure

## Problem

The grid has more distributed energy resources than ever, but coordinating them during local congestion is difficult.

## Insight

A battery, EV, building, or generator can all provide something valuable to the grid: flexibility.

## Solution

GridFlex predicts where flexibility is needed and creates a local market for it.

## Why blockchain

Solana provides an auditable market and settlement layer for many small participants.

## Why AI

Forecasting helps identify where congestion is likely before it becomes an outage.

## Future

- utilities
- microgrids
- developing regions with unreliable power
- EV fleets
- commercial buildings
- home batteries
- solar communities

---

# Questions judges may ask

## "Why blockchain?"

Answer:

Grid operations and telemetry remain off-chain. Solana is used where decentralization and auditability are useful: market commitments and settlement between many independent participants.

---

## "Why not just use a normal database?"

Answer:

The grid-control system can absolutely use a normal database internally. The value of Solana is creating a shared settlement layer where utilities, aggregators, and independent energy-resource owners can transact without one party owning the financial ledger.

---

## "How do you know the electricity was actually delivered?"

Answer:

A verifier/oracle checks meter data and submits the verified result. Our hackathon uses simulated meter data. A production system would integrate utility meters, device telemetry, or trusted hardware.

---

## "Does the electricity move through Solana?"

Answer:

No. Electricity still moves through the physical grid. Solana coordinates commitments and settlement.

---

## "Why AI?"

Answer:

The core numerical forecast can be deterministic or machine-learning based. AI helps combine forecast signals, weather, event context, and operational data into actionable explanations and procurement recommendations.

---

# Final presentation rule

Never describe the project as:

"people selling electricity on blockchain."

Describe it as:

**"A real-time local flexibility market that helps grid operators prevent congestion by coordinating distributed energy resources."**
