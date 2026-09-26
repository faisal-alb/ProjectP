"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { Map as MapboxMap } from "mapbox-gl";
import { resolveZip } from "@gridflex/shared";
import "mapbox-gl/dist/mapbox-gl.css";

const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();

/** Remounted per ZIP so in-flight map requests cannot show the previous location. */
export default function ZoneMap({ zip }: { zip: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const location = resolveZip(zip);

  useEffect(() => {
    const selected = resolveZip(zip);
    if (!token || !container.current || !selected) return;
    let disposed = false;
    let map: MapboxMap | undefined;
    let resize: ResizeObserver | undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (!disposed) setStatus("error");
    }, 15000);

    async function initialize() {
      try {
        const [module, response] = await Promise.all([
          import("mapbox-gl"),
          fetch("/maps/south-florida-zones.geojson", { signal: controller.signal }),
        ]);
        if (!response.ok) throw new Error("Zone boundaries unavailable");
        const boundaries = await response.json() as FeatureCollection<Geometry, { zone: string }>;
        if (disposed || !container.current || !selected) return;
        const feature = boundaries.features.find((item) => item.properties.zone === selected.zone);
        if (!feature || (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")) {
          throw new Error("Zone boundary missing");
        }
        const mapboxgl = module.default;
        map = new mapboxgl.Map({
          container: container.current,
          accessToken: token,
          style: "mapbox://styles/mapbox/dark-v11",
          center: selected.coordinates,
          zoom: 11,
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        // Required by Mapbox's terms; compact collapses the credits into an (i) button.
        map.addControl(new mapboxgl.AttributionControl({ compact: true }));
        map.getCanvas().setAttribute("aria-label", `${selected.zone} zone map, ZIP ${zip}`);
        map.on("error", () => {
          if (!disposed) setStatus("error");
          window.clearTimeout(timeout);
        });
        map.on("load", () => {
          if (disposed || !map) return;
          map.addSource("zone", { type: "geojson", data: feature });
          map.addLayer({
            id: "zone-outline", type: "line", source: "zone",
            paint: { "line-color": "#7fb4cc", "line-width": 2 },
          });
          const bounds = new mapboxgl.LngLatBounds(selected.coordinates, selected.coordinates);
          const positions = feature.geometry.type === "Polygon"
            ? feature.geometry.coordinates.flat()
            : feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates.flat(2) : [];
          for (const position of positions) bounds.extend([position[0], position[1]]);
          map.fitBounds(bounds, { padding: 42, maxZoom: 13, duration: 0 });
          resize = new ResizeObserver(() => {
            map?.resize();
            map?.fitBounds(bounds, { padding: 42, maxZoom: 13, duration: 0 });
          });
          resize.observe(container.current!);
          window.clearTimeout(timeout);
          setStatus("ready");
        });
      } catch {
        if (!disposed) setStatus("error");
        window.clearTimeout(timeout);
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
  }, [zip, attempt]);

  if (!location) return null;

  return (
    <figure className="mt-4 overflow-hidden rounded-md border border-border">
      <div className="relative h-64 bg-background-raised sm:h-72">
        <div ref={container} className="h-full w-full" />
        {(!token || status !== "ready") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background-raised px-6 text-center text-sm text-muted" role="status">
            <p>{!token ? "Map preview is unavailable. Your zone details are shown above."
              : status === "error" ? "The map couldn't load. Your zone details are shown above."
              : "Loading your grid zone…"}</p>
            {token && status === "error" && (
              <button type="button" className="rounded-md border border-border px-4 py-2 text-foreground transition-colors hover:border-border-strong"
                onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>
                Retry map
              </button>
            )}
          </div>
        )}
      </div>
      <figcaption className="border-t border-border px-4 py-3 text-xs text-muted">
        <p><span className="font-medium text-foreground">{location.zone}</span> · ZIP <span className="font-mono tabular">{zip}</span></p>
        <p className="mt-1">Outline groups Census ZIP areas. Grid assignments are illustrative.</p>
      </figcaption>
    </figure>
  );
}
