import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.e2e.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^@atlas\/core\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/core/src/$1.ts"),
      },
      {
        find: "@atlas/core",
        replacement: path.resolve(import.meta.dirname, "packages/core/src/index.ts"),
      },
      {
        find: "@atlas/tenancy",
        replacement: path.resolve(import.meta.dirname, "packages/tenancy/src/index.ts"),
      },
      {
        find: /^@atlas\/access\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/access/src/$1.ts"),
      },
      {
        find: "@atlas/access",
        replacement: path.resolve(import.meta.dirname, "packages/access/src/index.ts"),
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
        find: /^@atlas\/membership\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/membership/src/$1.ts"),
      },
      {
        find: "@atlas/membership",
        replacement: path.resolve(import.meta.dirname, "packages/membership/src/index.ts"),
      },
      {
        find: /^@atlas\/db\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/db/src/$1.ts"),
      },
      {
        find: "@atlas/db",
        replacement: path.resolve(import.meta.dirname, "packages/db/src/index.ts"),
      },
      {
        find: /^@atlas\/authorization\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/authorization/src/$1.ts"),
      },
      {
        find: "@atlas/authorization",
        replacement: path.resolve(import.meta.dirname, "packages/authorization/src/index.ts"),
      },
      {
        find: /^@atlas\/api\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/api/src/$1.ts"),
      },
      {
        find: "@atlas/api",
        replacement: path.resolve(import.meta.dirname, "packages/api/src/index.ts"),
      },
      {
        find: /^@atlas\/domain-config\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/domain/config/src/$1.ts"),
      },
      {
        find: "@atlas/domain-config",
        replacement: path.resolve(import.meta.dirname, "packages/domain/config/src/index.ts"),
      },
      {
        find: /^@atlas\/domain-tenancy\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/domain/tenancy/src/$1.ts"),
      },
      {
        find: "@atlas/domain-tenancy",
        replacement: path.resolve(import.meta.dirname, "packages/domain/tenancy/src/index.ts"),
      },
      {
        find: /^@atlas\/domain-branding\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/domain/branding/src/$1.ts"),
      },
      {
        find: "@atlas/domain-branding",
        replacement: path.resolve(import.meta.dirname, "packages/domain/branding/src/index.ts"),
      },
      {
        find: /^@atlas\/domain-access\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/domain/access/src/$1.ts"),
      },
      {
        find: "@atlas/domain-access",
        replacement: path.resolve(import.meta.dirname, "packages/domain/access/src/index.ts"),
      },
      {
        find: /^@atlas\/domain-identity\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/domain/identity/src/$1.ts"),
      },
      {
        find: "@atlas/domain-identity",
        replacement: path.resolve(import.meta.dirname, "packages/domain/identity/src/index.ts"),
      },
      {
        find: /^@atlas\/audit\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/audit/src/$1.ts"),
      },
      {
        find: "@atlas/audit",
        replacement: path.resolve(import.meta.dirname, "packages/audit/src/index.ts"),
      },
      {
        find: /^@atlas\/events\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/events/src/$1.ts"),
      },
      {
        find: "@atlas/events",
        replacement: path.resolve(import.meta.dirname, "packages/events/src/index.ts"),
      },
      {
        find: /^@atlas\/storage\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/storage/src/$1.ts"),
      },
      {
        find: "@atlas/storage",
        replacement: path.resolve(import.meta.dirname, "packages/storage/src/index.ts"),
      },
      {
        find: /^@atlas\/security\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "packages/security/src/$1.ts"),
      },
      {
        find: "@atlas/security",
        replacement: path.resolve(import.meta.dirname, "packages/security/src/index.ts"),
      },
    ],
  },
});
