import type { ConversationMessage, ConversationRecord } from "@obsidian-ai-history-importer/core";
import type { ClaudeConversation, ClaudeMessage } from "./types";

export interface ParseOptions {
	includeSystemMessages?: boolean;
	excludeThinking?: boolean;
	thinkingSeparator?: string;
}

function normalizeTimestamp(value?: string | null): string | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toISOString();
}

const DEFAULT_THINKING_SEPARATOR = "---";

function normalizeContentText(value?: string | null): string {
	if (typeof value !== "string") return "";
	return value.trim();
}

function extractMessageText(message: ClaudeMessage, options: ParseOptions): string {
	const excludeThinking = options.excludeThinking ?? false;
	const thinkingSeparator = options.thinkingSeparator ?? DEFAULT_THINKING_SEPARATOR;

	if (Array.isArray(message.content)) {
		const parts: string[] = [];
		let lastKind: "thinking" | "text" | undefined;

		for (const entry of message.content) {
			const rawType = entry?.type;
			const kind =
				rawType === "thinking"
					? "thinking"
					: rawType === "text" || !rawType
						? "text"
						: "other";

			if (kind === "thinking") {
				if (excludeThinking) continue;
				const thinkingText =
					normalizeContentText(entry.thinking) || normalizeContentText(entry.text);
				if (!thinkingText) continue;
				if (lastKind && lastKind !== "thinking") {
					parts.push(thinkingSeparator);
				}
				parts.push(thinkingText);
				lastKind = "thinking";
				continue;
			}

			const text = normalizeContentText(entry?.text);
			if (!text) continue;
			if (kind === "text" && lastKind && lastKind !== "text") {
				parts.push(thinkingSeparator);
			}
			parts.push(text);
			lastKind = kind === "text" ? "text" : undefined;
		}

		if (parts.length > 0) return parts.join("\n\n").trim();
	}

	if (typeof message.text === "string") {
		const trimmed = message.text.trim();
		if (trimmed.length > 0) return trimmed;
	}

	return "";
}

function mapRole(sender?: string): ConversationMessage["role"] {
	switch (sender) {
		case "human":
			return "user";
		case "assistant":
			return "assistant";
		case "system":
			return "system";
		default:
			return "unknown";
	}
}

function mapMessage(
	message: ClaudeMessage,
	includeSystemMessages: boolean,
	options: ParseOptions
): ConversationMessage | null {
	if (!message.uuid) return null;
	const role = mapRole(message.sender);
	if (!includeSystemMessages && role === "system") return null;

	return {
		id: message.uuid,
		role,
		createdAt: normalizeTimestamp(message.created_at),
		content: extractMessageText(message, options),
		contentType: message.content?.[0]?.type,
		attachments: []
	};
}

export function parseClaudeConversations(
	conversations: ClaudeConversation[],
	options: ParseOptions
): ConversationRecord[] {
	const includeSystemMessages = options.includeSystemMessages ?? false;
	const seenConversationKeys = new Set<string>();

	const output: ConversationRecord[] = [];
	for (const conversation of conversations) {
		const conversationId = conversation.uuid;
		if (!conversationId) continue;

		const importKey = `claude:${conversationId}`;
		if (seenConversationKeys.has(importKey)) continue;
		seenConversationKeys.add(importKey);

		const messages = (conversation.chat_messages ?? [])
			.map((message) => mapMessage(message, includeSystemMessages, options))
			.filter((message): message is ConversationMessage => Boolean(message))
			.filter((message) => message.content.length > 0);

		if (messages.length === 0) continue;

		output.push({
			source: "claude",
			conversationId,
			importKey,
			title:
				(conversation.name || "Untitled conversation").trim() || "Untitled conversation",
			createdAt: normalizeTimestamp(conversation.created_at),
			updatedAt: normalizeTimestamp(conversation.updated_at),
			messages
		});
	}

	return output;
}
