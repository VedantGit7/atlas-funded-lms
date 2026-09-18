import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { LINT_SHARDS } from "./lint-shards.mjs";

/**
 * Assert that the shards in scripts/ci/lint-shards.mjs lint every file that a
 * plain `eslint .` would have linted.
 *
 * run-lint.mjs replaced a single `eslint .` invocation (which OOM-aborted) with
 * per-directory shards. Sharding trades a loud crash for the risk of a silent
 * coverage hole — and the first version of this guard only compared top-level
 * directories, which was too coarse: it reported "backend is covered" while the
 * shards were `backend/apps` and `backend/packages`, silently dropping
 * backend/prisma/seeds (12 files) and backend/prisma.config.ts.
 *
 * This version walks the real file tree and asks ESLint itself which files it
 * would ignore, so the check cannot drift from ESLint's actual configuration.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const LINTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

// Never walked: huge, and ESLint ignores them anyway.
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "out",
  ".turbo",
]);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, acc);
    } else if (LINTABLE.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Directory shards cover any file beneath them; the root glob covers root files. */
function isCoveredByShard(relPath) {
  const normalised = relPath.split(sep).join("/");
  for (const shard of LINT_SHARDS) {
    if (shard.includes("*")) {
      // Root-level glob shard, e.g. "*.{ts,mjs,cjs,js}" — no directory separator.
      if (!normalised.includes("/")) return true;
      continue;
    }
    if (normalised === shard || normalised.startsWith(`${shard}/`)) return true;
  }
  return false;
}

const eslint = new ESLint({ cwd: repoRoot });
const uncovered = [];

for (const file of walk(repoRoot)) {
  const relPath = relative(repoRoot, file);
  if (isCoveredByShard(relPath)) continue;
  // Not in a shard — only acceptable if ESLint would have ignored it anyway.
  if (await eslint.isPathIgnored(file)) continue;
  uncovered.push(relPath.split(sep).join("/"));
}

if (uncovered.length > 0) {
  console.error(
    `\nLint coverage check FAILED: ${uncovered.length} file(s) would be linted by ` +
      `\`eslint .\` but are not covered by any shard.\n`,
  );
  for (const file of uncovered.slice(0, 40)) {
    console.error(`- ${file}`);
  }
  if (uncovered.length > 40) {
    console.error(`  …and ${uncovered.length - 40} more`);
  }
  console.error("\nAdd the missing path to LINT_SHARDS in scripts/ci/lint-shards.mjs.");
  process.exit(1);
}

console.log("Lint shard coverage OK: every file ESLint would lint is covered by a shard.");
