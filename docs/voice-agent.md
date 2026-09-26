# Voice agent (website)

Two voice surfaces, one voice service. This covers the **website** surface: a conversational
ElevenLabs agent on the household dashboard. Nest announcements (TTS → MP3 → Cast) come later.

```
Browser ── @elevenlabs/react ── ElevenLabs agent
   │                                  │
   │  GET /api/voice/session          │ calls client tools (browser-side)
   ▼                                  ▼
Next route (signed URL)        GridAssistant → dashboard snapshot (read-only)
```

## Setup

1. In the repo-root `.env` (see `.env.example`):
   `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`.
2. Create an agent in ElevenLabs, set **authentication on** (so it needs a signed URL), then add the
   **client tools** below (Tools → Add tool → Client, "wait for response" on).
3. Paste the system prompt below.

## Client tools

All return small JSON and change nothing. Names must match `components/voice/GridAssistant.tsx`.

| Tool | Parameters | Returns |
| --- | --- | --- |
| `get_grid_status` | none | zone, event window, why |
| `get_my_resources` | none | battery capacity, charge %, discharge limit, reserve |
| `get_available_flex` | none | kWh above reserve, kWh it would share |
| `get_active_event` | none | window, $/kWh, planned kWh, estimated earnings, status |
| `get_upcoming_events` | none | same as `get_active_event` (one event in the demo) |
| `get_earnings` | none | month total, event count |
| `get_autoflex_settings` | none | AutoFlex on/off, reserve, min price, max kWh |
| `get_power_plan` | none | Tonight's ranked Power Plan: each action's rank, kWh, earnings, reasons, caveat, plus a one-line "why" |
| `highlight_element` | `element`: `tonight` \| `earnings` \| `autoflex` \| `plan` (enum) | scrolls to and rings that section |

## System prompt (starting point)

> You are the GridFlex Grid Assistant, talking with a household about their home battery and
> tonight's grid event. Be brief and speak numbers naturally ("five kilowatt-hours", "one dollar
> fifty-five"). Always use the tools for facts; never guess amounts. When you explain a payment or
> event, call `highlight_element` for the relevant section while you talk. You cannot change any
> settings or join events yet.
>
> For "what should I do tonight" questions, call `get_power_plan` and explain the plan it returns. The
> ranking is already decided by GridFlex's optimizer: explain it in the order given and use its reasons,
> never re-rank or invent actions, and never suggest sending generator power to the grid. If the plan
> has a caveat, mention it. Call `highlight_element` with "plan" while you talk. If asked, say so and point to the control on screen.

## Not built yet

- Write actions (`accept_event`, `update_autoflex`, ...). When added, every one must read back the
  effect and require an explicit spoken "yes" before executing, so a misheard phrase can't change
  energy preferences.
- Server/webhook tools once data lives in `apps/api`; today the demo household state is client-side.
- `/voice/tts`, MP3 caching, Google Cast → Nest.

## Power Plan (Energy Copilot)

`packages/shared/src/power-plan.ts` ranks what a household can do about a grid stress event:
store excess solar, discharge the battery, shift household load, run a generator, or do nothing.
It's a pure function (tested in `power-plan.test.ts`): the optimizer decides, the card shows it,
and the voice agent only explains it. Each action is scored on financial value, grid relief,
reliability and emissions, weighted by the household's "Optimize for" setting; a storm multiplies
the reliability weight and raises the protected reserve to 80%. Solar surplus, generator fuel cost
and shiftable load are demo constants for now.
