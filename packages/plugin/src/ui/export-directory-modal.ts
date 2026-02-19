import { Modal, Notice, Setting, type App } from "obsidian";

export function promptExportDirectory(app: App, initialValue: string): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new ExportDirectoryModal(app, initialValue, resolve);
		modal.open();
	});
}

class ExportDirectoryModal extends Modal {
	private value: string;
	private readonly resolve: (value: string | null) => void;
	private resolved = false;
	private inputEl?: HTMLInputElement;

	constructor(app: App, initialValue: string, resolve: (value: string | null) => void) {
		super(app);
		this.value = initialValue;
		this.resolve = resolve;
	}

	onOpen(): void {
		this.titleEl.setText("Select export folder");
		this.contentEl.createEl("p", {
			text: "Paste the absolute path to the folder that contains conversations.json and attachment files."
		});
		this.contentEl.createEl("p", {
			text: "You can also select a folder with the browse button."
		});
		this.contentEl.createEl("p", {
			text: "Example paths: /path/to/chatgpt-export, c:\\\\path\\\\to\\\\chatgpt-export"
		});

		const inputSetting = new Setting(this.contentEl)
			.setName("Export directory")
			.setDesc("Absolute path only (not relative to the vault).")
			.addText((text) => {
				text.setPlaceholder("/path/to/chatgpt-export")
					.setValue(this.value)
					.onChange((value) => {
						this.value = value.trim();
					});
				this.inputEl = text.inputEl;
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						this.submit();
					}
				});
			});

		inputSetting.addButton((button) => {
			button.setButtonText("Browse...");
			button.onClick(async () => {
				const selected = await this.pickDirectory();
				if (!selected) return;
				this.value = selected;
				if (this.inputEl) {
					this.inputEl.value = selected;
				}
			});
		});

		inputSetting.controlEl.addClass("ai-history-importer__path-input");

		const buttonRow = this.contentEl.createDiv({ cls: "ai-history-importer__modal-buttons" });
		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.resolveOnce(null);
			this.close();
		});

		const importButton = buttonRow.createEl("button", { text: "Import" });
		importButton.addClass("mod-cta");
		importButton.addEventListener("click", () => this.submit());
		importButton.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolveOnce(null);
	}

	private resolveOnce(value: string | null): void {
		if (this.resolved) return;
		this.resolved = true;
		this.resolve(value);
	}

	private submit(): void {
		const trimmed = this.value.trim();
		if (!trimmed) {
			new Notice("Export directory is empty.");
			return;
		}
		this.resolveOnce(trimmed);
		this.close();
	}

	private async pickDirectory(): Promise<string | null> {
		const dialog = getElectronDialog();
		if (!dialog?.showOpenDialog) {
			new Notice("Folder picker is not available in this environment.");
			return null;
		}
		try {
			const result = await dialog.showOpenDialog({
				properties: ["openDirectory"]
			});
			if (!result || result.canceled || result.filePaths.length === 0) return null;
			return result.filePaths[0] ?? null;
		} catch (error) {
			new Notice(
				`Failed to open folder picker: ${error instanceof Error ? error.message : String(error)}`
			);
			return null;
		}
	}
}

type OpenDialogResult = { canceled: boolean; filePaths: string[] };
type ElectronDialog = {
	showOpenDialog: (options: {
		properties: string[];
	}) => Promise<OpenDialogResult> | OpenDialogResult;
};

function getElectronDialog(): ElectronDialog | null {
	const win = window as unknown as {
		electron?: { dialog?: ElectronDialog };
		require?: (name: string) => {
			dialog?: ElectronDialog;
			remote?: { dialog?: ElectronDialog };
		};
	};
	if (win.electron?.dialog) return win.electron.dialog;
	const electron = win.require?.("electron");
	return electron?.dialog ?? electron?.remote?.dialog ?? null;
}
