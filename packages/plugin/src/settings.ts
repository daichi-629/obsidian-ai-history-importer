export interface ImporterPluginSettings {
	exportDirectory: string;
	notesDirectory: string;
	attachmentsDirectory: string;
	customTemplatePath: string;
	includeSystemMessages: boolean;
	includeHiddenMessages: boolean;
	overwriteOnReimport: boolean;
}

export const DEFAULT_SETTINGS: ImporterPluginSettings = {
	exportDirectory: "",
	notesDirectory: "AI Chat History/ChatGPT",
	attachmentsDirectory: "AI Chat History/Attachments",
	customTemplatePath: "",
	includeSystemMessages: false,
	includeHiddenMessages: false,
	overwriteOnReimport: true
};

export interface ImportStateItem {
	conversationId: string;
	importKey: string;
	notePath: string;
	updatedAt?: string;
	importedAt: string;
}

export interface ImportState {
	conversations: Record<string, ImportStateItem>;
}

export const EMPTY_IMPORT_STATE: ImportState = {
	conversations: {}
};
