import { extname } from "node:path";

const RESERVED = /[<>:"/\\|?*]/g;

function stripControlChars(input: string): string {
	return [...input]
		.map((char) => (char.charCodeAt(0) <= 0x1f ? " " : char))
		.join("");
}

export function sanitizeFileName(input: string): string {
	const cleaned = stripControlChars(input).replace(RESERVED, " ").replace(/\s+/g, " ").trim();
	return cleaned.length > 0 ? cleaned : "untitled";
}

export function buildConversationFileName(title: string, conversationId: string): string {
	const base = sanitizeFileName(title).slice(0, 80);
	return `${base}-${conversationId.slice(0, 8)}.md`;
}

export function buildAttachmentFileName(originalName: string | undefined, sourcePath: string, attachmentId: string): string {
	const sourceExt = extname(sourcePath);
	const sourceBase = originalName ? sanitizeFileName(originalName) : attachmentId;
	const hasExt = extname(sourceBase).length > 0;
	if (hasExt) return sourceBase;
	return sourceExt.length > 0 ? `${sourceBase}${sourceExt}` : sourceBase;
}

export function isImageMimeType(mimeType?: string): boolean {
	return typeof mimeType === "string" && mimeType.startsWith("image/");
}
