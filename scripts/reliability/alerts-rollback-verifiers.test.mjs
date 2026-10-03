import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

async function run(script, env = {}, args = []) {
  const child = spawn(process.execPath, [script, ...args], {
    env: {
      ...process.env,
      RELEASE_SHA: "",
      RELEASE_VERSION: "",
      ROLLBACK_TARGET_RELEASE: "",
      RELEASE_CANDIDATE_RELEASE: "",
      RELEASE_OWNER: "",
      INCIDENT_OWNER: "",
      RELEASE_HEALTH_EXPECTED_RELEASE: "",
      RELEASE_HEALTH_BASE_URL: "",
      VERCEL_AUTOMATION_BYPASS_SECRET: "",
      RESTORED_ENV_BASE_URL: "",
      RESTORED_ENV_EXPECTED_RELEASE: "",
      RELEASE_HEALTH_TIMEOUT_MS: "500",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const timer = setTimeout(() => child.kill(), 5000);
  try {
    const [code] = await once(child, "close");
    assert.equal(stderr, "");
    return { code, stdout, result: JSON.parse(stdout) };
  } finally {
    clearTimeout(timer);
  }
}

async function serve(t, release = "rollback-local", mode = "healthy") {
  let requests = 0;
  const server = createServer((_req, res) => {
    const requestId = `probe-${++requests}`;
    if (mode === "stall") return;
    if (mode === "redirect") {
      res.writeHead(302, { location: "/?token=secret-redirect" });
      res.end();
      return;
    }
    if (mode === "malformed") {
      res.end("secret-response is not JSON");
      return;
    }
    if (mode === "unhealthy") {
      res.writeHead(503, { "content-type": "application/json", "x-request-id": requestId });
      res.end(JSON.stringify({ ok: false }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "x-request-id": requestId });
    res.end(
      JSON.stringify({ ok: true, service: "atlas-lms", status: "healthy", release, requestId }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return { url: `http://127.0.0.1:${server.address().port}`, requests: () => requests };
}

test("rollback preflight rejects a missing target instead of reporting success", async () => {
  assert.equal((await run("scripts/release/rollback-verify.mjs")).code, 1);
});

test("rollback preflight labels its evidence and does not claim an observed rollback", async () => {
  const { result, code } = await run("scripts/release/rollback-verify.mjs", {
    RELEASE_SHA: "rollback-local",
  });
  assert.equal(code, 0);
  assert.equal(result.evidenceScope, "preflight-only");
  assert.equal(result.rollbackProven, false);
});

test("rollback health verification rejects candidate identity equal to rollback target", async (t) => {
  const server = await serve(t);
  const { code } = await run(
    "scripts/release/rollback-verify.mjs",
    {
      RELEASE_SHA: "rollback-local",
      RELEASE_CANDIDATE_RELEASE: "rollback-local",
      RELEASE_HEALTH_BASE_URL: server.url,
    },
    ["--verify-health"],
  );
  assert.equal(code, 1);
  assert.equal(server.requests(), 0);
});

test("rollback health verification rejects a still-running candidate", async (t) => {
  const server = await serve(t, "candidate-local");
  const { code } = await run(
    "scripts/release/rollback-verify.mjs",
    {
      RELEASE_SHA: "rollback-local",
      RELEASE_CANDIDATE_RELEASE: "candidate-local",
      RELEASE_HEALTH_BASE_URL: server.url,
    },
    ["--verify-health"],
  );
  assert.equal(code, 1);
});

test("rollback observes target health without claiming it performed a deployment", async (t) => {
  const server = await serve(t);
  const { result, code } = await run(
    "scripts/release/rollback-verify.mjs",
    {
      RELEASE_SHA: "rollback-local",
      RELEASE_CANDIDATE_RELEASE: "candidate-local",
      RELEASE_HEALTH_BASE_URL: server.url,
    },
    ["--verify-health"],
  );
  assert.equal(code, 0);
  assert.equal(server.requests(), 2);
  assert.equal(result.evidenceScope, "target-health-only");
  assert.equal(result.rollbackProven, false);
});

test("restore validator rejects missing explicit expected restored release before spawning checks", async () => {
  const { result, code } = await run("scripts/release/restore-validate.mjs", {
    RESTORED_ENV_BASE_URL: "http://127.0.0.1:1",
  });
  assert.equal(code, 1);
  assert.equal(result.checks.length, 0);
});

test("restore validator checks target health only and redacts URL credentials", async (t) => {
  const server = await serve(t);
  const { result, code, stdout } = await run("scripts/release/restore-validate.mjs", {
    RESTORED_ENV_BASE_URL: `${server.url}/?token=secret-query#secret-fragment`,
    RESTORED_ENV_EXPECTED_RELEASE: "rollback-local",
  });
  assert.equal(code, 0);
  assert.equal(result.evidenceScope, "application-health-only");
  assert.equal(result.restoreProven, false);
  assert.equal(result.checks.length, 1);
  assert.ok(!stdout.includes("secret-query") && !stdout.includes("secret-fragment"));
  assert.equal(server.requests(), 2);
});

test("restore validator rejects credentials and shell syntax without echoing input", async () => {
  const { code, stdout } = await run("scripts/release/restore-validate.mjs", {
    RESTORED_ENV_BASE_URL: "http://secret-user:secret-password@127.0.0.1/&echo secret-shell",
    RESTORED_ENV_EXPECTED_RELEASE: "rollback-local",
  });
  assert.equal(code, 1);
  assert.ok(!stdout.includes("secret-"));
});

for (const mode of ["stall", "redirect", "malformed", "unhealthy"]) {
  test(`rollback health fails closed for ${mode} and does not echo response secrets`, async (t) => {
    const server = await serve(t, "rollback-local", mode);
    const { code, stdout } = await run(
      "scripts/release/rollback-verify.mjs",
      {
        RELEASE_SHA: "rollback-local",
        RELEASE_CANDIDATE_RELEASE: "candidate-local",
        RELEASE_HEALTH_BASE_URL: server.url,
      },
      ["--verify-health"],
    );
    assert.equal(code, 1);
    assert.ok(!stdout.includes("secret-"));
    if (mode === "redirect") assert.equal(server.requests(), 1);
  });
}

test("rollback production preflight requires both owners", async () => {
  assert.equal(
    (
      await run("scripts/release/rollback-verify.mjs", { RELEASE_SHA: "rollback-local" }, [
        "--strict-production",
      ])
    ).code,
    1,
  );
  assert.equal(
    (
      await run(
        "scripts/release/rollback-verify.mjs",
        {
          RELEASE_SHA: "rollback-local",
          RELEASE_OWNER: "local-owner",
          INCIDENT_OWNER: "local-owner",
        },
        ["--strict-production"],
      )
    ).code,
    0,
  );
});

test("restore health rejects wrong identity and unsafe timeout before any network request", async (t) => {
  const server = await serve(t, "candidate-local");
  const env = {
    RESTORED_ENV_BASE_URL: server.url,
    RESTORED_ENV_EXPECTED_RELEASE: "rollback-local",
  };
  assert.equal(
    (
      await run("scripts/release/restore-validate.mjs", {
        ...env,
        RELEASE_HEALTH_TIMEOUT_MS: "Infinity",
      })
    ).code,
    1,
  );
  assert.equal(server.requests(), 0);
  assert.equal((await run("scripts/release/restore-validate.mjs", env)).code, 1);
});
