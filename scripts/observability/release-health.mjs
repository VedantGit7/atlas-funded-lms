#!/usr/bin/env node

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const baseUrl = readArg("base-url") ?? process.env.RELEASE_HEALTH_BASE_URL?.trim();
const expectedRelease =
  readArg("expected-release") ?? process.env.RELEASE_HEALTH_EXPECTED_RELEASE?.trim();

const failures = [];
const checks = [];

if (!baseUrl) {
  failures.push("Missing --base-url or RELEASE_HEALTH_BASE_URL");
  console.log(JSON.stringify({ ok: false, failures, checks }, null, 2));
  process.exit(1);
}

const healthUrl = new URL("/api/v1/health", baseUrl).toString();

async function probeHealth() {
  const response = await fetch(healthUrl, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  const requestId = response.headers.get("x-request-id");
  const body = await response.json();

  return { response, requestId, body };
}

try {
  const first = await probeHealth();
  const second = await probeHealth();

  checks.push({ name: "health.status", ok: first.response.ok && second.response.ok });
  if (!first.response.ok || !second.response.ok) {
    failures.push("Health endpoint did not return 2xx");
  }

  checks.push({
    name: "health.request_id.present",
    ok: Boolean(first.requestId && second.requestId),
  });
  if (!first.requestId || !second.requestId) {
    failures.push("Health response missing x-request-id header");
  }

  checks.push({
    name: "health.request_id.unique",
    ok: first.requestId !== second.requestId,
  });
  if (first.requestId === second.requestId) {
    failures.push("Independent health probes returned duplicate request IDs");
  }

  const schemaOk =
    first.body?.ok === true &&
    first.body?.service === "atlas-lms" &&
    first.body?.status === "healthy" &&
    typeof first.body?.requestId === "string";

  checks.push({ name: "health.schema", ok: schemaOk });
  if (!schemaOk) {
    failures.push("Health response schema invalid");
  }

  if (expectedRelease) {
    const releaseOk = first.body?.release === expectedRelease;
    checks.push({ name: "health.release", ok: releaseOk, expected: expectedRelease });
    if (!releaseOk) {
      failures.push(`Release mismatch: expected ${expectedRelease}`);
    }
  }

  const rollbackTarget = process.env.RELEASE_SHA?.trim() || process.env.RELEASE_VERSION?.trim();

  const result = {
    ok: failures.length === 0,
    baseUrl,
    healthUrl,
    requestIds: [first.requestId, second.requestId],
    release: first.body?.release ?? null,
    environment: first.body?.environment ?? null,
    rollbackTarget: rollbackTarget ?? null,
    checks,
    failures,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.log(JSON.stringify({ ok: false, failures: [message], checks }, null, 2));
  process.exit(1);
}
