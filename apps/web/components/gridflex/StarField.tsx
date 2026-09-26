const LAYERS = [
  { count: 40, size: 1, opacity: 0.5, duration: "140s" },
  { count: 22, size: 1.5, opacity: 0.35, duration: "200s" },
  { count: 10, size: 2, opacity: 0.22, duration: "260s" },
];

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Ambient depth: three star layers drifting at different rates, the
 * night-sky counterpart to the grid map's foreground signal. Purely
 * decorative, so it is muted well below the accent and text.
 */
export function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {LAYERS.map((layer, li) => (
        <div
          key={li}
          className="absolute -inset-x-16 -inset-y-16"
          style={{ animation: `drift-slow ${layer.duration} linear infinite alternate` }}
        >
          {Array.from({ length: layer.count }).map((_, i) => {
            const seed = li * 97 + i * 13.7;
            const x = seededRandom(seed) * 100;
            const y = seededRandom(seed + 1) * 100;
            return (
              <span
                key={i}
                className="absolute rounded-full bg-foreground"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: layer.size,
                  height: layer.size,
                  opacity: layer.opacity,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
