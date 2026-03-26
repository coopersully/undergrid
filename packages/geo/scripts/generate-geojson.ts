#!/usr/bin/env bun
/**
 * generate-geojson.ts
 *
 * Downloads MTA GTFS static data, parses it, and generates two GeoJSON files
 * for NYC subway: stations.geojson and lines.geojson
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GTFS_URL = "http://web.mta.info/developers/data/nyct/subway/google_transit.zip";

// MTA official line colors keyed by route short name prefix
const LINE_COLORS: Record<string, string> = {
	"1": "#EE352E",
	"2": "#EE352E",
	"3": "#EE352E",
	"4": "#00933C",
	"5": "#00933C",
	"6": "#00933C",
	"7": "#B933AD",
	A: "#0039A6",
	C: "#0039A6",
	E: "#0039A6",
	B: "#FF6319",
	D: "#FF6319",
	F: "#FF6319",
	M: "#FF6319",
	G: "#6CBE45",
	J: "#996633",
	Z: "#996633",
	L: "#A7A9AC",
	N: "#FCCC0A",
	Q: "#FCCC0A",
	R: "#FCCC0A",
	W: "#FCCC0A",
	// Shuttles
	GS: "#808183",
	FS: "#808183",
	H: "#808183",
	S: "#808183",
	// Staten Island Railway
	SIR: "#00ADD0",
	SI: "#00ADD0",
};

function getLineColor(routeShortName: string): string {
	if (LINE_COLORS[routeShortName]) return LINE_COLORS[routeShortName];
	// Strip trailing X for express variants (6X, 7X, FX, etc.)
	const base = routeShortName.replace(/X$/, "");
	return LINE_COLORS[base] ?? "#808183";
}

/**
 * Parse a CSV file with potential BOM character and quoted fields.
 * Returns array of objects keyed by header row.
 */
function parseCsv(text: string): Record<string, string>[] {
	const cleaned = text.startsWith("\uFEFF") ? text.slice(1) : text;
	const lines = cleaned.split(/\r?\n/);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0] ?? "");
	const records: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim() === "") continue;
		const values = parseCsvLine(line);
		const record: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			record[headers[j] ?? ""] = values[j] ?? "";
		}
		records.push(record);
	}

	return records;
}

/** Parse a single quoted CSV field starting at position i, returning [field, newIndex]. */
function parseQuotedField(line: string, startIdx: number): [string, number] {
	let i = startIdx + 1; // skip opening quote
	let field = "";
	while (i < line.length) {
		if (line[i] === '"') {
			if (line[i + 1] === '"') {
				field += '"';
				i += 2;
			} else {
				i++; // skip closing quote
				break;
			}
		} else {
			field += line[i];
			i++;
		}
	}
	// Skip trailing comma delimiter
	if (line[i] === ",") i++;
	return [field, i];
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '"') {
			const [field, next] = parseQuotedField(line, i);
			fields.push(field);
			i = next;
		} else {
			const end = line.indexOf(",", i);
			if (end === -1) {
				fields.push(line.slice(i));
				break;
			}
			fields.push(line.slice(i, end));
			i = end + 1;
		}
	}
	return fields;
}

async function downloadAndUnzip(url: string, destDir: string): Promise<void> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to download GTFS data: HTTP ${res.status} ${res.statusText}`);
	}
	const zipBuffer = await res.arrayBuffer();

	const zipPath = join(destDir, "gtfs.zip");
	await writeFile(zipPath, Buffer.from(zipBuffer));
	const proc = Bun.spawnSync(["unzip", "-o", "-q", zipPath, "-d", destDir]);
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to unzip: ${proc.stderr.toString()}`);
	}
}

async function readCsvFile(dir: string, filename: string): Promise<Record<string, string>[]> {
	const text = await Bun.file(join(dir, filename)).text();
	return parseCsv(text);
}

/** Parse the header line of stop_times.txt and return [tripIdIdx, stopIdIdx]. */
function parseStopTimesHeader(rawLine: string): [number, number] {
	const line = rawLine.startsWith("\uFEFF") ? rawLine.slice(1) : rawLine;
	const headers = parseCsvLine(line);
	return [headers.indexOf("trip_id"), headers.indexOf("stop_id")];
}

/**
 * Read stop_times.txt efficiently. We only need trip_id -> stop_id mappings.
 * The file can be very large so we avoid building full parsed records.
 */
async function readStopTimesTripsToStops(dir: string): Promise<Map<string, Set<string>>> {
	const text = await Bun.file(join(dir, "stop_times.txt")).text();
	const tripToStops = new Map<string, Set<string>>();
	const lines = text.split(/\r?\n/);

	let tripIdIdx = -1;
	let stopIdIdx = -1;
	let headerParsed = false;

	for (const line of lines) {
		if (!line || line.trim() === "") continue;

		if (!headerParsed) {
			[tripIdIdx, stopIdIdx] = parseStopTimesHeader(line);
			headerParsed = true;
			continue;
		}

		addStopTimeLine(line, tripIdIdx, stopIdIdx, tripToStops);
	}
	return tripToStops;
}

