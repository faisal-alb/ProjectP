# Intelligence and Grid Simulator

## Principle

The demo must work even if the AI API is unavailable.

AI enhances the explanation.

It should not be required to complete the market.

---

# Grid simulator

Create 5 zones.

Suggested:

```text
Downtown
North
South
East
West
```

Each zone:

```text
capacity_kw
baseline_load_kw
current_load_kw
temperature
event_multiplier
solar_generation_kw
```

---

# Simulated load formula

Example:

```text
current_load =
    baseline
  + time_effect
  + weather_effect
  + event_effect
  + noise
  - dispatched_flex
```

This does not need to be scientifically perfect.

It needs to behave predictably and visually.

---

# Demo control

Add a hidden or internal demo control:

```text
Trigger Downtown Peak
Reset Simulation
Trigger Emergency
```

This is extremely useful.

Do not depend on random chance for the live presentation.

---

# Forecasting

## MVP

A formula/rules engine is fine.

Output:

```text
current load
forecast load
capacity
risk score
required flex
reason codes
```

Example:

```json
{
  "predictedLoadKw": 12800,
  "capacityKw": 12000,
  "riskScore": 0.91,
  "requiredFlexKw": 800,
  "reasons": [
    "EVENING_PEAK",
    "HIGH_TEMPERATURE",
    "LARGE_EVENT"
  ]
}
```

---

# If time allows: simple ML

Train a small regression model on generated data.

Features:

```text
hour
day_of_week
temperature
humidity
event_attendance
cloud_cover
solar_generation
previous_load
```

Target:

```text
next_interval_load_kw
```

Do not spend hours finding perfect public datasets.

---

# AI explanation

After deterministic forecasting works, an LLM can convert structured signals into a human-readable explanation.

Input:

```json
{
  "zone": "Downtown",
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

Desired output:

```json
{
  "severity": "HIGH",
  "summary": "Downtown is expected to exceed local capacity during the evening peak.",
  "drivers": [
    "High cooling demand",
    "Large event demand",
    "Reduced solar generation"
  ],
  "recommendedFlexKw": 800
}
```

---

# Resource simulation

Each resource has:

```text
zone
type
capacity
available capacity
price
response speed
```

Example:

```text
EV Group A        180 kW    $0.08
HVAC Group B      170 kW    $0.09
Solar Group C     100 kW    $0.11
Battery D         300 kW    $0.14
Generator E       250 kW    $0.32
```

This lets the matching engine visibly prefer cheaper clean/flexible resources before expensive generator use.

---

# Verification simulation

When dispatch occurs:

```text
baseline_kw = expected usage without action
actual_kw = simulated actual usage
verified_relief_kw = baseline_kw - actual_kw
```

For generation/storage:

```text
verified_relief_kw = delivered generation/discharge
```

Show a clear verification result in the UI:

```text
Committed: 100 kW
Delivered: 102 kW
Result: VERIFIED
```
