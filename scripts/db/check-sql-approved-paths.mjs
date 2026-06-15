import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const approvedSqlDirectories = [
  "prisma/migrations/",
  "prisma/sql/setup/",
  "prisma/sql/rls/",
  "prisma/sql/triggers/",
  "prisma/sql/indexes/",
  "prisma/sql/grants/",
  "prisma/sql/partitions/",
];

const roots = ["prisma", "scripts", "packages", "apps"];
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
