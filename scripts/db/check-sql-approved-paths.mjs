import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Paths moved under backend/ in the F-1 monorepo split. The pre-split spellings
// below scanned directories that no longer exist, so this guard passed while
// inspecting no SQL at all.
const approvedSqlDirectories = [
  "backend/prisma/migrations/",
  "backend/prisma/sql/setup/",
  "backend/prisma/sql/functions/",
  "backend/prisma/sql/rls/",
  "backend/prisma/sql/triggers/",
  "backend/prisma/sql/indexes/",
  "backend/prisma/sql/grants/",
  "backend/prisma/sql/partitions/",
];

const roots = ["backend", "frontend", "scripts", "tests"];
const failures = [];

function walkFiles(directory) {
  try {
    return readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      const normalized = path.replaceAll("\\", "/");

      if (
        normalized.includes("/node_modules/") ||
        normalized.includes("/.next/") ||
        normalized.includes("/dist/") ||
        normalized.includes("/build/") ||
        normalized.includes("/coverage/")
      ) {
        return [];
      }

      const stat = statSync(path);
      return stat.isDirectory() ? walkFiles(path) : [path];
    });
  } catch {
    return [];
  }
}

const sqlFiles = roots
  .flatMap((root) => walkFiles(root))
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => file.endsWith(".sql"));

for (const file of sqlFiles) {
  const isApproved = approvedSqlDirectories.some((directory) => file.startsWith(directory));

  if (!isApproved) {
    failures.push(file);
  }
}

if (failures.length > 0) {
  console.error("\nBlocked: raw SQL files must live only in approved prisma/sql folders.\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("\nApproved folders:");
  for (const directory of approvedSqlDirectories) {
    console.error(`- ${directory}`);
  }
  process.exit(1);
}

process.exit(0);
