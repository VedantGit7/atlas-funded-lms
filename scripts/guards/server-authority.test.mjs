import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkServerAuthority } from "./check-server-authority.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "atlas-authority-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, body = "export {};") => {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), body);
  };
  put("frontend/apps/web/src/app/page.tsx");
  put("backend/apps/api/src/app/api/v1/me/route.ts");
  for (const app of ["frontend/apps/web", "backend/apps/api"]) {
    put(
      `${app}/tsconfig.json`,
      JSON.stringify({
        compilerOptions: {
          baseUrl: root,
          paths: {
            "@hidden/*": ["backend/apps/api/src/*"],
            "@web/*": ["frontend/apps/web/src/*"],
          },
        },
      }),
    );
  }
  return { root, put };
}

test("permits web auth routes and HTTP adapters", (t) => {
  const { root, put } = fixture(t);
  put("frontend/apps/web/src/app/auth/callback/route.ts");
  put(
    "frontend/apps/web/src/lib/server/helper.ts",
    'import type { DTO } from "@atlas/contracts/course/dto";',
  );
  assert.deepEqual(checkServerAuthority(root).errors, []);
});

for (const path of [
  "server/new.service.ts",
  "events/worker-router.ts",
  "worker/index.ts",
  "app/api/v1/new/route.ts",
  "modules/diagnostics/diagnostic.repository.ts",
]) {
  test(`rejects shadow implementation ${path}`, (t) => {
    const { root, put } = fixture(t);
    put(`frontend/apps/web/src/${path}`);
    assert.match(checkServerAuthority(root).errors.join("\n"), /authoritative backend/);
  });
}

for (const source of [
  'import { secret } from "@hidden/server/secret";',
  'export * from "../../../../backend/apps/api/src/server/secret";',
  'const load = () => import("@atlas/api-server/secret");',
  'const service = require("@hidden/server/secret");',
  'type Service = import("@hidden/server/secret").Service;',
]) {
  test(`rejects application coupling: ${source}`, (t) => {
    const { root, put } = fixture(t);
    put("frontend/apps/web/src/bridge.ts", source);
    assert.match(checkServerAuthority(root).errors.join("\n"), /application boundary/);
  });
}

test("rejects backend imports of web application", (t) => {
  const { root, put } = fixture(t);
  put("backend/apps/api/src/bridge.ts", 'import { x } from "@web/lib/server/helper";');
  assert.match(checkServerAuthority(root).errors.join("\n"), /application boundary/);
});

test("missing source trees fail instead of passing vacuously", (t) => {
  const { root } = fixture(t);
  rmSync(join(root, "backend"), { recursive: true });
  assert.match(checkServerAuthority(root).errors.join("\n"), /missing|No canonical/);
});

test("rejects a shared package re-exporting an application service", (t) => {
  const { root, put } = fixture(t);
  put(
    "frontend/apps/web/src/app/page.tsx",
    'export * from "../../../../packages/bridge/src/index";',
  );
  put("frontend/packages/bridge/tsconfig.json", "{}");
  put(
    "frontend/packages/bridge/src/index.ts",
    'export * from "../../../../backend/apps/api/src/server/business";',
  );
  put("backend/apps/api/src/server/business.ts");
  assert.match(checkServerAuthority(root).errors.join("\n"), /application boundary/);
});

test("checks nested domain packages even when their parent has source files", (t) => {
  const { root, put } = fixture(t);
  put("backend/packages/domain/src/index.ts");
  put(
    "backend/packages/domain/config/src/index.ts",
    'export * from "../../../../apps/api/src/server/business";',
  );
  put("backend/apps/api/src/server/business.ts");
  const result = checkServerAuthority(root);
  assert.equal(result.packages, 2);
  assert.match(result.errors.join("\n"), /application boundary/);
});
