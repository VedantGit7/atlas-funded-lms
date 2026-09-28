#!/usr/bin/env node

import { observeHealth } from "./health-observation.mjs";

const baseUrl = process.env.RESTORED_ENV_BASE_URL?.trim();
const expectedRelease = process.env.RESTORED_ENV_EXPECTED_RELEASE?.trim();
const failures = [];
const checks = [];

if (!baseUrl)
  failures.push("RESTORED_ENV_BASE_URL is required after manual isolated non-production restore");
if (!expectedRelease) failures.push("RESTORED_ENV_EXPECTED_RELEASE is required");

let origin;
if (failures.length === 0) {
  const health = observeHealth(baseUrl, expectedRelease);
  origin = health.origin;
  checks.push({ name: "restore.application_health", ok: health.ok });
  if (!health.ok) failures.push(health.failure);
}

const result = {
  ok: failures.length === 0,
  evidenceScope: "application-health-only",
  restoreProven: false,
  ...(origin ? { baseUrl: origin } : {}),
  checks,
  failures,
  note: "HTTP health observes an expected release only. It does not perform a restore or verify restored data, RLS, tenant isolation, backup integrity, RPO or RTO. Run a separately authorized isolated database restore drill for that evidence.",
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.ok ? 0 : 1;
