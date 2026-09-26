# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, addressed on the same surfaces (a deliberately dual-sided marketplace pitch):

- **Utility/grid-operator buyers** — utility program managers, distribution system operators, and city energy planners who need to relieve local grid congestion (transformer, feeder, or zone-level constraints) without waiting on new generation or infrastructure build-out. They are the audience for the Predict → Procure → Coordinate → Verify → Settle workflow.
- **Flexibility asset owners/aggregators** — owners or operators of batteries, EV fleets, solar, generators, and flexible building/industrial loads who can enroll their assets to supply flexibility and get compensated. They are the audience for the "anyone with flexible energy can participate" framing.

Secondary contexts implied by the product but not yet a dedicated surface: microgrid operators and communities in regions with fragmented/unreliable utility supply (grid + rooftop solar + batteries + generators coordinated together).

## Product Purpose

GridFlex predicts short-term local electricity grid constraints (a specific zone/feeder/transformer approaching capacity) and coordinates nearby distributed flexibility resources — batteries, EVs, buildings, solar, and generators — to relieve that constraint before it causes an outage. Success is a forecasted constraint resolved by verified, paid flexibility delivery instead of curtailment, blackout, or new physical infrastructure.

## Positioning

Flexibility is matched to the specific local zone that needs it, not dispatched from anywhere on the grid — "a battery hundreds of miles away cannot relieve an overloaded neighborhood feeder." GridFlex's mechanism is local flexibility markets: a utility opens a zone-scoped flexibility request, resources are selected by availability/location/price, and delivery is metered and verified rather than merely committed.

Settlement is a firm, binding architectural choice: verified commitments and payments are recorded on Solana for transparent, programmable, auditable settlement, while high-frequency grid telemetry and forecasting stay off-chain. This is durable positioning, not a placeholder to swap out later.

## Operating Context

The end-to-end workflow the product performs: **Predict** (forecast load against zone capacity using load, weather, time-of-day, events, and distributed capacity data) → **Procure** (utility opens a local flexibility request for a zone and time window) → **Coordinate** (GridFlex selects and dispatches nearby batteries/EVs/buildings/solar/generators by availability, location, and price) → **Verify** (meter/device data confirms actual delivered flexibility against commitment) → **Settle** (verified commitments and payments recorded on Solana).

Flexibility resources fall into four categories the product treats as interchangeable inputs to the same market: Generate (solar, generators, microgrids), Store (home/commercial batteries, vehicle-to-grid), Shift (EV charging, HVAC, water heating, industrial demand), Reduce (commercial/industrial load curtailment).

## Capabilities and Constraints

- Core loop operates per local zone/feeder, not grid-wide — this locality is fundamental to the product's value claim and should not be abstracted away in future work.
- Off-chain: telemetry ingestion and forecasting. On-chain (Solana): settlement of verified commitments and payments. This split is a stated architectural constraint.
- No `/dashboard` implementation exists yet — the landing page (`apps/web/app/page.tsx`) links to it, but it is unbuilt. Building it is a likely near-term surface.
- Monorepo has empty scaffolding for `apps/api`, `packages/db`, `packages/shared`, `packages/solana`, `packages/ui` — no backend, database, or on-chain integration code exists yet. `apps/web` currently ships as a static/demo marketing site only.
- Stack (pre-existing, not a greenfield decision): Next.js 16, React 19, Tailwind CSS 4, TypeScript, lucide-react icons.

## Brand Commitments

- Name: **GridFlex**. Tagline direction: "Prevent grid congestion before it becomes an outage." Category line used in-product: "AI-assisted grid flexibility infrastructure."
- Named target sectors ("Built for"): Utilities, Microgrids, Cities, EV fleets, Energy communities.
- "Powered by Solana" is used as a trust/credibility marker, consistent with settlement being a firm commitment above.

## Evidence on Hand

All zone data, MW/kW figures, pricing, and market activity currently in the product (`apps/web/lib/demo-data.ts` and the components that render it) are **fictional, illustrative demo data**. There are no real pilots, utility customers, deployed assets, testimonials, case studies, or press behind this content. Future work must not present this demo data as real evidence, and must not fabricate testimonials, customer logos, benchmarks, pricing commitments, or press mentions.

## Product Principles

- Locality is the product: match flexibility to the specific constrained zone, never treat the grid as a single fungible pool.
- Verify before paying: compensation follows metered/verified delivery, not just commitment.
- Keep the fast-moving data off-chain and the trust-critical data (settlement) on-chain — don't blur that line for convenience.
- Speak to both sides of the market on the same surfaces: utilities procuring flexibility and asset owners supplying it are equally primary audiences.
- Never let demo/illustrative content be mistaken for real proof; the site currently has no real pilots or customers to point to.
