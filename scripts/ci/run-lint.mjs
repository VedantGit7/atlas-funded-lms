import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LINT_SHARDS } from "./lint-shards.mjs";

/**
 * Run ESLint in bounded shards.
 *
 * A single `eslint .` over this monorepo exhausts the V8 heap and aborts with
 * SIGABRT (exit 134). The cause is type-aware linting (`projectService: true`)
 * holding TypeScript programs for ~3,000 files in one process.
 *
 * Sharding is used rather than simply raising --max-old-space-size because CI
 * runners cap out around 7 GB, and a single process was still thrashing at 6 GB.
 * Each shard is a fresh process with its own heap, so peak memory is bounded by
 * the largest shard rather than the whole repo.
 *
 * `pnpm -r lint` is NOT a substitute: 25 of the 28 workspace lint scripts are
 * `echo` placeholders, so it would silently lint almost nothing.
 *
 * Shard list lives in ./lint-shards.mjs, shared with check-lint-coverage.mjs so
 * the runner and the coverage guard cannot drift apart.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const eslintBin = join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");
const HEAP_MB = Number(process.env.LINT_HEAP_MB ?? "4096");

const SHARDS = LINT_SHARDS;

if (!existsSync(eslintBin)) {
  console.error(`ESLint not found at ${eslintBin}. Run pnpm install.`);
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
let failed = 0;

for (const shard of SHARDS) {
  process.stdout.write(`\n=== lint ${shard} ===\n`);

  const result = spawnSync(
    process.execPath,
    [`--max-old-space-size=${HEAP_MB}`, eslintBin, shard, "--max-warnings=0", ...extraArgs],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );

  if (result.error) {
    console.error(`Shard "${shard}" failed to start: ${result.error.message}`);
    failed += 1;
    continue;
  }

  // 134 = SIGABRT, historically the V8 OOM signature for this repo.
  if (result.status === 134 || result.signal === "SIGABRT") {
    console.error(
      `\nShard "${shard}" ran out of memory at ${HEAP_MB} MB. ` +
        `Raise LINT_HEAP_MB or split this shard further.`,
    );
    failed += 1;
    continue;
  }

  if (result.status !== 0) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\nLint FAILED in ${failed} shard(s).`);
  process.exit(1);
}

console.log("\nLint passed in all shards.");
