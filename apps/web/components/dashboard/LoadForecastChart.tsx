"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface LoadPoint {
  minutes: number;
  mw: number;
}

export function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

const HEIGHT = 260;
const M = { top: 28, right: 16, bottom: 28, left: 44 };
const Y_MIN = 8;
const Y_MAX = 14;
const Y_TICKS = [8, 10, 12, 14];

/**
 * Forecast load against zone capacity. Flexibility is modeled as
 * delivered only where load would exceed capacity inside the window,
 * so the "with flexibility" line flattens at capacity when fully covered
 * and still overshoots by the shortfall when it isn't.
 */
export function LoadForecastChart({
  curve,
  capacityMw,
  committedKw,
  nowMinutes,
  windowStart,
  windowEnd,
}: {
  curve: LoadPoint[];
  capacityMw: number;
  committedKw: number;
  nowMinutes: number;
  windowStart: number;
  windowEnd: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const committedMw = committedKw / 1000;

  const points = useMemo(
    () =>
      curve.map((p) => {
        const inWindow = p.minutes >= windowStart && p.minutes <= windowEnd;
        const over = Math.max(0, p.mw - capacityMw);
        const relief = inWindow ? Math.min(over, committedMw) : 0;
        return { ...p, withFlex: Math.round((p.mw - relief) * 100) / 100 };
      }),
    [curve, capacityMw, committedMw, windowStart, windowEnd],
  );

  const t0 = curve[0].minutes;
  const t1 = curve[curve.length - 1].minutes;
  const innerW = Math.max(200, width - M.left - M.right);
  const innerH = HEIGHT - M.top - M.bottom;
  const x = (min: number) => M.left + ((min - t0) / (t1 - t0)) * innerW;
  const y = (mw: number) => M.top + (1 - (mw - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;

  const path = (pts: { minutes: number; v: number }[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.minutes).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");

  const measured = points.filter((p) => p.minutes <= nowMinutes);
  const future = points.filter((p) => p.minutes >= nowMinutes);
  const peak = points.reduce((a, b) => (b.mw > a.mw ? b : a));
  const peakWithFlex = Math.max(...future.map((p) => p.withFlex));

  // Overload area: forecast above capacity, clipped at the capacity line.
  const overloadPath = (() => {
    const pts: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const aOver = a.mw > capacityMw;
      const bOver = b.mw > capacityMw;
      if (!aOver && !bOver) continue;
      const cross = (p: typeof a, q: typeof a) =>
        p.minutes + ((capacityMw - p.mw) / (q.mw - p.mw)) * (q.minutes - p.minutes);
      const start = aOver ? a.minutes : cross(a, b);
      const end = bOver ? b.minutes : cross(a, b);
      if (!pts.length) pts.push(`M${x(start)},${y(capacityMw)}`);
      if (aOver) pts.push(`L${x(a.minutes)},${y(a.mw)}`);
      if (bOver) pts.push(`L${x(b.minutes)},${y(b.mw)}`);
      else pts.push(`L${x(end)},${y(capacityMw)}`);
    }
    return pts.length ? `${pts.join(" ")} Z` : "";
  })();

  const xTicks = [];
  for (let m = Math.ceil(t0 / 120) * 120; m <= t1; m += 120) xTicks.push(m);

  const nearest = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.minutes) - px) < Math.abs(x(points[best].minutes) - px)) best = i;
    });
    return best;
  };

  const activePoint = active === null ? null : points[active];
  const TIP_W = 200;
  const tooltipLeft = activePoint
    ? x(activePoint.minutes) + 12 + TIP_W <= width
      ? x(activePoint.minutes) + 12
      : Math.max(0, x(activePoint.minutes) - 12 - TIP_W)
    : 0;

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <LegendKey kind="measured" label="Measured" />
        <LegendKey kind="forecast" label="Forecast, no flexibility" />
        <LegendKey kind="flex" label="Forecast with committed flexibility" />
        <LegendKey kind="capacity" label={`Capacity ${capacityMw.toFixed(1)} MW`} />
      </figcaption>

      <div
        ref={wrapRef}
        className="relative mt-4 outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
        tabIndex={0}
        role="group"
        aria-label={`Downtown load forecast. Peaks at ${peak.mw} MW at ${formatTime(peak.minutes)} against ${capacityMw} MW capacity; with committed flexibility the peak is ${peakWithFlex} MW. Use arrow keys to step through times.`}
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setActive((prev) => {
            const start = prev ?? points.findIndex((p) => p.minutes >= nowMinutes);
            const next = start + (e.key === "ArrowRight" ? 1 : -1);
            return Math.min(points.length - 1, Math.max(0, next));
          });
        }}
      >
        <svg width={width} height={HEIGHT} className="block max-w-full" aria-hidden="true">
          {/* flex window */}
          <rect
            x={x(windowStart)}
            y={M.top}
            width={x(windowEnd) - x(windowStart)}
            height={innerH}
            fill="rgba(255,255,255,0.035)"
          />
          <text x={x(windowStart) + 6} y={M.top + 14} fontSize="11" fill="var(--muted)">
            Flex window
          </text>

          {/* grid + y axis */}
          {Y_TICKS.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--border)" />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-2)" className="tabular">
                {t} MW
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="var(--muted-2)">
              {formatTime(t)}
            </text>
          ))}

          {/* now marker */}
          <line x1={x(nowMinutes)} x2={x(nowMinutes)} y1={M.top - 10} y2={M.top + innerH} stroke="var(--border-strong)" />
          <text x={x(nowMinutes)} y={M.top - 14} textAnchor="middle" fontSize="11" fill="var(--muted)">
            Now
          </text>

          {/* overload */}
          {overloadPath && <path d={overloadPath} fill="var(--risk)" opacity="0.14" />}

          {/* capacity */}
          <line x1={M.left} x2={M.left + innerW} y1={y(capacityMw)} y2={y(capacityMw)} stroke="var(--risk)" strokeWidth="1.5" />

          {/* series */}
          <path d={path(measured.map((p) => ({ minutes: p.minutes, v: p.mw })))} fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(future.map((p) => ({ minutes: p.minutes, v: p.withFlex })))} fill="none" stroke="var(--chart-flex)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={path(future.map((p) => ({ minutes: p.minutes, v: p.mw })))} fill="none" stroke="var(--chart-forecast)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />

          {/* peak annotation */}
          <circle cx={x(peak.minutes)} cy={y(peak.mw)} r="4" fill="var(--chart-forecast)" stroke="var(--surface)" strokeWidth="2" />
          <text x={x(peak.minutes) + 9} y={y(peak.mw) - 6} fontSize="11" fill="var(--foreground)" className="tabular">
            Peak {peak.mw.toFixed(1)} MW
          </text>

          {/* crosshair */}
          {activePoint && (
            <g>
              <line x1={x(activePoint.minutes)} x2={x(activePoint.minutes)} y1={M.top} y2={M.top + innerH} stroke="var(--muted-2)" />
              {activePoint.minutes >= nowMinutes ? (
                <>
                  <circle cx={x(activePoint.minutes)} cy={y(activePoint.mw)} r="4" fill="var(--chart-forecast)" stroke="var(--surface)" strokeWidth="2" />
                  <circle cx={x(activePoint.minutes)} cy={y(activePoint.withFlex)} r="4" fill="var(--chart-flex)" stroke="var(--surface)" strokeWidth="2" />
                </>
              ) : (
                <circle cx={x(activePoint.minutes)} cy={y(activePoint.mw)} r="4" fill="var(--muted)" stroke="var(--surface)" strokeWidth="2" />
              )}
            </g>
          )}
        </svg>

        {activePoint && (
          <div
            className="pointer-events-none absolute top-8 w-[200px] whitespace-nowrap rounded-md border border-border-strong bg-background-raised px-3 py-2 text-xs"
            style={{ left: tooltipLeft }}
            role="status"
          >
            <p className="font-medium text-foreground">{formatTime(activePoint.minutes)}</p>
            {activePoint.minutes < nowMinutes ? (
              <TipRow color="var(--muted)" label="Measured" value={activePoint.mw} />
            ) : (
              <>
                <TipRow color="var(--chart-forecast)" dashed label="No flexibility" value={activePoint.mw} />
                <TipRow color="var(--chart-flex)" label="With flexibility" value={activePoint.withFlex} />
              </>
            )}
            <TipRow color="var(--risk)" label="Capacity" value={capacityMw} />
          </div>
        )}
      </div>

      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-foreground">Show data as a table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-background-raised">
              <tr>
                <th className="px-3 py-1.5 font-medium">Time</th>
                <th className="px-3 py-1.5 font-medium">Load, no flexibility (MW)</th>
                <th className="px-3 py-1.5 font-medium">With flexibility (MW)</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular text-foreground/85">
              {points.map((p) => (
                <tr key={p.minutes} className="border-t border-border">
                  <td className="px-3 py-1 font-sans">
                    {formatTime(p.minutes)}
                    {p.minutes <= nowMinutes && <span className="text-muted-2"> · measured</span>}
                  </td>
                  <td className="px-3 py-1">{p.mw.toFixed(1)}</td>
                  <td className="px-3 py-1">{p.withFlex.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function LegendKey({ kind, label }: { kind: "measured" | "forecast" | "flex" | "capacity"; label: string }) {
  const stroke = {
    measured: "var(--muted)",
    forecast: "var(--chart-forecast)",
    flex: "var(--chart-flex)",
    capacity: "var(--risk)",
  }[kind];
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="18" height="6" aria-hidden="true">
        <line
          x1="1"
          x2="17"
          y1="3"
          y2="3"
          stroke={stroke}
          strokeWidth={kind === "capacity" ? 1.5 : 2}
          strokeDasharray={kind === "forecast" ? "4 3" : undefined}
          strokeLinecap="round"
        />
      </svg>
      {label}
    </span>
  );
}

function TipRow({ color, label, value, dashed = false }: { color: string; label: string; value: number; dashed?: boolean }) {
  return (
    <p className="mt-1 flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted">
        <svg width="12" height="4" aria-hidden="true">
          <line x1="0" x2="12" y1="2" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} />
        </svg>
        {label}
      </span>
      <span className="font-mono font-semibold tabular text-foreground">{value.toFixed(1)} MW</span>
    </p>
  );
}
