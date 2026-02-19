import { Notice, Plugin } from "obsidian";
import { importChatGptHistory } from "./importer";
import { DEFAULT_SETTINGS, EMPTY_IMPORT_STATE, type ImportState, type ImporterPluginSettings } from "./settings";
import { ImporterSettingTab } from "./settings-tab";

interface PersistedData {
	settings?: Partial<ImporterPluginSettings>;
	state?: ImportState;
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
	if (isObject(raw.state)) {
		const conversations = isObject(raw.state.conversations)
			? (raw.state.conversations as ImportState["conversations"])
			: {};
		data.state = { conversations };
	}
	return data;
}

export default class ImporterPlugin extends Plugin {
	settings: ImporterPluginSettings = { ...DEFAULT_SETTINGS };
	state: ImportState = { ...EMPTY_IMPORT_STATE };

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
			const adapter = this.app.vault.adapter;
			const desktopAdapter = adapter as { getBasePath?: () => string };
			let vaultBasePath = "";
			if (typeof desktopAdapter.getBasePath === "function") {
				const maybeBasePath = desktopAdapter.getBasePath();
				if (typeof maybeBasePath === "string") {
					vaultBasePath = maybeBasePath;
				}
			}
			if (!vaultBasePath) {
				throw new Error("This plugin currently supports desktop vaults only");
			}

			const result = await importChatGptHistory({
				vault: this.app.vault,
				vaultBasePath,
				settings: this.settings,
				stateRef: { state: this.state }
			});
			await this.saveSettings();

			if (result.errors.length > 0) {
				new Notice(
					`Import finished: imported=${result.imported}, skipped=${result.skipped}, errors=${result.errors.length}`,
					10000
				);
				console.error("[obsidian-ai-history-importer] import errors", result.errors);
			} else {
				new Notice(`Import finished: imported=${result.imported}, skipped=${result.skipped}`);
			}
		} catch (error) {
			new Notice(`Import failed: ${error instanceof Error ? error.message : String(error)}`, 12000);
			console.error("[obsidian-ai-history-importer] import failed", error);
		}
	}

	async loadSettings(): Promise<void> {
		const raw = normalizePersistedData(await this.loadData());
		this.settings = {
			...DEFAULT_SETTINGS,
			...(raw?.settings ?? {})
		};
		this.state = {
			...EMPTY_IMPORT_STATE,
			...(raw?.state ?? {}),
			conversations: {
				...(raw?.state?.conversations ?? {})
			}
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			state: this.state
		});
	}
}
