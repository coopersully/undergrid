import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
function geojsonPlugin() {
	return {
		name: "geojson",
		transform(_code: string, id: string) {
			if (id.endsWith(".geojson")) {
				return { code: `export default ${_code}`, map: null };
			}
		},
	};
}

export default defineConfig({
	plugins: [geojsonPlugin(), react(), cloudflare()],
	server: {
		proxy: {
			"/v1": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
});
