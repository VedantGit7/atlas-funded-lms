import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@atlas/db": path.resolve(import.meta.dirname, "packages/db/src/index.ts"),
    },
  },
});
