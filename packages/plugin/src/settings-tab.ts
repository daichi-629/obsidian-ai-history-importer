import { PluginSettingTab, Setting, type App } from "obsidian";
import type ImporterPlugin from "./main";

export class ImporterSettingTab extends PluginSettingTab {
	private readonly plugin: ImporterPlugin;

	constructor(app: App, plugin: ImporterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Export directory")
			.setDesc("Directory that contains conversations.json and attachment files")
			.addText((text) =>
				text
					.setPlaceholder("/path/to/chatgpt-export")
					.setValue(this.plugin.settings.exportDirectory)
					.onChange(async (value) => {
						this.plugin.settings.exportDirectory = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Notes directory")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("Store markdown conversation files in this vault folder.")
			.addText((text) =>
				text.setValue(this.plugin.settings.notesDirectory).onChange(async (value) => {
					this.plugin.settings.notesDirectory = value.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Attachments directory")
			.setDesc("Vault-relative folder where imported attachments are copied")
			.addText((text) =>
				text.setValue(this.plugin.settings.attachmentsDirectory).onChange(async (value) => {
					this.plugin.settings.attachmentsDirectory = value.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Custom template path")
			.setDesc("Optional absolute file path. If empty, default template is used")
			.addText((text) =>
				text.setValue(this.plugin.settings.customTemplatePath).onChange(async (value) => {
					this.plugin.settings.customTemplatePath = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Include system messages")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.includeSystemMessages).onChange(async (value) => {
					this.plugin.settings.includeSystemMessages = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Include hidden messages")
			.setDesc("Includes messages flagged as visually hidden in the export")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.includeHiddenMessages).onChange(async (value) => {
					this.plugin.settings.includeHiddenMessages = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Overwrite on reimport")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("If a known conversation changes, update the existing markdown file.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.overwriteOnReimport).onChange(async (value) => {
					this.plugin.settings.overwriteOnReimport = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
