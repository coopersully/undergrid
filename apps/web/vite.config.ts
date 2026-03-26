import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), cloudflare()],
	server: {
		proxy: {
			"/v1": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
});
