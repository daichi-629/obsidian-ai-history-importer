export interface ClaudeAccount {
	uuid?: string;
}

export interface ClaudeMessageContent {
	start_timestamp?: string;
	stop_timestamp?: string;
	flags?: unknown;
	type?: string;
	text?: string;
	thinking?: string;
	citations?: unknown[];
}

export interface ClaudeAttachment {
	file_name?: string;
	file_size?: number;
	file_type?: string;
	extracted_content?: string;
}

export interface ClaudeFileRef {
	file_name?: string;
}

export interface ClaudeMessage {
	uuid?: string;
	text?: string;
	content?: ClaudeMessageContent[];
	sender?: string;
	created_at?: string;
	updated_at?: string;
	attachments?: ClaudeAttachment[];
	files?: ClaudeFileRef[];
}

export interface ClaudeConversation {
	uuid?: string;
	name?: string;
	summary?: string;
	created_at?: string;
	updated_at?: string;
	account?: ClaudeAccount;
	chat_messages?: ClaudeMessage[];
}
