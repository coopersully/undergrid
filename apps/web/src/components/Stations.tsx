import { getNycStations } from "@undergrid/geo";
import { useMemo } from "react";
import type { LayerProps } from "react-map-gl/maplibre";
import { Layer, Source } from "react-map-gl/maplibre";

const stationLayer: LayerProps = {
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
