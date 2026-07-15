import type {
	ExportPathApi,
	ExportSource,
	ImportOptions,
	ImportResult,
	ImportTarget,
	VaultPathApi
} from "@obsidian-ai-history-importer/core";
import { importConversationRecords } from "@obsidian-ai-history-importer/core";
import { parseChatGptConversations, type AttachmentPathResolver } from "./parser";
import type { ChatGptConversation } from "./types";

export interface ChatGptImportOptions extends ImportOptions {
	exportDir: string;
	includeSystemMessages?: boolean;
	includeHiddenMessages?: boolean;
	excludeThoughts?: boolean;
	excludeToolCalls?: boolean;
	excludeThoughtTime?: boolean;
	attachmentScanDepth?: number;
}

interface AttachmentIndexEntry {
	name: string;
	path: string;
}

interface ExportManifestLogicalFile {
	files?: unknown;
}

interface ExportManifest {
	logical_files?: Record<string, ExportManifestLogicalFile>;
}

async function readConversationsFile(
	exportDir: string,
	source: ExportSource,
	exportPath: ExportPathApi
): Promise<ChatGptConversation[]> {
	const filePath = exportPath.join(exportDir, "conversations.json");
	if (await source.exists(filePath)) {
		const raw = await source.readText(filePath);
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			throw new Error("conversations.json is not an array");
		}
		return parsed as ChatGptConversation[];
	}

	const shardPaths = await resolveConversationShardPaths(exportDir, source, exportPath);
	if (shardPaths.length === 0) {
		throw new Error("Missing conversations.json");
	}

	const conversations: ChatGptConversation[] = [];
	for (const shardPath of shardPaths) {
		const raw = await source.readText(shardPath);
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			throw new Error(`${shardPath} is not an array`);
		}
		conversations.push(...(parsed as ChatGptConversation[]));
	}
	return conversations;
}

async function resolveConversationShardPaths(
	exportDir: string,
	source: ExportSource,
	exportPath: ExportPathApi
): Promise<string[]> {
	const manifestPath = exportPath.join(exportDir, "export_manifest.json");
	if (await source.exists(manifestPath)) {
		const raw = await source.readText(manifestPath);
		const parsed = JSON.parse(raw) as ExportManifest;
		const files = parsed.logical_files?.["conversations.json"]?.files;
		if (Array.isArray(files)) {
			return files
				.filter((file): file is string => typeof file === "string")
				.map((file) => exportPath.join(exportDir, file));
		}
	}

	const entries = await source.listDir(exportDir);
	return entries
		.filter((entry) => entry.isFile && /^conversations-\d+\.json$/.test(entry.name))
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((entry) => entry.path);
}

async function buildAttachmentIndex(
	exportDir: string,
	source: ExportSource,
	maxDepth: number
): Promise<AttachmentIndexEntry[]> {
	const files: AttachmentIndexEntry[] = [];
	const stack: Array<{ dir: string; depth: number }> = [{ dir: exportDir, depth: 0 }];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) break;
		const { dir, depth } = current;
		if (depth > maxDepth) continue;

		const entries = await source.listDir(dir);
		for (const entry of entries) {
			if (entry.name === "node_modules") continue;
			if (entry.isDirectory) {
				stack.push({ dir: entry.path, depth: depth + 1 });
				continue;
			}
			if (!entry.isFile) continue;
			if (entry.name.endsWith(":Zone.Identifier")) continue;
			files.push({ name: entry.name, path: entry.path });
		}
	}

	return files;
}

function createAttachmentResolver(files: AttachmentIndexEntry[]): AttachmentPathResolver {
	const cache = new Map<string, string | undefined>();
	return (attachment) => {
		const cached = cache.get(attachment.id);
		if (cached !== undefined || cache.has(attachment.id)) return cached;

		for (const entry of files) {
			if (
				entry.name.startsWith(attachment.id) &&
				(entry.name.length === attachment.id.length ||
					entry.name[attachment.id.length] === "-" ||
					entry.name[attachment.id.length] === ".")
			) {
				cache.set(attachment.id, entry.path);
				return entry.path;
			}
		}

		cache.set(attachment.id, undefined);
		return undefined;
	};
}

export async function importChatGptExport(params: {
	options: ChatGptImportOptions;
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
	const scanDepth = options.attachmentScanDepth ?? 6;
	const attachmentIndex = await buildAttachmentIndex(trimmedExportDir, source, scanDepth);
	const resolveAttachmentPath = createAttachmentResolver(attachmentIndex);

	const parsed = parseChatGptConversations(conversations, {
		includeSystemMessages: options.includeSystemMessages,
		includeHiddenMessages: options.includeHiddenMessages,
		excludeThoughts: options.excludeThoughts,
		excludeToolCalls: options.excludeToolCalls,
		excludeThoughtTime: options.excludeThoughtTime,
		resolveAttachmentPath
	});

	return importConversationRecords(parsed, options, {
		source,
		target,
		vaultPath
	});
}
