# Phase 1: Foundation — Design Spec

Undergrid Phase 1 delivers a full-screen ambient map of NYC showing animated mock subway trains on real route geometries. No real data feeds yet — the goal is nailing the visual experience and establishing the architecture for everything that follows.

## Scope

- Shared Zod types for the transit domain
- Static GeoJSON for NYC subway stations and line routes
- Mock NYC subway provider generating fake train positions
- Hono API with OpenAPI docs serving mock data
- React SPA with MapLibre + Protomaps dark basemap + deck.gl animated trains
- Ambient mode only (full-screen map, no sidebar, no interactivity beyond pan/zoom)

## packages/types

Zod schemas that serve as the single source of truth for runtime validation, TypeScript types, and OpenAPI spec generation.

Schemas:
- `City` — `{ id: string, name: string, bounds: [[number, number], [number, number]] }`
- `Train` — `{ id: string, line: string, direction: "N" | "S", position: [number, number], timestamp: number }`
- `Station` — `{ id: string, name: string, lines: string[], position: [number, number] }`
- `Arrival` — `{ line: string, direction: "N" | "S", arrival: number }` (timestamp)
- `TrainsResponse` — `{ city: string, trains: Train[], timestamp: number }`
- `StationsResponse` — `{ city: string, stations: Station[] }`
- `ArrivalsResponse` — `{ station: string, arrivals: Arrival[] }`
- `CitiesResponse` — `{ cities: City[] }`

Each schema exported as both the Zod object and the inferred TypeScript type.

## packages/geo

Static GeoJSON bundled at build time. Two files for NYC:

- `nyc/stations.geojson` — FeatureCollection of Point features. Properties: `id`, `name`, `lines` (array of line IDs like `["A","C","E"]`).
- `nyc/lines.geojson` — FeatureCollection of LineString/MultiLineString features. Properties: `id` (line letter/number), `color` (hex string matching MTA official colors).

Source: MTA GTFS static data (`shapes.txt` for line geometries, `stops.txt` for stations). We'll derive GeoJSON from the GTFS static export ahead of time and check it into the repo.

Export a helper per city: `getNycStations()`, `getNycLines()` that return typed GeoJSON.

## packages/providers

Each provider implements a common interface:

```typescript
interface TransitProvider {
  getTrains(): Promise<Train[]>
  getStations(): Promise<Station[]>
  getArrivals(stationId: string): Promise<Arrival[]>
}
```

For Phase 1, `nyc/subway.ts` is a mock provider:
- `getStations()` returns real station data from `packages/geo`
- `getTrains()` generates ~50 fake trains distributed across lines, positioned along real route geometries using linear interpolation. Positions shift on each call to simulate movement.
- `getArrivals()` generates fake arrival times for the requested station (2-5 upcoming arrivals per line at that station)

A `_shared/types.ts` re-exports the provider interface. The `_shared/gtfs-rt.ts` file is a stub placeholder for Phase 2.

## apps/api

Hono app on Cloudflare Workers using `@hono/zod-openapi` for route definitions.

### Routes

| Method | Path | Response Schema | Description |
|--------|------|----------------|-------------|
| GET | `/v1/cities` | CitiesResponse | List available cities |
| GET | `/v1/{city}/trains` | TrainsResponse | Live train positions |
| GET | `/v1/{city}/stations` | StationsResponse | All stations |
| GET | `/v1/{city}/stations/{id}/arrivals` | ArrivalsResponse | Arrivals at a station |
| GET | `/openapi.json` | OpenAPI spec | Auto-generated |
| GET | `/docs` | HTML | Scalar API reference |

### Structure

```
apps/api/src/
  index.ts          → App entry, mounts city router
  routes/
    cities.ts       → /v1/cities route
    trains.ts       → /v1/{city}/trains route
    stations.ts     → /v1/{city}/stations + arrivals routes
  lib/
    providers.ts    → Instantiates providers by city ID
```

Each route file uses `createRoute()` from `@hono/zod-openapi` with Zod schemas from `packages/types`. The app exports `AppType` for Hono RPC.

### Error handling

Unknown city → 404 with `{ error: "City not found" }`. Unknown station → 404. Standard Zod validation errors for malformed params.

## apps/web

React SPA deployed via Cloudflare Workers Static Assets.

### Map Stack

1. **react-map-gl/maplibre** — `<Map>` component as root, handles viewport state
2. **pmtiles** — Protocol registered in a root `useEffect`, enables `pmtiles://` URLs
3. **@protomaps/basemaps** — `layers("protomaps", namedFlavor("dark"), { lang: "en" })` for muted dark basemap
4. **Subway lines** — `<Source type="geojson">` + `<Layer type="line">` with MTA official colors
5. **Stations** — `<Source type="geojson">` + `<Layer type="circle">` visible at zoom >= 12
6. **Train dots** — deck.gl `TripsLayer` via `MapboxOverlay` + `useControl` hook

### Component Structure

```
apps/web/src/
  main.tsx              → React entry
  App.tsx               → Map + polling orchestration
  components/
    DeckGLOverlay.tsx   → useControl wrapper for MapboxOverlay
    SubwayLines.tsx     → GeoJSON source + line layers
    Stations.tsx        → GeoJSON source + circle layer
  hooks/
    useTrains.ts        → Polls /v1/nyc/trains every 30s
  lib/
    api.ts              → Hono RPC client (hc<AppType>)
    map-style.ts        → Protomaps style builder
  data/
    (imports from packages/geo)
```

### Animation

The TripsLayer `currentTime` is driven by `requestAnimationFrame`. Mock trains include timestamps so TripsLayer can interpolate positions smoothly between 30-second API updates. Trail length set to ~600 for a nice visual tail.

### Ambient Mode

This is the only mode in Phase 1:
- Full-screen map, no UI chrome
- Dark Protomaps basemap (muted grays)
- Default viewport: all of NYC centered roughly on Manhattan (`[-73.98, 40.75]`, zoom ~11)
- Train dots use official MTA line colors
- Stations appear as small dots at higher zoom levels

### Polling

- `/v1/nyc/trains` every 30 seconds
- No station arrivals polling in Phase 1 (no sidebar to display them)

## Deployment (dev only for Phase 1)

- `bun dev` runs both API and web via Turborepo
- API: `wrangler dev` (local Cloudflare Workers runtime)
- Web: `vite dev` with `@cloudflare/vite-plugin`
- No production deployment in Phase 1

## What's NOT in Phase 1

- Real MTA GTFS-RT feeds (Phase 2)
- Workers KV caching (Phase 2)
- Interactive sidebar (Phase 2)
- Alerts/service status (Phase 3)
- Mobile bottom sheet (Phase 3)
- Multi-city (Phase 5)
