/**
 * Single source of truth for automated-test tenant slugs.
 *
 * Test fixtures provision throwaway tenants whose slugs follow `<prefix>-<8 hex>`.
 * Both the cleanup tooling (purge script, leak guard, global teardown) and the
 * fixtures themselves import from here so the matching logic can never drift from
 * the slugs that are actually created.
 *
 * Authored as `.mjs` (with a sibling `.d.mts`) so plain-node scripts and the
 * TypeScript test suite can share it without a build step.
 */

// Slug prefixes used by test fixtures. Each generated slug is `<prefix>-<8 hex>`.
export const TEST_TENANT_SLUG_PREFIXES = [
  "sprint0-a",
  "sprint0-b",
  "iso-prov-a",
  "iso-prov-b",
  "brand-dom",
  "smoke-tenant",
  "second-smoke-academy",
];

// Real tenants that must never be treated as test data, regardless of slug shape.
export const PROTECTED_TENANT_SLUGS = ["fundedbeyond", "dev"];

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// POSIX regex matching exactly the fixture-created slugs (prefix + 8 hex chars).
export const TEST_TENANT_SLUG_REGEX = `^(${TEST_TENANT_SLUG_PREFIXES.map(escapeForRegex).join("|")})-[0-9a-f]{8}$`;

/**
 * Build a test-tenant slug from an approved prefix and a suffix.
 * Throws if the prefix is not registered, so new fixtures can't silently drift
 * out of the cleanup net.
 */
export function buildTestTenantSlug(prefix, suffix) {
  if (!TEST_TENANT_SLUG_PREFIXES.includes(prefix)) {
    throw new Error(
      `Unregistered test tenant slug prefix "${prefix}". ` +
        `Add it to TEST_TENANT_SLUG_PREFIXES in scripts/db/test-tenant-slugs.mjs.`,
    );
  }
  return `${prefix}-${suffix}`;
}
