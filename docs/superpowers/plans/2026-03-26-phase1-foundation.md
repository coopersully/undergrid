# Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-screen ambient map of NYC showing animated mock subway trains on real route geometries, backed by a typed Hono API.

**Architecture:** Monorepo with shared types (Zod) → mock provider → Hono API → React SPA with MapLibre + deck.gl. Data flows bottom-up: types → geo → providers → api → web.

**Tech Stack:** Hono + @hono/zod-openapi, React + Vite, MapLibre GL JS + react-map-gl, deck.gl TripsLayer, Protomaps PMTiles, Zod, Cloudflare Workers, Turborepo + Bun.

**Code conventions:** Tabs, double quotes, trailing commas, semicolons. `import type` for type-only imports. Biome for linting/formatting. Packages use NodeNext module resolution (`.js` extensions on relative imports). Run `bun run check` from root to lint.

---

### Task 1: Install dependencies across all packages

**Files:**
- Modify: `packages/types/package.json`
- Modify: `packages/geo/package.json`
- Modify: `packages/providers/package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add zod to packages/types**

```bash
cd packages/types && bun add zod
```

- [ ] **Step 2: Add @undergrid/types dependency to packages/geo**

```bash
cd packages/geo && bun add @undergrid/types@workspace:*
```

- [ ] **Step 3: Add @undergrid/geo dependency to packages/providers**

```bash
cd packages/providers && bun add @undergrid/geo@workspace:*
```

- [ ] **Step 4: Add API dependencies**

```bash
cd apps/api && bun add @hono/zod-openapi zod @scalar/hono-api-reference @undergrid/types@workspace:* @undergrid/providers@workspace:*
```

- [ ] **Step 5: Add web dependencies**

```bash
cd apps/web && bun add react-map-gl maplibre-gl pmtiles @protomaps/basemaps @deck.gl/core @deck.gl/layers @deck.gl/geo-layers @deck.gl/mapbox hono @undergrid/types@workspace:* @undergrid/geo@workspace:*
```

- [ ] **Step 6: Install and verify**

```bash
cd /path/to/repo && bun install && bun run check-types
```

Expected: Clean install, type-check passes (packages are still empty exports).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: install Phase 1 dependencies"
```

---

### Task 2: Shared Zod schemas (packages/types)

**Files:**
- Create: `packages/types/src/schemas.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Create schemas.ts with all domain schemas**

Create `packages/types/src/schemas.ts`:

```typescript
import { z } from "zod";

const Position = z.tuple([z.number(), z.number()]);

export const CitySchema = z.object({
	id: z.string(),
	name: z.string(),
	bounds: z.tuple([Position, Position]),
});

export const TrainSchema = z.object({
	id: z.string(),
	line: z.string(),
	direction: z.enum(["N", "S"]),
	position: Position,
	timestamp: z.number(),
});

export const StationSchema = z.object({
	id: z.string(),
	name: z.string(),
	lines: z.array(z.string()),
	position: Position,
});

export const ArrivalSchema = z.object({
	line: z.string(),
	direction: z.enum(["N", "S"]),
	arrival: z.number(),
});

export const CitiesResponseSchema = z.object({
	cities: z.array(CitySchema),
});

export const TrainsResponseSchema = z.object({
	city: z.string(),
	trains: z.array(TrainSchema),
	timestamp: z.number(),
});

export const StationsResponseSchema = z.object({
	city: z.string(),
	stations: z.array(StationSchema),
});

export const ArrivalsResponseSchema = z.object({
	station: z.string(),
	arrivals: z.array(ArrivalSchema),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
});

export type City = z.infer<typeof CitySchema>;
export type Train = z.infer<typeof TrainSchema>;
export type Station = z.infer<typeof StationSchema>;
export type Arrival = z.infer<typeof ArrivalSchema>;
export type CitiesResponse = z.infer<typeof CitiesResponseSchema>;
export type TrainsResponse = z.infer<typeof TrainsResponseSchema>;
export type StationsResponse = z.infer<typeof StationsResponseSchema>;
export type ArrivalsResponse = z.infer<typeof ArrivalsResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

- [ ] **Step 2: Update index.ts to re-export everything**

Replace `packages/types/src/index.ts`:

```typescript
export {
	ArrivalSchema,
	CitiesResponseSchema,
	CitySchema,
	ErrorResponseSchema,
	StationSchema,
	StationsResponseSchema,
	TrainSchema,
	TrainsResponseSchema,
	ArrivalsResponseSchema,
} from "./schemas.js";

export type {
	Arrival,
	ArrivalsResponse,
	CitiesResponse,
	City,
	ErrorResponse,
	Station,
	StationsResponse,
	Train,
	TrainsResponse,
} from "./schemas.js";
```

- [ ] **Step 3: Verify types compile**

```bash
cd packages/types && bun run check-types
```

Expected: No errors.

- [ ] **Step 4: Run biome check**

```bash
bun run check
```

Expected: No errors. Fix any formatting issues with `bun run check:fix`.

- [ ] **Step 5: Commit**

```bash
git add packages/types && git commit -m "feat(types): add Zod schemas for transit domain"
```

---

### Task 3: Static GeoJSON data (packages/geo)

**Files:**
- Create: `packages/geo/src/nyc/stations.geojson`
- Create: `packages/geo/src/nyc/lines.geojson`
- Create: `packages/geo/src/nyc/index.ts`
- Modify: `packages/geo/src/index.ts`
- Modify: `packages/geo/tsconfig.json`

