import { isGeneratedSourcePath } from "./source-paths.mjs";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const rootsToScan = ["frontend", "backend/apps", "backend/packages", "src"];
const allowedPrismaRoot = "backend/packages/db/src/";

function walkFiles(directory) {
  try {
    const entries = readdirSync(directory);
    const files = [];

    for (const entry of entries) {
      const path = join(directory, entry);
      const normalized = path.replaceAll("\\", "/");

      if (
        isGeneratedSourcePath(normalized) ||
        normalized.includes("/.next/") ||
        normalized.includes("/dist/") ||
        normalized.includes("/build/")
      ) {
        continue;
      }

      const stat = statSync(path);

      if (stat.isDirectory()) {
        files.push(...walkFiles(path));
        continue;
      }

      files.push(path);
    }

    return files;
  } catch {
    return [];
  }
}

const sourceFiles = rootsToScan
  .flatMap((root) => walkFiles(root))
  .filter((file) => /\.(ts|tsx|js|mjs|cjs)$/.test(file));

const failures = [];

for (const file of sourceFiles) {
  const normalized = file.replaceAll("\\", "/");

  if (normalized.startsWith(allowedPrismaRoot)) {
    continue;
  }

  const content = readFileSync(file, "utf8");

  if (
    content.includes('from "@prisma/client"') ||
    content.includes("from '@prisma/client'") ||
    content.includes('require("@prisma/client")') ||
    content.includes("require('@prisma/client')")
  ) {
    failures.push(file);
  }
}

if (failures.length > 0) {
  console.error("\nBlocked push: direct Prisma imports are forbidden outside packages/db/src.\n");
  for (const file of failures) {
    console.error(`- ${file}`);
  }
  console.error(
    "\nUse approved DB boundaries only. No direct Prisma in UI, routes, services, or scripts.\n",
  );
  process.exit(1);
}

process.exit(0);
