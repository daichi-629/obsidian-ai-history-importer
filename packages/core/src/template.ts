import nunjucks from "nunjucks";
import type { ConversationRecord } from "./types";

export const DEFAULT_MARKDOWN_TEMPLATE =
	`---
ai_source: "{{ conversation.source }}"
ai_conversation_id: "{{ conversation.conversationId }}"
ai_import_key: "{{ conversation.importKey }}"
created_at: "{{ conversation.createdAt or '' }}"
updated_at: "{{ conversation.updatedAt or '' }}"
---

# {{ conversation.title }}

{% for message in conversation.messages %}
## {{ message.role | roleTitle }}{% if message.createdAt %} ({{ message.createdAt }}){% endif %}

{{ message.content | trim }}
{% if message.attachments.length > 0 %}

### Attachments
{% for attachment in message.attachments %}
- {% if attachment.obsidianLink %}{{ attachment.obsidianLink }}{% else %}` +
	"`{{ attachment.id }}`" +
	`{% endif %}
{% endfor %}
{% endif %}

{% endfor %}
`;

let env: nunjucks.Environment | null = null;

function getEnvironment(): nunjucks.Environment {
	if (env) return env;
	env = new nunjucks.Environment(undefined, {
		autoescape: false,
		trimBlocks: true,
		lstripBlocks: true
	});
	env.addFilter("roleTitle", (role: string) => {
		switch (role) {
			case "user":
				return "User";
			case "assistant":
				return "ChatGPT";
			case "system":
				return "System";
			case "tool":
				return "Tool";
			default:
				return role;
		}
	});
	return env;
}

export function renderConversationMarkdown(
	conversation: ConversationRecord,
	template: string = DEFAULT_MARKDOWN_TEMPLATE
): string {
	const rendered = getEnvironment().renderString(template, { conversation });
	return rendered.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
