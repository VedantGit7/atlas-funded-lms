import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";

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
