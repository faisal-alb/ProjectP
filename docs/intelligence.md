# Intelligence service

The shared dashboard now runs full-day causal forecasting and rolling-horizon dispatch. See [Shared energy day](showcase.md#models-and-physical-response) for current data sources, constraints, assistant tools and validation commands.

The models in `ml/`, served to the app. `services/intelligence` is a small internal Python service (FastAPI). The Node API calls it at fixed points in the market lifecycle and stays the only thing that talks to the browser or to Solana. Models predict here; the API decides what to commit.

## Where the data comes from

Everything is trained on public data for **Austin, Texas**, which is why the demo is set there:

| Model | Data | Output |
|---|---|---|
| Spike | ERCOT real-time prices for Austin Energy's load zone (`LZ_AEN`) and Open-Meteo Austin weather, Jan 2021 – May 2024 | P(price > $500/MWh) within 1–6 hours |
| Fair value | Same prices, Winter Storm Uri excluded | Expected price if it spikes or not, by season and time of day |
| Home baseline | NREL ResStock, 50 Travis County homes, 2018 | Each home's p10 and p50 draw per 15 minutes, 3 hours ahead |

Measured on held-out data when these artifacts were built (`npm run ml:train`, 2026-09-27):

- Spike, walk-forward over 8 folds: PR-AUC 0.43 at 1 hour (45× the base rate), 0.36 at 3 hours. Summer, the season that matters, scores 0.67. Fold-to-fold spread is wide (0.04–0.69).
- Baseline, walk-forward over 4 folds: p50 error 0.33 kW per home, 36% better than yesterday-same-time and 10% better than the 7-day same-hour average. p10 coverage 10.8% against a 10% target.

## The replay clock

The demo doesn't need live feeds. It replays one real, held-out evening: **20 August 2024**, a record ERCOT demand day. The service stands at 5:00 PM and looks at the 7–8 PM window, which actually cleared at $4,857/MWh. Neither the spike model nor the price statistics trained on anything after May 2024. The baseline model had the same calendar stretch (13–22 August) held out of its 2018 training data.

Homes are mapped onto that evening by clock time: ResStock is a 2018 dataset in local standard time, so 7 PM CDT on 20 August 2024 reads 6 PM on 20 August 2018.

`REPLAY_AT` moves the clock (any time within the exported slice, 19–21 August 2024). A request can also pass `?at=`.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` | Each model's source (`model` or `placeholder`) and manifest hash, and the replay time |
| `GET` | `/forecast/{zone}` | P(spike) by horizon, fair value, risk buffer, fee, the locked price they imply, whether the trigger rule (P ≥ 0.5) would open an event, reason codes and the signals behind them |
| `POST` | `/events/size` | `{ zone, homes: [ids], generationKw }` → each home's p50 baseline per interval, baseline kW and offerable kW (p10 draw + battery), plus `baselineHash`, `modelHash` and `featuresHash` |

Only `downtown` is a known zone.

## How the app uses it

| When | API call | Effect |
|---|---|---|
| Dashboard load | `GET /forecast/downtown` (proxied by the API at the same path) | **Price spike outlook** panel; **Use $x/kWh as your price** sets the cap |
| Opening a market | `GET /forecast/downtown` | Snapshot stored on the market record |
| Confirming a market | `POST /events/size` for up to 40 homes | The cleared home-battery kW is split by each home's offerable kW instead of a flat 5 kW. The plan and its hashes are saved before anything goes on-chain, so a retry records the same commitments |
| Verifying | none | Each model-sized home's delivery is measured against its committed baseline (delivered = baseline − metered draw; the draw is still simulated). The on-chain proof includes `baselineHash`, and the proof string is kept on the record so anyone can re-hash it |

Settlement never calls the model service, so it can't block a payout.

## When it's missing

- **No service running:** `/health` reports `"intelligence": "offline"`. The shared run cannot start; if intelligence fails during a run, new commitments are held while existing delivery continues.
- **Service running without artifacts:** legacy forecast endpoints can report `"source": "placeholder"`; the shared run rejects missing models or an invalid day bundle instead of treating placeholders as trained output.

## Running it

Python 3.12 is recommended. Runtime setup supports an existing Python 3.9 environment; optional training requires Python 3.10+ because the legacy gridstatus and AWS download dependencies conflict on 3.9.

```bash
npm run intelligence:setup   # .venv + runtime and lightweight bundle preparation
npm run dev                  # starts the service on :8000 alongside the API and web app
```

`npm run dev` skips the service with a note if there's no `.venv`. `npm run dev:intelligence` runs it alone. On macOS, LightGBM needs OpenMP: `brew install libomp`.

Existing artifacts need no retraining. To rebuild them, run `npm run intelligence:setup -- --training` then `npm run ml:train`. To rebuild only `run/` from existing models, use `npm run run:prepare`. Setup checks the actual `.venv` interpreter before installation; setting `PYTHON` only selects an interpreter when creating a new environment. Preserve an older `.venv` under another name before creating a replacement with `PYTHON=/path/to/python3.12 npm run intelligence:setup -- --training`.

Settings, all optional:

| Variable | Default | Used by |
|---|---|---|
| `INTELLIGENCE_URL` | `http://127.0.0.1:8000` | API |
| `MODEL_DIR` | `ml/artifacts` | service |
| `REPLAY_AT` | the exported evening | service |
| `INTELLIGENCE_PORT` | `8000` | `npm run dev` |

## Artifacts

`ml/artifacts/` (gitignored, about 8 MB):

```text
spike/            spike_{1..6}h.txt + manifest.json    LightGBM text, hashed
price_statistics.json
baseline/         baseline_q10.txt, baseline_q50.txt, baseline_mean.txt + manifest.json
replay/           grid.parquet, homes.parquet + manifest.json
run/              bundle.json + manifest.json (complete historical day)
```

Every file is checked against its manifest hash on load, and a mismatch falls back to the placeholder. Nothing is pickled, so loading a model never runs code.

## Deploying

Docker already installs `services/intelligence/requirements.txt` during its image build. You do not run `intelligence:setup` on the server or locally merely to deploy. Train/prepare artifacts once on a build machine when needed, then copy the **contents** of `ml/artifacts/`, including `run/`, into `files/models/`. These files are excluded from Git and the Docker build context. Restart intelligence after updating the files; it caches the bundle in memory. The checked-in Compose file already configures the service and volume below.

Add it to the compose file next to `api`, with no public domain:

```yaml
  intelligence:
    build:
      context: .
      dockerfile: services/intelligence/Dockerfile
    restart: unless-stopped
    expose:
      - "8000"
    volumes:
      - ../files/models:/app/ml/artifacts:ro
```

Then set `INTELLIGENCE_URL=http://intelligence:8000` on the `api` service and copy `ml/artifacts/` to `../files/models/` on the server.
