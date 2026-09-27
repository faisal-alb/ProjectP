import {
  Bell,
  LayoutGrid,
  Map as MapIcon,
  Search,
  Layers,
  HandCoins,
  Cpu,
  Zap,
  ShieldCheck,
} from "lucide-react";
import {
  downtown,
  downtownLoadCurve,
  flexResources,
  marketTotals,
  zones,
  NOW_MINUTES,
  WINDOW_START_MINUTES,
  WINDOW_END_MINUTES,
} from "@/lib/demo-data";
import { Logo } from "./Logo";

/* ── Chart geometry ─────────────────────────────────────────────────────── */

const CW = 620;
const CH = 220;
const PAD = { l: 8, r: 40, t: 16, b: 22 };
const T0 = 14 * 60;
const T1 = 23 * 60;
const Y0 = 8.5;
const Y1 = 13.5;
const FLEX_CEILING = downtown.capacityMw - 0.15;

const x = (m: number) => PAD.l + ((m - T0) / (T1 - T0)) * (CW - PAD.l - PAD.r);
const y = (mw: number) => PAD.t + (1 - (mw - Y0) / (Y1 - Y0)) * (CH - PAD.t - PAD.b);

type Pt = [number, number];

/** Catmull-Rom through the points, as cubic Béziers. */
function smooth(pts: Pt[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const measured = downtownLoadCurve.filter((p) => p.minutes <= NOW_MINUTES);
const forecast = downtownLoadCurve.filter((p) => p.minutes >= NOW_MINUTES);
const withFlex = forecast.map((p) => ({
  minutes: p.minutes,
  mw:
    p.minutes >= WINDOW_START_MINUTES - 30 && p.minutes <= WINDOW_END_MINUTES + 30
      ? Math.min(p.mw, FLEX_CEILING)
      : p.mw,
}));
const toPts = (s: { minutes: number; mw: number }[]): Pt[] => s.map((p) => [x(p.minutes), y(p.mw)]);

const measuredPath = smooth(toPts(measured));
const forecastPath = smooth(toPts(forecast));
const flexPath = smooth(toPts(withFlex));
const areaUnderForecast = `${forecastPath} L${x(forecast.at(-1)!.minutes)},${CH - PAD.b} L${x(forecast[0].minutes)},${CH - PAD.b} Z`;

const peak = downtownLoadCurve.reduce((a, b) => (b.mw > a.mw ? b : a));
const capY = y(downtown.capacityMw);

const hourTicks = [15, 17, 19, 21].map((h) => ({
  x: x(h * 60),
  label: `${h > 12 ? h - 12 : h} PM`,
}));

/* ── Pieces ─────────────────────────────────────────────────────────────── */

const statusDot = { high: "bg-risk", watch: "bg-watch", normal: "bg-normal" } as const;

const navItems = [
  { icon: LayoutGrid, label: "Overview", active: true },
  { icon: MapIcon, label: "Zones" },
  { icon: Layers, label: "Flex market" },
  { icon: HandCoins, label: "Settlement" },
  { icon: Cpu, label: "Devices" },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-white/[0.01] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-muted">
      {children}
    </span>
  );
}

function LoadChart() {
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="h-auto w-full" aria-hidden="true">
      <defs>
        <linearGradient id="hc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7fb4cc" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7fb4cc" stopOpacity="0" />
        </linearGradient>
        <clipPath id="hc-over">
          <rect x="0" y="0" width={CW} height={capY} />
        </clipPath>
      </defs>

      {/* Gridlines */}
      {[9, 10, 11, 12, 13].map((mw) => (
        <g key={mw}>
          <line x1={PAD.l} x2={CW - PAD.r} y1={y(mw)} y2={y(mw)} stroke="rgba(255,255,255,0.05)" />
          <text x={CW - PAD.r + 8} y={y(mw) + 3} fontSize="9" fill="#6d6e75" className="font-mono">
            {mw} MW
          </text>
        </g>
      ))}

      {/* Flex window */}
      <rect
        x={x(WINDOW_START_MINUTES)}
        y={PAD.t}
        width={x(WINDOW_END_MINUTES) - x(WINDOW_START_MINUTES)}
        height={CH - PAD.t - PAD.b}
        fill="rgba(255,255,255,0.035)"
      />
      <text x={x(WINDOW_START_MINUTES) + 5} y={CH - PAD.b - 5} fontSize="8.5" fill="#a0a1a8">
        Flex window
      </text>

      {/* Now */}
      <line x1={x(NOW_MINUTES)} x2={x(NOW_MINUTES)} y1={PAD.t} y2={CH - PAD.b} stroke="rgba(255,255,255,0.14)" strokeDasharray="2 3" />
      <text x={x(NOW_MINUTES) + 4} y={CH - PAD.b - 5} fontSize="8.5" fill="#6d6e75">
        Now
      </text>

      {/* Forecast area, and the part that would breach capacity */}
      <path d={areaUnderForecast} fill="url(#hc-area)" />
      <path d={areaUnderForecast} fill="#e07a66" opacity="0.28" clipPath="url(#hc-over)" />

      {/* Capacity */}
      <line x1={PAD.l} x2={CW - PAD.r} y1={capY} y2={capY} stroke="#e07a66" strokeWidth="1.2" />
      <text x={PAD.l + 2} y={capY - 5} fontSize="8.5" fill="#e07a66">
        Capacity {downtown.capacityMw.toFixed(1)} MW
      </text>

      {/* Series */}
      <path d={measuredPath} fill="none" stroke="#a0a1a8" strokeWidth="1.6" />
      <path d={forecastPath} fill="none" stroke="#7fb4cc" strokeWidth="1.6" strokeDasharray="4 3" />
      <path d={flexPath} fill="none" stroke="#eaf5fa" strokeWidth="1.8" />

      {/* Peak marker */}
      <circle cx={x(peak.minutes)} cy={y(peak.mw)} r="7" fill="#7fb4cc" opacity="0.2" />
      <circle cx={x(peak.minutes)} cy={y(peak.mw)} r="3" fill="#cfe6f0" stroke="#0c0c0e" strokeWidth="1.5" />

      {/* Axis */}
      {hourTicks.map((t) => (
        <text key={t.label} x={t.x} y={CH - 6} fontSize="9" fill="#6d6e75" textAnchor="middle" className="font-mono">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

/* ── Console ────────────────────────────────────────────────────────────── */

export function HeroConsole() {
  const committed = marketTotals.committedKw;
  const cost = marketTotals.estimatedCost;
  const peakLeft = ((x(peak.minutes) - 0) / CW) * 100;
  const peakTop = (y(peak.mw) / CH) * 100;

  return (
    <div className="relative">
      {/* Lit top edge of the frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-[100%] bg-[radial-gradient(closest-side,rgba(127,180,204,0.26),transparent)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-px left-[12%] right-[12%] z-10 h-px bg-gradient-to-r from-transparent via-[#cfe6f0] to-transparent"
      />

      <div
        role="img"
        aria-label={`Preview of the GridFlex operator console: ${downtown.zone} is forecast to reach ${downtown.forecastLoadMw} MW against ${downtown.capacityMw} MW capacity at ${downtown.peakTime}, and ${committed} kW of local flexibility is committed to keep it under the limit.`}
        className="relative overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0c0c0e] p-3 shadow-[0_40px_120px_-40px_rgba(127,180,204,0.25)] sm:p-4"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(127,180,204,0.12),transparent)]"
        />

        <div aria-hidden="true" className="relative grid gap-3 lg:grid-cols-[180px_1fr]">
          {/* Sidebar */}
          <aside className="hidden flex-col gap-5 px-2 py-2 lg:flex">
            <div className="flex items-center gap-2">
              <Logo className="h-5 w-5" />
              <span className="tracked-caps text-[12px] font-semibold text-foreground">GridFlex</span>
            </div>
            <div>
              <p className="px-2 text-[10px] font-medium text-muted-2">Console</p>
              <ul className="mt-2 space-y-0.5">
                {navItems.map(({ icon: Icon, label, active }) => (
                  <li
                    key={label}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] ${
                      active
                        ? "border border-white/[0.08] bg-white/[0.06] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "border border-transparent text-muted"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="px-2 text-[10px] font-medium text-muted-2">Zones</p>
              <ul className="mt-2 space-y-0.5">
                {zones.map((z) => (
                  <li key={z.name} className="flex items-center justify-between px-2 py-1.5 text-[12px] text-muted">
                    <span className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[z.status]}`} />
                      {z.name}
                    </span>
                    <span className="font-mono text-[10px] tabular text-muted-2">
                      {Math.round((z.forecastMw / z.capacityMw) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="min-w-0">
            {/* Top bar */}
            <div className="flex items-center gap-2">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-[12px] text-muted-2 sm:max-w-xs">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Search zones, feeders, resources</span>
              </div>
              <div className="ml-auto hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] text-muted sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-solana-green" />
                Solana devnet
              </div>
              <span className="hidden h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-muted sm:flex">
                <Bell className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-b from-[#a9cfe0] to-[#3f6f84] text-[10px] font-semibold text-[#0a1a22]">
                  CU
                </span>
                <span className="text-[11px] leading-tight">
                  <span className="block font-medium text-foreground">Coastal Utility</span>
                  <span className="block text-muted-2">Grid operator</span>
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_260px]">
              {/* Forecast card */}
              <Card className="min-w-0 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <IconChip>
                      <Zap className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </IconChip>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">{downtown.zone} load</p>
                      <p className="text-[10.5px] text-muted-2">Forecast updated 4:30 PM</p>
                    </div>
                  </div>
                  <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-0.5 font-mono text-[10px]">
                    {["1h", "6h", "Today", "7d"].map((t) => (
                      <span
                        key={t}
                        className={`rounded-md px-2 py-1 ${t === "Today" ? "bg-white/[0.08] text-foreground" : "text-muted-2"}`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[10.5px] text-muted-2">Forecast peak</p>
                    <p className="font-mono text-xl font-semibold tabular text-foreground">
                      {downtown.forecastLoadMw.toFixed(1)}
                      <span className="ml-1 text-xs text-muted">MW</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10.5px] text-muted-2">Overload risk</p>
                    <p className="font-mono text-xl font-semibold tabular text-risk">{downtown.riskPercent}%</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] text-muted-2">With GridFlex</p>
                    <p className="font-mono text-xl font-semibold tabular text-volt-bright">
                      {FLEX_CEILING.toFixed(2)}
                      <span className="ml-1 text-xs text-muted">MW</span>
                    </p>
                  </div>
                </div>

                <div className="relative mt-3">
                  <LoadChart />
                  <div
                    className="absolute hidden -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-white/[0.1] bg-[#18181b]/95 px-2.5 py-1.5 shadow-lg sm:block"
                    style={{ left: `${peakLeft}%`, top: `${peakTop}%` }}
                  >
                    <p className="font-mono text-[11px] font-semibold tabular text-foreground">
                      {peak.mw.toFixed(1)} MW
                    </p>
                    <p className="text-[9.5px] text-muted-2">{downtown.peakTime} forecast</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-3 bg-muted" /> Measured
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-3 border-t border-dashed border-volt" /> Forecast
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 bg-[#eaf5fa]" /> With committed flexibility
                  </span>
                </div>
              </Card>

              {/* Right column */}
              <div className="flex min-w-0 flex-col gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2.5">
                    <IconChip>
                      <Layers className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </IconChip>
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">Flexibility request</p>
                      <p className="text-[10.5px] text-muted-2">{downtown.window}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[11px] text-muted">Committed</span>
                    <span className="font-mono text-[12px] tabular text-foreground">
                      {committed}
                      <span className="text-muted-2"> / {marketTotals.requestedKw} kW</span>
                    </span>
                  </div>
                  <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                    {flexResources.map((r, i) => (
                      <span
                        key={r.label}
                        className="h-full"
                        style={{
                          width: `${(r.kw / marketTotals.requestedKw) * 100}%`,
                          background: `color-mix(in srgb, #7fb4cc ${100 - i * 16}%, #1c2b33)`,
                        }}
                      />
                    ))}
                  </div>

                  <ul className="mt-3 space-y-1.5">
                    {flexResources.map((r, i) => (
                      <li key={r.label} className="flex items-center justify-between text-[11px]">
                        <span className="flex min-w-0 items-center gap-2 text-muted">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-sm"
                            style={{ background: `color-mix(in srgb, #7fb4cc ${100 - i * 16}%, #1c2b33)` }}
                          />
                          <span className="truncate">{r.label}</span>
                        </span>
                        <span className="font-mono tabular text-foreground/85">{r.kw} kW</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5">
                      <IconChip>
                        <ShieldCheck className="h-3.5 w-3.5 text-solana-purple" strokeWidth={1.6} />
                      </IconChip>
                      <span className="text-[13px] font-semibold text-foreground">USDC escrow</span>
                    </span>
                    <span className="rounded-md border border-normal/30 px-1.5 py-0.5 text-[9.5px] font-medium text-normal">
                      Locked
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-xl font-semibold tabular text-foreground">
                    {cost.toFixed(2)}
                    <span className="ml-1 text-xs text-muted">USDC</span>
                  </p>
                  <p className="mt-1 text-[10.5px] text-muted-2">
                    Paid on verified delivery · recorded on Solana
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
