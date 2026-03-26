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
