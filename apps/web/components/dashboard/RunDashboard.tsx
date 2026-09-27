"use client";
import { useState } from "react";
import { virtualAt, type RunState, type ZoneId } from "@gridflex/shared";
import { useRun, runTime } from "./RunProvider";
import { RunAssistant } from "../voice/RunAssistant";

const number = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const dollars = (base: string | undefined) =>
  `$${(Number(base ?? 0) / 1e6).toFixed(2)}`;
const zoneName = (zone: string) =>
  `${zone[0].toUpperCase()}${zone.slice(1)} Austin`;
export function RunDashboard({
  role = "operator",
  view = "overview",
}: {
  role?: "operator" | "participant";
  view?: "overview" | "zones" | "devices" | "earnings" | "settings";
}) {
  const { run, connected } = useRun();
  const [zone, setZone] = useState<ZoneId>("downtown");
  if (!run)
    return (
      <section className="py-12">
        <h1 className="text-2xl font-semibold">
          {role === "operator" ? "Austin grid" : "My energy"}
        </h1>
        <p role="status" className="mt-3 text-muted">
          {connected
            ? "Waiting for the energy day to begin."
            : "Connecting to the energy service…"}
        </p>
      </section>
    );
  const z = run.zones.find((z) => z.id === zone)!;
  const devices = run.devices.filter((d) => d.zone === zone);
  const decisions = run.decisions.filter((d) => d.zone === zone);
  const decision = decisions.at(-1);
  const own = new Set(
    devices
      .filter((d) => d.kind !== "battery" || d.id.endsWith("-0"))
      .map((d) => d.id),
  );
  const events = run.events
    .filter((e) => e.zone === zone)
    .map((e) =>
      role === "participant"
        ? {
            ...e,
            commitments: e.commitments.filter((c) => own.has(c.resourceId)),
          }
        : e,
    )
    .filter((e) => role === "operator" || e.commitments.length > 0);
  const paid = events
    .flatMap((e) => e.commitments)
    .reduce((sum, c) => sum + Number(c.paidBase ?? 0), 0);
  const household = devices.find((d) => d.kind === "battery")!;
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {view === "earnings"
              ? "Energy earnings"
              : view === "devices"
                ? "Energy resources"
                : view === "settings"
                  ? "Operating preferences"
                  : role === "operator"
                    ? "Austin grid"
                    : "My energy"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {runTime(virtualAt(run))} ·{" "}
            {connected
              ? "Synchronized"
              : "Connection interrupted · last received state"}
          </p>
        </div>
        <label className="text-sm text-muted">
          Area
          <select
            className="ml-3 rounded-md border border-border bg-background-raised p-2 text-foreground"
            value={zone}
            onChange={(e) => setZone(e.target.value as ZoneId)}
          >
            {run.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {zoneName(z.id)}
              </option>
            ))}
          </select>
        </label>
      </header>
      {run.health.length > 0 && (
        <p role="status" className="text-sm text-watch">
          New commitments are paused until operating requirements are restored.
        </p>
      )}
      {view === "zones" && (
        <section className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-4 text-left text-muted">
              All areas · modeled local conditions
            </caption>
            <thead>
              <tr>
                {["Area", "Demand", "Forecast", "Relief", "Condition"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-border p-3 font-medium"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {run.zones.map((z) => (
                <tr key={z.id}>
                  <td className="border-b border-border p-3">
                    {zoneName(z.id)}
                  </td>
                  <td className="border-b border-border p-3">
                    {number(z.loadKw)} kW
                  </td>
                  <td className="border-b border-border p-3">
                    {number(z.forecastKw)} kW
                  </td>
                  <td className="border-b border-border p-3">
                    {number(z.reliefKw)} kW
                  </td>
                  <td className="border-b border-border p-3">
                    {z.status === "high"
                      ? "Needs flexibility"
                      : z.status === "watch"
                        ? "Near capacity"
                        : "Normal"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {(view === "overview" || view === "zones") && (
        <>
          <section
            className="grid gap-8 border-y border-border py-6 lg:grid-cols-[1.6fr_1fr]"
            aria-labelledby="outlook-title"
          >
            <div>
              <div className="flex justify-between gap-3">
                <h2 id="outlook-title" className="text-lg font-semibold">
                  {zoneName(zone)} outlook
                </h2>
                <span
                  className={
                    z.status === "high"
                      ? "text-risk"
                      : z.status === "watch"
                        ? "text-watch"
                        : "text-normal"
                  }
                >
                  {z.status === "high"
                    ? "Flexibility needed"
                    : z.status === "watch"
                      ? "Near capacity"
                      : "Within capacity"}
                </span>
              </div>
              <ForecastChart run={run} zone={zone} />
              <p className="mt-2 text-xs text-muted">
                Green: modeled demand · Blue: forecast · Dashed: 55 kW limit
              </p>
            </div>
            <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-5 text-sm">
              <Metric label="Current demand" value={`${number(z.loadKw)} kW`} />
              <Metric
                label="Delivered relief"
                value={`${number(z.reliefKw)} kW`}
              />
              <Metric
                label="Price spike probability"
                value={
                  decision
                    ? `${Math.round(decision.pSpike * 100)}%`
                    : "Awaiting forecast"
                }
              />
              <Metric
                label="Flexibility price"
                value={
                  decision
                    ? `$${decision.price.toFixed(2)}/kWh`
                    : "Awaiting forecast"
                }
              />
              <Metric
                label="Regional load"
                value={`${number(run.environment?.regionalLoadMw ?? 0)} MW`}
              />
              <Metric
                label="Temperature"
                value={`${number(run.environment?.tempF ?? 0)}°F`}
              />
            </dl>
          </section>
          {role === "participant" && (
            <section className="border-b border-border pb-6">
              <h2 className="text-lg font-semibold">Your battery</h2>
              <p className="mt-2 text-muted">
                {number(household.energyKwh)} of {household.capacityKwh} kWh
                stored · {Math.round(household.reserve * 100)}% minimum reserve
                · {household.status.toLowerCase()}
              </p>
              <p className="mt-2 text-sm">
                {decision?.dispatch.find((d) => d.resourceId === household.id)
                  ? "Selected to support the local grid within your energy limits."
                  : "Keeping energy available until a suitable request arrives."}
              </p>
            </section>
          )}
          <section>
            <h2 className="text-lg font-semibold">Decision record</h2>
            {decision ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  {runTime(decision.at)} · {decision.source}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {decision.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted">
                  {number(decision.requiredKw)} kW requested ·{" "}
                  {number(decision.uncoveredKw)} kW uncovered
                </p>
                <details className="mt-3 text-sm text-muted">
                  <summary className="cursor-pointer">
                    Operating constraints
                  </summary>
                  <p className="mt-2">{decision.constraints.join(" · ")}</p>
                </details>
              </>
            ) : (
              <p className="mt-3 text-muted">
                The next decision will appear when the day advances.
              </p>
            )}
          </section>
        </>
      )}
      {view === "devices" && (
        <section className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-4 text-left text-muted">
              Modeled devices responding to shared operating conditions
            </caption>
            <thead className="text-muted">
              <tr>
                {["Resource", "Stored / fuel", "Power", "State"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-3 py-3 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices
                .filter((d) => role === "operator" || own.has(d.id))
                .map((d) => (
                  <tr key={d.id}>
                    <td className="border-b border-border px-3 py-4 capitalize">
                      {d.kind} {d.id.split("-").at(-1)}
                    </td>
                    <td className="border-b border-border px-3 py-4 tabular-nums">
                      {number(d.kind === "generator" ? d.fuelKwh : d.energyKwh)}{" "}
                      kWh
                    </td>
                    <td className="border-b border-border px-3 py-4 tabular-nums">
                      {number(d.powerKw)} kW
                    </td>
                    <td className="border-b border-border px-3 py-4">
                      {d.status}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
      {view === "settings" && (
        <section>
          <h2 className="text-lg font-semibold">Automatic operation</h2>
          <p className="mt-3 max-w-2xl text-sm text-muted">
            The shared system respects household reserves, comfort limits,
            departure energy, and minimum offer prices. Changes to the shared
            run are controlled by the presenter.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-5">
            <Metric
              label="Battery reserve"
              value={`${household.reserve * 100}%`}
            />
            <Metric
              label="Minimum battery offer"
              value={`$${household.minPrice.toFixed(2)}/kWh`}
            />
            <Metric label="Dispatch limit" value={`${household.maxKw} kW`} />
            <Metric
              label="Settlement network"
              value="Solana devnet · test tokens"
            />
          </dl>
        </section>
      )}
      {(view === "overview" || view === "earnings") && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {view === "earnings"
                ? "Confirmed payments"
                : "Flexibility events"}
            </h2>
            <p className="text-sm text-muted">
              {dollars(String(paid))} paid this run · devnet test tokens
            </p>
          </div>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No flexibility events recorded yet.
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-border">
              {[...events].reverse().map((e) => (
                <li key={e.id} className="py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium">
                      {new Date(
                        Date.parse(run.start) + e.startMinute * 60000,
                      ).toLocaleTimeString("en-US", {
                        timeZone: "America/Chicago",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {number(e.requiredKw)} kW
                    </p>
                    <span className="text-sm capitalize text-muted">
                      {e.phase}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {number(
                      e.commitments.reduce((s, c) => s + c.deliveredWh, 0) /
                        1000,
                    )}{" "}
                    kWh measured · {e.commitments.length} resources · $
                    {e.price.toFixed(2)}/kWh
                  </p>
                  {e.error && (
                    <p className="mt-2 text-sm text-watch">{e.error}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    {e.address && (
                      <a
                        className="text-accent underline underline-offset-4"
                        href={`https://explorer.solana.com/address/${e.address}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Escrow account
                      </a>
                    )}
                    {e.commitments
                      .filter((c) => c.signature)
                      .map((c) => (
                        <a
                          key={c.resourceId}
                          className="text-accent underline underline-offset-4"
                          href={`https://explorer.solana.com/tx/${c.signature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {c.resourceId} · {dollars(c.paidBase)}
                        </a>
                      ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      <RunAssistant role={role} zone={zone} />
      <details className="border-t border-border pt-4 text-sm">
        <summary className="cursor-pointer text-muted">
          Data sources and estimation methods
        </summary>
        <ul className="mt-4 space-y-4">
          {run.sources.map((s) => (
            <li key={s.source}>
              <p className="break-words font-medium">
                {s.source.startsWith("http") ? (
                  <a href={s.source} className="text-accent underline">
                    {s.geography} source
                  </a>
                ) : (
                  s.source
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                {s.kind} · {s.geography} · {s.units}. {s.detail}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted">
          Historical inputs and modeled local equipment. No connected customer
          meters or physical device control. Payments use test tokens.
        </p>
      </details>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums">{value}</dd>
    </div>
  );
}
function ForecastChart({ run, zone }: { run: RunState; zone: ZoneId }) {
  const points = run.decisions.filter((d) => d.zone === zone);
  const max = Math.max(
    70,
    ...points.map((d) => d.horizonKw[0] ?? 0),
    ...(run.series ?? []).map(
      (p) => p.zones.find((z) => z.id === zone)?.loadKw ?? 0,
    ),
  );
  const actual = (run.series ?? [])
    .map(
      (p) =>
        `${((Date.parse(p.at) - Date.parse(run.start)) / 86400000) * 600},${170 - ((p.zones.find((z) => z.id === zone)?.loadKw ?? 0) / max) * 150}`,
    )
    .join(" ");
  const poly = points
    .map(
      (d) =>
        `${((Date.parse(d.at) - Date.parse(run.start)) / 86400000) * 600},${170 - ((d.horizonKw[0] ?? 0) / max) * 150}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 600 200"
      role="img"
      aria-label="Demand forecast through the day with modeled capacity line"
      className="mt-5 w-full"
    >
      <line
        x1="0"
        x2="600"
        y1={170 - (55 / max) * 150}
        y2={170 - (55 / max) * 150}
        stroke="var(--color-watch, #d6a55a)"
        strokeDasharray="5 5"
      />
      <polyline
        points={actual}
        fill="none"
        stroke="#6fb58f"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={poly}
        fill="none"
        stroke="var(--color-accent, #7fb4cc)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
      {[0, 6, 12, 18, 24].map((h) => (
        <text
          key={h}
          x={h === 24 ? 595 : (h / 24) * 600 + 5}
          textAnchor={h === 24 ? "end" : "start"}
          y="196"
          fill="#a0a1a8"
          fontSize="16"
        >
          {h}:00
        </text>
      ))}
    </svg>
  );
}
