import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useMemo } from "react";
import { Map as MapGL } from "react-map-gl/maplibre";
import { Stations } from "./components/Stations.tsx";
import { SubwayLines } from "./components/SubwayLines.tsx";
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
		<MapGL
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
		</MapGL>
	);
}
