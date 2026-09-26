"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Zone, ZoneStatus } from "@/lib/demo-data";
import "mapbox-gl/dist/mapbox-gl.css";

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

// Mapbox paints on a canvas, so it needs literal colors; these match --risk, --watch and --normal.
const COLOR: Record<ZoneStatus, string> = { high: "#e07a66", watch: "#d6a55a", normal: "#6fb58f" };
const LABEL: Record<ZoneStatus, string> = { high: "Needs flexibility", watch: "Close to limit", normal: "Normal" };

/** Every zone's outline on a map, filled by tonight's status. Same boundaries as onboarding. */
export function ZonesMap({ zones }: { zones: Zone[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token || !container.current) return;
    let disposed = false;
    let map: MapboxMap | undefined;
    let resize: ResizeObserver | undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => !disposed && setStatus("error"), 15000);
    const fail = () => {
      if (!disposed) setStatus("error");
      window.clearTimeout(timeout);
    };

    async function initialize() {
      try {
        const [module, response] = await Promise.all([
          import("mapbox-gl"),
          fetch("/maps/south-florida-zones.geojson", { signal: controller.signal }),
        ]);
        if (!response.ok) throw new Error("Zone boundaries unavailable");
        const boundaries = (await response.json()) as FeatureCollection<Geometry, { zone: string }>;
        if (disposed || !container.current) return;

        const byName = new Map(zones.map((z) => [z.name, z]));
        const data: FeatureCollection<Geometry, { zone: string; color: string; label: string }> = {
          type: "FeatureCollection",
          features: boundaries.features
            .filter((f) => byName.has(f.properties.zone))
            .map((f) => {
              const zone = byName.get(f.properties.zone)!;
              const pct = Math.round((zone.forecastMw / zone.capacityMw) * 100);
              return {
                ...f,
                properties: { zone: zone.name, color: COLOR[zone.status], label: `${zone.name}\n${pct}% of capacity` },
              };
            }),
        };

        const mapboxgl = module.default;
        map = new mapboxgl.Map({
          container: container.current,
          accessToken: token,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [-80.2, 25.9],
          zoom: 9,
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.getCanvas().setAttribute("aria-label", "Map of grid zones colored by status");
        map.on("error", fail);
        map.on("load", () => {
          if (disposed || !map) return;
          map.addSource("zones", { type: "geojson", data });
          map.addLayer({
            id: "zones-fill", type: "fill", source: "zones",
            paint: { "fill-color": ["get", "color"], "fill-opacity": 0.18 },
          });
          map.addLayer({
            id: "zones-outline", type: "line", source: "zones",
            paint: { "line-color": ["get", "color"], "line-width": 2 },
          });
          map.addLayer({
            id: "zones-label", type: "symbol", source: "zones",
            layout: { "text-field": ["get", "label"], "text-size": 12, "text-justify": "center" },
            paint: { "text-color": "#ececee", "text-halo-color": "#17181b", "text-halo-width": 1.5 },
          });

          const bounds = new mapboxgl.LngLatBounds();
          for (const f of data.features) {
            const g = f.geometry;
            const positions = g.type === "Polygon" ? g.coordinates.flat() : g.type === "MultiPolygon" ? g.coordinates.flat(2) : [];
            for (const p of positions) bounds.extend([p[0], p[1]]);
          }
          const fit = () => !bounds.isEmpty() && map?.fitBounds(bounds, { padding: 32, duration: 0 });
          fit();
          resize = new ResizeObserver(() => {
            map?.resize();
            fit();
          });
          resize.observe(container.current!);
          window.clearTimeout(timeout);
          setStatus("ready");
        });
      } catch {
        fail();
      }
    }
    void initialize();
    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
      resize?.disconnect();
      map?.remove();
    };
  }, [zones, attempt]);

  return (
    <figure className="panel overflow-hidden rounded-lg">
      <div className="relative h-72 bg-background-raised sm:h-96">
        <div ref={container} className="h-full w-full" />
        {(!token || status !== "ready") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted" role="status">
            <p>
              {!token
                ? "The zone map is unavailable. Every zone is listed below."
                : status === "error"
                  ? "The map couldn't load. Every zone is listed below."
                  : "Loading zone map…"}
            </p>
            {token && status === "error" && (
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-foreground transition-colors hover:border-border-strong"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((v) => v + 1);
                }}
              >
                Retry map
              </button>
            )}
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-xs text-muted">
        {(Object.keys(LABEL) as ZoneStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLOR[s] }} aria-hidden="true" />
            {LABEL[s]}
          </span>
        ))}
        <span className="text-muted-2 sm:ml-auto">Forecast peak vs capacity. Boundaries group Census ZIP areas; grid data is illustrative.</span>
      </figcaption>
    </figure>
  );
}
