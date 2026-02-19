import { Plugin, Notice } from "obsidian";
import { buildGreeting } from "@sample/core";

export default class SampleMonorepoPlugin extends Plugin {
	async onload() {
		const message = buildGreeting({ name: "Obsidian" });
		this.addCommand({
			id: "sample-monorepo-greeting",
			name: "Show greeting",
			callback: () => new Notice(message)
		});
	}
}
