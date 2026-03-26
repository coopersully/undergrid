import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ErrorResponseSchema, TrainsResponseSchema } from "@undergrid/types";
import { getProvider } from "../lib/providers.js";

const app = new OpenAPIHono();

const trainsRoute = createRoute({
	method: "get",
	path: "/",
	request: {
		params: z.object({
			city: z.string().openapi({ param: { name: "city", in: "path" }, example: "nyc" }),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: TrainsResponseSchema } },
			description: "Live train positions",
		},
		404: {
			content: { "application/json": { schema: ErrorResponseSchema } },
			description: "City not found",
		},
	},
});

app.openapi(trainsRoute, async (c) => {
	const { city } = c.req.valid("param");
	const provider = getProvider(city);
	if (!provider) {
		return c.json({ error: "City not found" }, 404);
	}
	const trains = await provider.getTrains();
	return c.json({ city, trains, timestamp: Date.now() }, 200);
});

export default app;
