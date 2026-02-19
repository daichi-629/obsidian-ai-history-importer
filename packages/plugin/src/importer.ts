import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizePath, type Vault } from "obsidian";
import { DEFAULT_MARKDOWN_TEMPLATE, renderConversationMarkdown, type ConversationRecord } from "@sample/core";
import { parseChatGptConversations, type ChatGptConversation } from "@sample/chatgpt";
import type { ImportState, ImporterPluginSettings } from "./settings";
import { buildAttachmentFileName, buildConversationFileName, isImageMimeType } from "./path-utils";

interface ImportResult {
	imported: number;
	skipped: number;
	errors: string[];
}

interface MutableState {
	state: ImportState;
}

function readConversationsFile(exportDirectory: string): ChatGptConversation[] {
	const filePath = join(exportDirectory, "conversations.json");
	const raw = readFileSync(filePath, "utf8");
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed)) {
		throw new Error("conversations.json is not an array");
	}
	return parsed as ChatGptConversation[];
}

function ensureDirectory(path: string): void {
	mkdirSync(path, { recursive: true });
}

function ensureUniqueVaultPath(vault: Vault, initialPath: string): string {
	if (!vault.getAbstractFileByPath(initialPath)) return initialPath;

	const base = initialPath.replace(/\.md$/, "");
	let i = 2;
	while (true) {
		const candidate = `${base}-${i}.md`;
		if (!vault.getAbstractFileByPath(candidate)) return candidate;
		i += 1;
	}
}

function ensureUniqueFilePath(initialPath: string): string {
	if (!existsSync(initialPath)) return initialPath;
	const extIndex = initialPath.lastIndexOf(".");
	const hasExt = extIndex > -1;
	const base = hasExt ? initialPath.slice(0, extIndex) : initialPath;
	const ext = hasExt ? initialPath.slice(extIndex) : "";

	let i = 2;
	while (true) {
		const candidate = `${base}-${i}${ext}`;
		if (!existsSync(candidate)) return candidate;
		i += 1;
	}
}

function relativeLinkPath(targetPath: string): string {
	return normalizePath(targetPath);
}

function loadTemplate(settings: ImporterPluginSettings): string {
	if (!settings.customTemplatePath.trim()) return DEFAULT_MARKDOWN_TEMPLATE;
	return readFileSync(settings.customTemplatePath.trim(), "utf8");
}

function mergeConversationAttachments(
	conversation: ConversationRecord,
	settings: ImporterPluginSettings,
	vaultBasePath: string
): void {
	const attachmentsRoot = join(vaultBasePath, normalizePath(settings.attachmentsDirectory));
	ensureDirectory(attachmentsRoot);
	const copiedById = new Map<string, string>();

	for (const message of conversation.messages) {
		for (const attachment of message.attachments) {
			if (!attachment.sourcePath) continue;

			let targetRelativePath = copiedById.get(attachment.id);
			if (!targetRelativePath) {
				const fileName = buildAttachmentFileName(attachment.name, attachment.sourcePath, attachment.id);
				const initialAbsPath = join(attachmentsRoot, fileName);
				let finalAbsPath = initialAbsPath;
				if (!existsSync(initialAbsPath)) {
					finalAbsPath = ensureUniqueFilePath(initialAbsPath);
					ensureDirectory(dirname(finalAbsPath));
					copyFileSync(attachment.sourcePath, finalAbsPath);
				}
				targetRelativePath = normalizePath(join(settings.attachmentsDirectory, finalAbsPath.slice(attachmentsRoot.length + 1)));
				copiedById.set(attachment.id, targetRelativePath);
			}

			attachment.vaultPath = targetRelativePath;
			attachment.obsidianLink = isImageMimeType(attachment.mimeType)
				? `![[${relativeLinkPath(targetRelativePath)}]]`
				: `[[${relativeLinkPath(targetRelativePath)}]]`;
		}
	}
}

function shouldSkipByState(state: ImportState, conversation: ConversationRecord): boolean {
	const existing = state.conversations[conversation.importKey];
	if (!existing) return false;
	if (!existing.updatedAt || !conversation.updatedAt) return true;
	return existing.updatedAt === conversation.updatedAt;
}

async function upsertNote(
	vault: Vault,
	settings: ImporterPluginSettings,
	conversation: ConversationRecord,
	markdown: string,
	existingPath?: string
): Promise<string> {
	if (existingPath) {
		const existing = vault.getAbstractFileByPath(existingPath);
		if (existing && "path" in existing && settings.overwriteOnReimport) {
			await vault.modify(existing, markdown);
			return existingPath;
		}
	}

	const fileName = buildConversationFileName(conversation.title, conversation.conversationId);
	const requestedPath = normalizePath(join(settings.notesDirectory, fileName));
	const finalPath = ensureUniqueVaultPath(vault, requestedPath);
	await vault.create(finalPath, markdown);
	return finalPath;
}

export async function importChatGptHistory(params: {
	vault: Vault;
	vaultBasePath: string;
	settings: ImporterPluginSettings;
	stateRef: MutableState;
}): Promise<ImportResult> {
	const { vault, vaultBasePath, settings, stateRef } = params;
	if (!settings.exportDirectory.trim()) {
		throw new Error("Export directory is empty");
	}
	const exportDirectory = settings.exportDirectory.trim();
	const conversations = readConversationsFile(exportDirectory);
	const template = loadTemplate(settings);
	const parsed = parseChatGptConversations(conversations, {
		exportDir: exportDirectory,
		includeSystemMessages: settings.includeSystemMessages,
		includeHiddenMessages: settings.includeHiddenMessages
	});

	const errors: string[] = [];
	let imported = 0;
	let skipped = 0;

	for (const conversation of parsed) {
		try {
			if (shouldSkipByState(stateRef.state, conversation)) {
				skipped += 1;
				continue;
			}

			mergeConversationAttachments(conversation, settings, vaultBasePath);
			const markdown = renderConversationMarkdown(conversation, template);
			const existing = stateRef.state.conversations[conversation.importKey];
			const notePath = await upsertNote(vault, settings, conversation, markdown, existing?.notePath);

			stateRef.state.conversations[conversation.importKey] = {
				conversationId: conversation.conversationId,
				importKey: conversation.importKey,
				notePath,
				updatedAt: conversation.updatedAt,
				importedAt: new Date().toISOString()
			};
			imported += 1;
		} catch (error) {
			errors.push(
				`${conversation.conversationId}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	return { imported, skipped, errors };
}
