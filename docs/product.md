# Product

GridFlex is a local flexibility marketplace. It predicts when a zone is about to exceed its safe capacity, works out how much relief is needed, and creates a market where nearby resources are paid to provide it.

## Problem

Electric grids get congested locally when demand approaches or exceeds the safe capacity of a feeder, transformer or zone.

At the same time, nearby distributed resources may be available:

- batteries
- EV charging loads
- commercial buildings
- rooftop solar
- generators
- flexible HVAC demand

Those resources could ease the stress, but coordinating and paying many small participants is hard.

## How it works

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

Participants provide flexibility by:

- making energy
- discharging stored energy
- using less energy
- shifting energy use to a later time

Locality is the point. Flexibility is matched to the specific zone that needs it, not dispatched from anywhere on the grid.

## Users

### Grid operator

The buyer: a utility, city energy planner or microgrid operator. Needs to:

- see grid health and forecast congestion
- understand the likely causes
- open a flexibility request
- see available resources
- monitor dispatch
- see settlement

### Participant

The seller: a homeowner with a battery, an EV owner, a business, a solar owner or a generator owner. Needs to:

- see what they can offer
- see the current opportunity and the expected payout
- decide whether to take part, or let AutoFlex decide within their limits
- see completed earnings

### City or regulator

Not part of the current product. Could later see peak reduction, avoided generator use, cost savings, payouts and estimated emissions impact.

## Terminology

Use **grid congestion**, **peak-demand event**, **local capacity constraint** or **energy shortage**. Don't make the main claim about "power surges"; a voltage surge is a different technical problem.

### Resource categories

The product treats every resource as an input to the same market. Two vocabularies describe them, one for each audience:

| What the resource does | Participant-facing label (app) | Grid-facing term (marketing, operator views) |
|---|---|---|
| Makes electricity (solar, generators, microgrids) | **Makes power** | Generate |
| Holds electricity (home and commercial batteries, vehicle-to-grid) | **Stores power** | Store |
| Can run later or use less (EV charging, HVAC, water heating, industrial load) | **Uses power** | Shift and Reduce |

The participant labels are the `role` values `producer`, `storer` and `consumer` in `packages/shared/src/onboarding.ts`.

## What is being bought?

The operator is buying **grid flexibility**. In the demo:

> 1 Flex = 1 kWh of verified grid relief delivered during a requested interval.

The relief can come from:

- +1 kWh produced
- +1 kWh discharged from storage
- −1 kWh of consumption
- 1 kWh shifted outside the constrained interval

This is a product abstraction for the demo, not a proposed market standard.

## Why Solana

Solana is the market and settlement layer, not the physical grid.

On-chain:

- market creation and USDC escrow
- commitments (accepted offers)
- verification results and proof hashes
- settlement and refund
- transaction history

Off-chain:

- raw smart-meter readings
- weather data and forecasts
- news and event data
- private participant information
- high-frequency telemetry

See [Solana settlement](solana.md) for how it works.

## Demo scenario

**Downtown Miami, evening peak.** The figures are illustrative.

| | |
|---|---|
| Safe capacity | 12.0 MW |
| Current load | 10.8 MW |
| Predicted peak (7:20 PM) | 12.8 MW |
| Required flexibility | 800 kW, 7–8 PM |
| Price cap | $0.20 per kWh |

Offers, cheapest first (from `packages/shared/src/demo-data.ts`):

| Offer | kW | $/kWh | Outcome |
|---|---|---|---|
| EV Fleet #4 | 180 | 0.08 | Accepted |
| Tower HVAC | 170 | 0.09 | Accepted |
| Solar Group #9 | 100 | 0.11 | Accepted |
| Downtown Miami home batteries | 100 | 0.14 | Accepted |
| Battery #17 | 250 | 0.16 | Accepted |
| Backup Generator #3 | 250 | 0.32 | Rejected: above the cap |

The market clears the cheapest offers that cover 800 kW, and never accepts one above the price cap. The dashboard then shows the zone load coming back under capacity. The [demo script](demo-and-pitch.md) walks through it.
