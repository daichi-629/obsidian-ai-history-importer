import { describe, expect, it } from "vitest";
import type {
	ExportPathApi,
	ExportSource,
	ImportTarget,
	VaultPathApi
} from "@sample/core";
import { importChatGptExport } from "../src";

type FileEntry =
	| { kind: "text"; content: string }
	| { kind: "binary"; content: Uint8Array };

function createVaultPathApi(): VaultPathApi {
	return {
		join: (...parts) => parts.filter(Boolean).join("/").replace(/\/+/g, "/"),
		dirname: (path) => {
			const normalized = path.replace(/\/+/g, "/");
			const index = normalized.lastIndexOf("/");
			return index <= 0 ? "" : normalized.slice(0, index);
		},
		normalize: (path) => path.replace(/\/+/g, "/").replace(/\/$/, "")
	};
}

function createExportPathApi(): ExportPathApi {
	return {
		join: (...parts) => parts.filter(Boolean).join("/").replace(/\/+/g, "/")
	};
}

function createExportSource(
	textFiles: Map<string, string>,
	binaryFiles: Map<string, Uint8Array>,
	entriesByDir: Map<
		string,
		Array<{ name: string; path: string; isDirectory: boolean; isFile: boolean }>
	>
): ExportSource {
	return {
		readText: async (path) => {
			const value = textFiles.get(path);
			if (value === undefined) throw new Error(`Missing text: ${path}`);
			return value;
		},
		readBinary: async (path) => {
			const value = binaryFiles.get(path);
			if (!value) throw new Error(`Missing binary: ${path}`);
			return value;
		},
		listDir: async (path) => entriesByDir.get(path) ?? [],
		exists: async (path) => textFiles.has(path) || binaryFiles.has(path) || entriesByDir.has(path)
	};
}

function createImportTarget() {
	const files = new Map<string, FileEntry>();
	const folders = new Set<string>();

	const target: ImportTarget = {
		listMarkdownFiles: async () =>
			[...files.keys()]
				.filter((path) => path.endsWith(".md"))
				.map((path) => ({ path })),
		readText: async (path) => {
			const entry = files.get(path);
			if (!entry || entry.kind !== "text") throw new Error(`Missing text: ${path}`);
			return entry.content;
		},
		writeText: async (path, content) => {
			files.set(path, { kind: "text", content });
		},
		writeBinary: async (path, data) => {
			files.set(path, { kind: "binary", content: data });
		},
		createFolder: async (path) => {
			folders.add(path);
		},
		exists: async (path) => files.has(path) || folders.has(path)
	};

	return { target, files };
}

function buildConversationJson(attachmentId: string) {
	return JSON.stringify([
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
						author: { role: "assistant" },
						content: { content_type: "text", parts: ["hi"] },
						metadata: {
							attachments: [{ id: attachmentId, name: "photo.jpg", mime_type: "image/jpeg" }]
						}
					}
				}
			}
		}
	]);
}

describe("importChatGptExport", () => {
	it("imports conversations and resolves attachments by id prefix", async () => {
		const exportDir = "/export";
		const filePath = "/export/file-aaa-photo.jpg";
		const conversationsPath = "/export/conversations.json";

		const textFiles = new Map([[conversationsPath, buildConversationJson("file-aaa")]]);
		const binaryFiles = new Map([[filePath, new Uint8Array([1, 2, 3])]]);
		const entriesByDir = new Map([
			[
				exportDir,
				[
					{
						name: "file-aaa-photo.jpg",
						path: filePath,
						isDirectory: false,
						isFile: true
					}
				]
			]
		]);

		const source = createExportSource(textFiles, binaryFiles, entriesByDir);
		const { target, files } = createImportTarget();
		const result = await importChatGptExport({
			options: {
				exportDir,
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false
			},
			source,
			target,
			exportPath: createExportPathApi(),
			vaultPath: createVaultPathApi()
		});

		expect(result.imported).toBe(1);
		expect(files.has("attachments/photo.jpg")).toBe(true);
		const notePath = [...files.keys()].find((path) => path.endsWith(".md"))!;
		const content = (files.get(notePath) as { kind: "text"; content: string }).content;
		expect(content).toContain("![[attachments/photo.jpg]]");
	});

	it("respects attachment scan depth", async () => {
		const exportDir = "/export";
		const nestedDir = "/export/nested";
		const filePath = "/export/nested/file-bbb-photo.jpg";
		const conversationsPath = "/export/conversations.json";

		const textFiles = new Map([[conversationsPath, buildConversationJson("file-bbb")]]);
		const binaryFiles = new Map([[filePath, new Uint8Array([4])]]);
		const entriesByDir = new Map([
			[
				exportDir,
				[
					{
						name: "nested",
						path: nestedDir,
						isDirectory: true,
						isFile: false
					}
				]
			],
			[
				nestedDir,
				[
					{
						name: "file-bbb-photo.jpg",
						path: filePath,
						isDirectory: false,
						isFile: true
					}
				]
			]
		]);

		const source = createExportSource(textFiles, binaryFiles, entriesByDir);
		const { target, files } = createImportTarget();
		const result = await importChatGptExport({
			options: {
				exportDir,
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false,
				attachmentScanDepth: 0
			},
			source,
			target,
			exportPath: createExportPathApi(),
			vaultPath: createVaultPathApi()
		});

		expect(result.imported).toBe(1);
		expect(files.has("attachments/photo.jpg")).toBe(false);
		const notePath = [...files.keys()].find((path) => path.endsWith(".md"))!;
		const content = (files.get(notePath) as { kind: "text"; content: string }).content;
		expect(content).toContain("`file-bbb`");
	});

	it("filters system and hidden messages by default", async () => {
		const exportDir = "/export";
		const conversationsPath = "/export/conversations.json";
		const data = JSON.stringify([
			{
				id: "c2",
				title: "roles",
				current_node: "n2",
				mapping: {
					n1: {
						id: "n1",
						parent: null,
						children: ["n2"],
						message: {
							id: "m1",
							author: { role: "system" },
							content: { content_type: "text", parts: ["system"] },
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
							content: { content_type: "text", parts: ["visible"] },
							metadata: { is_visually_hidden_from_conversation: true, attachments: [] }
						}
					}
				}
			}
		]);

		const source = createExportSource(new Map([[conversationsPath, data]]), new Map(), new Map());
		const { target, files } = createImportTarget();
		const result = await importChatGptExport({
			options: {
				exportDir,
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false
			},
			source,
			target,
			exportPath: createExportPathApi(),
			vaultPath: createVaultPathApi()
		});

		expect(result.imported).toBe(0);
		expect(files.size).toBe(0);
	});
});
