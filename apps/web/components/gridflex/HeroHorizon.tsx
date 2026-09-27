/**
 * The homepage's light source: the edge of a night-side planet, its rim lit steel
 * blue like a live conductor with a pulse of current running along it, and a faint
 * lat/long grid with sparking nodes across its face. Purely decorative, so it's
 * hidden from assistive tech.
 */

const W = 1440;
const H = 560;
const CX = W / 2;
const CY = -560;
const R = 820;
const RIM_Y = CY + R; // 260
const RIM_LENGTH = 2 * Math.PI * R;

// Deterministic PRNG so server and client render the same field.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGrid() {
  const rand = mulberry32(7);

  // Latitude rings, tighter toward the rim like a sphere seen edge-on.
  const rings = [10, 26, 48, 78, 118, 170, 236].map((d) => ({ r: R - d, o: 0.34 * (1 - d / 280) }));

  // Meridians fanning out from the planet's centre, evenly spaced along the rim.
  const angles: number[] = [];
  for (let xr = CX - 660; xr <= CX + 660; xr += 60) angles.push(Math.asin((xr - CX) / R));
  const meridians = angles.map((t) => ({
    x1: CX + (R - 300) * Math.sin(t),
    y1: CY + (R - 300) * Math.cos(t),
    x2: CX + R * Math.sin(t),
    y2: CY + R * Math.cos(t),
  }));

  // Lit nodes where rings and meridians cross, denser near the rim.
  const nodes: { x: number; y: number; o: number; live: boolean; delay: number }[] = [];
  rings.forEach((ring, i) => {
    angles.forEach((t) => {
      if (rand() > 0.62 - i * 0.07) return;
      nodes.push({
        x: CX + ring.r * Math.sin(t),
        y: CY + ring.r * Math.cos(t),
        o: 0.25 + ring.o * 1.6,
        live: rand() < 0.16,
        delay: rand() * 3,
      });
    });
  });

  const stars: { x: number; y: number; r: number; o: number }[] = [];
  while (stars.length < 70) {
    const x = rand() * W;
    const y = rand() * H;
    if (Math.hypot(x - CX, y - CY) < R + 12) continue;
    stars.push({ x, y, r: rand() < 0.15 ? 1.1 : 0.7, o: 0.15 + rand() * 0.4 });
  }

  return { rings, meridians, nodes, stars };
}

const { rings, meridians, nodes, stars } = buildGrid();

export function HeroHorizon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMin slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="hz-face" cx="0.5" cy="1" r="0.42">
          <stop offset="0%" stopColor="#10222b" />
          <stop offset="35%" stopColor="#0a1419" />
          <stop offset="100%" stopColor="#060607" />
        </radialGradient>
        <linearGradient id="hz-rim" x1="80" x2={W - 80} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7fb4cc" stopOpacity="0" />
          <stop offset="22%" stopColor="#5d91a8" stopOpacity="0.55" />
          <stop offset="42%" stopColor="#a8d2e3" />
          <stop offset="50%" stopColor="#f2f9fc" />
          <stop offset="58%" stopColor="#a8d2e3" />
          <stop offset="78%" stopColor="#5d91a8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7fb4cc" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="hz-bloom" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#7fb4cc" stopOpacity="0.28" />
          <stop offset="45%" stopColor="#3f6f84" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#3f6f84" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hz-fade-g" x1="0" x2="0" y1="0" y2={RIM_Y} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="hz-rim-fade-g" x1="80" x2={W - 80} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="25%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="42%" stopColor="#fff" stopOpacity="1" />
          <stop offset="58%" stopColor="#fff" stopOpacity="1" />
          <stop offset="75%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="hz-rim-fade" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="url(#hz-rim-fade-g)" />
        </mask>
        <mask id="hz-fade" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
          <rect width={W} height={H} fill="url(#hz-fade-g)" />
        </mask>
        <filter id="hz-blur-sm" x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="hz-blur-lg" x="-10%" y="-100%" width="120%" height="300%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <clipPath id="hz-planet">
          <circle cx={CX} cy={CY} r={R} />
        </clipPath>
      </defs>

      {/* Dust in the dark around the planet */}
      <g fill="#d6e8f0">
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
        ))}
      </g>

      {/* Light spilling below the rim */}
      <ellipse className="horizon-glow" cx={CX} cy={RIM_Y + 10} rx={620} ry={170} fill="url(#hz-bloom)" />

      {/* Planet face and the grid on it */}
      <circle cx={CX} cy={CY} r={R} fill="url(#hz-face)" />
      <g clipPath="url(#hz-planet)">
        <g fill="none" stroke="#a8d2e3" mask="url(#hz-fade)">
          {rings.map((ring) => (
            <circle key={ring.r} cx={CX} cy={CY} r={ring.r} strokeWidth="0.8" opacity={ring.o} />
          ))}
          {meridians.map((m, i) => (
            <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} strokeWidth="0.7" opacity="0.22" />
          ))}
        </g>
        {nodes.map((n, i) => (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.live ? 1.8 : 1.1}
            fill={n.live ? "#eaf5fa" : "#a9cfe0"}
            opacity={n.live ? undefined : n.o}
            className={n.live ? "grid-node-live" : undefined}
            style={n.live ? ({ "--d": `${n.delay}s` } as React.CSSProperties) : undefined}
          />
        ))}
      </g>

      {/* The lit rim: a wide halo, a soft glow and a hairline core */}
      <g className="horizon-glow" fill="none">
        <circle cx={CX} cy={CY} r={R} stroke="url(#hz-rim)" strokeWidth="24" filter="url(#hz-blur-lg)" opacity="0.6" />
        <circle cx={CX} cy={CY} r={R} stroke="url(#hz-rim)" strokeWidth="4" filter="url(#hz-blur-sm)" />
      </g>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#hz-rim)" strokeWidth="1.2" />

      {/* A pulse of current running along the rim (see rim-current in globals.css) */}
      <g mask="url(#hz-rim-fade)">
        <g className="rim-current" fill="none" stroke="#f2f9fc" strokeDasharray={`140 ${RIM_LENGTH}`} strokeLinecap="round">
          <circle cx={CX} cy={CY} r={R} strokeWidth="6" filter="url(#hz-blur-sm)" opacity="0.7" />
          <circle cx={CX} cy={CY} r={R} strokeWidth="1.6" />
        </g>
      </g>
    </svg>
  );
}
