import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every suite under `tests/` must be reachable from the root `test` script.
 *
 * This exists because four of them were not, and nobody could tell:
 *
 * - `tests/integration` (65 files, 258 tests) ran in no script and no CI job.
 *   The job *named* `integration-tests` ran `tests/db`.
 * - `tests/api` and `tests/ci` (26 files, 127 tests) were referenced nowhere at
 *   all. Eleven of those tests were failing.
 * - `tests/security`, `tests/events` and `tests/lint-rules` had no CI job —
 *   `tests/lint-rules` being the 33 structural checks relocated in Phase 3
 *   section 3.6, which the relocation would otherwise have quietly dropped from
 *   CI entirely.
 *
 * A suite that runs nowhere is worse than a missing one: the directory, the
 * filenames and the assertions all say the behaviour is covered. This check is
 * the reason a future suite cannot repeat that.
 *
 * It deliberately reads the root `test` script rather than the workflow file,
 * because that script is what `pnpm ci` runs and what CI jobs call into. A new
 * directory therefore has to be added there, which is the one place a reader
 * looks to answer "what does the test suite consist of".
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const testsRoot = join(repoRoot, "tests");

/** Directories that hold shared machinery, not suites. */
const NOT_SUITES = new Set(["fixtures", "browser"]);

function hasTestFiles(dir: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (hasTestFiles(join(dir, entry.name))) return true;
      continue;
    }
    if (/\.(test|spec)\.[cm]?tsx?$/.test(entry.name)) return true;
  }
  return false;
}

describe("test suite wiring", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };

  // Resolve `pnpm test:x` references so the check follows the same indirection
  // a developer does, rather than demanding every path appear in one string.
  function expandedTestScript(): string {
    let expanded = pkg.scripts["test"] ?? "";
    for (let depth = 0; depth < 5; depth += 1) {
      const next = expanded.replace(
        /pnpm (test:[a-z0-9-]+)/g,
        (match, name: string) => pkg.scripts[name] ?? match,
      );
      if (next === expanded) break;
      expanded = next;
    }
    return expanded;
  }

  const suiteDirs = readdirSync(testsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_SUITES.has(entry.name))
    .map((entry) => entry.name)
    .filter((name) => hasTestFiles(join(testsRoot, name)));

  it("finds the suites it is meant to be checking", () => {
    // Guards the guard: if the walk stopped matching test files this check
    // would pass vacuously, which is the failure mode it exists to prevent.
    expect(suiteDirs.length).toBeGreaterThanOrEqual(8);
    expect(suiteDirs).toContain("integration");
    expect(suiteDirs).toContain("api");
  });

  it.each(suiteDirs)("tests/%s is reachable from the root test script", (dir) => {
    expect(expandedTestScript()).toContain(`tests/${dir}`);
  });

  it("has a browser suite that is run separately by design", () => {
    // Playwright, not vitest — `test:browser` drives it, and it is excluded
    // above rather than forgotten.
    expect(pkg.scripts["test:browser"]).toBeDefined();
    expect(statSync(join(testsRoot, "browser")).isDirectory()).toBe(true);
  });
});
