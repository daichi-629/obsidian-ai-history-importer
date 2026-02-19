import { Notice, Plugin } from "obsidian";
import { importChatGptHistory } from "./importer";
import { DEFAULT_SETTINGS, type ImporterPluginSettings } from "./settings";
import { ImporterSettingTab } from "./settings-tab";
import { promptExportDirectory } from "./ui/export-directory-modal";

interface PersistedData {
	settings?: Partial<ImporterPluginSettings>;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizePersistedData(raw: unknown): PersistedData {
	if (!isObject(raw)) return {};
	const data: PersistedData = {};
	if (isObject(raw.settings)) {
		data.settings = raw.settings as Partial<ImporterPluginSettings>;
	}
	return data;
}

export default class ImporterPlugin extends Plugin {
	settings: ImporterPluginSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ImporterSettingTab(this.app, this));

		this.addCommand({
			id: "import-chatgpt-history",
			name: "Import chat history",
			callback: async () => {
				await this.runImport();
			}
		});
	}

	async runImport(): Promise<void> {
		try {
			const exportDirectory = await promptExportDirectory(this.app, "");
			if (!exportDirectory) {
				return;
			}

			const result = await importChatGptHistory({
				vault: this.app.vault,
				exportDirectory,
				settings: this.settings
			});
			await this.saveSettings();

			if (result.errors.length > 0) {
				new Notice(
					`Import finished: imported=${result.imported}, skipped=${result.skipped}, errors=${result.errors.length}`,
					10000
				);
				console.error("[obsidian-ai-history-importer] import errors", result.errors);
			} else {
				new Notice(
					`Import finished: imported=${result.imported}, skipped=${result.skipped}`
				);
			}
		} catch (error) {
			new Notice(
				`Import failed: ${error instanceof Error ? error.message : String(error)}`,
				12000
			);
			console.error("[obsidian-ai-history-importer] import failed", error);
		}
	}

	async loadSettings(): Promise<void> {
		const raw = normalizePersistedData(await this.loadData());
		this.settings = {
			...DEFAULT_SETTINGS,
			...(raw?.settings ?? {})
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			settings: this.settings
		});
	}
}
