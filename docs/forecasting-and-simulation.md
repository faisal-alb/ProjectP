# Forecasting and simulation

*Planned. The design for the grid simulator and the forecast service. Today the dashboards show static demo data (`packages/shared/src/demo-data.ts`), and the API's only simulation is the demo meter reading in `packages/shared/src/participants.ts`. For the fuller Python design, see [Model orchestration](model-orchestration.md).*

## Principle

The demo must work even if the AI API is unavailable. AI improves the explanation; it must never be required to complete a market, and it never decides the numeric forecast.

## Grid simulator

Five zones: Downtown, North, South, East and West. Each zone has:

| Field | Meaning |
|---|---|
| `capacity_kw` | Safe capacity |
| `baseline_load_kw` | Typical load |
| `current_load_kw` | Load right now |
| `temperature` | Weather input |
| `event_multiplier` | Effect of a large nearby event |
| `solar_generation_kw` | Local solar output |

Load is a simple formula. It doesn't need to be scientifically perfect, only predictable and visible:

```text
current_load =
    baseline
  + time_effect
  + weather_effect
  + event_effect
  + noise
  - dispatched_flex
```

### Demo controls

Add an internal control with **Trigger Downtown Peak**, **Reset Simulation** and **Trigger Emergency**. Don't depend on random chance for a live presentation.

## Forecasting

### MVP: rules

A formula or rules engine is enough. It outputs the current load, forecast load, capacity, risk score, required flex and reason codes:

```json
{
  "predictedLoadKw": 12800,
  "capacityKw": 12000,
  "riskScore": 0.91,
  "requiredFlexKw": 800,
  "reasons": ["EVENING_PEAK", "HIGH_TEMPERATURE", "LARGE_EVENT"]
}
```

### Later: a small ML model

Train a small regression model on generated data.

| | |
|---|---|
| Features | `hour`, `day_of_week`, `temperature`, `humidity`, `event_attendance`, `cloud_cover`, `solar_generation`, `previous_load` |
| Target | `next_interval_load_kw` |

Don't spend hours hunting for perfect public datasets. The work already in `ml/` uses real ERCOT prices and weather to predict price spikes; see [Model orchestration](model-orchestration.md).

### AI explanation

Once deterministic forecasting works, an LLM can turn structured signals into a readable explanation.

Input:

```json
{
  "zone": "Downtown Miami",
  "currentLoadKw": 10800,
  "predictedLoadKw": 12800,
  "capacityKw": 12000,
  "requiredFlexKw": 800,
  "signals": {
    "temperatureF": 96,
    "eventAttendance": 19000,
    "solarChangePct": -18
  }
}
```

Output:

```json
{
  "severity": "HIGH",
  "summary": "Downtown Miami is expected to exceed local capacity during the evening peak.",
  "drivers": ["High cooling demand", "Large event demand", "Reduced solar generation"],
  "recommendedFlexKw": 800
}
```

## Resource simulation

Each resource has a zone, type, capacity, available capacity, price and response speed. The demo offers (see [Product](product.md#demo-scenario)) let the matching engine visibly prefer cheap, flexible resources before expensive generator use:

| Offer | kW | $/kWh |
|---|---|---|
| EV Fleet #4 | 180 | 0.08 |
| Tower HVAC | 170 | 0.09 |
| Solar Group #9 | 100 | 0.11 |
| Downtown Miami home batteries | 100 | 0.14 |
| Battery #17 | 250 | 0.16 |
| Backup Generator #3 | 250 | 0.32 |

## Verification simulation

When dispatch happens:

```text
baseline_kw        = expected usage without action
actual_kw          = simulated actual usage
verified_relief_kw = baseline_kw - actual_kw
```

For generation and storage, `verified_relief_kw` is the delivered generation or discharge.

Show a clear result in the UI:

```text
Committed: 100 kW
Delivered: 102 kW
Result: VERIFIED
```

The API's demo meter reading already works this way in miniature: the EV fleet over-delivers by 10 kW (paid only what it committed) and the solar group under-delivers by 10 kW (paid only what it delivered).
