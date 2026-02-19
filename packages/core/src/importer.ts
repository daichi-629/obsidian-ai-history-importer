import { DEFAULT_MARKDOWN_TEMPLATE, renderConversationMarkdown } from "./template";
import type { ConversationRecord } from "./types";
import { buildAttachmentFileName, buildConversationFileName, isImageMimeType } from "./path-utils";
import type { ExportSource, ImportTarget, VaultPathApi } from "./io";

export interface ImportOptions {
	notesDirectory: string;
	attachmentsDirectory: string;
	overwriteOnReimport: boolean;
	customTemplatePath?: string;
}

export interface ImportResult {
	imported: number;
	skipped: number;
	errors: string[];
}

export interface ImportContext {
	source: ExportSource;
	target: ImportTarget;
	vaultPath: VaultPathApi;
}

function normalizeVaultPath(vaultPath: VaultPathApi, input: string): string {
	return vaultPath.normalize(input).replace(/^\/+/g, "").trim();
}

async function ensureVaultFolder(
	target: ImportTarget,
	vaultPath: VaultPathApi,
	dirPath: string
): Promise<void> {
	const normalized = normalizeVaultPath(vaultPath, dirPath);
	if (!normalized) return;

	const parts = normalized.split("/").filter(Boolean);
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!(await target.exists(current))) {
			await target.createFolder(current);
		}
	}
}

function extractConversationId(markdown: string): string | undefined {
	if (!markdown.startsWith("---")) return;
	const endIndex = markdown.indexOf("\n---", 3);
	if (endIndex === -1) return;
	const block = markdown.slice(3, endIndex).split("\n");
	for (const line of block) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("ai_conversation_id:")) continue;
		const value = trimmed.split(":").slice(1).join(":").trim();
		return value.replace(/^["']/, "").replace(/["']$/, "");
	}
}

async function findExistingNoteByConversationId(
	target: ImportTarget,
	vaultPath: VaultPathApi,
	conversationId: string,
	notesDirectory: string
): Promise<string | undefined> {
	const files = await target.listMarkdownFiles();
	const normalizedDir = normalizeVaultPath(vaultPath, notesDirectory);
	const preferred: typeof files = [];
	const fallback: typeof files = [];

	for (const file of files) {
		if (!normalizedDir) {
			fallback.push(file);
		} else if (file.path === normalizedDir || file.path.startsWith(`${normalizedDir}/`)) {
			preferred.push(file);
		} else {
			fallback.push(file);
		}
	}

	const candidates = preferred.length > 0 ? [...preferred, ...fallback] : fallback;
	for (const file of candidates) {
		const content = await target.readText(file.path);
		const found = extractConversationId(content);
		if (found === conversationId) return file.path;
	}
}

async function ensureUniqueVaultPath(
	target: ImportTarget,
	initialPath: string
): Promise<string> {
	if (!(await target.exists(initialPath))) return initialPath;

	const base = initialPath.replace(/\.md$/, "");
	let i = 2;
	while (true) {
		const candidate = `${base}-${i}.md`;
		if (!(await target.exists(candidate))) return candidate;
		i += 1;
	}
}

async function ensureUniqueFilePath(
	target: ImportTarget,
	initialPath: string
): Promise<string> {
	if (!(await target.exists(initialPath))) return initialPath;
	const extIndex = initialPath.lastIndexOf(".");
	const hasExt = extIndex > -1;
	const base = hasExt ? initialPath.slice(0, extIndex) : initialPath;
	const ext = hasExt ? initialPath.slice(extIndex) : "";

	let i = 2;
	while (true) {
		const candidate = `${base}-${i}${ext}`;
		if (!(await target.exists(candidate))) return candidate;
		i += 1;
	}
}

function relativeLinkPath(vaultPath: VaultPathApi, targetPath: string): string {
	return vaultPath.normalize(targetPath);
}

async function loadTemplate(
	source: ExportSource,
	options: ImportOptions
): Promise<string> {
	const customPath = options.customTemplatePath?.trim();
	if (!customPath) return DEFAULT_MARKDOWN_TEMPLATE;
	return source.readText(customPath);
}

