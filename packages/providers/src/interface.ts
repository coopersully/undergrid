import type { Arrival, Station, Train } from "@undergrid/types";

export interface TransitProvider {
	getTrains(): Promise<Train[]>;
	getStations(): Promise<Station[]>;
	getArrivals(stationId: string): Promise<Arrival[]>;
}
