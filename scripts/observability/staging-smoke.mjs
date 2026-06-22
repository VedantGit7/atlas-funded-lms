#!/usr/bin/env node
import { spawnSync } from "node:child_process";

if (process.env.OBSERVABILITY_SMOKE_ENABLED !== "true") {
  console.log(
    JSON.stringify({
      ok: true,
      skipped: true,
      reason: "OBSERVABILITY_SMOKE_ENABLED is not true",
    }),
  );
  process.exit(0);
}

const args = process.argv.slice(2);
const result = spawnSync("node", ["scripts/observability/release-health.mjs", ...args], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
