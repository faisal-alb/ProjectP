---
name: GridFlex
description: Graphite grid-operations console for local flexibility markets — a flat, instrumented control room, not a clean-energy brochure.
colors:
  background: "#17181b"
  background-raised: "#1d1e22"
  surface: "#212226"
  foreground: "#ececee"
  muted: "#a0a1a8"
  muted-2: "#6d6e75"
  border: "rgba(255, 255, 255, 0.08)"
  border-strong: "rgba(255, 255, 255, 0.16)"
  accent: "#7fb4cc"
  accent-dim: "#4a6f80"
  accent-soft: "rgba(127, 180, 204, 0.1)"
  risk: "#e07a66"
  risk-soft: "rgba(224, 122, 102, 0.1)"
  watch: "#d6a55a"
  watch-soft: "rgba(214, 165, 90, 0.1)"
  normal: "#6fb58f"
  normal-soft: "rgba(111, 181, 143, 0.1)"
  solana-purple: "#a38be0"
  solana-green: "#6fcf9f"
  solana-soft: "rgba(163, 139, 224, 0.1)"
typography:
  display:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "var(--font-geist-sans), Geist Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.14em"
  telemetry:
    fontFamily: "var(--font-geist-mono), Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    fontFeature: "tabular-nums"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  section-y: "clamp(5rem, 8vw, 7rem)"
  panel-p: "24px"
  rail-gap: "40px"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "24px"
  status-label:
    backgroundColor: "transparent"
    textColor: "{colors.risk} | {colors.watch} | {colors.normal}"
    rounded: "0"
    padding: "0"
---

# Design System: GridFlex

## Overview

**Creative North Star: "Graphite Grid-Operations Console"**

GridFlex reads as a utility operator's console, not a sustainability brochure and not a neon AI landing page. The canvas is a mid-dark neutral graphite; surfaces are flat, opaque panels one step lighter than the canvas with hairline borders. There are no glows, glass blurs, radial color washes, star fields, or tinted icon badges — depth comes only from surface steps and borders. Color is spent on data: status colors on status, a desaturated steel-blue accent on the one or two most important readouts per panel.

The same system runs across both surfaces: the marketing page (`app/page.tsx`) and the dashboard (`app/dashboard/page.tsx`). The dashboard drops the hero for a denser control-room grid built from the same components.

**The homepage is the one deliberate exception.** It runs under a `.home` scope (`globals.css`) that re-points the tokens: a near-black canvas (`#0a0a0c`), 16px panels with a faint lit top edge, and pill buttons (`.btn-volt` primary, `.btn-ghost-pill` secondary). Its color stays the app's steel-blue accent, the same blue as the Ask GridFlex voice button, extended into a **volt** family for light (`--volt` `#7fb4cc`, bright `#cfe6f0`, deep `#3f6f84`, arc core `#f2f9fc`). It stays desaturated so it reads as electricity, not neon, and not as a status color. It has exactly one light source, **the grid's current**: `HeroHorizon` (the rim of a night-side planet lit like a live conductor, with a lat/long grid and sparking nodes on its face), echoed by the lit top edge of the `HeroConsole` preview and the final `CTASection`. Glows stay tied to that one light; don't add new ones elsewhere on the page. The dashboard and onboarding keep the graphite, steel-blue system below.

**Key Characteristics:**
- Neutral graphite canvas (`#17181b`) with flat `.panel` surfaces (`#212226` + hairline border). No translucency, no blur.
- A muted steel-blue accent (`#7fb4cc`) used only as text color on key readouts and the map arc — never as a fill, wash, or glow.
- Primary buttons are a neutral off-white fill (`bg-foreground`) with dark text; secondary buttons are hairline-bordered ghosts. Both use `rounded-md` (6px).
- Geist Sans for display/body, Geist Mono for every numeric/telemetry readout.
- Status colors are desaturated (risk `#e07a66`, watch `#d6a55a`, normal `#6fb58f`) and appear as text, dots, thin bars, or a left border — not as tinted card backgrounds.
- Icons are 1.5-stroke Lucide glyphs in `text-muted`, bare or in a small bordered square — never inside a tinted circle.

