# Home Models Plan: Baseline and Fair Value

Status: planning. Supersedes parts of `08_MODEL_ORCHESTRATION.md` §3.2 where noted.

This covers the two remaining modelling pieces — the per-home baseline and the
fair-value price — after the spike classifier landed in `ml/`. It records what
the spike work measured, because several of those numbers decide things here.

---

## 1. The consolidation

`08_MODEL_ORCHESTRATION.md` §3.2 specifies four models. Three of them collapse:

| Spec model | Becomes | Why |
|---|---|---|
| Spike | unchanged — built, in `ml/` | keep |
| Price | stratified statistics, not ML | too few positives to learn from |
| Capacity | merged into Baseline | same quantity, different quantile |
| Baseline | one quantile model, p10 + p50 | — |

**Capacity and Baseline predict the same thing.** Both estimate a home's
counterfactual net grid draw absent an event. §3.3 reads p10 for
`committed_kwh`; §4.3 reads the expectation for `baseline_kwh`. That is one
model with two quantiles, not two models.

This is worth more than a tidier diagram: when sizing and settlement come from
one published number, you structurally cannot pair a generous sizing forecast
with a stingy settlement baseline. That asymmetry is the easiest aggregator
abuse and consolidating removes it by construction rather than by policy.

**Solar stays PVWatts and stays out of the trusted path.** `actual_grid_kwh` is
net of export, so the meter already captures solar at settlement. The solar
model only affects sizing, so it never enters the on-chain commitment. That
leaves exactly one model determining money.

Resulting stack:

| Component | Type | In settlement path |
|---|---|---|
| Spike | LightGBM classifier (built) | no |
| Fair value | stratified empirical statistics | no |
| **Home baseline** | **one quantile regressor** | **yes — the only one** |
| Solar | PVWatts physics | no |

---

## 2. Home baseline model

### 2.1 Target

Net grid draw per home per 15-minute interval, absent an event. One model,
predicted at two quantiles:

- **p10** → `committed_kwh`, conservative sizing
- **p50** → `baseline_kwh`, settlement counterfactual

LightGBM quantile objective, one booster per quantile.

### 2.2 The data problem — resolve this first

`06_AI_AND_SIMULATOR.md:209` defines `actual_kw = simulated actual usage`.
Homes are simulated, so a baseline model trained on simulator output **learns
the simulator's load formula**. Its held-out MAE will look excellent and measure
nothing.

This is not hypothetical. The spike model's original synthetic generator
produced zero positive labels at its own threshold and forecast features
correlated 1.000 with truth. It looked reasonable in review and was degenerate.
The baseline model faces the same trap and sits directly in the payment path,
where its error becomes payout error linearly and without bound.

Options, best first:

1. **NREL ResStock / End-Use Load Profiles** — free, public, 15-minute
   residential profiles by county, Travis County available. Simulated but
   physics-calibrated, authored by someone other than us, with real cross-home
   diversity and weather response. Roughly an hour to wire in.
2. **Pecan Street** — actual metered Austin residences including solar and EV,
   same geography as `LZ_AEN`. Better data, more access friction.
3. Hand-rolled simulator — acceptable for the demo loop only, never for any
   accuracy claim.

Either of the first two breaks the circularity. A sine-plus-noise formula gives
the model nothing to learn but itself.

### 2.3 Features

Mirrors `ml/features.py` where it applies:

- calendar: hour, day of week, month, holiday flag
- weather: temp and cloud cover, actual at `t` and forecast for `t+h`
- home history: lagged consumption, rolling means, same-interval-prior-day
- home static: floor area, occupancy, HVAC type, PV capacity if known

The home-history block is where gaming risk concentrates — see §2.5.

### 2.4 Evaluation

Reuse `ml/evaluate.py` directly; the machinery is already correct:

- **rolling-origin CV with embargo** — labels look forward, so train/test
  boundaries leak without it
- **macro-average per fold, never pool** — pooling across folds with different
  score scales inflated the spike model's PR-AUC from 0.4601 to 0.5854
- **report per-fold spread, not just the mean**

Two baseline-specific additions:

- §3.2 specifies "MAE on held-out normal days". Necessary but not sufficient:
  the model is *used* on hot afternoons during scarcity events, precisely what
  "normal days" excludes. Evaluate on event-like conditions separately.
- Report error in **dollars**, not just kWh. A 10% baseline overestimate is a
  10% overpayment on every home in every event, and the commitment hash will
  faithfully certify the wrong number.

### 2.5 Anti-gaming constraints

Publishing the baseline on-chain stops the aggregator moving it after the fact.
It does **not** stop a homeowner inflating consumption before an event to raise
their own baseline, then reverting and being paid for a "cut". The more the
model leans on the home's own recent load, the more directly the homeowner
controls their payout. This is the oldest attack in demand response.

Requirements, not nice-to-haves:

- exclude event days and event-adjacent days from training
- cap how far a baseline may exceed a rolling reference
- weight population and control-group features over the home's own recent history
- flag anomalous pre-event consumption ramps

None of these can be validated on synthetic occupants — simulated homes do not
behave strategically. Carry them as design constraints, not as tested claims.

---

## 3. Fair value

### 3.1 Stop treating price as ML

§3.2 plans "conditional averages → LightGBM quantile regression". Ship the
conditional averages and stop.

`E[price|spike]` would train on ~1,700 positive intervals across four years,
**26% of them from one week in February 2021**. That does not support a learned
model; a model fit on it would mostly memorise Winter Storm Uri.

Replace with stratified empirical statistics — conditional means and p10/p90
bucketed by hour of day and season. Same output contract, no training, fully
reproducible, and every number is traceable to a counterparty.

### 3.2 The price parameter decides whether the business works

