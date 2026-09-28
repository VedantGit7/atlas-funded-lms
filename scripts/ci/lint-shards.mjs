/**
 * The single source of truth for ESLint sharding.
 *
 * Consumed by both scripts/ci/run-lint.mjs (which lints each shard in its own
 * process) and scripts/ci/check-lint-coverage.mjs (which asserts the shards
 * together cover everything `eslint .` would lint). Keeping one list means the
 * runner and the coverage guard cannot drift apart.
 *
 * Ordered largest-first so failures surface early.
 */
export const LINT_SHARDS = [
  "frontend/apps",
  "backend/apps",
  "backend/packages",
  "frontend/packages",
  "backend/prisma",
  "backend/prisma.generate.config.ts",
  "deploy",
  "scripts",
  "tests",
  // Previously JSON-only; now holds shared ESM config (security-headers.mjs).
  "configs",
  // Audit evidence can include executable measurement helpers.
  "docs/engineering/audits",
  // Root-level config and stray files that no directory shard covers.
  "*.{ts,mts,cts,tsx,mjs,cjs,js,jsx}",
];
