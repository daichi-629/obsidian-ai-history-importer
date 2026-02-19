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
const TOOL_PAYLOAD_KEYS = new Set([
	"search_query",
	"open",
	"click",
	"find",
	"screenshot",
	"image_query",
	"weather",
	"finance",
	"sports",
	"calculator",
	"time"
]);

export interface ParseOptions {
	includeSystemMessages?: boolean;
	includeHiddenMessages?: boolean;
	excludeThoughts?: boolean;
	excludeToolCalls?: boolean;
	excludeThoughtTime?: boolean;
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

function collectContentStrings(message: ChatGptMessage): string[] {
	const content = message.content;
	if (!content) return [];

	const parts = Array.isArray(content.parts)
		? content.parts.filter((part): part is string => typeof part === "string")
		: [];
	const text = typeof content.text === "string" ? [content.text] : [];
	const inlineContent = typeof content.content === "string" ? [content.content] : [];

	return [...parts, ...text, ...inlineContent];
}

function isToolPayloadString(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
		return Object.keys(parsed as Record<string, unknown>).some((key) =>
			TOOL_PAYLOAD_KEYS.has(key)
		);
	} catch {
		return false;
	}
}

function isToolCallMessage(message: ChatGptMessage): boolean {
	return collectContentStrings(message).some((content) => isToolPayloadString(content));
}

function isThoughtTimeMessage(message: ChatGptMessage): boolean {
	const contents = collectContentStrings(message).map((content) => content.trim());
	if (contents.length !== 1) return false;
	const [only] = contents;
	return (
		only.startsWith("思考時間:") ||
		only.startsWith("Thought time:") ||
		/^思考時間:\s*\d/.test(only) ||
		/^Thought time:\s*\d/.test(only)
	);
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
	includeHiddenMessages: boolean,
	excludeThoughts: boolean,
	excludeToolCalls: boolean,
	excludeThoughtTime: boolean
): ConversationMessage | null {
	const message = node.message;
	if (!message?.id) return null;
	const role = message.author?.role ?? "unknown";
	if (!includeSystemMessages && role === "system") return null;
	if (SKIPPED_CONTENT_TYPES.has(message.content?.content_type ?? "")) return null;
	if (excludeThoughts && message.content?.content_type === "thoughts") return null;
	if (!includeHiddenMessages && message.metadata?.is_visually_hidden_from_conversation)
		return null;
	if (excludeToolCalls && isToolCallMessage(message)) return null;
	if (excludeThoughtTime && isThoughtTimeMessage(message)) return null;

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
	const excludeThoughts = options.excludeThoughts ?? false;
	const excludeToolCalls = options.excludeToolCalls ?? false;
	const excludeThoughtTime = options.excludeThoughtTime ?? false;
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
					includeHiddenMessages,
					excludeThoughts,
					excludeToolCalls,
					excludeThoughtTime
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
