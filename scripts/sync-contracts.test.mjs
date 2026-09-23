import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const trees = [
  "backend/apps/api/src/server",
  ...["branding", "identity", "config", "access"].map(
    (name) => `backend/packages/domain/${name}/src/schemas`,
  ),
];
const files = [
  "backend/packages/domain/config/src/cost-attribution.catalog.ts",
  "backend/packages/domain/branding/src/utils/public-landing-projection.ts",
  "backend/packages/domain/branding/src/utils/theme-semantic-tokens.ts",
  "backend/packages/membership/src/schemas.ts",
  "backend/packages/membership/src/schemas/shared.ts",
  "backend/packages/membership/src/schemas/admin-members.ts",
  "backend/packages/membership/src/notification-preferences.catalog.ts",
  "backend/packages/events/src/event-types.ts",
  "backend/packages/audit/src/schemas/audit.ts",
  "backend/apps/api/src/server/certificates/certificate-design-document.ts",
  "backend/apps/api/src/server/marketing-workflows/marketing-workflow.graph.ts",
];
const manual = [
  "access/permission-guards.ts",
  "item-registry/answer-contracts.ts",
  ...["theme-contrast", "theme-css-vars", "theme-diff", "theme-presets"].map(
    (name) => `domain-branding/utils/${name}.ts`,
  ),
];

function fixture(t) {
  const root = mkdtempSync(join(scriptDir, ".contract-sync-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, text = "export {};\n") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  for (const tree of trees) {
    write(`${tree}/fixture.schemas.ts`);
  }
  for (const file of files) write(file);
  write("backend/packages/db/src/secret.ts", "export type Secret = string;\n");
  for (const file of manual) write(`frontend/packages/contracts/src/${file}`);
  write("scripts/sync-contracts.mjs", readFileSync(join(scriptDir, "sync-contracts.mjs"), "utf8"));
  write(
    "tsconfig.base.json",
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@runtime/*": ["backend/packages/db/src/*"],
        },
      },
    }),
  );
  const run = (...args) =>
    spawnSync(process.execPath, [join(root, "scripts/sync-contracts.mjs"), ...args], {
      cwd: root,
      encoding: "utf8",
    });
  const sync = () => {
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const target = "frontend/packages/contracts/src";
  const snapshot = () => {
    const walk = (dir) =>
      readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(`${dir}/${entry.name}`)
          : [
              [
                `${dir}/${entry.name}`,
                readFileSync(join(root, dir, entry.name), "utf8"),
                statSync(join(root, dir, entry.name)).mtimeMs,
              ],
            ],
      );
    return walk(target);
  };
  return { root, write, run, sync, snapshot, target };
}

test("--check reports changed, missing and orphan files without writing", (t) => {
  const f = fixture(t);
  f.sync();
  f.write(`${f.target}/fixture.schemas.ts`, "export const stale = true;\n");
  rmSync(join(f.root, f.target, "membership/schemas.ts"));
  f.write(`${f.target}/removed.schemas.ts`);
  const before = f.snapshot();
  const result = f.run("--check");
  assert.equal(result.status, 1, "drift must fail the check");
  assert.match(result.stdout + result.stderr, /changed: fixture.schemas.ts/);
  assert.match(result.stdout + result.stderr, /missing: membership\/schemas.ts/);
  assert.match(result.stdout + result.stderr, /orphan: removed.schemas.ts/);
  assert.deepEqual(f.snapshot(), before, "check must not repair drift");
});

test("sync repairs drift, removes orphans, preserves handwritten utilities and is idempotent", (t) => {
  const f = fixture(t);
  const custom = "// handwritten utility\nexport const permission = true;\n";
  f.write(`${f.target}/access/permission-guards.ts`, custom);
  f.write(`${f.target}/orphan.ts`);
  f.sync();
  const once = f.snapshot();
  assert.equal(once.find(([name]) => name.endsWith("access/permission-guards.ts"))[1], custom);
  assert.ok(!once.some(([name]) => name.endsWith("/orphan.ts")));
  f.sync();
  assert.deepEqual(f.snapshot(), once);
  assert.equal(f.run("--check").status, 0);
  assert.deepEqual(f.snapshot(), once, "a clean check must not touch modification times either");
});

for (const statement of [
  'import { db } from "@atlas/db";',
  'export * from "@atlas/api-server/secret";',
  'export type { Secret } from "@runtime/secret";',
  'type Secret = import("@atlas/db").Secret;',
  'const secret = import("@atlas/auth");',
  'const secret = require("node:crypto");',
  'import secret = require("@atlas/db");',
  'import "../../../../backend/packages/db/src/secret";',
  'import { secret } from "./secret.service";',
  'const moduleName = "@atlas/db"; const secret = import(moduleName);',
]) {
  test(`rejects forbidden dependency: ${statement}`, (t) => {
    const f = fixture(t);
    f.write("backend/apps/api/src/server/fixture.schemas.ts", `${statement}\nexport {};\n`);
    const before = f.snapshot();
    const result = f.run();
    assert.equal(result.status, 1, "forbidden dependencies must fail before writing");
    assert.match(result.stdout + result.stderr, /forbidden|unresolved|nonliteral/i);
    assert.deepEqual(f.snapshot(), before);
  });
}

test("validates handwritten dependencies too", (t) => {
  const f = fixture(t);
  f.write(`${f.target}/access/permission-guards.ts`, 'export * from "@atlas/db";\n');
  assert.equal(f.run().status, 1);
});

test("allows local schema and browser utility imports including reexports", (t) => {
  const f = fixture(t);
  f.write(
    "backend/apps/api/src/server/fixture.schemas.ts",
    'export * from "./certificates/certificate-design-document";\nexport type Value = import("./item-registry/answer-contracts").Value;\n',
  );
  f.write(`${f.target}/item-registry/answer-contracts.ts`, "export type Value = string;\n");
  f.sync();
  assert.equal(f.run("--check").status, 0);
});

test("fails when a required source tree is absent", (t) => {
  const f = fixture(t);
  rmSync(join(f.root, trees[1]), { recursive: true });
  const result = f.run("--check");
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /source.*(missing|absent)|missing.*source/i);
});

test("fails when a required source file is absent", (t) => {
  const f = fixture(t);
  rmSync(join(f.root, files[0]));
  const before = f.snapshot();
  assert.equal(f.run().status, 1);
  assert.deepEqual(f.snapshot(), before);
});

test("normalizes backend CRLF without rewriting handwritten utilities", (t) => {
  const f = fixture(t);
  f.write(
    "backend/apps/api/src/server/fixture.schemas.ts",
    'import { z } from "zod";\r\nexport const schema=z.string();\r\n',
  );
  f.sync();
  const output = readFileSync(join(f.root, f.target, "fixture.schemas.ts"), "utf8");
  assert.equal(output, 'import { z } from "zod";\nexport const schema = z.string();\n');
});
