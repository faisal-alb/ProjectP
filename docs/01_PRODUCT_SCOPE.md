# Product Scope

## Problem

Electric grids experience local congestion when electricity demand temporarily approaches or exceeds the safe capacity of a feeder, transformer, or local grid zone.

At the same time, nearby distributed resources may be available:

- batteries
- EV charging loads
- commercial buildings
- rooftop solar
- generators
- flexible HVAC demand

Those resources can potentially reduce stress on the grid, but coordinating and paying many small participants is difficult.

---

## Product

GridFlex is a local flexibility marketplace.

When GridFlex predicts that a zone may become congested, it estimates the amount of grid relief required and creates a market for that relief.

Participants can provide flexibility by:

- producing energy
- discharging stored energy
- reducing demand
- shifting demand to a later time

---

## Core product loop

```text
Forecast
   ↓
Detect congestion
   ↓
Calculate required flexibility
   ↓
Create market
   ↓
Match resources
   ↓
Dispatch resources
   ↓
Verify delivery
   ↓
Settle
```

---

## Main users

### Utility operator

Needs to:

- see grid health
- see forecast congestion
- understand likely causes
- create a flexibility request
- view available resources
- monitor dispatch
- see settlement

### Participant

Examples:

- homeowner with battery
- EV owner
- business
- solar owner
- generator owner

Needs to:

- see available capacity
- see current opportunity
- decide whether to participate
- see expected payout
- see completed earnings

### City/regulator

Not required for MVP.

Could later see:

- peak reduction
- generator use avoided
- cost savings
- participant payouts
- estimated emissions impact

---

## Important terminology

Use **grid congestion**, **peak-demand event**, **local capacity constraint**, or **energy shortage**.

Avoid making the main claim about "power surges." A voltage surge is a different technical problem.

---

## What is being bought?

The utility is buying **grid flexibility**.

For the hackathon, define:

> 1 Flex = 1 kWh of verified grid relief delivered during a requested interval.

The relief can come from:

- +1 kWh produced
- +1 kWh discharged from storage
- -1 kWh of consumption
- 1 kWh shifted outside the constrained interval

This is a product abstraction for the demo, not a proposed universal market standard.

---

## Why Solana is included

Solana is the market and settlement layer, not the physical grid.

Use it for:

- market creation
- commitments
- accepted offers
- escrow/settlement
- transaction history
- proof hashes

Keep the following off-chain:

- raw smart-meter readings
- weather data
- forecasts
- news/event data
- private participant information
- high-frequency telemetry

---

## Demo scenario

Recommended:

**Downtown zone — evening peak**

Current load:
- 10.8 MW

Safe capacity:
- 12.0 MW

Predicted peak:
- 12.8 MW

Required flexibility:
- 800 kW

Available resources:
- EV charging reduction: 180 kW
- Commercial HVAC reduction: 170 kW
- Battery discharge: 300 kW
- Solar export: 100 kW
- Generator: 200 kW

The procurement engine selects the cheapest combination that supplies at least 800 kW.

The simulator then lowers the zone load to a safe level.
