import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

// Moved under backend/ in the F-1 monorepo split. With the old spellings the
// allowlist matched nothing, so the guard flagged the very wrappers it exists
// to protect.
const allowedFiles = new Set([
  "backend/packages/db/src/client.ts",
  "backend/packages/db/src/platform-client.ts",
  "backend/packages/db/src/with-tenant-tx.ts",
  "backend/packages/db/src/with-platform-scope.ts",
  "backend/packages/db/src/index.ts",
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
      if (relPath === "backend/packages/db/src/generated") continue;
      walk(fullPath);
      continue;
    }

    if (!relPath.endsWith(".ts") && !relPath.endsWith(".tsx")) continue;
    if (ignoredFiles.has(relPath)) continue;
    if (allowedFiles.has(relPath)) continue;
    if (relPath.endsWith(".d.ts")) continue;
    if (relPath.includes("/generated/prisma/")) continue;

    const rawContent = readFileSync(fullPath, "utf8");

    // `import type { … }` is erased at compile time and grants no runtime access
    // to Prisma, so it is not "direct Prisma access". Strip those statements
    // before testing; value imports below are still violations.
    const content = rawContent.replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?/g, "");

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
