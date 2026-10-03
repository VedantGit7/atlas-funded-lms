import { test } from "node:test";
import process from "node:process";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("scripts/ci/check-learner-bundle-boundary.mjs");
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), "atlas-bundle-"));
  const build = join(root, "frontend/apps/web/.next-perf");
  mkdirSync(join(build, "server/app/courses"), { recursive: true });
  mkdirSync(join(build, "static/chunks"), { recursive: true });
  mkdirSync(join(root, "configs"), { recursive: true });
  writeFileSync(join(build, "BUILD_ID"), "fixture-build");
  writeFileSync(
    join(build, "server/app-paths-manifest.json"),
    JSON.stringify({ "/courses/page": "app/courses/page.js" }),
  );
  writeFileSync(
    join(build, "build-manifest.json"),
    JSON.stringify({ rootMainFiles: ["static/chunks/root.js"] }),
  );
  writeFileSync(join(build, "static/chunks/root.js"), "console.log('learner');");
  writeFileSync(
    join(build, "server/app/courses/page_client-reference-manifest.js"),
    'globalThis.__RSC_MANIFEST["/courses/page"] = {"entryJSFiles":{}};',
  );
  writeFileSync(
    join(root, "configs/learner-bundle-baseline.json"),
    JSON.stringify({ maxLearnerFirstLoadKb: 1, targetKb: 150 }),
  );
  const exec = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      env: { ...process.env, ATLAS_PERF_BUILD: "1" },
      encoding: "utf8",
    });
  try {
    run({ root, build, exec });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("measures the explicitly isolated performance build", () =>
  fixture(({ exec }) => {
    const result = exec();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 learner routes measured/);
  }));
test("missing referenced chunks fail instead of becoming zero bytes", () =>
  fixture(({ build, exec }) => {
    rmSync(join(build, "static/chunks/root.js"));
    const result = exec();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing bundle chunk/);
  }));
test("incomplete production build fails even if manifests remain", () =>
  fixture(({ build, exec }) => {
    rmSync(join(build, "BUILD_ID"));
    const result = exec();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /BUILD_ID/);
  }));
test("an unreadable route manifest cannot silently reduce coverage", () =>
  fixture(({ build, exec }) => {
    writeFileSync(join(build, "server/app/broken_client-reference-manifest.js"), "broken");
    const result = exec();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid route manifest/);
  }));
test("a missing route artifact cannot silently reduce coverage", () =>
  fixture(({ build, exec }) => {
    writeFileSync(
      join(build, "server/app-paths-manifest.json"),
      JSON.stringify({
        "/courses/page": "app/courses/page.js",
        "/assessments/page": "app/assessments/page.js",
      }),
    );
    const result = exec();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing route manifest/);
  }));
test("updating the baseline may never increase its allowance", () =>
  fixture(({ root, exec }) => {
    const file = join(root, "configs/learner-bundle-baseline.json");
    const before = JSON.stringify({ maxLearnerFirstLoadKb: 0.01, targetKb: 150 });
    writeFileSync(file, before);
    const result = exec("--update-baseline");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /may only decrease/);
    assert.equal(readFileSync(file, "utf8"), before);
  }));
test("normal checks reject even a sub-half-kilobyte ratchet regression", () =>
  fixture(({ root, exec }) => {
    writeFileSync(
      join(root, "configs/learner-bundle-baseline.json"),
      JSON.stringify({ maxLearnerFirstLoadKb: 0.01, targetKb: 150 }),
    );
    const result = exec();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /first-load regression/);
  }));

test("a decreased baseline still accepts the identical build without rounding regressions", () =>
  fixture(({ exec, build }) => {
    writeFileSync(join(build, "static/chunks/root.js"), "console.log(1);");
    assert.equal(exec("--update-baseline").status, 0);
    const result = exec();
    assert.equal(result.status, 0, result.stderr);
  }));
