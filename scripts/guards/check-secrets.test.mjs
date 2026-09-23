import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { test } from "node:test";

const repository = resolve(import.meta.dirname, "../..");
const guard = join(repository, "scripts/guards/check-secrets.mjs");
const reviewedFiles = [
  "scripts/db/test-cleanup-boundary.test.mjs",
  "scripts/db/verify-proctoring-integrity.mjs",
  "scripts/db/verify-test-cleanup.mjs",
  "scripts/e2e/local-env.mjs",
  "scripts/e2e/local-stack.compose.yml",
  "scripts/perf/microbenchmark-guard.test.mjs",
  "scripts/security/verify-f19-event-trigger.mjs",
];

function fixture(t) {
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, "atlas-secret-guard-"));
  t.after(() => {
    assert.ok(resolve(root).startsWith(`${parent}${sep}`));
    rmSync(root, { recursive: true, force: true });
  });
  const put = (path, content) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  // Exercise the unchanged minimum-coverage guard without a test-only bypass.
  for (let i = 0; i < 500; i += 1) put(`backend/src/fixture-${i}.ts`, "export {};\n");
  const run = () =>
    spawnSync(process.execPath, [guard], { cwd: root, encoding: "utf8", timeout: 30000 });
  return { put, run };
}

for (const path of reviewedFiles) {
  test(`approved disposable literals pass but an additional credential fails in ${path}`, (t) => {
    const { put, run } = fixture(t);
    const source = readFileSync(join(repository, path), "utf8");
    put(path, source);
    const approved = run();
    assert.equal(approved.status, 0, approved.stderr);

    const literal = source.match(/postgres(?:ql)?:\/\/[^"'`\s]+:[^"'`\s]+@[^"'`\s]+/)?.[0];
    assert.ok(literal, "the real fixture must still contain a credential-shaped URL");
    const injected = new URL(literal);
    injected.password = "additional-synthetic-credential";
    // Put the unexpected value after the approved one to catch first-match-only scans.
    put(path, `${source}\n// ${injected.href}\n`);
    const rejected = run();
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /Database URL/);
    assert.ok(rejected.stderr.replaceAll("\\", "/").includes(path));
    assert.ok(!rejected.stderr.includes(injected.password));
  });
}

test("approval does not follow a fixture URL into an unreviewed source path", (t) => {
  const { put, run } = fixture(t);
  put("backend/src/copied-fixture.ts", readFileSync(join(repository, reviewedFiles[3]), "utf8"));
  const rejected = run();
  assert.equal(rejected.status, 1, rejected.stderr);
  assert.match(rejected.stderr, /Database URL/);
});

test("approval does not permit a changed host or query on a reviewed literal", (t) => {
  const { put, run } = fixture(t);
  const path = reviewedFiles[3];
  const source = readFileSync(join(repository, path), "utf8");
  const literal = source.match(/postgres(?:ql)?:\/\/[^"'`\s]+:[^"'`\s]+@[^"'`\s]+/)[0];
  for (const mutation of [
    (url) => {
      url.hostname = "unreviewed.example";
    },
    (url) => {
      url.searchParams.set("host", "unreviewed.example");
    },
  ]) {
    const changed = new URL(literal);
    mutation(changed);
    put(path, source.replace(literal, changed.href));
    const rejected = run();
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.match(rejected.stderr, /Database URL/);
  }
});

test("other secret patterns remain active in reviewed fixture files", (t) => {
  const { put, run } = fixture(t);
  const path = reviewedFiles[3];
  const source = readFileSync(join(repository, path), "utf8");
  const syntheticKey = ["AKIA", "0123456789ABCDEF"].join("");
  put(path, `${source}\n// ${syntheticKey}\n`);
  const rejected = run();
  assert.equal(rejected.status, 1, rejected.stderr);
  assert.match(rejected.stderr, /AWS-style access key/);
  assert.ok(!rejected.stderr.includes(syntheticKey));
});
