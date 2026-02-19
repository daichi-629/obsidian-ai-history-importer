import { describe, expect, it } from "vitest";
import { parseChatGptConversations } from "../src";

describe("parseChatGptConversations", () => {
	it("parses chatgpt conversations and removes duplicates by id", () => {
		const records = parseChatGptConversations(
			[
				{
					id: "c1",
					title: "hello",
					create_time: 1710000000,
					update_time: 1710000010,
					current_node: "n2",
					mapping: {
						n1: {
							id: "n1",
							parent: null,
							children: ["n2"],
							message: {
								id: "m1",
								author: { role: "user" },
								content: { content_type: "text", parts: ["hi"] },
								metadata: { attachments: [] }
							}
						},
						n2: {
							id: "n2",
							parent: "n1",
							children: [],
							message: {
								id: "m2",
								author: { role: "assistant" },
								content: { content_type: "text", parts: ["hello"] },
								metadata: { attachments: [] }
							}
						}
					}
				},
				{
					id: "c1",
					title: "dup",
					mapping: {}
				}
			],
			{ exportDir: process.cwd() }
		);

		expect(records).toHaveLength(1);
		expect(records[0].messages).toHaveLength(2);
		expect(records[0].importKey).toBe("chatgpt:c1");
	});
});
