import { describe, expect, it } from "vitest";
import { renderConversationMarkdown } from "../src";
import type { ConversationRecord } from "../src";

describe("renderConversationMarkdown", () => {
	it("renders the default markdown template", () => {
		const conversation: ConversationRecord = {
			source: "chatgpt",
			conversationId: "c1",
			importKey: "chatgpt:c1",
			title: "Sample chat",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:10:00.000Z",
			messages: [
				{
					id: "m1",
					role: "user",
					content: "hello",
					attachments: []
				},
				{
					id: "m2",
					role: "assistant",
					content: "world",
					attachments: [{ id: "f1", obsidianLink: "[[files/a.txt]]" }]
				}
			]
		};

		const output = renderConversationMarkdown(conversation);
		expect(output).toContain("# Sample chat");
		expect(output).toContain("## User");
		expect(output).toContain("## ChatGPT");
		expect(output).toContain("[[files/a.txt]]");
		expect(output).toContain('ai_import_key: "chatgpt:c1"');
	});
});