function addStopTimeLine(
	line: string,
	tripIdIdx: number,
	stopIdIdx: number,
	tripToStops: Map<string, Set<string>>,
): void {
	const parts = line.split(",");
	const tripId = parts[tripIdIdx]?.trim() ?? "";
	const stopId = parts[stopIdIdx]?.trim() ?? "";
	if (!tripId || !stopId) return;

	let stops = tripToStops.get(tripId);
	if (!stops) {
		stops = new Set();
		tripToStops.set(tripId, stops);
	}
	stops.add(stopId);
}

interface GeoJsonPoint {
	type: "Feature";
	geometry: { type: "Point"; coordinates: [number, number] };
	properties: { id: string; name: string; lines: string[] };
}

interface GeoJsonLineString {
	type: "Feature";
	geometry: { type: "LineString"; coordinates: [number, number][] };
	properties: { id: string; color: string };
}

type StopRecord = { id: string; name: string; lat: number; lon: number };

function stopToRecord(stop: Record<string, string>): StopRecord {
	return {
		id: stop.stop_id?.trim() ?? "",
		name: stop.stop_name?.trim() ?? "",
		lat: parseFloat(stop.stop_lat ?? "0"),
		lon: parseFloat(stop.stop_lon ?? "0"),
	};
}

/** Filter stops by location_type === "1" (parent station). */
function filterByLocationType(stopsRaw: Record<string, string>[]): Map<string, StopRecord> {
	const parentStops = new Map<string, StopRecord>();
	for (const stop of stopsRaw) {
		if ((stop.location_type?.trim() ?? "") === "1") {
			const rec = stopToRecord(stop);
			parentStops.set(rec.id, rec);
		}
	}
	return parentStops;
}

/** Fallback filter: exclude stops whose ID ends with N or S (platform suffixes). */
function filterBySuffixExclusion(stopsRaw: Record<string, string>[]): Map<string, StopRecord> {
	const parentStops = new Map<string, StopRecord>();
	for (const stop of stopsRaw) {
		const stopId = stop.stop_id?.trim() ?? "";
		if (!stopId.endsWith("N") && !stopId.endsWith("S")) {
			const rec = stopToRecord(stop);
			parentStops.set(rec.id, rec);
		}
	}
	return parentStops;
}

function parseParentStops(stopsRaw: Record<string, string>[]): Map<string, StopRecord> {
	const byLocType = filterByLocationType(stopsRaw);
	if (byLocType.size > 0) return byLocType;
	return filterBySuffixExclusion(stopsRaw);
}

function parseRoutes(
	routesRaw: Record<string, string>[],
): Map<string, { shortName: string; color: string }> {
	const routes = new Map<string, { shortName: string; color: string }>();
	for (const route of routesRaw) {
		const routeId = route.route_id?.trim() ?? "";
		const shortName = (route.route_short_name?.trim() ?? "").toUpperCase();
		routes.set(routeId, { shortName, color: getLineColor(shortName) });
	}
	return routes;
}

function parseTrips(tripsRaw: Record<string, string>[]): {
	tripToRoute: Map<string, string>;
	routeShapes: Map<string, Map<string, number>>;
} {
	const tripToRoute = new Map<string, string>();
	const routeShapes = new Map<string, Map<string, number>>();

	for (const trip of tripsRaw) {
		const tripId = trip.trip_id?.trim() ?? "";
		const routeId = trip.route_id?.trim() ?? "";
		const shapeId = trip.shape_id?.trim() ?? "";
		tripToRoute.set(tripId, routeId);

		if (routeId && shapeId) {
			let shapeMap = routeShapes.get(routeId);
			if (!shapeMap) {
				shapeMap = new Map();
				routeShapes.set(routeId, shapeMap);
			}
			shapeMap.set(shapeId, (shapeMap.get(shapeId) ?? 0) + 1);
		}
	}

	return { tripToRoute, routeShapes };
}

function addStopToRouteMap(
	stopId: string,
	shortName: string,
	parentStops: Map<string, StopRecord>,
	stationRoutes: Map<string, Set<string>>,
): void {
	const parentId = stopId.endsWith("N") || stopId.endsWith("S") ? stopId.slice(0, -1) : stopId;
	if (!parentStops.has(parentId)) return;

	let routeSet = stationRoutes.get(parentId);
	if (!routeSet) {
		routeSet = new Set();
		stationRoutes.set(parentId, routeSet);
	}
	routeSet.add(shortName);
}

function buildStationRoutes(
	tripToStops: Map<string, Set<string>>,
	tripToRoute: Map<string, string>,
	routes: Map<string, { shortName: string; color: string }>,
	parentStops: Map<string, StopRecord>,
): Map<string, Set<string>> {
	const stationRoutes = new Map<string, Set<string>>();

	for (const [tripId, stops] of tripToStops) {
		const routeId = tripToRoute.get(tripId);
		if (!routeId) continue;
		const route = routes.get(routeId);
		if (!route) continue;

		for (const stopId of stops) {
			addStopToRouteMap(stopId, route.shortName, parentStops, stationRoutes);
		}
	}

	return stationRoutes;
}