This task requires generating GeoJSON from the MTA GTFS static data. The GeoJSON files will contain real station locations and subway line geometries.

- [ ] **Step 1: Download and process MTA GTFS static data**

Download the MTA GTFS static feed and extract station + shape data to GeoJSON. Write a script or manually produce:

1. `stations.geojson` — FeatureCollection of Point features from `stops.txt`. Only include stations (not entrances — `location_type=1` or parent stations). Properties: `id` (stop_id), `name` (stop_name), `lines` (array of route_ids serving that station, derived from `stop_times.txt` → `trips.txt` → `routes.txt`).

2. `lines.geojson` — FeatureCollection of LineString features from `shapes.txt`. One feature per route. Properties: `id` (route letter/number like "A", "1", "L"), `color` (hex color).

MTA official line colors to use:

```
1/2/3: #EE352E (red)
4/5/6: #00933C (green)
7: #B933AD (purple)
A/C/E: #0039A6 (blue)
B/D/F/M: #FF6319 (orange)
G: #6CBE45 (lime green)
J/Z: #996633 (brown)
L: #A7A9AC (gray)
N/Q/R/W: #FCCC0A (yellow)
S: #808183 (shuttle gray)
SIR: #00add0 (teal)
```

The GTFS static data is at: http://web.mta.info/developers/data/nyct/subway/google_transit.zip

Write a Bun script `packages/geo/scripts/generate-geojson.ts` that:
1. Downloads and unzips the GTFS data to a temp directory
2. Parses `stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `shapes.txt` as CSV
3. Generates the two GeoJSON files
4. Writes them to `packages/geo/src/nyc/`

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const GTFS_URL = "http://web.mta.info/developers/data/nyct/subway/google_transit.zip";
const OUT_DIR = join(import.meta.dirname, "../src/nyc");

const LINE_COLORS: Record<string, string> = {
	"1": "#EE352E", "2": "#EE352E", "3": "#EE352E",
	"4": "#00933C", "5": "#00933C", "6": "#00933C", "6X": "#00933C",
	"7": "#B933AD", "7X": "#B933AD",
	A: "#0039A6", C: "#0039A6", E: "#0039A6",
	B: "#FF6319", D: "#FF6319", F: "#FF6319", FX: "#FF6319", M: "#FF6319",
	G: "#6CBE45",
	J: "#996633", Z: "#996633",
	L: "#A7A9AC",
	N: "#FCCC0A", Q: "#FCCC0A", R: "#FCCC0A", W: "#FCCC0A",
	GS: "#808183", FS: "#808183", H: "#808183",
	SI: "#00ADD0",
};

function parseCsv(text: string): Record<string, string>[] {
	const lines = text.trim().split("\n");
	const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^\uFEFF/, ""));
	return lines.slice(1).map((line) => {
		const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
		const obj: Record<string, string> = {};
		for (let i = 0; i < headers.length; i++) {
			obj[headers[i]!] = values[i] ?? "";
		}
		return obj;
	});
}

async function main() {
	console.log("Downloading GTFS data...");
	const resp = await fetch(GTFS_URL);
	const blob = await resp.blob();

	// Bun supports unzipping via Bun.file + decompress
	const tempDir = join(import.meta.dirname, "../.gtfs-temp");
	await mkdir(tempDir, { recursive: true });
	const zipPath = join(tempDir, "gtfs.zip");
	await writeFile(zipPath, Buffer.from(await blob.arrayBuffer()));

	// Unzip using bun shell
	const proc = Bun.spawnSync(["unzip", "-o", zipPath, "-d", tempDir]);
	if (proc.exitCode !== 0) throw new Error("Failed to unzip");

	const readFile = (name: string) => Bun.file(join(tempDir, name)).text();

	const stops = parseCsv(await readFile("stops.txt"));
	const routes = parseCsv(await readFile("routes.txt"));
	const trips = parseCsv(await readFile("trips.txt"));
	const stopTimes = parseCsv(await readFile("stop_times.txt"));
	const shapes = parseCsv(await readFile("shapes.txt"));

	// Build route_id → route_short_name mapping
	const routeIdToName: Record<string, string> = {};
	for (const r of routes) {
		routeIdToName[r["route_id"]!] = r["route_short_name"] || r["route_id"]!;
	}

	// Build trip_id → route_id mapping
	const tripToRoute: Record<string, string> = {};
	const tripToShape: Record<string, string> = {};
	for (const t of trips) {
		tripToRoute[t["trip_id"]!] = t["route_id"]!;
		if (t["shape_id"]) tripToShape[t["trip_id"]!] = t["shape_id"]!;
	}

	// Build stop_id → set of route names
	const stopRoutes: Record<string, Set<string>> = {};
	for (const st of stopTimes) {
		const stopId = st["stop_id"]!;
		const routeId = tripToRoute[st["trip_id"]!];
		if (!routeId) continue;
		const routeName = routeIdToName[routeId] ?? routeId;
		const parentStop = stopId.replace(/[NS]$/, "");
		if (!stopRoutes[parentStop]) stopRoutes[parentStop] = new Set();
		stopRoutes[parentStop]!.add(routeName);
	}

	// Generate stations GeoJSON — only parent stations (location_type=1 or stops without N/S suffix that are parents)
	const parentStops = stops.filter(
		(s) => s["location_type"] === "1" || (s["location_type"] === "" && !s["stop_id"]!.match(/[NS]$/)),
	);

	// Deduplicate by taking only parent station IDs
	const seenStopIds = new Set<string>();
	const stationFeatures = [];
	for (const s of parentStops) {
		const id = s["stop_id"]!;
		if (seenStopIds.has(id)) continue;
		seenStopIds.add(id);
		const lines = Array.from(stopRoutes[id] ?? []).sort();
		if (lines.length === 0) continue;
		stationFeatures.push({
			type: "Feature" as const,
			properties: { id, name: s["stop_name"]!, lines },
			geometry: {
				type: "Point" as const,
				coordinates: [Number.parseFloat(s["stop_lon"]!), Number.parseFloat(s["stop_lat"]!)],
			},
		});
	}

	// Generate lines GeoJSON from shapes
	// Group shape points by shape_id
	const shapePoints: Record<string, { lat: number; lon: number; seq: number }[]> = {};
	for (const sp of shapes) {
		const id = sp["shape_id"]!;
		if (!shapePoints[id]) shapePoints[id] = [];
		shapePoints[id]!.push({
			lat: Number.parseFloat(sp["shape_pt_lat"]!),
			lon: Number.parseFloat(sp["shape_pt_lon"]!),
			seq: Number.parseInt(sp["shape_pt_sequence"]!, 10),
		});
	}

	// Sort each shape's points by sequence
	for (const pts of Object.values(shapePoints)) {
		pts.sort((a, b) => a.seq - b.seq);
	}

	// Map shape_id → route_name (pick the first trip with that shape)
	const shapeToRoute: Record<string, string> = {};
	for (const [tripId, shapeId] of Object.entries(tripToShape)) {
		if (shapeToRoute[shapeId]) continue;
		const routeId = tripToRoute[tripId];
		if (routeId) shapeToRoute[shapeId] = routeIdToName[routeId] ?? routeId;
	}

	// Group shapes by route name, pick the longest shape per route
	const routeShapes: Record<string, { shapeId: string; points: { lat: number; lon: number }[] }> = {};
	for (const [shapeId, pts] of Object.entries(shapePoints)) {
		const routeName = shapeToRoute[shapeId];
		if (!routeName) continue;
		if (!routeShapes[routeName] || pts.length > routeShapes[routeName]!.points.length) {
			routeShapes[routeName] = { shapeId, points: pts };
		}
	}

	const lineFeatures = Object.entries(routeShapes).map(([routeName, { points }]) => ({
		type: "Feature" as const,
		properties: {
			id: routeName,
			color: LINE_COLORS[routeName] ?? "#888888",
		},
		geometry: {
			type: "LineString" as const,
			coordinates: points.map((p) => [p.lon, p.lat]),
		},
	}));

	await mkdir(OUT_DIR, { recursive: true });

	await writeFile(
		join(OUT_DIR, "stations.geojson"),
		JSON.stringify({ type: "FeatureCollection", features: stationFeatures }, null, "\t"),
	);

	await writeFile(
		join(OUT_DIR, "lines.geojson"),
		JSON.stringify({ type: "FeatureCollection", features: lineFeatures }, null, "\t"),
	);

	// Cleanup
	const rmProc = Bun.spawnSync(["rm", "-rf", tempDir]);
	if (rmProc.exitCode !== 0) console.warn("Warning: failed to clean up temp dir");

	console.log(`Generated ${stationFeatures.length} stations and ${lineFeatures.length} lines`);
}

main().catch(console.error);
```

