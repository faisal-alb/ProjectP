# Demo and pitch

A judge should understand the product in under two minutes. Don't start with architecture. Start with the problem.

The figures below are the illustrative demo data described in [Product](product.md#demo-scenario). Before presenting, make sure the settlement flow works end to end (`npm run solana:demo`), and keep it as your fallback if the UI or API breaks. Setup is in [Solana settlement](solana.md#running-it).

## Two-minute demo

### 1. Show the grid

"GridFlex monitors local grid capacity and distributed resources."

```text
Downtown Austin
Current:  10.8 MW
Capacity: 12.0 MW
```

### 2. Show the forecast

"Our forecasting system predicts Downtown Austin will reach 12.8 MW during the evening peak."

With the model service running, point at **Price spike outlook**: "This is a real evening, 20 August 2024, replayed. At 5 PM our spike model, which never saw that day, put the chance of an ERCOT price spike before 8 PM at 88%. The 7–8 PM window cleared at $4,857/MWh." Click **Use $0.55/kWh as your price** to set the cap from the model.

```text
Predicted:       12.8 MW at 7:20 PM
Capacity:        12.0 MW
Required relief: 800 kW
Risk:            HIGH
```

Point at the drivers: high temperatures, evening demand and a large nearby event.

### 3. Fund the request

"Instead of waiting for an overload, the operator buys 800 kW of local flexibility."

As the grid operator, connect a wallet, click **Get test USDC** if needed, then **Fund request**. The operator signs one transaction: the USDC escrow. Don't spend 30 seconds explaining wallets.

### 4. Show matching

GridFlex accepts the cheapest offers that cover the need, up to the operator's price cap:

```text
EV Fleet #4                     180 kW   $0.08
Tower HVAC                      170 kW   $0.09
Solar Group #9                  100 kW   $0.11
Downtown Austin home batteries   100 kW   $0.14
Battery #17                     250 kW   $0.16
                               --------
Total                           800 kW
```

"Backup Generator #3 offered 250 kW at $0.32, above the $0.20 cap, so it's not used."

### 5. Show Solana

"The escrow and every commitment are recorded on Solana, so the market and settlement are auditable."

Open a transaction link from the dashboard.

### 6. Verify and settle

"A simulated meter verifier confirms delivery."

Click **Verify delivery**:

```text
Committed: 800 kW
Delivered: 800 kW   (EV fleet +10 kW, solar group -10 kW)
Payable:   790 kW   (nobody is paid for more than they committed)
```

Then click **Settle payments**:

```text
Escrowed: $160.00
Paid:      $93.60  to 18 participants (24 without the model service)
Refunded:  $66.40  to the operator
```

### 7. Show a participant

Sign out from the account menu, then choose **Provide flexibility** on the onboarding page and finish setup. Show the household's payout in the header wallet: $0.84 (6.0 kWh at $0.14) when the baseline model sized the homes, $0.70 (5 kWh) without it. To also show the "You got paid" notification, open the household dashboard in a second window before settling; notifications arrive live and aren't replayed.

## Pitch structure

| Beat | Line |
|---|---|
| Problem | The grid has more distributed energy resources than ever, but coordinating them during local congestion is difficult. |
| Insight | A battery, EV, building or generator can all offer something the grid values: flexibility. |
| Solution | GridFlex predicts where flexibility is needed and creates a local market for it. |
| Why blockchain | Solana gives many small participants an auditable market and settlement layer. |
| Why AI | Forecasting finds where congestion is likely before it becomes an outage. |
| Future | Utilities, microgrids, developing regions with unreliable power, EV fleets, commercial buildings, home batteries, solar communities. |

## Questions judges may ask

### "Why blockchain?"

Grid operations and telemetry stay off-chain. Solana is used where decentralization and auditability help: market commitments and settlement between many independent participants.

### "Why not just use a normal database?"

The grid-control system can use a normal database internally. Solana's value is a shared settlement layer where utilities, aggregators and independent resource owners can transact without one party owning the financial ledger.

### "How do you know the electricity was actually delivered?"

A verifier checks meter data and submits the verified result. The demo uses simulated meter data. A production system would integrate utility meters, device telemetry or trusted hardware. The program already guarantees the operator can't be charged more than the escrow and nobody is paid more than they committed ([trust model](solana.md#trust-model-v1)).

### "Does the electricity move through Solana?"

No. Electricity still moves through the physical grid. Solana coordinates commitments and settlement.

### "Why AI?"

The core numerical forecast can be deterministic or machine-learning based. AI helps combine forecast signals, weather, event context and operational data into actionable explanations and procurement recommendations. The voice assistant and the Power Plan apply the same idea for households: a deterministic optimizer decides, and the assistant explains ([Voice agent](voice-agent.md)).

## Final presentation rule

Never describe the project as "people selling electricity on blockchain." Describe it as:

**A real-time local flexibility market that helps grid operators prevent congestion by coordinating distributed energy resources.**
