#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const checks = [];
const failures = [];

function runStep(name, command, args) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const ok = result.status === 0;
  checks.push({ name, ok, command: `${command} ${args.join(" ")}`.trim() });
  if (!ok) {
    failures.push(name);
  }
}

runStep("secrets.scan", "pnpm", ["check:secrets"]);
runStep("forbidden.scope", "pnpm", ["check:forbidden-scope"]);
runStep("dependency.audit", "pnpm", ["audit", "--audit-level", "high"]);
runStep("security.unit", "pnpm", ["exec", "vitest", "run", "tests/security"]);
runStep("observability.contract", "pnpm", ["observability:check"]);

const result = { ok: failures.length === 0, checks, failures };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