Measured on out-of-sample predictions, realised price over the delivery window:

```
                 n_spike    mean   median   trimmed10%   E[no spike]
all data            2348    2505      970         2255            34
excl. Uri           1736    1033      627          882            34
2022+ only          1440    1107      665          953            35
```

The `$2,441` figure in earlier analysis was both Uri-contaminated and computed
inconsistently with the revenue definition. Corrected: **~$1,033, not $2,441.**

That parameter, not the threshold, decides profitability:

```
E[price|spike]=2441  →  mean margin  -513/MWh   loss rate 85%
E[price|spike]=1500  →  mean margin   -15/MWh   loss rate 73%
E[price|spike]=1033  →  profitable at every threshold
```

At $2,441 **every threshold loses money** — `fair_value` is overstated,
`locked_price` overpays, and 85% of events lose. Fix the estimator first.

Uri must be excluded here specifically: its near-cap prices are unreachable
under current ERCOT rules (yearly max steps 9,902 → 5,991 → 6,018 → 4,981 after
the post-Uri cap reduction). `ml/ingest.py` exposes `REGIME_EXCLUSIONS` and
`--exclude-regimes` for exactly this consumer. It stays **off** for the spike
classifier, where excluding Uri cost ~9% relative PR-AUC.

### 3.3 Event threshold

Recommended operating point: **P(spike) ≥ 0.50**.

```
thr    events/yr   precision   margin $/MWh   mean/sd   loss rate
0.10        128       38.1%           +178     0.213         61%
0.20         88       49.3%           +233     0.237         59%
0.30         68       58.8%           +290     0.264         57%
0.50         43       72.8%           +455     0.359         49%
0.70         23       84.4%           +747     0.521         38%
```

(Fair pricing at $1,033; flagged intervals clustered into events, ~1.5h each.)

Total P&L is nearly flat from 0.20 to 0.70, while risk-adjusted return rises
monotonically — so moving up is close to free. 43 events/year at ~1.5 hours is
operationally realistic for residential DR (typical programs run 10–60), and
three correct calls in four is defensible to a participant. Lower thresholds
dispatch homes far more often while being wrong more than half the time, which
costs retention in ways the P&L table does not model.

Pair it with a **disclosed `risk_buffer`**. Pricing at the median ($627) rather
than the mean ($1,033) lifts margin at 0.50 from +455 to +762 and cuts loss rate
from 49% to 36% — but that is underpaying participants relative to expected
value, so it must be an explicit buffer, not hidden margin. It also offsets a
measured model bias: calibration is over-confident by 4.4–5.2 points in the
0.20–0.70 band, squarely around the operating threshold.

---

## 4. Commitment and verifiability

### 4.1 What the hash proves

§4.4 already hashes the baseline at lock time. Be precise about the claim:

| Claim | Status |
|---|---|
| the baseline was not altered after the event | proven ✓ |
| the baseline was a good counterfactual | **not proven** ✗ |

A hash gives immutability, not accuracy.

### 4.2 Upgrade to reproducibility

Commit three things at lock, not one, so a third party can re-run inference and
confirm the published number:

1. baseline values (canonical JSON, as today)
2. **model artifact hash**
3. **input feature vector**

LightGBM inference is deterministic given fixed inputs, so this is achievable.
It turns "trust us, we didn't change it" into "re-run it yourself".

### 4.3 Artifact format — not pickle

The spike model currently ships as `spike_model.pkl`. For the verifiable path
that is the wrong format: pickles are Python- and library-version fragile, and
`pickle.load` executes arbitrary code — a poor property for a file third parties
are invited to run.

Use LightGBM's native `save_model()` text format: stable across versions,
human-readable, hashes cleanly. Keep pickle for local convenience only.

Track a small **manifest** in git rather than the artifact itself — hash,
feature list in order, training window, quantiles, library versions. Small,
diffable, reviewable in a PR; the bytes live in release storage or object
storage keyed by hash.

---

## 5. Open decisions

1. **Household data source** — ResStock, Pecan Street, or accept simulator-only
   for the demo with accuracy claims explicitly scoped out. Blocks §2.
2. **Price estimator** — mean ($1,033), median ($627), or trimmed ($882), and
   how much of the gap is declared as `risk_buffer` versus margin.
3. **Threshold** — 0.50 recommended; 0.70 if participant retention dominates.
4. **Artifact storage** — where hashed model bytes live once out of git.
5. **Event frequency cap** — independent of threshold; worth a hard limit per
   home per month regardless of what the model says.

---

## 6. Reusable from the spike work

Already built and correct; do not rewrite:

- `ml/evaluate.py` — `walk_forward_splits` (embargoed), `macro_scores`,
  `print_oos_report`, chi-square seasonality tests
- `ml/ingest.py` — caching pattern, `REGIME_EXCLUSIONS`, Open-Meteo fetchers
  with the `day_ahead` / `short` lead distinction
- `ml/spike_model.py` — persisted feature names enforced at predict;
  calibration layer (off by default, measured as a net loss)

Environment notes: `libomp` is not installable via Homebrew on Intel macOS here
and was sourced from conda-forge into `.venv` — it will not survive a venv
rebuild. `gridstatus` is pinned to 0.29.1 because 0.30+ requires Python 3.11.

---

## 7. Sequencing

1. Resolve household data (§2.2) — everything downstream is only as meaningful
   as this.
2. Fair-value statistics (§3) — mostly done, needs stratification and a robust
   estimator. Independent of §2, can run in parallel.
3. Baseline quantile model (§2) on real profiles, evaluated with the existing
   walk-forward machinery.
4. Commitment plumbing (§4) — manifest, native-format export, canonical JSON.
5. Anti-gaming constraints (§2.5) as code, flagged as unvalidated.
