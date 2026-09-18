import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards must run, and must be pointed at code that exists.
 *
 * Two failure modes, both of which this repository has produced repeatedly and
 * both of which look identical to success:
 *
 * 1. A guard nobody invokes. `lint:coverage` — which asserts the lint shards
 *    still cover every file, the whole risk introduced by sharding — was in
 *    `package.json` and in no workflow. `db:sql:check` likewise.
 *
 * 2. A guard invoked but aimed at nothing. `check-no-session-tenant-set.mjs`
 *    scanned `["prisma", "packages", "apps"]`, which have not existed since the
 *    F-1 monorepo split. `walkFiles` swallowed the ENOENT, returned `[]`, and
 *    the guard passed having inspected none of the tenant-scoped code. Its
 *    sibling in the same npm script carries a comment describing exactly this
 *    bug, fixed there and missed here.
 *
 * A guard that scans zero files is worse than no guard: it is a green check
 * that certifies nothing.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const workflowDir = join(repoRoot, ".github", "workflows");

const workflows = readdirSync(workflowDir)
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => readFileSync(join(workflowDir, file), "utf8"))
  .join("\n");

describe("guards run in the pipeline", () => {
  it("reads the workflows it is checking", () => {
    expect(workflows.length).toBeGreaterThan(1000);
  });

  it.each([
    ["lint shard coverage", "pnpm lint:coverage"],
    ["static SQL guards", "pnpm db:sql:check"],
    ["forbidden scope", "pnpm check:forbidden-scope"],
    ["prisma boundary", "pnpm check:prisma-boundary"],
    ["route metadata", "pnpm check:route-metadata"],
    ["secrets", "pnpm check:secrets"],
  ])("%s runs in CI", (_label, command) => {
    expect(workflows).toContain(command);
  });
});

describe("guards are aimed at directories that exist", () => {
  /**
   * Read the `roots` array a scanning guard declares and check each path is
   * real. A root that does not exist is silently skipped at runtime, so this is
   * the only place the mistake is visible.
   */
  const scanners = [
    "scripts/db/check-no-session-tenant-set.mjs",
    "scripts/db/check-sql-approved-paths.mjs",
  ];

  it.each(scanners)("%s declares only real paths", (scanner) => {
    const source = readFileSync(join(repoRoot, scanner), "utf8");
    // Accept both spellings: one guard writes "backend/prisma/sql/rls/" with a
    // trailing slash, the other writes "backend/packages" without.
    const quoted = source.match(/"(backend|frontend)\/[a-z0-9/_.-]*"/gi) ?? [];
    const paths = [...new Set(quoted.map((match) => match.slice(1, -1)))];

    // The guard must name at least one real tree, and every tree it names must
    // exist — otherwise it walks nothing and reports success.
    expect(paths.length).toBeGreaterThan(0);
    const missing = paths.filter((candidate) => !existsSync(join(repoRoot, candidate)));
    expect(missing).toEqual([]);
  });

  it("the session-tenant guard covers the backend and frontend trees", () => {
    // Naming `scripts` alone is what it did for the whole life of the split:
    // technically a real path, and none of the code that opens tenant
    // transactions.
    const source = readFileSync(
      join(repoRoot, "scripts/db/check-no-session-tenant-set.mjs"),
      "utf8",
    );
    expect(source).toContain("backend/packages");
    expect(source).toContain("backend/apps");
    expect(source).toContain("frontend/apps");
  });
});
