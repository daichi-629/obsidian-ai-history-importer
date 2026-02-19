import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
	resolve: {
		alias: {
			"@obsidian-ai-history-importer/core": fileURLToPath(
				new URL("../core/src/index.ts", import.meta.url)
			)
		}
	},
	test: {
		include: ["__tests__/**/*.test.ts"]
	}
});
