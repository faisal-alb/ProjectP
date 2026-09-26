---
name: GridFlex
description: Orbital night-grid mission control for local flexibility markets — a graphite instrument panel, not a clean-energy brochure.
colors:
  background: "#05070d"
  background-raised: "#0a0e18"
  foreground: "#eef1f6"
  muted: "#9aa4b2"
  muted-2: "#626c78"
  border: "rgba(255, 255, 255, 0.1)"
  border-strong: "rgba(255, 255, 255, 0.2)"
  glass: "rgba(13, 18, 32, 0.55)"
  accent: "#57d6ff"
  accent-dim: "#1b6f8c"
  accent-soft: "rgba(87, 214, 255, 0.12)"
  risk: "#ff6a4d"
  risk-soft: "rgba(255, 106, 77, 0.14)"
  watch: "#ffb648"
  watch-soft: "rgba(255, 182, 72, 0.14)"
  normal: "#34d399"
  normal-soft: "rgba(52, 211, 153, 0.12)"
  solana-purple: "#9945ff"
  solana-green: "#14f195"
  solana-soft: "rgba(153, 69, 255, 0.14)"
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
  full: "9999px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
spacing:
  section-y: "clamp(5rem, 8vw, 7rem)"
  panel-p: "24px"
  rail-gap: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
  glass-panel:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  status-badge-risk:
    backgroundColor: "{colors.risk-soft}"
    textColor: "{colors.risk}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  status-badge-watch:
    backgroundColor: "{colors.watch-soft}"
    textColor: "{colors.watch}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  status-badge-normal:
    backgroundColor: "{colors.normal-soft}"
    textColor: "{colors.normal}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: GridFlex

## Overview

**Creative North Star: "Orbital Night-Grid Mission Control"**

GridFlex reads as a satellite operator's console for a grid at night, not a sustainability brochure. The canvas is near-black graphite; every surface is a dark glass instrument panel rather than a white bordered card; the one signal color, electric cyan, is spent almost entirely on glow washes, live-data accents, and the signature power-flow arc rather than on flat fills. The system explicitly refuses the category default it was built against: warm sun/leaf-green "clean energy" marketing, rounded friendly icon-card grids, and stock renewable-energy photography. It also refuses kickers/eyebrows above headings — no heading in the shipped build carries one — and refuses hard, offset "sticker" shadows; every shadow observed in the build is a soft, colored ambient glow.

The same world runs unmodified across both shipped surfaces: the Persuade marketing page (`app/page.tsx`) and the Operate dashboard (`app/dashboard/page.tsx`). The dashboard reuses the identical tokens, glass panels, and mono telemetry type but drops the large expressive hero in favor of a denser control-room grid — brand lives in the glow and the motif, not in decoration, once the surface is task-mode.

**Key Characteristics:**
- Near-black graphite canvas (`#05070d`) with dark glass panels (`rgba(13,18,32,0.55)`, `blur(20px)`) standing in for bordered white cards.
- One electric-cyan signal color (`#57d6ff`) carried almost exclusively through radial glow washes, glowing pills, and the animated arc motif — never as large flat fills.
- Solana's own purple/green (`#9945ff` / `#14f195`) is switched in only inside the settlement section, marking the off-chain/on-chain boundary the product itself draws.
- Geist Sans for all display and body type, Geist Mono for every numeric/telemetry readout (tabular figures throughout).
- Status is color-coded consistently everywhere: risk (orange-red), watch (amber), normal (green) — the same three colors on the hero map, the dashboard radar, and every zone card.
- Parallel categories render as one hairline-divided instrument panel (`FlexInstrumentPanel`, `SolanaSettlementCard`), not repeated icon-card grids; the five-step workflow renders as one chase-lit connected rail (`WorkflowRail`), not five identical cards.

## Colors

A near-monochrome graphite palette lit by a single cyan signal, with a second, deliberately quarantined duotone for settlement.

### Primary
- **Signal Cyan** (`#57d6ff`): the one accent. Used for the power-flow arc, live-data highlights (mono readouts, dispatch chase-lights), primary CTA fills, focus rings, and ambient radial glow washes behind hero/section content. Almost never appears as a large flat block — it is a glow, a stroke, or small badge/pill fill.
- **Dim Cyan** (`#1b6f8c`): scrollbar-thumb hover and other low-emphasis cyan touches where full accent would be too loud.
- **Cyan Wash** (`rgba(87,214,255,0.12)` / `.14`): the `accent-soft` background used behind icon badges and glow-adjacent chips.

