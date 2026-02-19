export interface ImporterPluginSettings {
	notesDirectory: string;
	attachmentsDirectory: string;
	customTemplatePath: string;
	includeSystemMessages: boolean;
	includeHiddenMessages: boolean;
	overwriteOnReimport: boolean;
}

export const DEFAULT_SETTINGS: ImporterPluginSettings = {
	notesDirectory: "AI Chat History/ChatGPT",
	attachmentsDirectory: "AI Chat History/Attachments",
	customTemplatePath: "",
	includeSystemMessages: false,
	includeHiddenMessages: false,
	overwriteOnReimport: true
};
