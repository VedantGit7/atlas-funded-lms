import process from "node:process";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

/**
 * The worker image runs a bundle (build-worker.mjs). Its Docker build runs the
 * same checks with Chromium; this catches a broken bundle in seconds.
 */
test("bundles the worker into self-contained modules a scanner can still read", (t) => {
  const outdir = mkdtempSync(join(tmpdir(), "atlas-worker-bundle-"));
  t.after(() => rmSync(outdir, { recursive: true, force: true }));
  const summary = JSON.parse(
    execFileSync(process.execPath, ["deploy/managed-node/build-worker.mjs", outdir], {
      encoding: "utf8",
    }),
  );

  for (const entry of [
    "worker.mjs",
    "check-worker-imports.mjs",
    "check-worker-runtime.mjs",
    "rerender-certificate-pdfs.mjs",
  ]) {
    assert.equal(existsSync(join(outdir, entry)), true, entry);
  }

  const modules = readdirSync(outdir).filter((file) => file.endsWith(".mjs"));
  const code = modules.map((file) => readFileSync(join(outdir, file), "utf8")).join("\n");
  // Data loaded beside a package's own code does not exist beside a bundle.
  assert.doesNotMatch(code, /createRequire\w*\(import\.meta\.url\)\s*;\s*\w+ = \w+\("\.\.?\//);
  assert.doesNotMatch(code, /default-stylesheet\.css/);
  assert.doesNotMatch(code, /require\.resolve\("\.\/xhr-sync-worker\.js"\)/);

  // Every bundled package is visible to an image scanner.
  const manifests = readdirSync(join(outdir, "bundled-packages", "node_modules"), {
    recursive: true,
  }).filter((file) => String(file).endsWith("package.json"));
  assert.equal(manifests.length, summary.bundledPackages);
  assert.ok(summary.bundledPackages > 100);

  const imports = execFileSync(process.execPath, ["check-worker-imports.mjs"], {
    cwd: outdir,
    encoding: "utf8",
    env: { ...process.env, APP_ENV: "test", NODE_ENV: "test" },
  });
  assert.match(imports, /"passed":true/);
});