### Secondary
- **Solana Purple** (`#9945ff`) and **Solana Green** (`#14f195`): reserved exclusively for the settlement/on-chain section (`SolanaSettlementCard`, `SettlementFlow`, the "Powered by Solana" strip). This pairing never appears outside that context; it visually marks the off-chain (cyan) vs. on-chain (purple/green) boundary the product itself draws.

### Tertiary (status)
- **Risk** (`#ff6a4d`, soft `rgba(255,106,77,0.14)`): high-congestion zone state, used identically on the marketing hero map, dashboard radar, and zone-status cards.
- **Watch** (`#ffb648`, soft `rgba(255,182,72,0.14)`): elevated/caution zone state, and the congestion-alert panel background.
- **Normal** (`#34d399`, soft `rgba(52,211,153,0.12)`): nominal zone state.

### Neutral
- **Graphite Canvas** (`#05070d`): page background, `color-scheme: dark`.
- **Raised Graphite** (`#0a0e18`): section-level background for panels that sit one step above the canvas (e.g. the Grid Intelligence section band, workflow readouts).
- **Off-White Foreground** (`#eef1f6`): primary text.
- **Muted** (`#9aa4b2`) / **Muted-2** (`#626c78`): secondary body copy and tertiary metadata (timestamps, micro-labels) respectively.
- **Hairline Border** (`rgba(255,255,255,0.1)`) / **Strong Border** (`rgba(255,255,255,0.2)` on hover): the only border treatment in the system; no colored borders except inside the status-coded and Solana contexts.
- **Glass** (`rgba(13,18,32,0.55)` with `blur(20px)`): the fill for every panel that would otherwise be a white bordered card.

### Named Rules
**The One Signal Rule.** Cyan is the only free-roaming accent color. It is spent on glow, motion, and live data — not on large fills — so its rarity keeps it legible as "this is live/important."
**The Quarantined Duotone Rule.** Solana purple/green never leaves the settlement section. If a future surface needs an on-chain reference outside settlement, it still borrows this pairing only in that same restrained (badge/border/soft-fill) register, never as a general-purpose accent.
**The Status-Color Consistency Rule.** Risk/watch/normal always map to the same three hexes across every surface (hero map, dashboard radar, zone cards, driver-weight chips) — a color never gets reassigned to a different status per component.

## Typography

**Display Font:** Geist Sans (with system-ui, sans-serif fallback)
**Body Font:** Geist Sans (same family — no secondary body face)
**Label/Mono Font:** Geist Mono, used for every numeric and telemetry value

**Character:** A single geometric, engineered sans carries both headings and body — deliberately no display-face swap, keeping the tone instrumented rather than editorial. Geist Mono is reserved strictly for numbers: MW/kW figures, percentages, prices, timestamps — anywhere a value would sit on a real telemetry readout.

### Hierarchy
- **Display** (600, `text-4xl`–`text-5xl`/`2.75rem` at desktop, line-height 1.12): the single H1 on the marketing hero only.
- **Headline** (600, `text-3xl`–`text-4xl`): section `H2`s (`SectionHeader`), always paired with body-copy subtitle, never a kicker above.
- **Title** (600, `text-lg`–`text-base`): panel/card titles inside glass panels (e.g. "Downtown congestion likely", `WorkflowStep` station titles).
- **Body** (400, `text-sm`–`text-lg`, line-height ~1.7, `leading-relaxed`): section subtitles and descriptive copy, generally capped near max-w-2xl for measure.
- **Label** (500, `text-[11px]`–`text-xs`, `letter-spacing: 0.14em`, uppercase via `.tracked-caps`): nav links, panel micro-headers ("Grid Intelligence", "Primary drivers", "Recommended dispatch"), and status strips ("Built for", "Powered by Solana"). Never used as a kicker directly above an `H1`/`H2`.
- **Telemetry** (Geist Mono, 500–700, `tabular-nums`): every MW/kW/%/$ figure, dispatch stack values, market-table cells, zone capacity readouts.

