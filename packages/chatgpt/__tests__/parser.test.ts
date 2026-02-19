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
			{}
		);

		expect(records).toHaveLength(1);
		expect(records[0].messages).toHaveLength(2);
		expect(records[0].importKey).toBe("chatgpt:c1");
	});

	it("uses injected attachment resolver", () => {
		const calls: Array<{ id: string }> = [];
		const records = parseChatGptConversations(
			[
				{
					id: "c1",
					title: "attachments",
					current_node: "n1",
					mapping: {
						n1: {
							id: "n1",
							parent: null,
							children: [],
							message: {
								id: "m1",
								author: { role: "user" },
								content: { content_type: "text", parts: ["hi"] },
								metadata: {
									attachments: [
										{ id: "file-aaa", name: "photo.jpg" },
										{ id: "file-bbb", name: "photo.jpg" }
									]
								}
							}
						}
					}
				}
			],
			{
				resolveAttachmentPath: (attachment) => {
					calls.push({ id: attachment.id });
					return `/resolved/${attachment.id}`;
				}
			}
		);

		const attachments = records[0].messages[0].attachments;
		expect(attachments[0].sourcePath).toBe("/resolved/file-aaa");
		expect(attachments[1].sourcePath).toBe("/resolved/file-bbb");
		expect(calls).toEqual([{ id: "file-aaa" }, { id: "file-bbb" }]);
	});

	it("excludes reasoning and tool call payload messages", () => {
		const records = parseChatGptConversations(
			[
				{
					id: "c2",
					title: "filters",
					current_node: "n3",
					mapping: {
						n1: {
							id: "n1",
							parent: null,
							children: ["n2"],
							message: {
								id: "m1",
								author: { role: "assistant" },
								content: { content_type: "thoughts", parts: ["internal"] },
								metadata: { attachments: [] }
							}
						},
						n2: {
							id: "n2",
							parent: "n1",
							children: ["n3"],
							message: {
								id: "m2",
								author: { role: "assistant" },
								content: {
									content_type: "text",
									parts: ['{"search_query":[{"q":"test"}],"response_length":"short"}']
								},
								metadata: { attachments: [] }
							}
						},
						n3: {
							id: "n3",
							parent: "n2",
							children: [],
							message: {
								id: "m3",
								author: { role: "assistant" },
								content: { content_type: "text", parts: ["keep me"] },
								metadata: { attachments: [] }
							}
						}
					}
				}
			],
			{ excludeThoughts: true, excludeToolCalls: true }
		);

		expect(records).toHaveLength(1);
		expect(records[0].messages).toHaveLength(1);
		expect(records[0].messages[0].content).toBe("keep me");
	});

	it("excludes thought time messages", () => {
		const records = parseChatGptConversations(
			[
				{
					id: "c3",
					title: "thought time",
					current_node: "n2",
					mapping: {
						n1: {
							id: "n1",
							parent: null,
							children: ["n2"],
							message: {
								id: "m1",
								author: { role: "assistant" },
								content: { content_type: "text", parts: ["思考時間: 4m 58s"] },
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
								content: { content_type: "text", parts: ["keep me too"] },
								metadata: { attachments: [] }
							}
						}
					}
				}
			],
			{ excludeThoughtTime: true }
		);

		expect(records).toHaveLength(1);
		expect(records[0].messages).toHaveLength(1);
		expect(records[0].messages[0].content).toBe("keep me too");
	});
});
