import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Audit finding M9 — `server-only` markers.
 *
 * Zero files in the frontend imported `server-only`, so nothing at the language
 * level stopped a server module being pulled into a client component. The
 * existing `check-learner-bundle-boundary` guard covers part of the same ground,
 * but only for the learner bundle and only by matching import paths as text — it
 * cannot see a service reached through a re-export, and it says nothing about
 * admin, studio or platform code.
 *
 * `import "server-only"` is enforced by the bundler rather than by convention:
 * the package resolves to a module that throws at build time if it lands in a
 * client graph. Marking the directory was a no-op at the time it was applied —
 * the production build stayed green across all 200 modules, which means nothing
 * was leaking. The value is that the next leak fails the build instead of
 * shipping.
 *
 * This test keeps the marker from decaying: a new file under `src/server`
 * without it would otherwise reopen the hole silently.
 */

const repoRoot = resolve(import.meta.dirname, "..", "..");
const serverRoot = join(repoRoot, "frontend/apps/web/src/server");

const MARKER = 'import "server-only";';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, out);
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

describe("server-only markers (M9)", () => {
  const files = walk(serverRoot);

  it("finds the module tree it is meant to be checking", () => {
    // Guards the guard. If the walk stopped matching, every assertion below
    // would pass vacuously — the same failure mode that let four CI guards
    // scan zero files earlier in this programme.
    expect(files.length).toBeGreaterThan(150);
  });

  it("marks every module under src/server", () => {
    const unmarked = files
      .filter((file) => !readFileSync(file, "utf8").includes(MARKER))
      .map((file) => relative(repoRoot, file).replace(/\\/g, "/"));

    expect(unmarked, `these need \`${MARKER}\``).toEqual([]);
  });

  it("has no client component hiding under src/server", () => {
    // A file carrying both markers would fail the build; one carrying only
    // "use client" would sit in a server directory while shipping to browsers.
    const clientish = files
      .filter((file) => /^\s*["']use client["']/m.test(readFileSync(file, "utf8")))
      .map((file) => relative(repoRoot, file).replace(/\\/g, "/"));

    expect(clientish).toEqual([]);
  });
});