### Named Rules
**The No-Kicker Rule.** Tracked-uppercase micro-labels are reserved for navigation and status strips. No heading in the built system is preceded by an eyebrow/kicker line; `SectionHeader` is title + optional subtitle only.
**The Mono-For-Numbers Rule.** Any numeric value that represents live or telemetry-like data (MW, kW, %, $, timestamps) renders in Geist Mono with tabular figures; prose numbers do not.

## Layout

Content is capped at a `max-w-[1240px]` container with `px-5`/`sm:px-8` gutters on the marketing page; sections run a consistent vertical rhythm of `py-20`/`sm:py-28` (roughly 80–112px), separated in places by full-bleed hairline-bordered bands (`border-y border-border`) rather than visible section dividers. The hero uses an asymmetric two-column grid (`lg:grid-cols-[3fr_2fr]`) pairing display copy with the night-grid map and a layered telemetry card. The five-step workflow and the flex-resource categories both flatten to a single column on mobile and expand to a horizontal rail/4-up grid at `lg`.

The dashboard (`/dashboard`) is a denser control-room grid: a top bar, a full-width alert band, a two-column main split (zone radar + Grid Intelligence panel) that stacks to one column on mobile, a 4-up zone-status row, and a full-width market table — composed from the same real-data components used on the marketing page, restyled into the same panel language rather than inventing new widgets.

Ambient ration: 800–900px soft radial glow washes (`rgba(87,214,255,0.13–0.16)` cyan, `rgba(153,69,255,0.16)` purple for the settlement section) sit behind section content at low opacity, tying every section back to the one-signal-color rule without ever becoming a flat color block.

## Elevation & Depth

The system is flat-plus-glow: there is no drop-shadow-driven card elevation. Depth comes from (1) translucent glass panels with `backdrop-filter: blur(20px)` sitting a shade lighter than the canvas, and (2) soft, colored ambient glows used as light sources rather than structural shadows.

### Shadow Vocabulary
- **Accent glow — CTA** (`0 8px 28px -8px rgba(87,214,255,0.7)` / navbar pill `0 0 0 1px rgba(87,214,255,0.4), 0 8px 24px -8px rgba(87,214,255,0.65)`): primary buttons and the nav's glowing-pill CTA.
- **Accent glow — telemetry dot** (`0 0 6px 1px rgba(87,214,255,0.8)` / chase-light `0 0 8px 2px rgba(87,214,255,0.8)`): live/active indicator dots on the workflow rail connector and Grid Intelligence dispatch stack.
- **Risk glow** (`0 0 40px -8px rgba(255,106,77,0.5)`): the constrained-zone halo on `GridMapPreview`.
- **Panel lift** (`0 30px 80px -30px rgba(0,0,0,0.7)`): the hero telemetry card (`HeroGridPreview`) floating over the night-grid map.

### Named Rules
**The Glow-Not-Sticker Rule.** Every shadow in the system is a soft, color-tinted ambient glow keyed to a status or accent color; there are no hard-offset, uncolored "sticker" drop shadows anywhere in the build.

## Shapes

Corners are consistently soft and generous: pills (`rounded-full`, 9999px) for every button, nav CTA, status badge, and tag chip; `rounded-2xl` (16px) for glass panels and instrument-panel containers; `rounded-xl`/`rounded-lg` (12px/8px) for smaller inline containers like the congestion alert and workflow readouts. Borders are hairline and low-contrast (`rgba(255,255,255,0.1)`, strengthening to `0.2` on hover) except inside status-coded contexts (risk/watch/normal borders at ~25–35% opacity) and the Solana section (purple border at ~22–30% opacity). Dividers inside multi-item panels are hairlines (`divide-border`), used instead of separate bordered boxes to keep parallel categories reading as one console.

## Components

### Buttons
- **Shape:** fully rounded pill (`rounded-full`, 9999px) for every button variant.
- **Primary:** solid accent fill (`bg-accent`, `#57d6ff`) with dark text (`text-background`), accent-tinted glow shadow, `px-5 py-3` (CTA) or `px-4 py-2` (nav), scales up slightly on hover (`hover:scale-[1.02–1.03]`).
- **Hover / Focus:** primary buttons scale rather than change fill; all interactive elements get the global `:focus-visible` cyan outline (`2px solid var(--accent)`, `2px` offset).
- **Ghost / Secondary:** transparent fill, hairline border (`border-border`), border strengthens to `border-strong` on hover; text-only color shift on links.

