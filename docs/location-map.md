# Location Map Boundary

This document records the narrow boundary for the onboarding location map. It is a presentation aid for the illustrative GridFlex demo; it does not model utility topology, service territory, electrical boundaries, or municipal boundaries.

## Runtime contract

- `apps/web/components/onboarding/ZoneMap.tsx` reads `NEXT_PUBLIC_MAPBOX_TOKEN`, loads Mapbox style `mapbox://styles/mapbox/dark-v11`, and fetches `/maps/south-florida-zones.geojson`.
- The selected feature is matched by its `zone` property from `resolveZip()` in `packages/shared/src/onboarding.ts`. The map shows only the zone outline, with no ZIP marker or polygon fill.
- Without a token, or when Mapbox/GeoJSON loading fails, onboarding keeps the zone details visible and shows the map fallback. The map is non-rotating and disables scroll zoom.

## Local setup

Create `apps/web/.env.local` and add the public Mapbox browser token:

```dotenv
NEXT_PUBLIC_MAPBOX_TOKEN=pk.…
```

Use the actual `pk.…` value locally; never commit or print the token. `.env.*` is ignored by the repository. Restart the Next.js dev server after changing the value. Rebuild production after changing it there because `NEXT_PUBLIC_*` values are embedded at build time.

## Boundary data provenance

`apps/web/public/maps/south-florida-zones.geojson` contains four zone features. Each feature is the union of its selected 2020 Census ZCTA polygons (23 ZCTAs total), retrieved on 2026-09-26 from the Census TIGERweb query service:

`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2025/MapServer/2/query`

The request used `where=ZCTA5 IN (...)`, `outFields=ZCTA5`, `outSR=4326`, `returnGeometry=true`, `f=geojson`, `maxAllowableOffset=0.0005`, and `geometryPrecision=5`. Polygons were unioned per zone with Shapely `unary_union`. Representative points came from the [2020 Census ZCTA national Gazetteer ZIP](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip).

ZIP codes `33302`, `33303`, `33307`, and `33310` have no ZCTA and are intentionally excluded. Zone and feeder assignments in `onboarding.ts` are illustrative sample data; they are not FPL network topology.

## Known documentation drift

The preexisting project brief in `docs/00_README.md` still describes the map as “MapLibre or Mapbox only if time allows,” although the onboarding implementation now uses Mapbox. `apps/web/DESIGN.md` documents the dashboard schematic map as the signature component; this onboarding map is a separate Census outline treatment. No design-system changes are required for this extension.
