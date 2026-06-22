#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const baseUrl = process.env.RESTORED_ENV_BASE_URL?.trim();

const failures = [];
const checks = [];

if (!baseUrl) {
  failures.push("RESTORED_ENV_BASE_URL is required after manual isolated non-production restore");
  console.log(JSON.stringify({ ok: false, failures, checks }, null, 2));
  process.exit(1);
}

function runCheck(name, script, args) {
  const result = spawnSync("pnpm", [script, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      RELEASE_HEALTH_BASE_URL: baseUrl,
    },
  });

  const ok = result.status === 0;
  checks.push({ name, ok, command: `pnpm ${script} ${args.join(" ")}`.trim() });
  if (!ok) {
    failures.push(`${name} failed`);
  }
}

runCheck("restore.health", "release:health", ["--", "--base-url", baseUrl]);
runCheck("restore.tenant_config.fundedbeyond", "tenant-config:verify", [
  "--",
  "--tenant",
  "fundedbeyond",
  "--environment",
  "test",
]);
runCheck("restore.tenant_config.second_smoke", "tenant-config:verify", [
  "--",
  "--tenant",
  "second-smoke-academy",
  "--environment",
  "test",
]);
runCheck("restore.tenant_isolation", "test:tenant-isolation", []);

const result = {
  ok: failures.length === 0,
  baseUrl,
  checks,
  failures,
  note: "Restore validation assumes manual isolated non-production restore completed first",
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