Run it:

```bash
cd packages/geo && bun run scripts/generate-geojson.ts
```

Expected: Two GeoJSON files created in `packages/geo/src/nyc/`. Roughly 470+ stations and 25+ lines.

- [ ] **Step 2: Update tsconfig to resolve JSON modules**

The base tsconfig already has `resolveJsonModule: true`. Verify that `packages/geo/tsconfig.json` extends it. It does — no changes needed.

However, we need to allow importing `.geojson` files. Add to `packages/geo/tsconfig.json`:

```json
{
	"extends": "@undergrid/typescript-config/base.json",
	"compilerOptions": {
		"outDir": "dist",
		"resolveJsonModule": true
	},
	"include": ["src"]
}
```

- [ ] **Step 3: Create the NYC geo module**

Create `packages/geo/src/nyc/index.ts`:

```typescript
import type { FeatureCollection, LineString, Point } from "geojson";
import linesData from "./lines.geojson" with { type: "json" };
import stationsData from "./stations.geojson" with { type: "json" };

export interface StationProperties {
	id: string;
	name: string;
	lines: string[];
}

export interface LineProperties {
	id: string;
	color: string;
}

export function getNycStations(): FeatureCollection<Point, StationProperties> {
	return stationsData as FeatureCollection<Point, StationProperties>;
}

export function getNycLines(): FeatureCollection<LineString, LineProperties> {
	return linesData as FeatureCollection<LineString, LineProperties>;
}
```

- [ ] **Step 4: Update packages/geo/src/index.ts**

```typescript
export { getNycLines, getNycStations } from "./nyc/index.js";
export type { LineProperties, StationProperties } from "./nyc/index.js";
```

- [ ] **Step 5: Add geojson types**

```bash
cd packages/geo && bun add -d @types/geojson
```

- [ ] **Step 6: Verify**

```bash
cd packages/geo && bun run check-types
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add packages/geo && git commit -m "feat(geo): add NYC subway stations and lines GeoJSON"
```

---

### Task 4: Transit provider interface and mock NYC provider (packages/providers)

**Files:**
- Create: `packages/providers/src/interface.ts`
- Create: `packages/providers/src/nyc/subway.ts`
- Modify: `packages/providers/src/index.ts`

- [ ] **Step 1: Create the provider interface**

Create `packages/providers/src/interface.ts`:

```typescript
import type { Arrival, Station, Train } from "@undergrid/types";

export interface TransitProvider {
	getTrains(): Promise<Train[]>;
	getStations(): Promise<Station[]>;
	getArrivals(stationId: string): Promise<Arrival[]>;
}
```

- [ ] **Step 2: Create mock NYC subway provider**

Create `packages/providers/src/nyc/subway.ts`:

```typescript
import { getNycLines, getNycStations } from "@undergrid/geo";
import type { Arrival, Station, Train } from "@undergrid/types";
import type { TransitProvider } from "../interface.js";

const NYC_LINES = [
	"1", "2", "3", "4", "5", "6", "7",
	"A", "B", "C", "D", "E", "F", "G",
	"J", "L", "M", "N", "Q", "R", "W", "Z",
];

function interpolateAlongLine(
	coords: number[][],
	fraction: number,
): [number, number] {
	const totalPoints = coords.length;
	if (totalPoints < 2) return coords[0] as [number, number];

	const idx = fraction * (totalPoints - 1);
	const low = Math.floor(idx);
	const high = Math.min(low + 1, totalPoints - 1);
	const t = idx - low;

	const p0 = coords[low]!;
	const p1 = coords[high]!;

	return [
		p0[0]! + (p1[0]! - p0[0]!) * t,
		p0[1]! + (p1[1]! - p0[1]!) * t,
	];
}

function seededRandom(seed: number): number {
	const x = Math.sin(seed) * 10000;
	return x - Math.floor(x);
}

export class MockNycSubwayProvider implements TransitProvider {
	async getStations(): Promise<Station[]> {
		const fc = getNycStations();
		return fc.features.map((f) => ({
			id: f.properties.id,
			name: f.properties.name,
			lines: f.properties.lines,
			position: f.geometry.coordinates as [number, number],
		}));
	}

	async getTrains(): Promise<Train[]> {
		const linesGeo = getNycLines();
		const now = Date.now();
		const trains: Train[] = [];

		for (const feature of linesGeo.features) {
			const lineId = feature.properties.id;
			const coords = feature.geometry.coordinates as number[][];
			if (coords.length < 2) continue;

			const trainCount = 2 + Math.floor(seededRandom(lineId.charCodeAt(0)) * 3);
			for (let i = 0; i < trainCount; i++) {
				const seed = lineId.charCodeAt(0) * 100 + i;
				const baseOffset = seededRandom(seed);
				const speed = 0.00002 + seededRandom(seed + 1) * 0.00003;
				const fraction = (baseOffset + (now * speed) / 1000) % 1;
				const direction = i % 2 === 0 ? "N" : "S";
				const position = interpolateAlongLine(
					direction === "N" ? coords : [...coords].reverse(),
					fraction,
				);

				trains.push({
					id: `${lineId}-${i}`,
					line: lineId,
					direction: direction as "N" | "S",
					position,
					timestamp: now,
				});
			}
		}

		return trains;
	}

	async getArrivals(stationId: string): Promise<Arrival[]> {
		const stations = await this.getStations();
		const station = stations.find((s) => s.id === stationId);
		if (!station) return [];

		const now = Date.now();
		const arrivals: Arrival[] = [];

		for (const line of station.lines) {
			const count = 2 + Math.floor(seededRandom(line.charCodeAt(0) + stationId.charCodeAt(0)) * 3);
			for (let i = 0; i < count; i++) {
				arrivals.push({
					line,
					direction: i % 2 === 0 ? "N" : "S",
					arrival: now + (i + 1) * 120_000 + Math.floor(seededRandom(i * 7) * 60_000),
				});
			}
		}

		return arrivals.sort((a, b) => a.arrival - b.arrival);
	}
}
```

- [ ] **Step 3: Update index.ts**

Replace `packages/providers/src/index.ts`:

```typescript
export { MockNycSubwayProvider } from "./nyc/subway.js";
export type { TransitProvider } from "./interface.js";
```

- [ ] **Step 4: Add @undergrid/geo dependency if not already present**

Already added in Task 1. Verify:

```bash
cd packages/providers && bun run check-types
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/providers && git commit -m "feat(providers): add mock NYC subway provider"
```

---

### Task 5: Hono API with OpenAPI routes (apps/api)

**Files:**
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/cities.ts`
- Create: `apps/api/src/routes/trains.ts`
- Create: `apps/api/src/routes/stations.ts`
- Create: `apps/api/src/lib/providers.ts`

- [ ] **Step 1: Create the provider registry**

Create `apps/api/src/lib/providers.ts`:

```typescript
import { MockNycSubwayProvider } from "@undergrid/providers";
import type { TransitProvider } from "@undergrid/providers";

const providers: Record<string, TransitProvider> = {
	nyc: new MockNycSubwayProvider(),
};

export function getProvider(cityId: string): TransitProvider | undefined {
	return providers[cityId];
}

export function getCityIds(): string[] {
	return Object.keys(providers);
}
```

- [ ] **Step 2: Create the cities route**

Create `apps/api/src/routes/cities.ts`:

```typescript
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { CitiesResponseSchema } from "@undergrid/types";
import { getCityIds } from "../lib/providers.js";

const app = new OpenAPIHono();

const citiesRoute = createRoute({
	method: "get",
	path: "/",
	responses: {
		200: {
			content: { "application/json": { schema: CitiesResponseSchema } },
			description: "List of available cities",
		},
	},
});