## Colors

### Accent
- **Steel Blue** (`#7fb4cc`): the highlighted value in a readout (required flex, committed kW), the map's resource arc, focus rings. Text/stroke only.
- **Dim Steel** (`#4a6f80`): scrollbar-thumb hover.

### Settlement
- **Solana Purple** (`#a38be0`): desaturated, used only for the settlement section's icons and the "Recorded on Solana" glyph. No purple borders, washes, or gradients.

### Status
- **Risk** (`#e07a66`), **Watch** (`#d6a55a`), **Normal** (`#6fb58f`): fixed mapping across every surface. Soft variants exist but are reserved; prefer text color, a 6px dot, a progress bar, or a 2px left border.

### Neutral
- **Canvas** (`#17181b`): page background.
- **Raised** (`#1d1e22`): section bands and nested inline blocks (readouts, list rows).
- **Surface** (`#212226`): panels/cards (`.panel`).
- **Foreground** (`#ececee`), **Muted** (`#a0a1a8`), **Muted-2** (`#6d6e75`).
- **Border** (`rgba(255,255,255,0.08)`) / **Strong Border** (`0.16`).

### Named Rules
**The No-Glow Rule.** No colored box-shadows, text-shadows, drop-shadow filters, blur halos, radial gradient washes, or backdrop blur. If something needs emphasis, use a stronger border, a surface step, or the accent as text color. (Homepage exception: the grid-current light described in the Overview.)
**The Data-Only Color Rule.** Accent and status colors mark data, not decoration. Headers, icons, chips, and containers stay neutral.
**The Status-Color Consistency Rule.** Risk/watch/normal always map to the same three hexes across every surface.

## Typography

**Display Font:** Geist Sans (with system-ui, sans-serif fallback)
**Body Font:** Geist Sans (same family — no secondary body face)
**Label/Mono Font:** Geist Mono, used for every numeric and telemetry value

**Character:** A single geometric, engineered sans carries both headings and body — deliberately no display-face swap, keeping the tone instrumented rather than editorial. Geist Mono is reserved strictly for numbers: MW/kW figures, percentages, prices, timestamps — anywhere a value would sit on a real telemetry readout.

### Hierarchy
- **Display** (600, `text-4xl`–`text-5xl`/`2.75rem` at desktop, line-height 1.12): the single H1 on the marketing hero only.
- **Headline** (600, `text-3xl`–`text-4xl`): section `H2`s (`SectionHeader`), always paired with body-copy subtitle, never a kicker above.
- **Title** (600, `text-lg`–`text-base`): panel/card titles inside panels (e.g. "Downtown congestion likely", `WorkflowStep` station titles).
- **Body** (400, `text-sm`–`text-lg`, line-height ~1.7, `leading-relaxed`): section subtitles and descriptive copy, generally capped near max-w-2xl for measure.
- **Label** (500, `text-[11px]`–`text-xs`, `letter-spacing: 0.14em`, uppercase via `.tracked-caps`): nav links, panel micro-headers ("Grid Intelligence", "Primary drivers", "Recommended dispatch"), and status strips ("Built for", "Powered by Solana"). Never used as a kicker directly above an `H1`/`H2`.
- **Telemetry** (Geist Mono, 500–700, `tabular-nums`): every MW/kW/%/$ figure, dispatch stack values, market-table cells, zone capacity readouts.

### Named Rules
**The No-Kicker Rule.** Tracked-uppercase micro-labels are reserved for navigation and status strips. No heading in the built system is preceded by an eyebrow/kicker line; `SectionHeader` is title + optional subtitle only.
**The Mono-For-Numbers Rule.** Any numeric value that represents live or telemetry-like data (MW, kW, %, $, timestamps) renders in Geist Mono with tabular figures; prose numbers do not.

## Layout

