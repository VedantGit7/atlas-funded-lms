import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

// Moved under backend/ in the F-1 monorepo split (see check-no-direct-prisma.ts).
const allowedFiles = new Set([
  "backend/packages/db/src/platform-client.ts",
  "backend/packages/db/src/with-platform-scope.ts",
  "tests/db/with-platform-scope.test.ts",
  "tests/tenant-isolation/platform-leakage.test.ts",
]);

const ignoredFiles = new Set([
  "scripts/check-no-direct-prisma.ts",
  "scripts/check-no-platform-scope-outside-wrapper.ts",
]);

const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "prisma",
]);

const violations: string[] = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relPath = relative(root, fullPath).replaceAll("\\", "/");

    if (ignoredDirs.has(entry)) continue;

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (relPath === "backend/packages/db/src/generated") continue;
      walk(fullPath);
      continue;
    }

    if (!relPath.endsWith(".ts") && !relPath.endsWith(".tsx")) continue;
    if (ignoredFiles.has(relPath)) continue;
    if (allowedFiles.has(relPath)) continue;
    if (relPath.endsWith(".d.ts")) continue;
    if (relPath.includes("/generated/prisma/")) continue;

    const content = readFileSync(fullPath, "utf8");

    const setsPlatformScope =
      content.includes("app.platform_scope") || content.includes("SET LOCAL ROLE atlas_platform");

    const importsPlatformClient =
      /from\s+['"].*platform-client['"]/.test(content) || content.includes("getPlatformPrisma");

    if (setsPlatformScope || importsPlatformClient) {
      violations.push(relPath);
    }
  }
}

walk(root);

if (violations.length > 0) {
  console.error("Platform scope is forbidden outside withPlatformScope() and its tests.");
  console.error("Violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}
