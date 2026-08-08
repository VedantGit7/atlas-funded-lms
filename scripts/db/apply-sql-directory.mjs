import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Client } from "pg";

const allowedDirectories = new Set([
  "prisma/sql/setup",
  "prisma/sql/rls",
  "prisma/sql/triggers",
  "prisma/sql/indexes",
  "prisma/sql/grants",
  "prisma/sql/partitions",
  "backend/prisma/sql/setup",
  "backend/prisma/sql/rls",
  "backend/prisma/sql/triggers",
  "backend/prisma/sql/indexes",
  "backend/prisma/sql/grants",
  "backend/prisma/sql/partitions",
]);

const directoryArg = process.argv[2];

if (!directoryArg) {
  console.error("Usage: pnpm db:sql:apply <directory>");
  console.error("Allowed directories:");
  for (const directory of allowedDirectories) {
    console.error(`- ${directory}`);
  }
  process.exit(1);
}

const normalizedDirectory = directoryArg.replaceAll("\\", "/").replace(/\/$/, "");

if (!allowedDirectories.has(normalizedDirectory)) {
  console.error(`Refusing to apply SQL from unapproved directory: ${directoryArg}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function getSqlFiles(directory) {
  try {
    return readdirSync(directory)
      .map((entry) => join(directory, entry))
      .filter((path) => statSync(path).isFile())
      .filter((path) => path.endsWith(".sql"))
      .sort();
  } catch {
    return [];
  }
}

function assertNoUnsafeSessionTenantSet(file, sql) {
  const forbiddenPatterns = [
    /\bSET\s+app\.tenant_id\b/i,
    /\bSET\s+app\.actor_membership_id\b/i,
    /\bSET\s+app\.request_id\b/i,
    /\bset_config\s*\(\s*['"]app\.tenant_id['"]\s*,\s*[^,]+,\s*false\s*\)/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sql)) {
      throw new Error(
        `Unsafe session-level tenant context detected in ${file}. Use transaction-local set_config(..., true).`,
      );
    }
  }
}

const sqlFiles = getSqlFiles(normalizedDirectory);

if (sqlFiles.length === 0) {
  console.log(`No SQL files found in ${normalizedDirectory}. Nothing to apply.`);
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  for (const file of sqlFiles) {
    const absolutePath = resolve(file);
    const sql = readFileSync(absolutePath, "utf8");

    assertNoUnsafeSessionTenantSet(file, sql);

    console.log(`Applying ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log("SQL apply completed.");
} finally {
  await client.end();
}