Content is capped at `max-w-[1240px]` with `px-5`/`sm:px-8` gutters on the marketing page; sections run `py-20`/`sm:py-28`, separated in places by full-bleed hairline-bordered bands (`border-y border-border`). The hero is centered: `HeroHorizon` across the top, a two-line H1 (`3.5rem` at desktop) with "before" in the volt gradient, the subtitle, two pill CTAs, then `HeroConsole`, a static preview of the household dashboard's Tonight page (header and tabs, the three at-a-glance tiles, tonight's event, the top of the Power Plan). It renders in the app's own tokens and card style (`.console-app` restores them inside `.home`), derives its figures from `lib/demo-data` the way `HouseholdState` does for a default participant, and dissolves into the page (`.fade-bottom`) above an "illustrative demo data" caption. The workflow rail and flex categories collapse to one column on mobile.

The dashboard (`/dashboard`) shows one view per account. The account type is chosen once at onboarding and stored in a cookie with a validated profile (`lib/profile.ts`); there is no in-app toggle, and changing account type means **Switch account** from the account menu. Both views are capped at `max-w-[1240px]` and share a header: wordmark, account label (the organization name for operators, "My energy" for participants), Solana network status, a wallet control, and the account menu.

Onboarding (`/onboarding`) asks one question, "How will you use GridFlex?", with two paths whose tone differs on purpose:
- **Provide flexibility** (participant, `/onboarding/participant`): a narrow single column that feels like setting up a smart-home product. Three steps — resources plus where they're connected (ZIP resolves the grid zone, feeder and eligibility), AutoFlex limits (only the limits for the resources they picked, with a live estimate of what one event could use and earn), and payout (a GridFlex-held USDC wallet). Ends on "You're ready" with what GridFlex can use and potential earnings per event.
- **Manage a grid** (operator, `/onboarding/operator`): wider, with a step rail, denser tables and mono values, like configuring an infrastructure console. Three steps — organization, network and data (demo network pre-loaded, warning threshold, data sources), and procurement rules plus settlement. Ends on "<org>'s network is ready".
Both flows are demo onboarding: the topology, devices and ZIP lookup are illustrative (`packages/shared/src/onboarding.ts`), and what's chosen (reserve, minimum rate, price cap, organization name) is what the dashboards start from.
- **Participant**: a 2/1 split — tonight's event and earnings on the left, AutoFlex settings on the right; stacks on mobile. The header wallet is the household's managed USDC wallet (balance, last payment, explorer link); there is nothing to connect.
- **Grid operator**: page title with a one-line zone summary, then one full-width panel for the active event. Its top-right is the **USDC escrow card** — the amount to lock / locked / paid, the single next action (connect wallet, get test USDC, fund, record meter readings, pay participants), and flexibility committed — beside the plain-language situation headline; then five-step progress with transaction links, the load forecast chart beside "why the forecast is high", the flexibility request (price-cap slider, outcome sentence, merit-order offers table), and an "all zones" table sorted by severity. The header wallet connects the operator's own wallet and shows its USDC.
Each view leads with a sentence that says what's happening and what it means, before any numbers. On phones, tables drop secondary columns rather than scrolling sideways.

## Elevation & Depth

Flat. Depth comes only from the three neutral steps (canvas → raised → surface) and hairline borders. There are no shadows in the system.

## Shapes

Tight, consistent radii: `rounded-lg` (8px) for panels, `rounded-md` (6px) for buttons, inline blocks, readouts and chips, `rounded` (4px) for small tags. `rounded-full` is reserved for status dots only. Dividers inside multi-item panels are hairlines (`divide-border`).

## Components

### Buttons
- **Primary:** `rounded-md bg-foreground text-background`, `hover:bg-white`, `px-5 py-3` (CTA) or `px-4 py-2` (nav). No shadow, no scale on hover.
- **Ghost:** transparent, `border-border`, strengthens to `border-border-strong` on hover.
- **Focus:** global `:focus-visible` outline in the accent.