app.openapi(citiesRoute, (c) => {
	const cityIds = getCityIds();
	const cities = cityIds.map((id) => ({
		id,
		name: id === "nyc" ? "New York City" : id,
		bounds: id === "nyc"
			? [[-74.26, 40.49], [-73.68, 40.92]] as [[number, number], [number, number]]
			: [[-180, -90], [180, 90]] as [[number, number], [number, number]],
	}));
	return c.json({ cities }, 200);
});

export default app;
```

- [ ] **Step 3: Create the trains route**

Create `apps/api/src/routes/trains.ts`:

```typescript
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ErrorResponseSchema, TrainsResponseSchema } from "@undergrid/types";
import { getProvider } from "../lib/providers.js";

const app = new OpenAPIHono();

const trainsRoute = createRoute({
	method: "get",
	path: "/",
	request: {
		params: z.object({
			city: z.string().openapi({ param: { name: "city", in: "path" }, example: "nyc" }),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: TrainsResponseSchema } },
			description: "Live train positions",
		},
		404: {
			content: { "application/json": { schema: ErrorResponseSchema } },
			description: "City not found",
		},
	},
});

app.openapi(trainsRoute, async (c) => {
	const { city } = c.req.valid("param");
	const provider = getProvider(city);
	if (!provider) {
		return c.json({ error: "City not found" }, 404);
	}
	const trains = await provider.getTrains();
	return c.json({ city, trains, timestamp: Date.now() }, 200);
});

export default app;
```

- [ ] **Step 4: Create the stations route (includes arrivals)**

Create `apps/api/src/routes/stations.ts`:

```typescript
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	ArrivalsResponseSchema,
	ErrorResponseSchema,
	StationsResponseSchema,
} from "@undergrid/types";
import { getProvider } from "../lib/providers.js";

const app = new OpenAPIHono();

const stationsRoute = createRoute({
	method: "get",
	path: "/",
	request: {
		params: z.object({
			city: z.string().openapi({ param: { name: "city", in: "path" }, example: "nyc" }),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: StationsResponseSchema } },
			description: "All stations with metadata",
		},
		404: {
			content: { "application/json": { schema: ErrorResponseSchema } },
			description: "City not found",
		},
	},
});

const arrivalsRoute = createRoute({
	method: "get",
	path: "/:id/arrivals",
	request: {
		params: z.object({
			city: z.string().openapi({ param: { name: "city", in: "path" }, example: "nyc" }),
			id: z.string().openapi({ param: { name: "id", in: "path" }, example: "127" }),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: ArrivalsResponseSchema } },
			description: "Real-time arrivals for a station",
		},
		404: {
			content: { "application/json": { schema: ErrorResponseSchema } },
			description: "City or station not found",
		},
	},
});

app.openapi(stationsRoute, async (c) => {
	const { city } = c.req.valid("param");
	const provider = getProvider(city);
	if (!provider) {
		return c.json({ error: "City not found" }, 404);
	}
	const stations = await provider.getStations();
	return c.json({ city, stations }, 200);
});

app.openapi(arrivalsRoute, async (c) => {
	const { city, id } = c.req.valid("param");
	const provider = getProvider(city);
	if (!provider) {
		return c.json({ error: "City not found" }, 404);
	}
	const arrivals = await provider.getArrivals(id);
	return c.json({ station: id, arrivals }, 200);
});

export default app;
```

- [ ] **Step 5: Wire up index.ts with all routes + OpenAPI docs**

Replace `apps/api/src/index.ts`:

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import cities from "./routes/cities.js";
import stations from "./routes/stations.js";
import trains from "./routes/trains.js";

const app = new OpenAPIHono();

app.use("*", cors());

app.route("/v1/cities", cities);
app.route("/v1/:city/trains", trains);
app.route("/v1/:city/stations", stations);

app.doc("/openapi.json", {
	openapi: "3.1.0",
	info: {
		title: "Undergrid API",
		version: "0.1.0",
		description: "Public API for live transit and urban data",
	},
});

app.get("/docs", (c) => {
	return c.html(`<!DOCTYPE html>
<html>
<head>
	<title>Undergrid API Docs</title>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<script id="api-reference" data-url="/openapi.json"></script>
	<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

export type AppType = typeof app;

export default app;
```

- [ ] **Step 6: Update apps/api/tsconfig.json to support path resolution**

The api tsconfig currently targets ESNext with Bundler resolution. Wrangler bundles the code, so this should work. No changes needed — wrangler handles resolving workspace packages.

- [ ] **Step 7: Verify type check**

```bash
cd apps/api && bun run check-types
```

Expected: No errors. If there are import resolution issues with workspace packages, ensure wrangler.jsonc has no conflicting settings.

- [ ] **Step 8: Test manually**

```bash
cd apps/api && bun run dev
```

In another terminal:

```bash
curl http://localhost:8787/v1/cities | jq .
curl http://localhost:8787/v1/nyc/trains | jq .
curl http://localhost:8787/v1/nyc/stations | jq . | head -50
curl http://localhost:8787/openapi.json | jq .info
```

Expected: JSON responses with city data, trains with positions, stations with coordinates, and OpenAPI spec info.

- [ ] **Step 9: Commit**

```bash
git add apps/api && git commit -m "feat(api): add Hono API with OpenAPI routes for transit data"
```

---

### Task 6: Map foundation — Protomaps dark basemap (apps/web)

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/lib/map-style.ts`
- Modify: `apps/web/src/App.css` → replace with `apps/web/src/index.css` (minimal reset)
- Delete: `apps/web/src/App.css`

- [ ] **Step 1: Create map style builder**

Create `apps/web/src/lib/map-style.ts`:

