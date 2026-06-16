import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^@atlas\/core\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/core/src/$1.ts"),
      },
      {
        find: "@atlas/tenancy",
        replacement: path.resolve(import.meta.dirname, "packages/tenancy/src/index.ts"),
      },
      {
        find: /^@atlas\/auth\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/auth/src/$1.ts"),
      },
      {
        find: "@atlas/auth",
        replacement: path.resolve(import.meta.dirname, "packages/auth/src/index.ts"),
      },
      {
        find: /^@atlas\/db\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/db/src/$1.ts"),
      },
      {
        find: "@atlas/db",
        replacement: path.resolve(import.meta.dirname, "packages/db/src/index.ts"),
      },
    ],
  },
});
