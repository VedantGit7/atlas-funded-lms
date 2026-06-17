import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

const allowedFiles = new Set([
  "packages/db/src/client.ts",
  "packages/db/src/platform-client.ts",
  "packages/db/src/with-tenant-tx.ts",
  "packages/db/src/with-platform-scope.ts",
  "packages/db/src/index.ts",
]);

const ignoredFiles = new Set(["scripts/check-no-direct-prisma.ts"]);

const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "prisma",
  "tests",
]);

const violations: string[] = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relPath = relative(root, fullPath).replaceAll("\\", "/");

    if (ignoredDirs.has(entry)) continue;

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (relPath === "packages/db/src/generated") continue;
      walk(fullPath);
      continue;
    }

    if (!relPath.endsWith(".ts") && !relPath.endsWith(".tsx")) continue;
    if (ignoredFiles.has(relPath)) continue;
    if (allowedFiles.has(relPath)) continue;
    if (relPath.endsWith(".d.ts")) continue;
    if (relPath.includes("/generated/prisma/")) continue;

    const content = readFileSync(fullPath, "utf8");

    const importsPrismaClient =
      content.includes("from '@prisma/client'") || content.includes('from "@prisma/client"');

    const importsGeneratedPrisma = /from\s+['"][^'"]*generated\/prisma/.test(content);

    const importsDbPrisma = /import\s+\{[^}]*\bprisma\b[^}]*\}\s+from\s+['"]@atlas\/db['"]/.test(
      content,
    );

    if (importsPrismaClient || importsGeneratedPrisma || importsDbPrisma) {
      violations.push(relPath);
    }
  }
}

walk(root);

if (violations.length > 0) {
  console.error("Direct Prisma access is forbidden outside @atlas/db wrappers.");
  console.error("Violations:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}
