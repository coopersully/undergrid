import { getNycLines } from "@undergrid/geo";
import { useMemo } from "react";
import type { LayerProps } from "react-map-gl/maplibre";
import { Layer, Source } from "react-map-gl/maplibre";

const lineLayer: LayerProps = {
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