### Cards / Containers (Glass Panel)
- **Corner Style:** `rounded-2xl` (16px) for primary panels; smaller nested containers use `rounded-lg`/`rounded-xl`.
- **Background:** `rgba(13,18,32,0.55)` with `backdrop-filter: blur(20px)` — the `.glass-panel` utility — replacing every white bordered card from a conventional light-mode system.
- **Shadow Strategy:** none at rest; only the hero's floating telemetry card carries an ambient lift shadow (see Elevation).
- **Border:** 1px hairline (`rgba(255,255,255,0.1)`).
- **Internal Padding:** `p-5`–`p-6` (20–24px) for panels; `p-4` for smaller alert/readout blocks.

### Status Badges
- **Style:** pill-shaped, soft-tinted background matched to status color (`bg-risk-soft`/`bg-watch-soft`/`bg-normal-soft`), text in the full-strength status color, small pulsing dot (`animate-pulse`) when status is `high`.
- **State:** a `compact` variant renders as a bare dot with `sr-only` label for dense contexts (tables, cards).

### Navigation
- **Style:** sticky glass-panel header with hairline bottom border; wordmark left (glowing cyan orbital mark + tracked-caps "GridFlex"), tracked-caps nav links center-right (`text-[11px]`, `0.14em` tracking, muted → foreground on hover), ghost "Dashboard" link plus glowing-pill "Launch Demo" CTA on the right. Mobile collapses the link row, keeping wordmark and CTA.

### Night-Grid Map (signature component)
`NightGridMap.tsx`: the page's reused motif. An SVG night-map of zone points connected by faint hairline transmission lines; on mount, a cyan arc animates (`arc-draw`, 1.8s) from a resource origin point into the highest-risk zone, which then settles into a slow pulsing halo (`arc-pulse`). Reused at hero scale on the marketing page and at radar scale (`GridMapPreview`, dashboard) — the same arc-into-zone gesture is the system's one signature animation, not a one-off hero flourish.

### Workflow Rail (signature component)
`WorkflowStep.tsx`'s `WorkflowRail`: parallel sequential steps render as stations on one connected rail with chase-lit connectors (`chase` keyframe, staggered delay) rather than five identical cards — the sequence itself is the point.

### Instrument Panel (signature component)
`FlexResourceCard.tsx`'s `FlexInstrumentPanel` and `SolanaSettlementCard.tsx`: parallel categories render as one hairline-divided glass panel (`divide-border`/`divide-x`) instead of a grid of separate bordered icon cards — one console with multiple readout zones, each still carrying a small icon-in-circle badge, short title, and description, but never isolated into its own bordered box.

## Do's and Don'ts

### Do:
- **Do** spend cyan (`#57d6ff`) as glow, stroke, live-data, and small-badge fill — never as a large flat color block.
- **Do** keep Solana purple/green (`#9945ff`/`#14f195`) confined to the settlement section only.
- **Do** render numeric/telemetry values in Geist Mono with tabular figures (`.tabular`).
- **Do** use `.glass-panel` (translucent graphite + hairline border + blur) for any card-equivalent surface instead of a white bordered card.
- **Do** group parallel categories into one hairline-divided instrument panel rather than a grid of separate icon cards.
- **Do** reuse the night-grid arc motif (`NightGridMap`) at any scale where a "resource relieves a constrained zone" moment is being shown; do not invent a second signature animation.

### Don't:
- **Don't** place a tracked-uppercase kicker/eyebrow directly above an `H1` or `H2`; tracked-caps labels are for nav and status strips only.
- **Don't** use hard-offset, uncolored drop shadows; every shadow in this system is a soft, color-tinted ambient glow.
- **Don't** use flat sun/leaf-green "clean energy" color language or stock renewable-energy photography; all imagery is CSS/SVG-authored.
- **Don't** reassign risk/watch/normal to different colors between surfaces — the mapping is fixed system-wide.
- **Don't** present the demo zone/market data (`lib/demo-data.ts`) as real evidence in new copy; it is illustrative only (per `PRODUCT.md`).
