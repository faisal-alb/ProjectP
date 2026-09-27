# Demo and pitch

A judge should understand the product in under two minutes. Start with the problem, not the architecture.

The demo runs the shared energy day described in [Shared energy day](showcase.md): August 20, 2024 in Austin, replayed from public data, with real Solana devnet settlement. Prepare it with the commands there, and check that presenter **Check readiness** reports "Ready to run." before you start.

## Setup

Use two browser sessions, because the role is stored in a cookie:

- **Operator** (normal window): Get Started → Set up your grid → Finish configuration → Open control center.
- **Household** (private window): Get Started → Provide flexibility → Finish setup → Go to My Energy.

In the operator window, press Ctrl Shift S, unlock with `.data/presenter-code`, set **Playback speed** to **Manual · next event**, and close the panel. Don't start the day until you present.

## Two-minute demo

1. **The forecast.** On the operator overview, name the lines: modeled demand, forecast, and the neighborhood's 55 kW limit. Point at the decision record under the chart.
2. **An event opens.** Click **Next event**. On the stress day the first event opens at 12:01 AM, so switch **Area** to the neighborhood that has it. "The optimizer saw this neighborhood going over its limit and opened a request for relief."
3. **Commit, deliver, verify.** Keep clicking **Next event**. Each click stops at the next event phase: committing, dispatching, verifying, settling, completed. "Baselines are hashed before dispatch, so no one can inflate delivery afterwards."
4. **Settlement.** When the event shows payouts, open **Escrow account** in Solana Explorer. "Every payout and refund is a real, auditable transaction."
5. **The household.** Switch to the household window: the battery, the decision, and **Earnings**.
6. **Ask GridFlex.** Ask by voice or text: "Why did GridFlex call an event?" The assistant reads the live run and can run what-ifs on a copy, but it can't send transactions or change settings.

With more time, inject a scenario from the presenter controls (for example **Demand surge** or **Device unavailable**). Some scenarios need a compatible active event, so rehearse the one you plan to show.

Transactions are real and can take a few seconds. The run never fakes a confirmation. After a rehearsal, click **Next event** until it reads **Day complete**, then create a new stress-day run.

## Pitch structure

| Beat | Line |
|---|---|
| Problem | Grids overload one neighborhood at a time, while the batteries, EVs and thermostats that could help sit on the same street, uncoordinated and unpaid. |
| Solution | GridFlex predicts which neighborhood is about to exceed its limit, buys relief from nearby resources, and pays only for verified delivery. |
| Why AI | Models forecast load, price spikes and household baselines; a linear program decides dispatch; the voice agent explains decisions. Forecasts never come from a language model. |
| Why Solana | Many small participants settle against one auditable escrow that no single party controls, with fees small enough for cent-level payouts. |
| Proof | A full devnet day: 40 events, none left unresolved, and 37 fault scenarios tested. See [Latest local validation](showcase.md#latest-local-validation). |

## Questions judges may ask

### "Why blockchain?"

Grid operations and telemetry stay off-chain. Solana is used where auditability between independent parties helps: escrow, commitments, verified delivery, payouts and refunds.

### "How do you know the energy was delivered?"

Each resource's baseline is predicted and hashed before dispatch, and delivery is measured against it. Invalid readings are quarantined, and payment is capped at the commitment. The demo's meter readings come from a device simulator; production would use utility meters or device telemetry. See the [trust model](solana.md#trust-model-v1).

### "Is the data real?"

The inputs are public historical data (ERCOT load and prices, Open-Meteo weather, NREL ResStock and ComStock). Devices, neighborhood downscaling and the 55 kW limits are modeled. There are no connected utility accounts and no real-dollar payouts.

### "Does the electricity move through Solana?"

No. Electricity moves through the physical grid. Solana records the market and settlement.

## Final presentation rule

Never describe the project as "people selling electricity on blockchain." Describe it as:

**A real-time local flexibility market that helps grid operators prevent congestion by coordinating distributed energy resources.**
