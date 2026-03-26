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
