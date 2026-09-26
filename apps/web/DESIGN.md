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
**The No-Glow Rule.** No colored box-shadows, text-shadows, drop-shadow filters, blur halos, radial gradient washes, or backdrop blur. If something needs emphasis, use a stronger border, a surface step, or the accent as text color.
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

Content is capped at `max-w-[1240px]` with `px-5`/`sm:px-8` gutters on the marketing page; sections run `py-20`/`sm:py-28`, separated in places by full-bleed hairline-bordered bands (`border-y border-border`). The hero is an asymmetric two-column grid (`lg:grid-cols-[3fr_2fr]`) pairing display copy with the grid map and a telemetry card. The workflow rail and flex categories collapse to one column on mobile.

The dashboard (`/dashboard`) is a denser control-room grid: top bar, alert band, a two-column split (zone map + Grid Intelligence) that stacks on mobile, a 4-up zone-status row, and the market table.

## Elevation & Depth

Flat. Depth comes only from the three neutral steps (canvas → raised → surface) and hairline borders. There are no shadows in the system.

## Shapes

Tight, consistent radii: `rounded-lg` (8px) for panels, `rounded-md` (6px) for buttons, inline blocks, readouts and chips, `rounded` (4px) for small tags. `rounded-full` is reserved for status dots only. Dividers inside multi-item panels are hairlines (`divide-border`).

## Components

### Buttons
- **Primary:** `rounded-md bg-foreground text-background`, `hover:bg-white`, `px-5 py-3` (CTA) or `px-4 py-2` (nav). No shadow, no scale on hover.
- **Ghost:** transparent, `border-border`, strengthens to `border-border-strong` on hover.
- **Focus:** global `:focus-visible` outline in the accent.

### Panels
- `.panel` utility: opaque `surface` fill + 1px hairline border, `rounded-lg`, `p-5`–`p-6`.
- A highlighted panel (e.g. the at-risk zone) swaps the border to `border-risk/50`; the fill stays neutral.
- Alerts use a 2px status-colored left border on a neutral panel (`CongestionAlert`).

### Status Labels
- `GridStatusBadge`: a 6px status dot plus label in the status color, no background pill. Dot pulses only for `high`. A `compact` variant renders the bare dot with an `sr-only` label.

### Navigation
- Sticky header on the opaque canvas color with a hairline bottom border; neutral wordmark, tracked-caps links, ghost "Dashboard" and primary "Launch Demo".

### Grid Map (signature component)
`NightGridMap.tsx`: zone points joined by faint lines; on mount a thin (1.5px) accent arc draws from a resource point into the highest-risk zone, whose low-opacity halo pulses slowly. No drop-shadow filter. `GridMapPreview` is the dashboard's schematic version.

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
