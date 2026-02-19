import { describe, expect, it } from "vitest";
import type { ConversationRecord } from "../src";
import type { ExportSource, ImportTarget, VaultPathApi } from "../src";
import { importConversationRecords } from "../src";

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

	return { target, files, folders };
}

function baseConversation(overrides?: Partial<ConversationRecord>): ConversationRecord {
	return {
		source: "chatgpt",
		conversationId: "conv-12345678",
		importKey: "chatgpt:conv-12345678",
		title: "Hello world",
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-01T00:00:10.000Z",
		messages: [],
		...overrides
	};
}

describe("importConversationRecords", () => {
	it("writes a new note using the default template", async () => {
		const { target, files } = createImportTarget();
		const exportSource = createExportSource(new Map(), new Map(), new Map());
		const vaultPath = createVaultPathApi();

		const records = [
			baseConversation({
				title: "My Chat",
				messages: [
					{
						id: "m1",
						role: "user",
						content: "hello",
						attachments: []
					}
				]
			})
		];

		const result = await importConversationRecords(
			records,
			{
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false
			},
			{ source: exportSource, target, vaultPath }
		);

		expect(result.imported).toBe(1);
		const [path] = [...files.keys()];
		expect(path).toMatch(/^notes\/My Chat-conv-123\.md$/);
		const content = (files.get(path) as { kind: "text"; content: string }).content;
		expect(content).toContain("ai_conversation_id: \"conv-12345678\"");
		expect(content).toContain("# My Chat");
	});

	it("skips when a note already exists and overwrite is false", async () => {
		const { target, files } = createImportTarget();
		const exportSource = createExportSource(new Map(), new Map(), new Map());
		const vaultPath = createVaultPathApi();
		const existingPath = "notes/Hello world-conv-123.md";
		files.set(existingPath, { kind: "text", content: "existing" });

		const result = await importConversationRecords(
			[baseConversation()],
			{
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false
			},
			{ source: exportSource, target, vaultPath }
		);

		expect(result.skipped).toBe(1);
		expect((files.get(existingPath) as { kind: "text"; content: string }).content).toBe(
			"existing"
		);
	});

	it("updates an existing note that matches conversation id", async () => {
		const { target, files } = createImportTarget();
		const exportSource = createExportSource(new Map(), new Map(), new Map());
		const vaultPath = createVaultPathApi();
		const existingPath = "notes/old-name.md";
		files.set(
			existingPath,
			{
				kind: "text",
				content: `---\nai_conversation_id: "conv-12345678"\n---\nOld`
			}
		);

		const result = await importConversationRecords(
			[baseConversation({ title: "Renamed" })],
			{
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: true
			},
			{ source: exportSource, target, vaultPath }
		);

		expect(result.imported).toBe(1);
		const updated = files.get(existingPath) as { kind: "text"; content: string };
		expect(updated.content).toContain("# Renamed");
	});

	it("copies attachments and renders obsidian links", async () => {
		const { target, files } = createImportTarget();
		const binary = new Uint8Array([1, 2, 3]);
		const exportSource = createExportSource(
			new Map(),
			new Map([["/export/file-aaa-photo.jpg", binary]]),
			new Map()
		);
		const vaultPath = createVaultPathApi();

		const records = [
			baseConversation({
				messages: [
					{
						id: "m1",
						role: "assistant",
						content: "see",
						attachments: [
							{
								id: "file-aaa",
								name: "photo.jpg",
								mimeType: "image/jpeg",
								sourcePath: "/export/file-aaa-photo.jpg"
							}
						]
					}
				]
			})
		];

		const result = await importConversationRecords(
			records,
			{
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false
			},
			{ source: exportSource, target, vaultPath }
		);

		expect(result.imported).toBe(1);
		expect(files.has("attachments/photo.jpg")).toBe(true);
		const notePath = [...files.keys()].find((path) => path.endsWith(".md"))!;
		const content = (files.get(notePath) as { kind: "text"; content: string }).content;
		expect(content).toContain("![[attachments/photo.jpg]]");
	});

	it("loads a custom template from the export source", async () => {
		const { target, files } = createImportTarget();
		const exportSource = createExportSource(
			new Map([["/export/template.md", "TITLE={{ conversation.title }}"]]),
			new Map(),
			new Map()
		);
		const vaultPath = createVaultPathApi();

		const result = await importConversationRecords(
			[baseConversation({ title: "Custom" })],
			{
				notesDirectory: "notes",
				attachmentsDirectory: "attachments",
				overwriteOnReimport: false,
				customTemplatePath: "/export/template.md"
			},
			{ source: exportSource, target, vaultPath }
		);

		expect(result.imported).toBe(1);
		const notePath = [...files.keys()].find((path) => path.endsWith(".md"))!;
		const content = (files.get(notePath) as { kind: "text"; content: string }).content;
		expect(content.trim()).toBe("TITLE=Custom");
	});
});