```typescript
import { layers, namedFlavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";

const PMTILES_URL = "pmtiles://https://demo-bucket.protomaps.com/v4.pmtiles";

export function createMapStyle(): StyleSpecification {
	return {
		version: 8,
		glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
		sprite: "https://protomaps.github.io/basemaps-assets/sprites/v4/dark",
		sources: {
			protomaps: {
				type: "vector",
				url: PMTILES_URL,
				attribution:
					'<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
			},
		},
		layers: layers("protomaps", namedFlavor("dark"), { lang: "en" }),
	};
}
```

- [ ] **Step 2: Replace App.tsx with the map**

Replace `apps/web/src/App.tsx`:

```tsx
import "maplibre-gl/dist/maplibre-gl.css";

import { Protocol } from "pmtiles";
import { useEffect, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import { createMapStyle } from "./lib/map-style.ts";

export default function App() {
	useEffect(() => {
		const protocol = new Protocol();
		maplibregl.addProtocol("pmtiles", protocol.tile);
		return () => {
			maplibregl.removeProtocol("pmtiles");
		};
	}, []);

	const mapStyle = useMemo(() => createMapStyle(), []);

	return (
		<Map
			initialViewState={{
				longitude: -73.98,
				latitude: 40.75,
				zoom: 11,
			}}
			style={{ width: "100vw", height: "100vh" }}
			mapStyle={mapStyle}
		/>
	);
}
```

Note: `maplibregl` is available as a global when using `react-map-gl/maplibre`. If this doesn't resolve, import it explicitly:

```typescript
import maplibregl from "maplibre-gl";
```

- [ ] **Step 3: Simplify index.css to a minimal reset**

Replace `apps/web/src/index.css`:

```css
*,
*::before,
*::after {
	box-sizing: border-box;
	margin: 0;
	padding: 0;
}

html,
body,
#root {
	width: 100%;
	height: 100%;
	overflow: hidden;
}
```

- [ ] **Step 4: Clean up App.css import and delete App.css**

Update `apps/web/src/main.tsx` — it already imports `./index.css`, so just remove any `App.css` import in App.tsx (we already did this in step 2). Delete `apps/web/src/App.css`.

```bash
rm apps/web/src/App.css
```

Also delete any unused assets from the boilerplate:

```bash
rm -rf apps/web/src/assets
```

- [ ] **Step 5: Verify it builds**

```bash
cd apps/web && bun run check-types
```

Expected: No errors.

- [ ] **Step 6: Test visually**

```bash
cd apps/web && bun run dev
```

Open the URL in browser. Expected: Full-screen dark map centered on NYC. Pan and zoom should work. Muted gray/dark basemap from Protomaps.

- [ ] **Step 7: Commit**

```bash
git add apps/web && git commit -m "feat(web): add MapLibre map with Protomaps dark basemap"
```

---

### Task 7: Subway lines and stations on the map (apps/web)

**Files:**
- Create: `apps/web/src/components/SubwayLines.tsx`
- Create: `apps/web/src/components/Stations.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create SubwayLines component**

Create `apps/web/src/components/SubwayLines.tsx`:

```tsx
import { getNycLines } from "@undergrid/geo";
import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import type { LineLayer } from "react-map-gl/maplibre";

const lineLayer: LineLayer = {
	id: "subway-lines",
	type: "line",
	paint: {
		"line-color": ["get", "color"],
		"line-width": 2,
		"line-opacity": 0.7,
	},
};

export function SubwayLines() {
	const data = useMemo(() => getNycLines(), []);
	return (
		<Source id="subway-lines" type="geojson" data={data}>
			<Layer {...lineLayer} />
		</Source>
	);
}
```

- [ ] **Step 2: Create Stations component**

Create `apps/web/src/components/Stations.tsx`:

```tsx
import { getNycStations } from "@undergrid/geo";
import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import type { CircleLayer } from "react-map-gl/maplibre";

const stationLayer: CircleLayer = {
	id: "stations",
	type: "circle",
	minzoom: 12,
	paint: {
		"circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2, 16, 6],
		"circle-color": "#ffffff",
		"circle-opacity": 0.8,
		"circle-stroke-width": 1,
		"circle-stroke-color": "#333333",
	},
};

export function Stations() {
	const data = useMemo(() => getNycStations(), []);
	return (
		<Source id="stations" type="geojson" data={data}>
			<Layer {...stationLayer} />
		</Source>
	);
}
```

- [ ] **Step 3: Add components to App.tsx**

Update `apps/web/src/App.tsx`:

```tsx
import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import { Stations } from "./components/Stations.ts";
import { SubwayLines } from "./components/SubwayLines.ts";
import { createMapStyle } from "./lib/map-style.ts";

export default function App() {
	useEffect(() => {
		const protocol = new Protocol();
		maplibregl.addProtocol("pmtiles", protocol.tile);
		return () => {
			maplibregl.removeProtocol("pmtiles");
		};
	}, []);

	const mapStyle = useMemo(() => createMapStyle(), []);

	return (
		<Map
			initialViewState={{
				longitude: -73.98,
				latitude: 40.75,
				zoom: 11,
			}}
			style={{ width: "100vw", height: "100vh" }}
			mapStyle={mapStyle}
		>
			<SubwayLines />
			<Stations />
		</Map>
	);
}
```

- [ ] **Step 4: Verify and test**

```bash
cd apps/web && bun run check-types
```

Then `bun run dev` and verify: subway lines should appear as colored lines on the dark map. Stations appear as small white dots when zoomed to ~12+.

- [ ] **Step 5: Commit**

```bash
git add apps/web && git commit -m "feat(web): render subway lines and stations on map"
```

---

### Task 8: API client and train polling hook (apps/web)

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/hooks/useTrains.ts`

