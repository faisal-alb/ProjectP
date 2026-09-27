import { createHash, randomUUID } from "node:crypto";
import {
  activeFault,
  applyScenario,
  createDevices,
  evolveDevice,
  releaseScenario,
  rounded,
  RUN_ZONES,
  SCENARIOS,
  virtualAt,
  type Decision,
  type RunBundle,
  type RunEvent,
  type RunState,
  type ZoneId,
} from "@gridflex/shared";
import type { RunStore } from "./run-store";

export interface RunServices {
  bundle(): Promise<RunBundle>;
  decide(run: RunState, zone: ZoneId): Promise<Decision | null>;
  settle(run: RunState, event: RunEvent, persist: () => void): Promise<void>;
  preflight(): Promise<string[]>;
}
export class RunEngine {
  state: RunState | null;
  bundle: RunBundle | null = null;
  private busy = false;
  private ticking = false;
  private controlling = false;
  private working = false;
  private retryAutomaticAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  private elapsed = 0;
  private lastWall = Date.now();
  constructor(
    readonly store: RunStore,
    readonly services: RunServices,
    readonly publish: (s: RunState) => void = () => {},
  ) {
    this.state = store.current();
    if (this.state) {
      // Older untouched runs started paused by default; preserve other legacy pauses.
      this.state.autoplay ??= this.state.speed !== 0 &&
        (this.state.status !== "paused" ||
          (this.state.minute === 0 && this.state.events.length === 0));
      if (this.state.speed === 0) this.state.autoplay = false;
      if (this.state.status !== "completed") this.state.status = "paused";
      this.save();
    }
  }
  save = () => {
    if (!this.state) return;
    this.state.version++;
    this.store.save(this.state);
    this.publish(this.state);
  };
  log(type: string, message: string, eventId?: string, scenario?: string) {
    const s = this.state!;
    const entry = {
      seq: (s.log.at(-1)?.seq ?? 0) + 1,
      at: virtualAt(s),
      type,
      message,
      eventId,
      scenario,
    };
    s.log.push(entry);
    if (scenario) {
      const item = s.coverage.find((c) => c.scenario === scenario);
      if (item && type !== "scenario.injected") {
        item.status = "observed";
        item.evidence.push(entry.seq);
      }
    }
  }
  async preflight(checkCurrentBundle = true) {
    const errors = await this.services.preflight();
    try {
      const bundle = await this.services.bundle();
      if (checkCurrentBundle && this.state && this.state.bundleVersion !== bundle.version)
        errors.push("Dataset changed: restart with the new bundle.");
      if (bundle.points.length < 96 || !bundle.sources.length)
        errors.push("Dataset does not cover a full day.");
      if (Object.values(bundle.modelHealth).some((v) => v !== "model"))
        errors.push("Required model artifacts are unavailable.");
      this.bundle = bundle;
    } catch {
      errors.push("Historical dataset bundle is unavailable.");
    }
    return errors;
  }
  async restart(preset: "stress" | "historical" = "stress", seed = 7, autoplay = false) {
    if (this.busy || this.ticking)
      throw new Error("Wait for the current operation to finish.");
    if (
      this.state?.events.some(
        (e) => !["completed", "canceled"].includes(e.phase),
      )
    )
      throw new Error("Resolve outstanding commitments before restarting.");
    this.bundle = await this.services.bundle();
    this.state = {
      id: randomUUID(),
      version: 0,
      seed,
      bundleVersion: this.bundle.version,
      start: this.bundle.start,
      minute: 0,
      speed: 96,
      autoplay,
      status: "paused",
      preset,
      devices: createDevices(seed),
      zones: RUN_ZONES.map((id) => ({
        id,
        loadKw: 0,
        capacityKw: 55,
        forecastKw: 0,
        lowKw: 0,
        highKw: 0,
        reliefKw: 0,
        requiredKw: 0,
        status: "normal",
      })),
      environment: null,
      decisions: [],
      events: [],
      faults: [],
      log: [],
      sources: this.bundle.sources,
      coverage: SCENARIOS.map((s) => ({
        scenario: s.id,
        status: "pending",
        evidence: [],
      })),
      health: [],
      spentBase: "0",
      priceCapPerKwh: 0.6,
      series: [],
    };
    this.observe(false);
    this.log("run.created", "Energy day initialized.");
    this.save();
    return this.state;
  }
  inject(id: string) {
    const s = this.state!;
    const scenario = SCENARIOS.find((c) => c.id === id);
    if (!scenario) throw new Error("Unknown scenario");
    s.faults = s.faults.filter((f) => f.id !== id);
    s.faults.push({ id, until: s.minute + scenario.duration });
    s.coverage.find((c) => c.scenario === id)!.status = "injected";
    if (id === "full-battery" || id === "empty-battery") {
      s.devices
        .filter((d) => d.kind === "battery")
        .forEach(
          (d) =>
            (d.energyKwh =
              d.capacityKwh * (id === "full-battery" ? 1 : d.reserve)),
        );
      this.log("device.changed", scenario.label, undefined, id);
    }
    // Not evidence on its own: coverage still waits for the scenario to affect delivery.
    if (applyScenario(s, id))
      this.log("device.changed", `${scenario.label}: device settings updated.`);
    if (id === "cancel-event")
      for (const e of s.events.filter(
        (e) => !["completed", "canceled"].includes(e.phase),
      )) {
        e.canceled = true;
        e.cancellationReason = "Operator canceled remaining dispatch";
        // Preserve the window already signed on-chain; settle only actual delivery.
        if (e.phase === "dispatching") e.phase = "verifying";
        this.log("event.canceled", e.cancellationReason, e.id, id);
      }
    this.log("scenario.injected", scenario.label, undefined, id);
    this.save();
  }
  async control(action: string, value?: unknown) {
    if (this.controlling)
      throw new Error("Another control operation is in progress.");
    this.controlling = true;
    try {
      while (this.busy || this.ticking || this.working)
        await new Promise((resolve) => setTimeout(resolve, 25));
      return await this.applyControl(action, value);
    } finally {
      this.controlling = false;
    }
  }
  private async applyControl(action: string, value?: unknown) {
    if (action === "restart") {
      const autoplay = this.state?.autoplay ?? true;
      const speed = this.state?.speed ?? 96;
      await this.restart(value === "historical" ? "historical" : "stress", 7, autoplay);
      this.state!.speed = speed;
      this.retryAutomaticAt = 0;
      this.save();
      return this.state;
    }
    if (!this.state) await this.restart();
    const s = this.state!;
    if (action === "pause") {
      s.autoplay = false;
      s.status = "paused";
      this.elapsed = 0;
    } else if (action === "start") {
      if (s.speed === 0)
        throw new Error(
          "Use Next event in manual playback, or select a playback speed.",
        );
      // A single-day rehearsal can opt out of repeating without changing the UI default.
      s.autoplay = value !== "once";
      const failures = await this.preflight();
      s.health = failures;
      if (failures.length) {
        s.status = "paused";
        this.retryAutomaticAt = Date.now() + 30_000;
        this.save();
        throw new Error(failures.join(" "));
      }
      s.status = s.minute >= 1440 ? "draining" : "running";
      this.lastWall = Date.now();
      this.elapsed = 0;
    } else if (action === "speed") {
      if (typeof value !== "number" || ![0, 1, 24, 96].includes(value))
        throw new Error("Invalid speed");
      s.speed = value as RunState["speed"];
      if (s.speed === 0) {
        s.autoplay = false;
        if (s.status !== "completed") s.status = "paused";
        this.elapsed = 0;
      }
    } else if (action === "price-cap") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0.01 ||
        value > 1
      )
        throw new Error("Price cap must be between 0.01 and 1.");
      s.priceCapPerKwh = value;
      this.log(
        "preferences.updated",
        `Maximum procurement price is $${value.toFixed(2)}/kWh.`,
      );
    } else if (action === "resource") {
      const input = value as {
        id?: string;
        reservePercent?: number;
        available?: boolean;
        optedOut?: boolean;
      };
      const device = s.devices.find((d) => d.id === input?.id);
      if (!device) throw new Error("Unknown resource");
      if (input.reservePercent !== undefined) {
        if (
          !Number.isFinite(input.reservePercent) ||
          input.reservePercent < 10 ||
          input.reservePercent > 100
        )
          throw new Error("Reserve must be between 10 and 100 percent");
        device.reserve = input.reservePercent / 100;
        // A presenter's own setting outlasts whatever a scenario was holding.
        delete device.held?.reserve;
      }
      if (typeof input.available === "boolean") {
        device.available = input.available;
        delete device.held?.available;
      }
      if (typeof input.optedOut === "boolean") device.optedOut = input.optedOut;
      this.log(
        "resource.updated",
        `${device.id}: operating preferences updated.`,
      );
    } else if (action === "inject") this.inject(String(value));
    else if (action === "next-event") {
      if (s.speed !== 0) throw new Error("Select manual playback first.");
      if (s.status === "completed") return s;
      if (s.status !== "paused") throw new Error("Pause before advancing.");
      const failures = await this.preflight();
      if (failures.length) throw new Error(failures.join(" "));
      const sequence = s.log.at(-1)?.seq ?? 0;
      const phases = () => s.events.map((e) => `${e.id}:${e.phase}`).join("|");
      const before = phases();
      const reachedEvent = () =>
        phases() !== before ||
        s.log.some(
          (e) => e.seq > sequence &&
            /^(event\.|scenario\.|telemetry\.recovered|settlement\.pending|forecast\.unavailable)/.test(e.type),
        );

      // Finish pending real transactions before moving the virtual clock.
      await this.reconcile();
      while (s.minute < 1440 && !reachedEvent()) {
        if (s.events.some((e) => ["scheduled", "committing"].includes(e.phase) && !e.error))
          throw new Error(
            "Waiting for transaction confirmation. Try Next event again shortly.",
          );
        await this.advance();
        if (reachedEvent()) break;
        await this.reconcile();
      }
      if (s.minute >= 1440) await this.reconcile();
    } else if (action === "step") {
      if (s.status !== "paused") throw new Error("Pause before stepping.");
      const failures = await this.preflight();
      if (failures.length) throw new Error(failures.join(" "));
      const target = Math.min(
        1440,
        s.minute + Math.max(1, Math.min(60, Number(value) || 15)),
      );
      while (s.minute < target) {
        await this.advance();
        await this.reconcile();
      }
    } else if (!["start", "pause", "speed", "inject"].includes(action))
      throw new Error("Unknown action");
    this.save();
    return this.state;
  }
  private observe(evolve = true) {
    const s = this.state!;
    const at = Date.parse(virtualAt(s));
    const raw = [...this.bundle!.points]
      .reverse()
      .find((p) => Date.parse(p.at) <= at);
    if (!raw) throw new Error("No environmental coverage for this time.");
    const p = structuredClone(raw);
    if (activeFault(s, "negative-price")) {
      p.priceMwh = -25;
      this.evidence(
        "negative-price",
        "Negative prices suppress price-driven procurement.",
      );
    }
    if (activeFault(s, "solar-drop")) {
      p.radiationWm2 *= 0.15;
      this.evidence("solar-drop", "Solar output reduced by cloud front.");
    }
    s.environment = p;
    const faults = s.faults.filter((f) => f.until > s.minute).map((f) => f.id);
    for (const [zi, zone] of s.zones.entries()) {
      const homes = p.homesKw.filter((_, i) => i % 4 === zi);
      let native = homes.reduce((a, b) => a + b, 0) + (p.commercialKw[zi] ?? 0);
      if (activeFault(s, "demand-surge") || activeFault(s, "peak")) {
        native += zone.capacityKw * 0.7;
        for (const fault of ["peak", "demand-surge"])
          if (activeFault(s, fault))
            this.evidence(
              fault,
              "Added demand exceeds local operating limits.",
            );
      }
      let relief = 0;
      for (const [i, d] of s.devices
        .filter((d) => d.zone === zone.id)
        .entries()) {
        d.baselineKw =
          d.kind === "battery"
            ? (homes[i % homes.length] ?? 0)
            : d.kind === "hvac"
              ? Math.max(0, (p.tempF - 74) * 0.13)
              : 0;
        if (d.kind === "ev")
          d.baselineKw =
            s.minute < d.departureMinute || s.minute >= 1080
              ? Math.min(
                  d.maxKw,
                  (Math.max(0, d.targetKwh - d.energyKwh) * 60) / 0.9,
                )
              : 0;
        if (d.kind === "solar")
          d.baselineKw =
            -Math.min(d.maxKw, (d.maxKw * Math.max(0, p.radiationWm2)) / 1000) *
            0.8;
        const event = s.events.find(
          (e) =>
            e.zone === zone.id &&
            e.phase === "dispatching" &&
            e.startMinute <= s.minute &&
            e.endMinute > s.minute &&
            !e.canceled,
        );
        const commitment = event?.commitments.find(
          (c) => c.resourceId === d.id,
        );
        if (evolve) {
          const chargeLimit =
            Math.max(
              0,
              zone.capacityKw -
                homes.reduce((a, b) => a + b, 0) -
                (p.commercialKw[zi] ?? 0) -
                15,
            ) / 6;
          const result = evolveDevice(
            d,
            commitment?.kw ?? 0,
            s.minute,
            p.tempF,
            p.radiationWm2,
            faults,
            chargeLimit,
          );
          // Household baseline is already in native load; other assets add their own draw.
          native +=
            result.consumptionKw - (d.kind === "battery" ? d.baselineKw : 0);
          relief += result.reliefKw;
          for (const f of ["reserve", "storm", "ev-departure"])
            if (faults.includes(f))
              this.evidence(f, `${d.kind} operating limits applied.`);
          if (commitment) {
            commitment.physicalWh += (result.reliefKw * 1000) / 60;
            const invalid = [
              "missing-readings",
              "stale-readings",
              "implausible-readings",
            ].find((f) => faults.includes(f));
            if (invalid) {
              commitment.missing++;
              (commitment.quarantined ??= []).push({
                minute: s.minute,
                wh:
                  (Math.max(0, commitment.baselineKw - result.consumptionKw) *
                    1000) /
                  60,
                reason: invalid,
              });
              this.evidence(
                invalid,
                "Reading quarantined; verification awaits valid evidence.",
                event!.id,
              );
            } else {
              // Native actual load plus physical response is independent of prediction.
              const estimated = Math.max(
                0,
                commitment.baselineKw - result.consumptionKw,
              );
              commitment.deliveredWh += (estimated * 1000) / 60;
              commitment.samples++;
              if (faults.includes("duplicate-readings"))
                this.evidence(
                  "duplicate-readings",
                  "Repeated interval key discarded.",
                  event!.id,
                );
            }
            for (const f of [
              "under-delivery",
              "over-delivery",
              "zero-delivery",
              "device-offline",
              "hvac-limit",
              "generator-limit",
            ]) {
              if (faults.includes(f))
                this.evidence(
                  f,
                  `Device response recorded: ${rounded(result.reliefKw)} kW.`,
                  event!.id,
                );
            }
          }
        }
      }
      zone.loadKw = rounded(native);
      zone.reliefKw = rounded(relief);
      zone.status =
        native > zone.capacityKw
          ? "high"
          : native > zone.capacityKw * 0.9
            ? "watch"
            : "normal";
    }
  }
  evidence(id: string, message: string, eventId?: string) {
    if (
      this.state!.coverage.find((c) => c.scenario === id)?.status !== "observed"
    )
      this.log("scenario.observed", message, eventId, id);
  }
  async advance() {
    if (this.ticking || !this.state || this.state.minute >= 1440) return;
    this.ticking = true;
    try {
      const s = this.state;
      if (!this.bundle) this.bundle = await this.services.bundle();
      if (s.preset === "stress") {
        // Supply compatible delivery windows for scheduled telemetry and settlement faults.
        if ([120, 360, 720, 1095, 1185].includes(s.minute))
          this.inject("demand-surge");
        for (const f of SCENARIOS.filter((f) => f.minute === s.minute))
          this.inject(f.id);
      }
      const ended = s.faults.filter((f) => f.until <= s.minute);
      s.faults = s.faults.filter((f) => f.until > s.minute);
      for (const f of ended)
        if (releaseScenario(s, f.id))
          this.log(
            "device.changed",
            `${SCENARIOS.find((c) => c.id === f.id)?.label ?? f.id} ended: device settings restored.`,
          );
      // The simulator keeps raw interval evidence. After a fault clears, a corrected
      // resend is ingested exactly once; unavailable real telemetry must remain pending.
      for (const event of s.events)
        for (const c of event.commitments) {
          const recovered = (c.quarantined ?? []).filter(
            (q) => !activeFault(s, q.reason),
          );
          if (recovered.length) {
            c.deliveredWh += recovered.reduce((sum, q) => sum + q.wh, 0);
            c.samples += recovered.length;
            c.missing -= recovered.length;
            c.quarantined = (c.quarantined ?? []).filter((q) =>
              activeFault(s, q.reason),
            );
            this.log(
              "telemetry.recovered",
              `${recovered.length} corrected intervals ingested once.`,
              event.id,
            );
          }
        }
      this.observe();
      if (s.minute % 15 === 0)
        (s.series ??= []).push({
          at: virtualAt(s),
          zones: structuredClone(s.zones),
        });
      for (const e of s.events)
        if (e.phase === "dispatching" && s.minute >= e.endMinute) {
          e.phase = "verifying";
          this.log(
            "event.verifying",
            "Delivery window closed; checking interval evidence.",
            e.id,
          );
        }
      if (s.minute % 15 === 0 && s.minute < 1380)
        for (const z of RUN_ZONES) await this.decide(z);
      s.minute++;
      for (const e of s.events)
        if (e.phase === "dispatching" && s.minute >= e.endMinute)
          e.phase = "verifying";
      if (s.minute === 1440 && s.status === "running") s.status = "draining";
      this.save();
    } finally {
      this.ticking = false;
    }
  }
  private async decide(zone: ZoneId) {
    const s = this.state!;
    if (["incomplete-data", "corrupt-model"].some((f) => activeFault(s, f))) {
      const f = activeFault(s, "incomplete-data")
        ? "incomplete-data"
        : "corrupt-model";
      this.evidence(
        f,
        "New commitments paused because required inputs are unusable.",
      );
      return;
    }
    let decision: Decision | null = null;
    if (!activeFault(s, "forecast-offline"))
      decision = await this.services.decide(s, zone);
    if (!decision) {
      this.evidence(
        "forecast-offline",
        "Forecast unavailable; holding new commitments and continuing existing delivery.",
      );
      this.log("forecast.unavailable", `Forecast unavailable for ${zone}.`);
      return;
    }
    decision.id = `${s.id}:${s.minute}:${zone}`;
    s.decisions.push(decision);
    const z = s.zones.find((z) => z.id === zone)!;
    z.forecastKw = decision.horizonKw[0] ?? z.loadKw;
    z.lowKw = z.forecastKw * 0.9;
    z.highKw = z.forecastKw * 1.1;
    z.requiredKw = decision.requiredKw;
    for (const f of [
      "zero-procurement",
      "partial-procurement",
      "price-ineligible",
      "declined",
      "unanswered",
      "opt-out",
      "optimizer-infeasible",
      "device-offline",
      "forecast-error",
    ])
      if (activeFault(s, f))
        this.evidence(
          f,
          `${decision.dispatch.length} resources selected; ${rounded(decision.uncoveredKw)} kW uncovered.`,
        );
    if (
      !decision.dispatch.length ||
      decision.requiredKw <= 0 ||
      s.events.some(
        (e) => e.zone === zone && !["completed", "canceled"].includes(e.phase),
      )
    )
      return;
    let remainingWh = Math.floor(decision.requiredKw * 1000);
    const commitments = decision.dispatch
      .map((d) => {
        const committedWh = Math.min(remainingWh, Math.floor(d.kw * 1000));
        remainingWh -= committedWh;
        return {
          ...d,
          kw: committedWh / 1000,
          committedWh,
          deliveredWh: 0,
          physicalWh: 0,
          baselineHash: createHash("sha256")
            .update(
              JSON.stringify({
                at: decision!.at,
                version: decision!.modelVersion,
                id: d.resourceId,
                baseline: d.baselineKw,
              }),
            )
            .digest("hex"),
          samples: 0,
          missing: 0,
        };
      })
      .filter((c) => c.committedWh > 0);
    const escrow = BigInt(
      Math.ceil(decision.requiredKw * decision.price * 1e6),
    );
    const maxEvent = BigInt(process.env.RUN_EVENT_LIMIT_BASE ?? "100000000");
    const maxRun = BigInt(process.env.RUN_SPEND_LIMIT_BASE ?? "1000000000");
    if (escrow <= 0n) return;
    if (escrow > maxEvent || BigInt(s.spentBase) + escrow > maxRun) {
      this.log(
        "budget.limit",
        "Procurement paused at the configured spending limit.",
      );
      return;
    }
    const e: RunEvent = {
      id: `${s.id}:${s.events.length}`,
      zone,
      startMinute: s.minute + 1,
      endMinute: s.minute + 61,
      phase: "scheduled",
      decisionId: decision.id,
      price: decision.price,
      requiredKw: decision.requiredKw,
      commitments,
      chainId: String(BigInt(Date.now()) * 1000n + BigInt(s.events.length)),
      escrowBase: escrow.toString(),
      attempts: 0,
    };
    s.spentBase = (BigInt(s.spentBase) + escrow).toString();
    s.events.push(e);
    this.log(
      "event.scheduled",
      `${zone}: ${rounded(decision.requiredKw)} kW requested.`,
      e.id,
    );
  }
  async reconcile() {
    if (this.busy || !this.state) return;
    this.busy = true;
    try {
      for (const e of this.state.events.filter(
        (e) => !["completed", "canceled", "dispatching"].includes(e.phase),
      )) {
        if (e.retryAt && e.retryAt > Date.now()) continue;
        try {
          const before = e.phase;
          await this.services.settle(this.state, e, this.save);
          e.error = undefined;
          e.retryAt = undefined;
          if (before !== e.phase)
            this.log(`event.${e.phase}`, `${e.zone}: ${e.phase}.`, e.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "";
          e.error =
            /^(Settlement pending:|Operator test-token|Escrow confirmation|Commitment batch|Awaiting \d+ validated|Payout confirmation)/.test(
              message,
            )
              ? message
              : "Settlement unavailable; retrying after reconciliation.";
          if (e.error !== message)
            console.error(`Run settlement ${e.id}: ${message}`);
          e.attempts++;
          e.retryAt =
            Date.now() + Math.min(30_000, 1000 * 2 ** Math.min(e.attempts, 5));
          this.log("settlement.pending", e.error, e.id);
          for (const f of [
            "rpc-timeout",
            "insufficient-funds",
            "expired-transaction",
            "delayed-confirmation",
            "partial-batch",
          ])
            if (activeFault(this.state, f)) this.evidence(f, e.error, e.id);
        }
      }
      if (
        this.state.minute >= 1440 &&
        this.state.events.every((e) =>
          ["completed", "canceled"].includes(e.phase),
        )
      )
        this.state.status = "completed";
      this.save();
    } finally {
      this.busy = false;
    }
  }
  private async automaticPlayback(now: number) {
    if (now < this.retryAutomaticAt) return;
    this.retryAutomaticAt = now + 30_000;
    if (!this.state) await this.restart("stress", 7, true);
    const previous = this.state!;
    const failures = await this.preflight(previous.status !== "completed");
    previous.health = failures;
    if (failures.length) {
      this.save();
      return;
    }
    if (previous.status === "completed") {
      this.save();
      await this.restart(previous.preset, previous.seed, true);
      this.state!.speed = previous.speed;
      this.state!.priceCapPerKwh = previous.priceCapPerKwh;
    }
    this.state!.status = this.state!.minute >= 1440 ? "draining" : "running";
    this.elapsed = 0;
    this.lastWall = Date.now();
    this.retryAutomaticAt = 0;
    this.save();
  }

  /** One serialized worker pass; also used by deterministic lifecycle checks. */
  async tick(now = Date.now()) {
    const dt = Math.max(0, Math.min(2000, now - this.lastWall));
    this.lastWall = now;
    if (this.controlling || this.working) return;
    this.working = true;
    try {
      if (!this.state || (this.state.autoplay &&
          ["paused", "completed"].includes(this.state.status))) {
        await this.automaticPlayback(now);
        return;
      }
      if (this.state.status === "running" &&
          this.state.events.some((e) =>
            ["scheduled", "committing"].includes(e.phase) && !e.error)) {
        // Real transaction confirmation is a barrier, not simulated elapsed time.
        await this.reconcile();
        return;
      }
      if (this.state.status === "running") {
        this.elapsed += dt * this.state.speed;
        if (this.elapsed >= 60_000) {
          this.elapsed -= 60_000;
          await this.advance();
        }
      }
      if (["running", "draining"].includes(this.state.status))
        await this.reconcile();
    } catch (error) {
      this.retryAutomaticAt = now + 30_000;
      if (this.state) {
        this.state.status = "paused";
        this.state.health = [error instanceof Error ? error.message : String(error)];
        this.log("run.error", this.state.health[0]);
        this.save();
      } else {
        console.error("Automatic run initialization failed; retrying in 30 seconds.", error);
      }
    } finally {
      this.working = false;
    }
  }

  startWorker() {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 250);
    this.timer.unref();
  }
  stopWorker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
