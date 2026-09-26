# API and Data Model

## Keep the data model small

Recommended tables:

```text
grid_zones
resources
forecasts
flex_markets
market_commitments
meter_readings
settlements
```

Optional:

```text
grid_events
```

---

# Data model

## grid_zones

```text
id
name
capacity_kw
current_load_kw
baseline_load_kw
status
created_at
updated_at
```

Status:

```text
NORMAL
WATCH
CONGESTED
EMERGENCY
```

---

## resources

```text
id
name
zone_id
type
capacity_kw
available_kw
price_per_kwh
state
wallet_address
metadata_json
```

Types:

```text
BATTERY
EV
SOLAR
GENERATOR
HVAC
COMMERCIAL_LOAD
```

State:

```text
AVAILABLE
COMMITTED
DISPATCHED
OFFLINE
```

---

## forecasts

```text
id
zone_id
forecast_for
predicted_load_kw
capacity_kw
risk_score
required_flex_kw
reason_json
created_at
```

---

## flex_markets

```text
id
zone_id
start_time
end_time
required_flex_kw
max_price_per_kwh
status
solana_market_address
solana_tx
created_at
```

Status:

```text
DRAFT
OPEN
MATCHED
DISPATCHING
VERIFYING
SETTLED
CANCELLED
```

---

## market_commitments

```text
id
market_id
resource_id
committed_kw
price_per_kwh
expected_kwh
status
solana_tx
```

---

## meter_readings

```text
id
resource_id
market_id
timestamp
baseline_kw
actual_kw
verified_relief_kw
```

---

## settlements

```text
id
market_id
resource_id
delivered_kwh
amount
status
solana_tx
created_at
```

---

# API

## Grid

```text
GET /grid/zones
GET /grid/zones/:id
POST /grid/reset
```

---

## Forecast

```text
GET /forecast/:zoneId
POST /forecast/:zoneId/run
```

Example:

```json
{
  "zoneId": "downtown",
  "currentLoadKw": 10800,
  "predictedLoadKw": 12800,
  "capacityKw": 12000,
  "riskScore": 0.91,
  "requiredFlexKw": 800,
  "reasons": [
    "EVENING_PEAK",
    "HIGH_TEMPERATURE",
    "EVENT_DEMAND"
  ]
}
```

---

## Resources

```text
GET /resources
GET /resources?zoneId=downtown
GET /resources/:id
```

---

## Markets

```text
POST /markets
GET /markets
GET /markets/:id
POST /markets/:id/match
POST /markets/:id/dispatch
POST /markets/:id/verify
POST /markets/:id/settle
```

---

# Market creation example

```json
{
  "zoneId": "downtown",
  "requiredFlexKw": 800,
  "durationMinutes": 60,
  "maxPricePerKwh": 0.40
}
```

---

# Matching algorithm

For the hackathon:

1. Filter resources to the affected zone.
2. Filter to AVAILABLE resources.
3. Sort ascending by price.
4. Select until committed flexibility >= required flexibility.
5. Mark selected resources COMMITTED.

Pseudo:

```ts
const candidates = resources
  .filter(r => r.zoneId === zoneId)
  .filter(r => r.state === "AVAILABLE")
  .sort((a, b) => a.pricePerKwh - b.pricePerKwh);

let total = 0;
const selected = [];

for (const resource of candidates) {
  if (total >= requiredKw) break;

  const needed = requiredKw - total;
  const committed = Math.min(resource.availableKw, needed);

  selected.push({
    resourceId: resource.id,
    committedKw: committed,
    pricePerKwh: resource.pricePerKwh
  });

  total += committed;
}
```

That is enough for the demo.
