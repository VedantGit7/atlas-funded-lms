import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { deploymentEnv } from "../../helpers/deployment-env";

function preflight(overrides: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--tsconfig",
      "backend/apps/api/tsconfig.json",
      "scripts/validate-deployment.ts",
      "api",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...deploymentEnv(), ...overrides },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}
describe("F05 standalone deployment preflight", () => {
  it("runs the same complete configuration check without provider calls", () => {
    const result = preflight();
    expect(result.status).toBe(0);
    expect(result.output).toContain('"connectivityVerified":false');
    expect(result.output).toContain('"deployed":true');
  });
  it("exits nonzero with redacted failures", () => {
    const result = preflight({
      DATABASE_URL: "invalid://private-user:private-password",
      APP_URL: "http://example.test",
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("DATABASE_URL");
    expect(result.output).not.toContain("private-password");
    expect(result.output).not.toContain("private-user");
  });
});
