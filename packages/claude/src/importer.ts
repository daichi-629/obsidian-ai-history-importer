import type {
	ExportPathApi,
	ExportSource,
	ImportOptions,
	ImportResult,
	ImportTarget,
	VaultPathApi
} from "@obsidian-ai-history-importer/core";
import { importConversationRecords } from "@obsidian-ai-history-importer/core";
import { parseClaudeConversations } from "./parser";
import type { ClaudeConversation } from "./types";

export interface ClaudeImportOptions extends ImportOptions {
	exportDir: string;
	includeSystemMessages?: boolean;
	excludeThinking?: boolean;
}

async function readConversationsFile(
	exportDir: string,
	source: ExportSource,
	exportPath: ExportPathApi
): Promise<ClaudeConversation[]> {
	const filePath = exportPath.join(exportDir, "conversations.json");
	const raw = await source.readText(filePath);
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed)) {
		throw new Error("conversations.json is not an array");
	}
	return parsed as ClaudeConversation[];
}


export async function importClaudeExport(params: {
	options: ClaudeImportOptions;
	source: ExportSource;
	target: ImportTarget;
	exportPath: ExportPathApi;
	vaultPath: VaultPathApi;
}): Promise<ImportResult> {
	const { options, source, target, exportPath, vaultPath } = params;
	const trimmedExportDir = options.exportDir.trim();
	if (!trimmedExportDir) {
		throw new Error("Export directory is empty");
	}

	const conversations = await readConversationsFile(trimmedExportDir, source, exportPath);
	const parsed = parseClaudeConversations(conversations, {
		includeSystemMessages: options.includeSystemMessages,
		excludeThinking: options.excludeThinking
	});

	return importConversationRecords(parsed, options, {
		source,
		target,
		vaultPath
	});
}
