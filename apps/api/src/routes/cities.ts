import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { CitiesResponseSchema } from "@undergrid/types";
import { getCityIds } from "../lib/providers.js";

const app = new OpenAPIHono();

const citiesRoute = createRoute({
	method: "get",
	path: "/",
	responses: {
		200: {
			content: { "application/json": { schema: CitiesResponseSchema } },
			description: "List of available cities",
		},
	},
});

app.openapi(citiesRoute, (c) => {
	const cityIds = getCityIds();
	const cities = cityIds.map((id) => ({
		id,
		name: id === "nyc" ? "New York City" : id,
		bounds:
			id === "nyc"
				? ([
						[-74.26, 40.49],
						[-73.68, 40.92],
					] as [[number, number], [number, number]])
				: ([
						[-180, -90],
						[180, 90],
					] as [[number, number], [number, number]]),
	}));
	return c.json({ cities }, 200);
});

export default app;
