import path from "node:path"
import { defineConfig } from "vite"
import eslintPlugin from "vite-plugin-eslint"

export default defineConfig( {
	server: {
		host: true,
	},
	build: {
		target: "esnext",
		chunkSizeWarningLimit: 2048,
	},
	resolve: {
		alias: {
			"@app": path.resolve( import.meta.dirname, "./src/app" ),
			"@css": path.resolve( import.meta.dirname, "./src/css" ),
			"@lib": path.resolve( import.meta.dirname, "./src/library" ),
		},
	},
	plugins: [
		eslintPlugin(),
	]
} )