type ShapePoint = { lat: number; lon: number; seq: number };

function parseShapes(shapesRaw: Record<string, string>[]): Map<string, ShapePoint[]> {
	const shapePoints = new Map<string, ShapePoint[]>();

	for (const row of shapesRaw) {
		const shapeId = row.shape_id?.trim() ?? "";
		const lat = parseFloat(row.shape_pt_lat ?? "0");
		const lon = parseFloat(row.shape_pt_lon ?? "0");
		const seq = parseInt(row.shape_pt_sequence ?? "0", 10);

		let pts = shapePoints.get(shapeId);
		if (!pts) {
			pts = [];
			shapePoints.set(shapeId, pts);
		}
		pts.push({ lat, lon, seq });
	}

	for (const pts of shapePoints.values()) {
		pts.sort((a, b) => a.seq - b.seq);
	}

	return shapePoints;
}

function findLongestShapePerRoute(
	routeShapes: Map<string, Map<string, number>>,
	shapePoints: Map<string, ShapePoint[]>,
): Map<string, string> {
	const routeLongestShape = new Map<string, string>();

	for (const [routeId, shapeMap] of routeShapes) {
		let bestShape = "";
		let bestCount = 0;
		for (const shapeId of shapeMap.keys()) {
			const count = shapePoints.get(shapeId)?.length ?? 0;
			if (count > bestCount) {
				bestCount = count;
				bestShape = shapeId;
			}
		}
		if (bestShape) routeLongestShape.set(routeId, bestShape);
	}

	return routeLongestShape;
}

function buildStationFeatures(
	parentStops: Map<string, StopRecord>,
	stationRoutes: Map<string, Set<string>>,
): GeoJsonPoint[] {
	const features: GeoJsonPoint[] = [];

	for (const [stopId, station] of parentStops) {
		if (Number.isNaN(station.lat) || Number.isNaN(station.lon)) continue;
		const lines = Array.from(stationRoutes.get(stopId) ?? []).sort();
		features.push({
			type: "Feature",
			geometry: { type: "Point", coordinates: [station.lon, station.lat] },
			properties: { id: station.id, name: station.name, lines },
		});
	}

	features.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
	return features;
}

function buildLineFeatures(
	routes: Map<string, { shortName: string; color: string }>,
	routeLongestShape: Map<string, string>,
	shapePoints: Map<string, ShapePoint[]>,
): GeoJsonLineString[] {
	const features: GeoJsonLineString[] = [];

	for (const [routeId, route] of routes) {
		const shapeId = routeLongestShape.get(routeId);
		if (!shapeId) continue;
		const pts = shapePoints.get(shapeId);
		if (!pts || pts.length < 2) continue;

		features.push({
			type: "Feature",
			geometry: {
				type: "LineString",
				coordinates: pts.map((p) => [p.lon, p.lat]),
			},
			properties: { id: route.shortName, color: route.color },
		});
	}

	features.sort((a, b) => a.properties.id.localeCompare(b.properties.id));
	return features;
}

async function generateGeoJson(tmpDir: string): Promise<void> {
	await downloadAndUnzip(GTFS_URL, tmpDir);
	const parentStops = parseParentStops(await readCsvFile(tmpDir, "stops.txt"));
	const routes = parseRoutes(await readCsvFile(tmpDir, "routes.txt"));
	const tripsRaw = await readCsvFile(tmpDir, "trips.txt");
	const { tripToRoute, routeShapes } = parseTrips(tripsRaw);

	const tripToStops = await readStopTimesTripsToStops(tmpDir);
	const stationRoutes = buildStationRoutes(tripToStops, tripToRoute, routes, parentStops);
	const shapePoints = parseShapes(await readCsvFile(tmpDir, "shapes.txt"));
	const routeLongestShape = findLongestShapePerRoute(routeShapes, shapePoints);
	const stationFeatures = buildStationFeatures(parentStops, stationRoutes);
	const lineFeatures = buildLineFeatures(routes, routeLongestShape, shapePoints);

	const outDir = new URL("../src/nyc", import.meta.url).pathname;

	await writeFile(
		join(outDir, "stations.geojson"),
		JSON.stringify({ type: "FeatureCollection", features: stationFeatures }, null, "\t"),
		"utf-8",
	);

	await writeFile(
		join(outDir, "lines.geojson"),
		JSON.stringify({ type: "FeatureCollection", features: lineFeatures }, null, "\t"),
		"utf-8",
	);
}

async function main() {
	const tmpDir = join(tmpdir(), `gtfs-${Date.now()}`);
	await mkdir(tmpDir, { recursive: true });

	try {
		await generateGeoJson(tmpDir);
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
}

main().catch((_err: unknown) => {
	process.exit(1);
});
