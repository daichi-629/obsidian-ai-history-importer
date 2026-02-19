import { describe, expect, it } from "vitest";
import { buildGreeting } from "../src/index";

describe("buildGreeting", () => {
	it("returns a greeting with the provided name", () => {
		expect(buildGreeting({ name: "Obsidian" })).toBe("Hello, Obsidian");
	});
});
