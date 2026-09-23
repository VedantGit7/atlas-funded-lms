#!/usr/bin/env node

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "";
}

const baseUrl = (readArg("base-url") ?? process.env.RELEASE_HEALTH_BASE_URL)?.trim();
const expectedRelease = (
  readArg("expected-release") ?? process.env.RELEASE_HEALTH_EXPECTED_RELEASE
)?.trim();
const timeoutMs = Number(process.env.RELEASE_HEALTH_TIMEOUT_MS ?? 10_000);
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();

const failures = [];
const checks = [];

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

async function probeHealth(healthUrl) {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(bypassSecret ? { "x-vercel-protection-bypass": bypassSecret } : {}),
      },
      redirect: "error",
      signal,
    });
    const requestId = response.headers.get("x-request-id");
    const body = await response.json();
    return { response, requestId, body };
  } catch {
    // Fetch and JSON errors may include URLs, credentials or response content.
    throw new Error(signal.aborted ? "Health probe timed out" : "Health probe failed");
  }
}

async function main() {
  if (!baseUrl) failures.push("Missing --base-url or RELEASE_HEALTH_BASE_URL");
  if (!expectedRelease) {
    failures.push("Missing --expected-release or RELEASE_HEALTH_EXPECTED_RELEASE");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    failures.push("RELEASE_HEALTH_TIMEOUT_MS must be an integer from 100 to 30000");
  }
  if (failures.length) {
    printResult({ ok: false, failures, checks });
    return;
  }

  let origin;
  try {
    const parsed = new URL(baseUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      (parsed.protocol === "http:" && !loopback) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("Invalid URL");
    }
    origin = parsed.origin;
  } catch {
    printResult({ ok: false, failures: ["Invalid health base URL"], checks });
    return;
  }
  const healthUrl = new URL("/api/v1/health", origin).toString();

  try {
    const first = await probeHealth(healthUrl);
    const second = await probeHealth(healthUrl);
    const probes = [first, second];

    checks.push({ name: "health.status", ok: first.response.ok && second.response.ok });
    if (!first.response.ok || !second.response.ok) {
      failures.push("Health endpoint did not return 2xx");
    }

    checks.push({
      name: "health.request_id.present",
      ok: probes.every(({ requestId }) => Boolean(requestId?.trim())),
    });
    if (!probes.every(({ requestId }) => Boolean(requestId?.trim()))) {
      failures.push("Health response missing x-request-id header");
    }

    checks.push({
      name: "health.request_id.unique",
      ok: first.requestId !== second.requestId,
    });
    if (first.requestId === second.requestId) {
      failures.push("Independent health probes returned duplicate request IDs");
    }

    const requestIdsMatch = probes.every(({ requestId, body }) => requestId === body?.requestId);
    checks.push({ name: "health.request_id.matches", ok: requestIdsMatch });
    if (!requestIdsMatch) {
      failures.push("Health response request ID does not match x-request-id header");
    }

    const schemaOk = probes.every(
      ({ body }) =>
        body?.ok === true &&
        body?.service === "atlas-lms" &&
        body?.status === "healthy" &&
        typeof body?.requestId === "string" &&
        Boolean(body.requestId.trim()),
    );

    checks.push({ name: "health.schema", ok: schemaOk });
    if (!schemaOk) {
      failures.push("Health response schema invalid");
    }

    const releaseOk = probes.every(({ body }) => body?.release === expectedRelease);
    checks.push({ name: "health.release", ok: releaseOk, expected: expectedRelease });
    if (!releaseOk) {
      failures.push(`Release mismatch: expected ${expectedRelease}`);
    }

    const rollbackTarget = process.env.RELEASE_SHA?.trim() || process.env.RELEASE_VERSION?.trim();

    const result = {
      ok: failures.length === 0,
      baseUrl: origin,
      healthUrl,
      requestIds: [first.requestId, second.requestId],
      release: first.body?.release ?? null,
      environment: first.body?.environment ?? null,
      rollbackTarget: rollbackTarget ?? null,
      checks,
      failures,
    };

    printResult(result);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "Health probe timed out"
        ? "Health probe timed out"
        : "Health probe failed";
    printResult({ ok: false, failures: [message], checks });
  }
}

await main();
