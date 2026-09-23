import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
import { getFileInfo } from "prettier";
import { pathToFileURL } from "node:url";

const repository = resolve(import.meta.dirname, "../..");
const productCoverage = "backend/apps/api/src/app/api/v1/locales/coverage/route.ts";
const generatedCoverage = [
  "coverage/coverage-final.json",
  "backend/apps/api/coverage/coverage-final.json",
  "backend/packages/db/coverage/coverage-final.json",
  "backend/packages/domain/access/coverage/coverage-final.json",
  "frontend/apps/web/coverage/coverage-final.json",
  "frontend/packages/contracts/coverage/coverage-final.json",
];

test("Git and Docker ignore patterns preserve source and exclude generated coverage reports", () => {
  const root = mkdtempSync(join(tmpdir(), "atlas-coverage-ignore-"));
  try {
    assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
    // These root-relative directory globs have the same matching semantics in both files.
    for (const ignoreFile of [".gitignore", ".dockerignore"]) {
      writeFileSync(join(root, ".gitignore"), readFileSync(join(repository, ignoreFile)));
      for (const path of [...generatedCoverage, productCoverage]) {
        const result = spawnSync("git", ["check-ignore", "--no-index", path], {
          cwd: root,
          encoding: "utf8",
        });
        assert.equal(result.status, path === productCoverage ? 1 : 0, `${ignoreFile}: ${path}`);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ESLint and Prettier inspect the product coverage route but skip generated reports", async () => {
  const eslint = new ESLint({ cwd: repository });
  for (const path of [...generatedCoverage, productCoverage]) {
    const ignored = path !== productCoverage;
    assert.equal(await eslint.isPathIgnored(join(repository, path)), ignored, path);
    assert.equal(
      (
        await getFileInfo(join(repository, path), {
          ignorePath: join(repository, ".prettierignore"),
        })
      ).ignored,
      ignored,
      path,
    );
  }
});

test("required source guards inspect coverage source while excluding workspace reports", () => {
  const root = mkdtempSync(join(tmpdir(), "atlas-coverage-guards-"));
  const guards = [
    "guards/check-prisma-boundary.mjs",
    "guards/check-secrets.mjs",
    "guards/check-forbidden-scope.mjs",
    "guards/check-audit-compliance.mjs",
    "guards/check-outbox-compliance.mjs",
    "db/check-no-session-tenant-set.mjs",
    "db/check-sql-approved-paths.mjs",
  ];
  const source = [
    'import { PrismaClient } from "@prisma/client";',
    "export function createTenant() {}",
    "sendEmail();",
    'const product = "challengeCheckout";',
    `const secret = "${["AKIA", "0123456789ABCDEF"].join("")}";`,
    `const query = "${["SET", "app.tenant_id = 1"].join(" ")}";`,
  ].join("\n");
  const put = (directory) => {
    mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(join(root, directory, "fixture.ts"), source);
    writeFileSync(join(root, directory, "fixture.sql"), ["SET", "app.tenant_id = 1;"].join(" "));
  };
  const run = (script) =>
    spawnSync(process.execPath, [join(repository, "scripts", script)], {
      cwd: root,
      encoding: "utf8",
      timeout: 30000,
    });
  try {
    mkdirSync(join(root, "backend/apps/api/src"), { recursive: true });
    for (let i = 0; i < 500; i += 1)
      writeFileSync(join(root, `backend/apps/api/src/fixture-${i}.ts`), "export {};\n");
    put("backend/apps/api/coverage");
    for (const script of guards) {
      const result = run(script);
      assert.equal(result.status, 0, `${script}: ${result.stderr}`);
    }
    put("backend/apps/api/src/app/api/v1/locales/coverage");
    for (const script of guards) {
      const result = run(script);
      assert.equal(result.status, 1, `${script}: ${result.stderr}`);
      assert.match(result.stderr.replaceAll("\\", "/"), /src\/app\/api\/v1\/locales\/coverage/);
    }
    const walkerUrl = pathToFileURL(join(repository, "scripts/ci/lib/page-reachability.mjs")).href;
    const traversal = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { walkFiles } from ${JSON.stringify(walkerUrl)}; console.log(JSON.stringify(walkFiles('.')));`,
      ],
      { cwd: root, encoding: "utf8", timeout: 10000 },
    );
    assert.equal(traversal.status, 0, traversal.stderr);
    const paths = JSON.parse(traversal.stdout).map((path) => path.replaceAll("\\", "/"));
    assert.ok(paths.includes("backend/apps/api/src/app/api/v1/locales/coverage/fixture.ts"));
    assert.ok(!paths.some((path) => path.startsWith("backend/apps/api/coverage/")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const guard = resolve(import.meta.dirname, "check-prisma-boundary.mjs");
test("Prisma boundary ignores generated verification builds but still rejects real source imports", () => {
  const root = mkdtempSync(join(tmpdir(), "atlas-guard-output-"));
  try {
    for (const dir of [".next", ".next-e2e", ".next-perf"]) {
      const folder = join(root, "frontend/apps/web", dir);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "compiled.js"), 'import { PrismaClient } from "@prisma/client";');
    }
    const run = () =>
      spawnSync(process.execPath, [guard], { cwd: root, encoding: "utf8", timeout: 10000 });
    assert.equal(run().status, 0);
    const folder = join(root, "frontend/apps/web/src");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "bad.ts"), 'import { PrismaClient } from "@prisma/client";');
    const rejected = run();
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /src.bad.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
