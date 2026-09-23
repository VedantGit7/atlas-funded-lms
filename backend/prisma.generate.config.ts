import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

// Client generation reads the schema, not the database. Keep installation
// independent of runtime/migration credentials and local environment files.
// All database operations still use prisma.config.ts and require DATABASE_URL.
export default defineConfig({
  schema: path.join(path.dirname(fileURLToPath(import.meta.url)), "prisma", "schema.prisma"),
});
