import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = process.argv[2];
const rootPath = join(process.cwd(), "package.json");
const rootJson = JSON.parse(readFileSync(rootPath, "utf8"));

const next = (() => {
	if (!arg) {
		throw new Error("Usage: pnpm run version:bump <x.y.z|patch|minor|major>");
	}
	if (/^\d+\.\d+\.\d+$/.test(arg)) return arg;

	const [major, minor, patch] = rootJson.version.split(".").map(Number);
	if (arg === "patch") return `${major}.${minor}.${patch + 1}`;
	if (arg === "minor") return `${major}.${minor + 1}.0`;
	if (arg === "major") return `${major + 1}.0.0`;

	throw new Error(`Unsupported version bump: ${arg}`);
})();

const files = [
	"package.json",
	"packages/core/package.json",
	"packages/plugin/package.json",
	"packages/plugin/manifest.json"
];

for (const file of files) {
	const filePath = join(process.cwd(), file);
	const json = JSON.parse(readFileSync(filePath, "utf8"));
	json.version = next;
	writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n");
}

const manifestPath = join(process.cwd(), "packages/plugin/manifest.json");
const versionsPath = join(process.cwd(), "packages/plugin/versions.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

versions[next] = manifest.minAppVersion;

writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + "\n");

console.log(`Version bumped to ${next}`);
