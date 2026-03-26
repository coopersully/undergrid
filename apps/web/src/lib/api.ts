import type {
	ArrivalsResponse,
	CitiesResponse,
	StationsResponse,
	TrainsResponse,
} from "@undergrid/types";

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
