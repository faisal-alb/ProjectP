# GridFlex

A local grid-flexibility market. GridFlex predicts where the grid is about to be congested, lets a grid operator buy relief from nearby batteries, EVs, buildings, solar and generators, and pays participants in USDC on Solana once delivery is verified.

All zone, load and pricing figures in the app are illustrative demo data.

## Repo layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js app: landing page, onboarding, household and operator dashboards |
| `apps/api` | Hono API: market lifecycle and live events (SSE) |
| `programs/gridflex` | Solana program (Anchor): escrow, commitments, verification, payouts |
| `packages/shared` | Shared TypeScript: unit maths, Power Plan optimizer, onboarding data |
| `packages/solana` | Solana client and generated program bindings |
| `services/intelligence` | Python model service: price-spike forecast, fair value, household baselines ([docs](docs/intelligence.md)) |
| `ml/` | Python models and training: ERCOT spike classifier, price statistics, ResStock home baseline |
| `scripts/` | Dev runner and Solana setup, faucet and demo scripts |
| `docs/` | Product, architecture and how-to docs ([index](docs/README.md)) |

## Run it

Needs Node 20.9 or newer. For the Solana pieces you also need Rust, the Solana CLI and Anchor (see [Solana settlement](docs/solana.md#running-it)).

```bash
npm install
cp .env.example .env         # then fill in the values you need
npm run dev                  # API on :8787 and web on :3000
```

The web app works without Solana running, but live settlement shows as offline. To run the full flow locally, follow [Running it](docs/solana.md#running-it).

The demo is set in Austin, Texas, where the models are trained. To run them (Python 3.10+), set up once and `npm run dev` also starts the model service on :8000:

```bash
npm run intelligence:setup   # Python venv at .venv
npm run ml:train             # download public ERCOT/ResStock data and train
```

Without it, the API uses demo values instead ([Intelligence service](docs/intelligence.md)).

Optional settings, all in the root `.env`:

- `NEXT_PUBLIC_MAPBOX_TOKEN` for the onboarding map ([Location map](docs/location-map.md))
- `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` for the voice assistant ([Voice agent](docs/voice-agent.md))
- `BETTER_AUTH_SECRET` for sessions

## Common commands

| Command | Does |
|---|---|
| `npm run dev` | Start every app that has a `dev` script |
| `npm run build` / `npm run lint` | Build or lint every workspace |
| `npm test -w @gridflex/shared` | Unit tests (units, Power Plan) |
| `npm run solana:setup` | Fund keys, create mock USDC, initialize the program config |
| `npm run solana:demo` | The full settlement flow with no UI |
| `npm run e2e -w web` | The same flow in a browser with a test wallet |

## Learn more

Start with the [docs index](docs/README.md): [Product](docs/product.md), [Architecture](docs/architecture.md), [API and data](docs/api-and-data.md), [Solana settlement](docs/solana.md).