- [ ] **Step 1: Create Hono RPC client**

Create `apps/web/src/lib/api.ts`:

```typescript
import type { AppType } from "@undergrid/api";
import { hc } from "hono/client";

const API_URL = import.meta.env.DEV
	? "http://localhost:8787"
	: "https://api.undergrid.app";

export const api = hc<AppType>(API_URL);
```

Note: For this to work, `apps/api` needs to export its `AppType`. The `apps/web/package.json` needs `@undergrid/api` as a dev dependency for the type import only. Alternatively, we can create a shared package for the API type. The simplest approach: add the API as a workspace dependency in web's package.json.

```bash
cd apps/web && bun add -d @undergrid/api@workspace:*
```

And update `apps/api/package.json` to add an exports field:

Add to `apps/api/package.json`:

```json
{
	"exports": {
		".": {
			"types": "./src/index.ts"
		}
	}
}
```

However, Hono RPC with `@hono/zod-openapi` routes can be tricky for type inference. If the `AppType` from the OpenAPIHono instance doesn't carry enough type information for `hc`, we can use a simpler approach — a plain fetch wrapper with types from `@undergrid/types`:

Create `apps/web/src/lib/api.ts` (simpler approach if RPC types don't work):

```typescript
import type { ArrivalsResponse, CitiesResponse, StationsResponse, TrainsResponse } from "@undergrid/types";

const API_URL = import.meta.env.DEV
	? "http://localhost:8787"
	: "https://api.undergrid.app";

async function fetchJson<T>(path: string): Promise<T> {
	const res = await fetch(`${API_URL}${path}`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json() as Promise<T>;
}

export const api = {
	getCities: () => fetchJson<CitiesResponse>("/v1/cities"),
	getTrains: (city: string) => fetchJson<TrainsResponse>(`/v1/${city}/trains`),
	getStations: (city: string) => fetchJson<StationsResponse>(`/v1/${city}/stations`),
	getArrivals: (city: string, stationId: string) =>
		fetchJson<ArrivalsResponse>(`/v1/${city}/stations/${stationId}/arrivals`),
};
```

Start with the Hono RPC approach. If type inference issues arise at build time, fall back to the simple typed fetch wrapper above.

- [ ] **Step 2: Create useTrains polling hook**

Create `apps/web/src/hooks/useTrains.ts`:

```typescript
import type { Train } from "@undergrid/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.ts";

const POLL_INTERVAL = 30_000;

export function useTrains(city: string) {
	const [trains, setTrains] = useState<Train[]>([]);
	const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

	const fetchTrains = useCallback(async () => {
		try {
			const data = await api.getTrains(city);
			setTrains(data.trains);
		} catch {
			// Silently retry on next interval — avoid crashing the map
		}
	}, [city]);

	useEffect(() => {
		fetchTrains();
		intervalRef.current = setInterval(fetchTrains, POLL_INTERVAL);
		return () => clearInterval(intervalRef.current);
	}, [fetchTrains]);

	return trains;
}
```

- [ ] **Step 3: Verify types**

```bash
cd apps/web && bun run check-types
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web && git commit -m "feat(web): add API client and train polling hook"
```

---

### Task 9: Animated train dots with deck.gl TripsLayer (apps/web)

**Files:**
- Create: `apps/web/src/components/DeckGLOverlay.tsx`
- Create: `apps/web/src/components/TrainLayer.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create DeckGLOverlay component**

Create `apps/web/src/components/DeckGLOverlay.tsx`:

```tsx
import type { DeckProps } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { useControl } from "react-map-gl/maplibre";

export function DeckGLOverlay(props: DeckProps) {
	const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
	overlay.setProps(props);
	return null;
}
```

- [ ] **Step 2: Create TrainLayer component**

The mock provider returns individual train positions per poll. For TripsLayer, we need waypoints with timestamps. Since our mock data gives us a single position + timestamp per train per poll, we'll accumulate a short trail of positions over successive polls to build up waypoint arrays.

Simpler approach for Phase 1: Use `ScatterplotLayer` for train dots (no trail animation), since TripsLayer needs historical waypoints that our mock API doesn't yet provide in a single response. We can add TripsLayer trail animation in Phase 2 when we have real GTFS-RT data with vehicle trajectories.

Actually, for the ambient mode visual effect, let's use `ScatterplotLayer` with animated opacity/size for a clean glowing dot per train. This is simpler and still looks great.

Create `apps/web/src/components/TrainLayer.tsx`:

```tsx
import { ScatterplotLayer } from "@deck.gl/layers";
import type { Train } from "@undergrid/types";
import { useMemo } from "react";
import { DeckGLOverlay } from "./DeckGLOverlay.ts";

const LINE_COLORS: Record<string, [number, number, number]> = {
	"1": [238, 53, 46], "2": [238, 53, 46], "3": [238, 53, 46],
	"4": [0, 147, 60], "5": [0, 147, 60], "6": [0, 147, 60],
	"7": [185, 51, 173],
	A: [0, 57, 166], C: [0, 57, 166], E: [0, 57, 166],
	B: [255, 99, 25], D: [255, 99, 25], F: [255, 99, 25], M: [255, 99, 25],
	G: [108, 190, 69],
	J: [153, 102, 51], Z: [153, 102, 51],
	L: [167, 169, 172],
	N: [252, 204, 10], Q: [252, 204, 10], R: [252, 204, 10], W: [252, 204, 10],
	GS: [128, 129, 131], FS: [128, 129, 131], H: [128, 129, 131],
	SI: [0, 173, 208],
};

function getLineColor(line: string): [number, number, number] {
	return LINE_COLORS[line] ?? [200, 200, 200];
}

interface TrainLayerProps {
	trains: Train[];
}

export function TrainLayer({ trains }: TrainLayerProps) {
	const layers = useMemo(
		() => [
			new ScatterplotLayer<Train>({
				id: "trains",
				data: trains,
				getPosition: (d) => d.position,
				getFillColor: (d) => [...getLineColor(d.line), 220],
				getRadius: 80,
				radiusMinPixels: 3,
				radiusMaxPixels: 12,
				filled: true,
				stroked: true,
				getLineColor: (d) => [...getLineColor(d.line), 100],
				lineWidthMinPixels: 1,
				pickable: false,
				transitions: {
					getPosition: { duration: 2000, type: "interpolation" },
				},
			}),
		],
		[trains],
	);

	return <DeckGLOverlay layers={layers} interleaved />;
}
```

The `transitions.getPosition` with `duration: 2000` will smoothly animate train dots between poll updates, giving the appearance of movement even though we're getting discrete position updates.

- [ ] **Step 3: Wire everything together in App.tsx**

Update `apps/web/src/App.tsx`:

```tsx
import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import { Stations } from "./components/Stations.ts";
import { SubwayLines } from "./components/SubwayLines.ts";
import { TrainLayer } from "./components/TrainLayer.ts";
import { useTrains } from "./hooks/useTrains.ts";
import { createMapStyle } from "./lib/map-style.ts";

export default function App() {
	useEffect(() => {
		const protocol = new Protocol();
		maplibregl.addProtocol("pmtiles", protocol.tile);
		return () => {
			maplibregl.removeProtocol("pmtiles");
		};
	}, []);

	const mapStyle = useMemo(() => createMapStyle(), []);
	const trains = useTrains("nyc");

	return (
		<Map
			initialViewState={{
				longitude: -73.98,
				latitude: 40.75,
				zoom: 11,
			}}
			style={{ width: "100vw", height: "100vh" }}
			mapStyle={mapStyle}
		>
			<SubwayLines />
			<Stations />
			<TrainLayer trains={trains} />
		</Map>
	);
}
```

- [ ] **Step 4: Verify types**

```bash
cd apps/web && bun run check-types
```

- [ ] **Step 5: Run full dev stack and test**

In one terminal:

```bash
cd apps/api && bun run dev
```

In another:

```bash
cd apps/web && bun run dev
```

Expected: Dark map of NYC with colored subway lines, station dots at zoom 12+, and colored train dots scattered along the lines. Dots should smoothly animate positions every 30 seconds when new data arrives.

- [ ] **Step 6: Commit**

```bash
git add apps/web && git commit -m "feat(web): add animated train dots with deck.gl ScatterplotLayer"
```

---

### Task 10: Dev script and final polish

**Files:**
- Modify: `apps/web/vite.config.ts` (add proxy for API in dev)
- Verify: `turbo.json` dev task works for both apps

- [ ] **Step 1: Add API proxy to Vite dev config**

This lets the web app call `/v1/...` in development without CORS issues and without hardcoding the API URL.

Update `apps/web/vite.config.ts`:

```typescript
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), cloudflare()],
	server: {
		proxy: {
			"/v1": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
});
```

Then update `apps/web/src/lib/api.ts` to use relative URLs in dev:

```typescript
import type { ArrivalsResponse, CitiesResponse, StationsResponse, TrainsResponse } from "@undergrid/types";

