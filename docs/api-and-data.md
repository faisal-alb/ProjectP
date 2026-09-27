# API and data

The dashboard now uses the durable shared-run API documented in [Shared energy day](showcase.md#apis-and-persistence). The market endpoints below remain available for presenter-authorized manual operations; all market/faucet POST requests require the presenter bearer token.

The HTTP API in `apps/api` runs the market lifecycle and streams live events. The data model and the forecast, grid and resource endpoints further down are the planned design.

## API

Hono on Node, port `8787` (`API_PORT`). State is in memory and mirrored to `.data/*.<cluster>.json` (gitignored). The on-chain side of each step is in [Solana settlement](solana.md).

| Method | Path | Does |
|---|---|---|
| `GET` | `/health` | Cluster, RPC, program id, USDC mint, verifier, and whether the intelligence service is `online`. |
| `GET` | `/forecast/:zone` | `{ forecast }` from the [intelligence service](intelligence.md) (P(spike), fair value, suggested price), or `{ forecast: null }` when it isn't running. |
| `GET` | `/markets/current` | The latest funded market, or `null`. |
| `GET` | `/markets/:id` | One market with commitments, payouts and explorer links. |
| `POST` | `/markets` | `{ operatorWallet, maxPricePerKwh }` → unsigned `create_market` transaction (base64) with the escrow amount. |
| `POST` | `/markets/:id/confirm` | `{ signedTransaction }` (the API broadcasts it) or `{ signature }`. Waits for the escrow on-chain, clears the market, records commitments (households sized by the baseline model when it's running). Confirming again after a partial failure picks up where it stopped. |
| `POST` | `/markets/:id/verify` | Demo meter readings → `verify_delivery` for every commitment. Model-sized households are measured against their committed baseline, and the proof includes its hash. |
| `POST` | `/markets/:id/settle` | Pays every commitment, then closes the market and refunds the operator. |
| `GET` | `/households/:resourceId` | Managed wallet, live USDC balance, payouts, and tonight's status. |
| `GET` | `/wallets/:address/usdc` | USDC balance of any wallet. |
| `POST` | `/faucet` | `{ wallet }` → 500 mock USDC plus fee SOL. Not available on mainnet. |
| `GET` | `/stream` | Server-sent events (below). |

Lifecycle steps return `409` if the market isn't in the right phase or is already being updated, so a double click is harmless.

### SSE events

| Event | Sent when |
|---|---|
| `market.created` | Escrow confirmed on-chain |
| `commitment.accepted` | Accepted offers recorded |
| `verification.completed` | Deliveries recorded |
| `settlement.completed` | Participants paid |
| `market.closed` | Remainder refunded, vault closed |
| `market.failed` | A step failed; the payload has the message |

Each event carries `{ type, marketId }` (plus `data` for `market.failed`). The stream also sends `ready` on connect and a `ping` every 20 seconds. The dashboard refetches the market or household when an event arrives, and the notification bell turns it into a notification.

### Matching

Offers are cleared cheapest first, up to the price cap, until the required kW is covered. Offers above the cap are rejected. The code is `clearMarket` in `packages/shared/src/demo-data.ts`, and the API calls it when a market is confirmed. The offers and result for the demo scenario are in [Product](product.md#demo-scenario).

## Planned data model

*Planned. Today the dashboards read static demo data from `packages/shared/src/demo-data.ts` and the API keeps its state in memory.*

Keep it small. Recommended tables: `grid_zones`, `resources`, `forecasts`, `flex_markets`, `market_commitments`, `meter_readings` and `settlements`, with `grid_events` optional.

| Table | Fields |
|---|---|
| `grid_zones` | `id`, `name`, `capacity_kw`, `current_load_kw`, `baseline_load_kw`, `status`, `created_at`, `updated_at` |
| `resources` | `id`, `name`, `zone_id`, `type`, `capacity_kw`, `available_kw`, `price_per_kwh`, `state`, `wallet_address`, `metadata_json` |
| `forecasts` | `id`, `zone_id`, `forecast_for`, `predicted_load_kw`, `capacity_kw`, `risk_score`, `required_flex_kw`, `reason_json`, `created_at` |
| `flex_markets` | `id`, `zone_id`, `start_time`, `end_time`, `required_flex_kw`, `max_price_per_kwh`, `status`, `solana_market_address`, `solana_tx`, `created_at` |
| `market_commitments` | `id`, `market_id`, `resource_id`, `committed_kw`, `price_per_kwh`, `expected_kwh`, `status`, `solana_tx` |
| `meter_readings` | `id`, `resource_id`, `market_id`, `timestamp`, `baseline_kw`, `actual_kw`, `verified_relief_kw` |
| `settlements` | `id`, `market_id`, `resource_id`, `delivered_kwh`, `amount`, `status`, `solana_tx`, `created_at` |

Allowed values:

| Field | Values |
|---|---|
| `grid_zones.status` | `NORMAL`, `WATCH`, `CONGESTED`, `EMERGENCY` |
| `resources.type` | `BATTERY`, `EV`, `SOLAR`, `GENERATOR`, `HVAC`, `COMMERCIAL_LOAD` |
| `resources.state` | `AVAILABLE`, `COMMITTED`, `DISPATCHED`, `OFFLINE` |
| `flex_markets.status` | `DRAFT`, `OPEN`, `MATCHED`, `DISPATCHING`, `VERIFYING`, `SETTLED`, `CANCELLED` |

### Planned endpoints

| Area | Endpoints |
|---|---|
| Grid | `GET /grid/zones`, `GET /grid/zones/:id`, `POST /grid/reset` |
| Forecast | `GET /forecast/:zoneId`, `POST /forecast/:zoneId/run` |
| Resources | `GET /resources`, `GET /resources?zoneId=downtown`, `GET /resources/:id` |
| Markets | `GET /markets`, `POST /markets/:id/match`, `POST /markets/:id/dispatch` (in addition to the ones above) |

A forecast response:

```json
{
  "zoneId": "downtown",
  "currentLoadKw": 10800,
  "predictedLoadKw": 12800,
  "capacityKw": 12000,
  "riskScore": 0.91,
  "requiredFlexKw": 800,
  "reasons": ["EVENING_PEAK", "HIGH_TEMPERATURE", "EVENT_DEMAND"]
}
```

A market request:

```json
{
  "zoneId": "downtown",
  "requiredFlexKw": 800,
  "durationMinutes": 60,
  "maxPricePerKwh": 0.2
}
```

### Planned matching

When resources live in a database, matching stays this simple:

1. Filter resources to the affected zone.
2. Keep the `AVAILABLE` ones.
3. Sort by price, ascending.
4. Commit each one, up to what's still needed, until the total reaches the required flexibility.
5. Mark the selected resources `COMMITTED`.
