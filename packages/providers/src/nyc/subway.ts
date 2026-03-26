import { getNycLines, getNycStations } from "@undergrid/geo";
import type { Arrival, Station, Train } from "@undergrid/types";
import type { TransitProvider } from "../interface.js";

function interpolateAlongLine(coords: number[][], fraction: number): [number, number] {
	const totalPoints = coords.length;
	if (totalPoints < 2) return coords[0] as [number, number];

	const idx = fraction * (totalPoints - 1);
	const low = Math.floor(idx);
	const high = Math.min(low + 1, totalPoints - 1);
	const t = idx - low;

	const p0 = coords[low]!;
	const p1 = coords[high]!;

	return [p0[0]! + (p1[0]! - p0[0]!) * t, p0[1]! + (p1[1]! - p0[1]!) * t];
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
