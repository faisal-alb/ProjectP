import { zones } from "@/lib/demo-data";
import { BatteryCharging } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  high: "var(--risk)",
  watch: "var(--watch)",
  normal: "var(--normal)",
};

const POSITIONS: Record<string, { x: number; y: number; r: number }> = {
  Downtown: { x: 392, y: 214, r: 11 },
  North: { x: 392, y: 92, r: 6 },
  West: { x: 226, y: 236, r: 6 },
  South: { x: 414, y: 342, r: 6 },
};

const RESOURCE = { x: 108, y: 96 };

/**
 * Signature moment: a resource's committed power sweeps into the
 * highest-risk zone once, on mount, then settles into a quiet pulse.
 */
export function NightGridMap({ className = "" }: { className?: string }) {
  const downtown = zones.find((z) => z.name === "Downtown");

  return (
    <svg
      viewBox="0 0 640 420"
      className={className}
      role="img"
      aria-label="Map of the local grid, showing an arc of committed power flowing into the constrained Downtown zone"
    >
      {/* faint transmission lines connecting zones */}
      <g stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none">
        <path d="M392,92 L392,214" />
        <path d="M226,236 L392,214" />
        <path d="M414,342 L392,214" />
      </g>

      {/* signature arc: resource -> constrained zone */}
      <path
        d={`M${RESOURCE.x},${RESOURCE.y} Q262,44 ${POSITIONS.Downtown.x},${POSITIONS.Downtown.y}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        pathLength={100}
        style={{
          strokeDasharray: 100,
          strokeDashoffset: 100,
          animation: "arc-draw 1.8s 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      />

      {/* resource origin point */}
      <g transform={`translate(${RESOURCE.x}, ${RESOURCE.y})`}>
                <circle r="4.5" fill="var(--accent)" />
        <foreignObject x={-9} y={-34} width={18} height={18}>
          <BatteryCharging className="h-[18px] w-[18px] text-accent" aria-hidden="true" />
        </foreignObject>
      </g>

      {/* zone points */}
      {zones.map((zone) => {
        const pos = POSITIONS[zone.name];
        if (!pos) return null;
        const color = STATUS_COLOR[zone.status];
        const isDowntown = zone.name === "Downtown";
        const haloRadius = pos.r * 2.4;
        return (
          <g key={zone.name} transform={`translate(${pos.x}, ${pos.y})`}>
            <circle
              r={haloRadius}
              fill={color}
              opacity="0.08"
              style={
                isDowntown
                  ? { animation: "arc-pulse 2.4s ease-in-out infinite" }
                  : undefined
              }
            />
            <circle r={pos.r} fill={color} />
            <text
              x="0"
              y={pos.r + 18}
              textAnchor="middle"
              className="tracked-caps"
              fill="rgba(238,241,246,0.65)"
              fontSize="10"
            >
              {zone.name}
            </text>
            {isDowntown && downtown && (
              <text
                x="0"
                y={-haloRadius - 10}
                textAnchor="middle"
                fill={color}
                fontSize="11"
                fontFamily="var(--font-mono)"
                fontWeight="600"
              >
                {Math.round((downtown.forecastMw / downtown.capacityMw) * 100)}% risk
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