### Sliders
- Native `input[type=range]`, restyled in `globals.css`: a 4px track that fills with the foreground color up to the value, and a 10×20px rectangular handle (3px radius). The fill comes from a `--range-pct` CSS variable that components set with `rangeFill()` (`components/onboarding/controls.tsx`). Hover lightens the handle, pressing it turns it accent-colored, keyboard focus adds a 2px accent ring around it, and disabled dims the whole control. The input is 28px tall so the touch target is larger than the visible track.

### Panels
- `.panel` utility: opaque `surface` fill + 1px hairline border, `rounded-lg`, `p-5`–`p-6`.
- A highlighted panel (e.g. the at-risk zone) swaps the border to `border-risk/50`; the fill stays neutral.
- Alerts use a 1px status-tinted border (`border-watch/35`) on a neutral panel with a status icon. Never a thick colored side stripe.

### Status Labels
- `GridStatusBadge`: a 6px status dot plus label in the status color, no background pill. Dot pulses only for `high`. A `compact` variant renders the bare dot with an `sr-only` label.

### Navigation
- Homepage: sticky, translucent blurred header with a hairline bottom border; wordmark left, a centered segmented pill nav, and a steel-blue "Get Started" pill right. The current item sits on one raised pill (`.nav-pill`) that slides and resizes to whichever item is clicked, and follows the section you've scrolled into (it holds on the clicked item while a click's scroll is running). The wordmark and "Overview" smooth-scroll to the top and clear any `#section` from the URL. The pill nav hides below `md`.

### Load Forecast Chart (dashboard)
`components/dashboard/LoadForecastChart.tsx`: measured load (muted), forecast without flexibility (`--chart-forecast` #b86f9c, dashed) and forecast with committed flexibility (`--chart-flex` #4f92c3, solid) against a 1.5px risk-colored capacity line, with the overload area at 14% risk and the flex window as a faint band. Legend with line keys, crosshair tooltip, arrow-key stepping, and a "Show data as a table" disclosure. The two series colors were validated for the dark surface (CVD ΔE 7.2, so the dashed/solid distinction is required, not decorative).

### Grid-Current Horizon (homepage signature)
`HeroHorizon.tsx`: an SVG planet edge whose rim is lit steel blue (near-white hairline core, soft glow, wide halo that breathes slowly), light spilling below it, a lat/long grid on its face fading upward, and a few nodes that spark with a quick double flash. Every 6.5s a pulse of current runs along the rim, left to right, faded at the ends to match the rim; it's hidden under reduced motion. It's deterministic (seeded), so server and client render the same field. `GridMapPreview` is the schematic zone map used further down the page.

### Workflow Rail
`WorkflowStep.tsx`'s `WorkflowRail`: five stations on one rail separated by plain hairline connectors, each with a bordered-square icon, title, description, and mono readout.

### Instrument Panel
`FlexInstrumentPanel` and `SolanaSettlementCard`: parallel categories as one hairline-divided `.panel`, each zone with a bare muted icon, title and description.

## Do's and Don'ts

### Do:
- **Do** keep surfaces opaque, neutral, and flat; use `.panel` for any card.
- **Do** use the accent as text/stroke on at most one or two key values per panel.
- **Do** render numeric/telemetry values in Geist Mono with tabular figures (`.tabular`).
- **Do** group parallel categories into one hairline-divided panel rather than separate icon cards.

### Don't:
- **Don't** add glows, colored shadows, blur, gradient washes, star fields or other ambient effects.
- **Don't** use `rounded-full` on buttons, chips or badges, or radii above 8px.
- **Don't** put icons in tinted circles, or tint whole cards with status/accent color.
- **Don't** use saturated neon hues; every color in the palette is deliberately desaturated.
- **Don't** place a tracked-uppercase kicker directly above an `H1`/`H2`.
- **Don't** present the demo data (`lib/demo-data.ts`) as real evidence in new copy (per `PRODUCT.md`).
