import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import cities from "./routes/cities.js";
import stations from "./routes/stations.js";
import trains from "./routes/trains.js";

const app = new OpenAPIHono();

app.use("*", cors());

app.route("/v1/cities", cities);
app.route("/v1/:city/trains", trains);
app.route("/v1/:city/stations", stations);

app.doc("/openapi.json", {
	openapi: "3.1.0",
	info: {
		title: "Undergrid API",
		version: "0.1.0",
		description: "Public API for live transit and urban data",
	},
});

app.get("/docs", (c) => {
	return c.html(`<!DOCTYPE html>
<html>
<head>
	<title>Undergrid API Docs</title>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<script id="api-reference" data-url="/openapi.json"></script>
	<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

export type AppType = typeof app;

export default app;
