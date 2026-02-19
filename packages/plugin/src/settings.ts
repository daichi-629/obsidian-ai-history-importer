export interface ImporterPluginSettings {
	notesDirectory: string;
	claudeNotesDirectory: string;
	attachmentsDirectory: string;
	customTemplatePath: string;
	includeSystemMessages: boolean;
	includeHiddenMessages: boolean;
	overwriteOnReimport: boolean;
}

export const DEFAULT_SETTINGS: ImporterPluginSettings = {
	notesDirectory: "AI Chat History/ChatGPT",
	claudeNotesDirectory: "AI Chat History/Claude",
	attachmentsDirectory: "AI Chat History/Attachments",
	customTemplatePath: "",
	includeSystemMessages: false,
	includeHiddenMessages: false,
	overwriteOnReimport: true
};
