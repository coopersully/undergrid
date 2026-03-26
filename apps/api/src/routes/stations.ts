import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
	ArrivalsResponseSchema,
	ErrorResponseSchema,
	StationsResponseSchema,
} from "@undergrid/types";
import { getProvider } from "../lib/providers.js";

const app = new OpenAPIHono();

const stationsRoute = createRoute({
	method: "get",
	path: "/",
	request: {
		params: z.object({
			city: z.string().openapi({ param: { name: "city", in: "path" }, example: "nyc" }),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: StationsResponseSchema } },
			description: "All stations with metadata",
		},
		404: {
			content: { "application/json": { schema: ErrorResponseSchema } },
			description: "City not found",
		},
	},
});

const arrivalsRoute = createRoute({
	method: "get",
	path: "/:id/arrivals",
	request: {
		params: z.object({
			city: z.string().openapi({ param: { name: "city", in: "path" }, example: "nyc" }),
			id: z.string().openapi({ param: { name: "id", in: "path" }, example: "127" }),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: ArrivalsResponseSchema } },
			description: "Real-time arrivals for a station",
		},
		404: {
			content: { "application/json": { schema: ErrorResponseSchema } },
			description: "City or station not found",
		},
	},
});

app.openapi(stationsRoute, async (c) => {
	const { city } = c.req.valid("param");
	const provider = getProvider(city);
	if (!provider) {
		return c.json({ error: "City not found" }, 404);
	}
	const stations = await provider.getStations();
	return c.json({ city, stations }, 200);
});

app.openapi(arrivalsRoute, async (c) => {
	const { city, id } = c.req.valid("param");
	const provider = getProvider(city);
	if (!provider) {
		return c.json({ error: "City not found" }, 404);
	}
	const arrivals = await provider.getArrivals(id);
	return c.json({ station: id, arrivals }, 200);
});

export default app;