async function mergeConversationAttachments(
	conversation: ConversationRecord,
	options: ImportOptions,
	context: ImportContext
): Promise<void> {
	const attachmentsRoot = normalizeVaultPath(
		context.vaultPath,
		options.attachmentsDirectory
	);
	if (attachmentsRoot) {
		await ensureVaultFolder(context.target, context.vaultPath, attachmentsRoot);
	}
	const copiedById = new Map<string, string>();

	for (const message of conversation.messages) {
		if (message.attachments.length === 0) continue;
		for (const attachment of message.attachments) {
			if (!attachment.sourcePath) continue;

			let targetRelativePath = copiedById.get(attachment.id);
			if (!targetRelativePath) {
				const fileName = buildAttachmentFileName(
					attachment.name,
					attachment.sourcePath,
					attachment.id
				);
				const initialPath = attachmentsRoot
					? context.vaultPath.join(attachmentsRoot, fileName)
					: fileName;
				let finalPath = initialPath;
				if (await context.target.exists(initialPath)) {
					if (options.overwriteOnReimport) {
						const data = await context.source.readBinary(attachment.sourcePath);
						await ensureVaultFolder(
							context.target,
							context.vaultPath,
							context.vaultPath.dirname(initialPath)
						);
						await context.target.writeBinary(initialPath, data);
					} else {
						finalPath = await ensureUniqueFilePath(context.target, initialPath);
						const data = await context.source.readBinary(attachment.sourcePath);
						await ensureVaultFolder(
							context.target,
							context.vaultPath,
							context.vaultPath.dirname(finalPath)
						);
						await context.target.writeBinary(finalPath, data);
					}
				} else {
					const data = await context.source.readBinary(attachment.sourcePath);
					await ensureVaultFolder(
						context.target,
						context.vaultPath,
						context.vaultPath.dirname(initialPath)
					);
					await context.target.writeBinary(initialPath, data);
				}
				targetRelativePath = relativeLinkPath(context.vaultPath, finalPath);
				copiedById.set(attachment.id, targetRelativePath);
			}

			attachment.vaultPath = targetRelativePath;
			attachment.obsidianLink = isImageMimeType(attachment.mimeType)
				? `![[${relativeLinkPath(context.vaultPath, targetRelativePath)}]]`
				: `[[${relativeLinkPath(context.vaultPath, targetRelativePath)}]]`;
		}
	}
}

async function upsertNote(
	target: ImportTarget,
	vaultPath: VaultPathApi,
	options: ImportOptions,
	conversation: ConversationRecord,
	markdown: string
): Promise<{ path: string; skipped: boolean }> {
	const fileName = buildConversationFileName(conversation.title, conversation.conversationId);
	const requestedPath = normalizeVaultPath(
		vaultPath,
		vaultPath.join(options.notesDirectory, fileName)
	);
	await ensureVaultFolder(target, vaultPath, options.notesDirectory);
	const existing = await target.exists(requestedPath);
	if (existing) {
		if (!options.overwriteOnReimport) {
			return { path: requestedPath, skipped: true };
		}
		await target.writeText(requestedPath, markdown);
		return { path: requestedPath, skipped: false };
	}

	const byIdPath = await findExistingNoteByConversationId(
		target,
		vaultPath,
		conversation.conversationId,
		options.notesDirectory
	);
	if (byIdPath) {
		if (!options.overwriteOnReimport) {
			return { path: byIdPath, skipped: true };
		}
		await target.writeText(byIdPath, markdown);
		return { path: byIdPath, skipped: false };
	}

	const finalPath = await ensureUniqueVaultPath(target, requestedPath);
	await ensureVaultFolder(target, vaultPath, vaultPath.dirname(finalPath));
	await target.writeText(finalPath, markdown);
	return { path: finalPath, skipped: false };
}

export async function importConversationRecords(
	conversations: ConversationRecord[],
	options: ImportOptions,
	context: ImportContext
): Promise<ImportResult> {
	const template = await loadTemplate(context.source, options);
	await ensureVaultFolder(context.target, context.vaultPath, options.notesDirectory);

	const errors: string[] = [];
	let imported = 0;
	let skipped = 0;

	for (const conversation of conversations) {
		try {
			await mergeConversationAttachments(conversation, options, context);
			const markdown = renderConversationMarkdown(conversation, template);
			const result = await upsertNote(
				context.target,
				context.vaultPath,
				options,
				conversation,
				markdown
			);
			if (result.skipped) {
				skipped += 1;
			} else {
				imported += 1;
			}
		} catch (error) {
			errors.push(
				`${conversation.conversationId}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	return { imported, skipped, errors };
}
