import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, "..");

config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(configDir, ".env.local") });

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
    url: env("DATABASE_URL"),
  },
});
