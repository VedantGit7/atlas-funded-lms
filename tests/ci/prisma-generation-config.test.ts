import { afterAll, describe, expect, it } from "vitest";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const cache = join(root, "node_modules/.cache");
mkdirSync(cache, { recursive: true });
const fixture = mkdtempSync(join(cache, "f11-prisma-"));
const backend = join(fixture, "backend");
mkdirSync(join(backend, "prisma"), { recursive: true });
writeFileSync(
  join(backend, "prisma/schema.prisma"),
  `generator client {
  provider = "prisma-client"
  output = "./generated"
}
datasource db {
  provider = "postgresql"
}
model BuildFixture {
  id String @id
}
`,
);
afterAll(() => {
  if (!fixture.startsWith(resolve(cache) + "/") && !fixture.startsWith(resolve(cache) + "\\"))
    throw new Error("Unsafe fixture cleanup");
  rmSync(fixture, { recursive: true, force: true });
});
function run(config: string, command: string) {
  copyFileSync(join(root, "backend", config), join(backend, config));
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/DATABASE_URL|DATABASE_DIRECT_URL|ATLAS_APP_LOGIN_URL/.test(key))
      Reflect.deleteProperty(env, key);
  return spawnSync(
    process.execPath,
    [join(root, "node_modules/prisma/build/index.js"), command, "--config", join(backend, config)],
    {
      cwd: fixture,
      env,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
}
describe("credential-free install generation", () => {
  it("generates the client without database credentials or local env files", () => {
    const result = run("prisma.generate.config.ts", "generate");
    expect(result.stderr + result.stdout).not.toContain("Cannot resolve environment variable");
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(existsSync(join(backend, "prisma/generated/client.ts"))).toBe(true);
  });
  it("keeps database operations fail-closed without DATABASE_URL", () => {
    const result = run("prisma.config.ts", "validate");
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(
      "Cannot resolve environment variable: DATABASE_URL",
    );
  });
  it("uses generation config only for client generation scripts", () => {
    const { scripts } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    for (const name of ["postinstall", "db:generate", "db:generate:ci"])
      expect(scripts[name]).toBe("prisma generate --config backend/prisma.generate.config.ts");
    expect(scripts["db:migrate:deploy"]).toBe(
      "prisma migrate deploy --config backend/prisma.config.ts",
    );
  });
});
