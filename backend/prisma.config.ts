import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..");

// The Prisma CLI (migrate, studio, validate) needs the schema owner.
// DATABASE_URL is the RLS-bound application login wherever the app runs under
// tenant isolation, and that role cannot ALTER or CREATE, so `migrate deploy`
// against it aborts on the first DDL statement. Prefer the owner login.
//
// A URL the caller passed in always beats one read from .env.local. Callers
// that target another database (db:test:setup, CI) set DATABASE_URL and remove
// DIRECT_DATABASE_URL on purpose; if .env.local could refill the direct URL,
// migrations would silently run against the development database instead.
// So precedence is decided before the files are loaded.
const callerUrl = process.env["DIRECT_DATABASE_URL"] || process.env["DATABASE_URL"];

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(configDir, ".env.local") });

// With neither set, `env()` fails closed with Prisma's own unresolved-variable
// error, which tests/ci/prisma-generation-config.test.ts relies on.
const datasourceUrl = callerUrl || process.env["DIRECT_DATABASE_URL"] || env("DATABASE_URL");

// Prisma resolves these paths relative to process.cwd(), so make them
// cwd-independent by pointing at absolute filesystem locations.
const schemaPath = path.join(configDir, "prisma", "schema.prisma");
const migrationsPath = path.join(configDir, "prisma", "migrations");

export default defineConfig({
  schema: schemaPath,
  migrations: {
    path: migrationsPath,
  },
  datasource: {
    url: datasourceUrl,
  },
});
