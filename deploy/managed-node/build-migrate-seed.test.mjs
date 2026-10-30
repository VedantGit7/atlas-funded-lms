import process from "node:process";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

/**
 * The migration job seeds the global catalogues from this bundle
 * (build-migrate-seed.mjs). The Docker build only builds it, so this checks
 * the bundle is one self-contained module without the seed CLI.
 */
test("bundles the global catalogue seed into one module the migration job runs", (t) => {
  const outdir = mkdtempSync(join(tmpdir(), "atlas-migrate-seed-"));
  t.after(() => rmSync(outdir, { recursive: true, force: true }));
  const summary = JSON.parse(
    execFileSync(process.execPath, ["deploy/managed-node/build-migrate-seed.mjs", outdir], {
      encoding: "utf8",
    }),
  );

  assert.deepEqual(readdirSync(outdir), ["global-catalogues.mjs"]);
  assert.equal(summary.outputs, 1);
  const code = readFileSync(join(outdir, "global-catalogues.mjs"), "utf8");
  assert.match(code, /runSeeds\("global", "apply"\)/);
  // The seed CLI (index.ts) would also run its own main() inside the bundle.
  assert.doesNotMatch(code, /\[seed\] group=/);
  // The job calls it by this path (scripts/db/migration-job.mjs).
  assert.match(
    readFileSync("scripts/db/migration-job.mjs", "utf8"),
    /join\(repoRoot, "seed", "global-catalogues\.mjs"\)/,
  );
});
