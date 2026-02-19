import type { ConversationMessage, ConversationRecord } from "@obsidian-ai-history-importer/core";
import type { ClaudeConversation, ClaudeMessage } from "./types";

export interface ParseOptions {
	includeSystemMessages?: boolean;
}

function normalizeTimestamp(value?: string | null): string | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toISOString();
}

function extractMessageText(message: ClaudeMessage): string {
	if (typeof message.text === "string") {
		const trimmed = message.text.trim();
		if (trimmed.length > 0) return trimmed;
	}

	if (Array.isArray(message.content)) {
		const parts = message.content
			.map((entry) => (typeof entry?.text === "string" ? entry.text.trim() : ""))
			.filter((part) => part.length > 0);
		if (parts.length > 0) return parts.join("\n\n").trim();
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
	includeSystemMessages: boolean
): ConversationMessage | null {
	if (!message.uuid) return null;
	const role = mapRole(message.sender);
	if (!includeSystemMessages && role === "system") return null;

	return {
		id: message.uuid,
		role,
		createdAt: normalizeTimestamp(message.created_at),
		content: extractMessageText(message),
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
			.map((message) => mapMessage(message, includeSystemMessages))
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
