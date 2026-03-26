import { ScatterplotLayer } from "@deck.gl/layers";
import type { Train } from "@undergrid/types";
import { useMemo } from "react";
import { DeckGLOverlay } from "./DeckGLOverlay.ts";

const LINE_COLORS: Record<string, [number, number, number]> = {
	"1": [238, 53, 46],
	"2": [238, 53, 46],
	"3": [238, 53, 46],
	"4": [0, 147, 60],
	"5": [0, 147, 60],
	"6": [0, 147, 60],
	"7": [185, 51, 173],
	A: [0, 57, 166],
	C: [0, 57, 166],
	E: [0, 57, 166],
	B: [255, 99, 25],
	D: [255, 99, 25],
	F: [255, 99, 25],
	M: [255, 99, 25],
	G: [108, 190, 69],
	J: [153, 102, 51],
	Z: [153, 102, 51],
	L: [167, 169, 172],
	N: [252, 204, 10],
	Q: [252, 204, 10],
	R: [252, 204, 10],
	W: [252, 204, 10],
	GS: [128, 129, 131],
	FS: [128, 129, 131],
	H: [128, 129, 131],
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
