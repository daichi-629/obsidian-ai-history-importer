import type {
	ConversationAttachment,
	ConversationMessage,
	ConversationRecord
} from "@obsidian-ai-history-importer/core";
import type {
	ChatGptAttachment,
	ChatGptConversation,
	ChatGptMappingNode,
	ChatGptMessage
} from "./types";

const SKIPPED_CONTENT_TYPES = new Set(["user_editable_context"]);

export interface ParseOptions {
	includeSystemMessages?: boolean;
	includeHiddenMessages?: boolean;
	resolveAttachmentPath?: AttachmentPathResolver;
}

function toIsoDate(value?: number | null): string | undefined {
	if (typeof value !== "number" || Number.isNaN(value)) return undefined;
	return new Date(value * 1000).toISOString();
}

function extractMessageText(message: ChatGptMessage): string {
	const content = message.content;
	if (!content) return "";

	switch (content.content_type) {
		case "text":
		case "multimodal_text":
			if (Array.isArray(content.parts)) {
				return content.parts
					.filter((part): part is string => typeof part === "string")
					.join("\n\n")
					.trim();
			}
			return "";
		case "code":
		case "execution_output":
			return typeof content.text === "string" ? content.text.trim() : "";
		case "reasoning_recap":
			return typeof content.content === "string" ? content.content.trim() : "";
		default:
			return JSON.stringify(content, null, 2);
	}
}

export type AttachmentPathResolver = (attachment: ChatGptAttachment) => string | undefined;

function mapAttachment(
	attachment: ChatGptAttachment,
	resolveAttachmentPath: AttachmentPathResolver,
): ConversationAttachment {
	const sourcePath = resolveAttachmentPath(attachment);
	return {
		id: attachment.id,
		name: attachment.name,
		mimeType: attachment.mime_type,
		sizeBytes: attachment.size,
		sourcePath
	};
}

function selectPathNodes(conversation: ChatGptConversation): ChatGptMappingNode[] {
	const mapping = conversation.mapping ?? {};
	const current = conversation.current_node;
	if (!current || !mapping[current]) {
		return Object.values(mapping);
	}

	const ordered: ChatGptMappingNode[] = [];
	let nodeId: string | null | undefined = current;
	while (nodeId) {
		const currentNode: ChatGptMappingNode | undefined = mapping[nodeId];
		if (!currentNode) break;
		ordered.push(currentNode);
		nodeId = currentNode.parent;
	}
	return ordered.reverse();
}

function mapMessage(
	node: ChatGptMappingNode,
	resolveAttachmentPath: AttachmentPathResolver,
	includeSystemMessages: boolean,
	includeHiddenMessages: boolean
): ConversationMessage | null {
	const message = node.message;
	if (!message?.id) return null;
	const role = message.author?.role ?? "unknown";
	if (!includeSystemMessages && role === "system") return null;
	if (SKIPPED_CONTENT_TYPES.has(message.content?.content_type ?? "")) return null;
	if (!includeHiddenMessages && message.metadata?.is_visually_hidden_from_conversation)
		return null;

	const attachments = (message.metadata?.attachments ?? [])
		.filter((attachment): attachment is ChatGptAttachment => Boolean(attachment?.id))
		.map((attachment) => mapAttachment(attachment, resolveAttachmentPath));

	return {
		id: message.id,
		role: role as ConversationMessage["role"],
		createdAt: toIsoDate(message.create_time ?? undefined),
		content: extractMessageText(message),
		contentType: message.content?.content_type,
		attachments
	};
}

export function parseChatGptConversations(
	conversations: ChatGptConversation[],
	options: ParseOptions
): ConversationRecord[] {
	const includeSystemMessages = options.includeSystemMessages ?? false;
	const includeHiddenMessages = options.includeHiddenMessages ?? false;
	const resolveAttachmentPath = options.resolveAttachmentPath ?? (() => undefined);
	const seenConversationKeys = new Set<string>();

	const output: ConversationRecord[] = [];
	for (const conversation of conversations) {
		const conversationId = conversation.id ?? conversation.conversation_id;
		if (!conversationId) continue;

		const importKey = `chatgpt:${conversationId}`;
		if (seenConversationKeys.has(importKey)) continue;
		seenConversationKeys.add(importKey);

		const messages = selectPathNodes(conversation)
			.map((node) =>
				mapMessage(
					node,
					resolveAttachmentPath,
					includeSystemMessages,
					includeHiddenMessages
				)
			)
			.filter((message): message is ConversationMessage => Boolean(message))
			.filter((message) => message.content.length > 0 || message.attachments.length > 0);

		if (messages.length === 0) continue;

		output.push({
			source: "chatgpt",
			conversationId,
			importKey,
			title:
				(conversation.title || "Untitled conversation").trim() || "Untitled conversation",
			createdAt: toIsoDate(conversation.create_time),
			updatedAt: toIsoDate(conversation.update_time),
			messages
		});
	}

	return output;
}
