import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.e2e.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globalSetup: ["tests/global-teardown.ts"],
  },
  resolve: {
    alias: [
      {
        find: /^@atlas\/core\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/core/src/$1.ts"),
      },
      {
        find: "@atlas/core",
        replacement: path.resolve(import.meta.dirname, "backend/packages/core/src/index.ts"),
      },
      {
        find: "@atlas/tenancy",
        replacement: path.resolve(import.meta.dirname, "backend/packages/tenancy/src/index.ts"),
      },
      {
        find: /^@atlas\/access\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/access/src/$1.ts"),
      },
      {
        find: "@atlas/access",
        replacement: path.resolve(import.meta.dirname, "backend/packages/access/src/index.ts"),
      },
      {
        find: /^@atlas\/auth\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/auth/src/$1.ts"),
      },
      {
        find: "@atlas/auth",
        replacement: path.resolve(import.meta.dirname, "backend/packages/auth/src/index.ts"),
      },
      {
        find: /^@atlas\/membership\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/membership/src/$1.ts"),
      },
      {
        find: "@atlas/membership",
        replacement: path.resolve(import.meta.dirname, "backend/packages/membership/src/index.ts"),
      },
      {
        find: /^@atlas\/db\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/db/src/$1.ts"),
      },
      {
        find: "@atlas/db",
        replacement: path.resolve(import.meta.dirname, "backend/packages/db/src/index.ts"),
      },
      {
        find: /^@atlas\/authorization\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/authorization/src/$1.ts"),
      },
      {
        find: "@atlas/authorization",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/authorization/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/api\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/api/src/$1.ts"),
      },
      {
        find: "@atlas/api",
        replacement: path.resolve(import.meta.dirname, "backend/packages/api/src/index.ts"),
      },
      {
        find: /^@atlas\/domain-config\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/domain/config/src/$1.ts"),
      },
      {
        find: "@atlas/domain-config",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/config/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/domain-tenancy\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/domain/tenancy/src/$1.ts"),
      },
      {
        find: "@atlas/domain-tenancy",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/tenancy/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/domain-branding\/(.+)$/,
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/branding/src/$1.ts",
        ),
      },
      {
        find: "@atlas/domain-branding",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/branding/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/domain-access\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/domain/access/src/$1.ts"),
      },
      {
        find: "@atlas/domain-access",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/access/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/domain-identity\/(.+)$/,
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/identity/src/$1.ts",
        ),
      },
      {
        find: "@atlas/domain-identity",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/domain/identity/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/domain\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/domain/src/$1.ts"),
      },
      {
        find: "@atlas/domain",
        replacement: path.resolve(import.meta.dirname, "backend/packages/domain/src/index.ts"),
      },
      {
        find: /^@atlas\/audit\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/audit/src/$1.ts"),
      },
      {
        find: "@atlas/audit",
        replacement: path.resolve(import.meta.dirname, "backend/packages/audit/src/index.ts"),
      },
      {
        find: /^@atlas\/events\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/events/src/$1.ts"),
      },
      {
        find: "@atlas/events",
        replacement: path.resolve(import.meta.dirname, "backend/packages/events/src/index.ts"),
      },
      {
        find: /^@atlas\/storage\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/storage/src/$1.ts"),
      },
      {
        find: "@atlas/storage",
        replacement: path.resolve(import.meta.dirname, "backend/packages/storage/src/index.ts"),
      },
      {
        find: /^@atlas\/security\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/security/src/$1.ts"),
      },
      {
        find: /^@atlas\/observability\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/observability/src/$1.ts"),
      },
      {
        find: "@atlas/observability",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/observability/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/tenant-config\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "backend/packages/tenant-config/src/$1.ts"),
      },
      {
        find: "@atlas/tenant-config",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/tenant-config/src/index.ts",
        ),
      },
      {
        find: /^@atlas\/release-readiness\/(.+)$/,
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/release-readiness/src/$1.ts",
        ),
      },
      {
        find: "@atlas/release-readiness",
        replacement: path.resolve(
          import.meta.dirname,
          "backend/packages/release-readiness/src/index.ts",
        ),
      },
      {
        find: "@atlas/security",
        replacement: path.resolve(import.meta.dirname, "backend/packages/security/src/index.ts"),
      },
      {
        find: /^@atlas\/contracts\/(.+)$/,
        replacement: path.resolve(import.meta.dirname, "frontend/packages/contracts/src/$1.ts"),
      },
      {
        find: "@atlas/contracts",
        replacement: path.resolve(import.meta.dirname, "frontend/packages/contracts/src/index.ts"),
      },
    ],
  },
});
