const RESERVED = /[<>:"/\\|?*]/g;

function stripControlChars(input: string): string {
	return [...input].map((char) => (char.charCodeAt(0) <= 0x1f ? " " : char)).join("");
}

function extnameFromPath(filePath: string): string {
	const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	const base = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
	const dotIndex = base.lastIndexOf(".");
	if (dotIndex <= 0) return "";
	return base.slice(dotIndex);
}

export function sanitizeFileName(input: string): string {
	const cleaned = stripControlChars(input).replace(RESERVED, " ").replace(/\s+/g, " ").trim();
	return cleaned.length > 0 ? cleaned : "untitled";
}

function formatDateSegment(value?: string): string | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return undefined;
	const yyyy = String(parsed.getUTCFullYear()).padStart(4, "0");
	const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(parsed.getUTCDate()).padStart(2, "0");
	const hh = String(parsed.getUTCHours()).padStart(2, "0");
	const min = String(parsed.getUTCMinutes()).padStart(2, "0");
	return `${yyyy}${mm}${dd}${hh}${min}`;
}

export function buildConversationFileName(
	title: string,
	conversationId: string,
	createdAt?: string
): string {
	const base = sanitizeFileName(title).slice(0, 80);
	const datePrefix = formatDateSegment(createdAt) ?? "unknown";
	return `${datePrefix}-${base}-${conversationId.slice(0, 8)}.md`;
}

export function buildAttachmentFileName(
	originalName: string | undefined,
	sourcePath: string,
	attachmentId: string
): string {
	const sourceExt = extnameFromPath(sourcePath);
	const sourceBase = originalName ? sanitizeFileName(originalName) : attachmentId;
	const hasExt = extnameFromPath(sourceBase).length > 0;
	if (hasExt) return sourceBase;
	return sourceExt.length > 0 ? `${sourceBase}${sourceExt}` : sourceBase;
}

export function isImageMimeType(mimeType?: string): boolean {
	return typeof mimeType === "string" && mimeType.startsWith("image/");
}
