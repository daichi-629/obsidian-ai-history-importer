export type ConversationRole = "user" | "assistant" | "system" | "tool" | "unknown";

export interface ConversationAttachment {
	id: string;
	name?: string;
	mimeType?: string;
	sourcePath?: string;
	vaultPath?: string;
	obsidianLink?: string;
	sizeBytes?: number;
}

export interface ConversationMessage {
	id: string;
	role: ConversationRole;
	createdAt?: string;
	content: string;
	contentType?: string;
	attachments: ConversationAttachment[];
	metadata?: Record<string, unknown>;
}

export interface ConversationRecord {
	source: string;
	conversationId: string;
	importKey: string;
	title: string;
	createdAt?: string;
	updatedAt?: string;
	messages: ConversationMessage[];
	metadata?: Record<string, unknown>;
}

export interface RenderOptions {
	template?: string;
}
