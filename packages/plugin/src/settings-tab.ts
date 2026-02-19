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

		new Setting(containerEl).setHeading().setName("Common");

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
			.setName("Overwrite on reimport")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("If a known conversation changes, update the existing markdown file.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.overwriteOnReimport)
					.onChange(async (value) => {
						this.plugin.settings.overwriteOnReimport = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setHeading()
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName("ChatGPT");

		new Setting(containerEl)
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setName("ChatGPT notes directory")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("Store ChatGPT markdown conversation files in this vault folder.")
			.addText((text) =>
				text.setValue(this.plugin.settings.notesDirectory).onChange(async (value) => {
					this.plugin.settings.notesDirectory = value.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Include system messages").addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.includeSystemMessages).onChange(async (value) => {
				this.plugin.settings.includeSystemMessages = value;
				await this.plugin.saveSettings();
			})
		);

		new Setting(containerEl)
			.setName("Include hidden messages")
			.setDesc("Includes messages flagged as visually hidden in the export")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeHiddenMessages)
					.onChange(async (value) => {
						this.plugin.settings.includeHiddenMessages = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Exclude reasoning messages")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc('Skips ChatGPT messages with content type "thoughts".')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.excludeThoughts).onChange(async (value) => {
					this.plugin.settings.excludeThoughts = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude tool call payloads")
			.setDesc("Skips tool input JSON blocks (search_query, open, screenshot, etc.)")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.excludeToolCalls).onChange(async (value) => {
					this.plugin.settings.excludeToolCalls = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Exclude thinking time lines")
			.setDesc('Skips messages like "思考時間: 2m 54s"')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.excludeThoughtTime).onChange(async (value) => {
					this.plugin.settings.excludeThoughtTime = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setHeading().setName("Claude");

		new Setting(containerEl)
			.setName("Claude notes directory")
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			.setDesc("Store Claude markdown conversation files in this vault folder.")
			.addText((text) =>
				text.setValue(this.plugin.settings.claudeNotesDirectory).onChange(async (value) => {
					this.plugin.settings.claudeNotesDirectory = value.trim();
					await this.plugin.saveSettings();
				})
			);
	}
}