const API_URL = import.meta.env.DEV ? "" : "https://api.undergrid.app";

async function fetchJson<T>(path: string): Promise<T> {
	const res = await fetch(`${API_URL}${path}`);
	if (!res.ok) throw new Error(`API error: ${res.status}`);
	return res.json() as Promise<T>;
}

export const api = {
	getCities: () => fetchJson<CitiesResponse>("/v1/cities"),
	getTrains: (city: string) => fetchJson<TrainsResponse>(`/v1/${city}/trains`),
	getStations: (city: string) => fetchJson<StationsResponse>(`/v1/${city}/stations`),
	getArrivals: (city: string, stationId: string) =>
		fetchJson<ArrivalsResponse>(`/v1/${city}/stations/${stationId}/arrivals`),
};
```

- [ ] **Step 2: Verify full dev workflow**

```bash
bun run dev
```

This should start both `apps/api` (wrangler dev) and `apps/web` (vite dev) via Turborepo. Open the web URL — you should see the full ambient map experience.

- [ ] **Step 3: Run lint and type check**

```bash
bun run check && bun run check-types
```

Fix any issues.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add dev proxy and polish Phase 1 setup"
```

---

### Task 11: Final verification

- [ ] **Step 1: Clean build from scratch**

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
bun install
bun run check
bun run check-types
bun run build
```

Expected: All three pass cleanly.

- [ ] **Step 2: Run dev and visually verify**

```bash
bun run dev
```

Checklist:
- Dark Protomaps basemap centered on NYC
- Colored subway lines visible
- Station dots visible at zoom 12+
- Train dots visible along lines with correct MTA colors
- Train positions update and animate smoothly every 30 seconds
- API responds at `http://localhost:8787/v1/cities`
- API docs at `http://localhost:8787/docs`
- No console errors

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: address Phase 1 verification issues"
```
