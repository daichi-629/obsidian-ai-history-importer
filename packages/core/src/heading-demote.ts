import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import type { Heading, Nodes, Root } from "mdast";

function collectHeadings(node: Nodes, out: Heading[]): void {
	if (node.type === "heading") {
		out.push(node);
	}
	if ("children" in node) {
		for (const child of node.children) {
			collectHeadings(child as Nodes, out);
		}
	}
}

/**
 * Demotes only heading nodes found in the markdown AST, leaving everything
 * else (code fences, inline code, prose) byte-identical to the source.
 */
export function demoteHeadings(markdown: string, offset: number): string {
	if (!markdown || offset <= 0) return markdown;

	const tree = fromMarkdown(markdown) as Root;
	const headings: Heading[] = [];
	collectHeadings(tree, headings);
	if (headings.length === 0) return markdown;

	const sorted = [...headings].sort(
		(a, b) => b.position!.start.offset! - a.position!.start.offset!
	);

	let result = markdown;
	for (const heading of sorted) {
		if (!heading.position) continue;
		const start = heading.position.start.offset!;
		const end = heading.position.end.offset!;
		const newDepth = Math.min(6, heading.depth + offset) as Heading["depth"];
		const replacement = toMarkdown(
			{ type: "heading", depth: newDepth, children: heading.children },
			{ setext: false }
		).trimEnd();
		result = result.slice(0, start) + replacement + result.slice(end);
	}
	return result;
}
