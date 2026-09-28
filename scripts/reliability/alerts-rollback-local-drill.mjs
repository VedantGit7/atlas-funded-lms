#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

// This is intentionally a local fixture drill, not a staging acceptance gate.
const candidate = "local-fixture-candidate-v2";
const rollback = "local-fixture-previous-v1";
const children = new Set();
const checks = [];
let heartbeatStatus = 503;
const receipts = [];
const receiver = createServer((_request, response) => {
  receipts.push(heartbeatStatus);
  response.writeHead(heartbeatStatus);
  response.end();
});
const env = {
  PATH: process.env.PATH ?? process.env.Path,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  NODE_ENV: "test",
  RELEASE_ENV: "test",
  RELEASE_HEALTH_TIMEOUT_MS: "500",
};
const startedAt = Date.now();
const deadline = setTimeout(() => {
  for (const child of children) child.kill();
  process.exitCode = 1;
}, 25_000);

async function waitMessage(child, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Local fixture IPC deadline exceeded")), 5000);
    const onMessage = (message) => {
      if (predicate(message)) finish(null, message);
    };
    const onExit = () => finish(new Error("Local fixture exited before responding"));
    function finish(error, value) {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("exit", onExit);
      error ? reject(error) : resolve(value);
    }
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

async function start(release, port = 0) {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/reliability/alerts-rollback-child.ts"],
    {
      env: {
        ...env,
        RELEASE_SHA: release,
        DRILL_API_PORT: String(port),
        BETTER_STACK_WORKER_HEARTBEAT_URL: `http://127.0.0.1:${receiver.address().port}/synthetic-secret-heartbeat`,
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    },
  );
  children.add(child);
  child.logs = "";
  child.stdout.on("data", (chunk) => (child.logs += chunk));
  child.stderr.on("data", (chunk) => (child.logs += chunk));
  const ready = await waitMessage(child, (message) => message.type === "ready");
  return { child, ...ready };
}

let sequence = 0;
async function command(instance, command) {
  const id = ++sequence;
  const done = waitMessage(
    instance.child,
    (message) => message.type === "done" && message.id === id,
  );
  instance.child.send({ id, command });
  await done;
}

async function stop(instance) {
  const closed = once(instance.child, "close");
  instance.child.kill();
  await closed;
  children.delete(instance.child);
  assert.ok(!instance.child.logs.includes("synthetic-secret-heartbeat"));
}

async function probe(port, route) {
  return (await fetch(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(1000) }))
    .status;
}

async function verify(
  port,
  expected,
  script = "scripts/observability/release-health.mjs",
  args = [],
) {
  const child = spawn(process.execPath, [script, ...args], {
    env: {
      ...env,
      RELEASE_HEALTH_BASE_URL: `http://127.0.0.1:${port}`,
      RELEASE_HEALTH_EXPECTED_RELEASE: expected,
      RELEASE_SHA: rollback,
      RELEASE_CANDIDATE_RELEASE: candidate,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  children.add(child);
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", () => {});
  const [code] = await once(child, "close");
  children.delete(child);
  return { code, result: JSON.parse(output) };
}

try {
  receiver.listen(0, "127.0.0.1");
  await once(receiver, "listening");
  const first = await start(candidate);
  const port = first.apiPort;
  assert.equal((await verify(port, candidate)).code, 0);
  assert.equal(
    (await verify(port, rollback, "scripts/release/rollback-verify.mjs", ["--verify-health"])).code,
    1,
  );
  checks.push({ name: "candidate.observed_and_wrong_rollback_rejected", ok: true });
  assert.equal(await probe(first.workerPort, "/healthz"), 200);
  assert.equal(await probe(first.workerPort, "/readyz"), 200);
  checks.push({
    name: "worker.startup_grace_without_completed_sweep",
    ok: true,
    implication: "200 does not prove completed work",
  });
  await command(first, "stall-worker");
  assert.equal(await probe(first.workerPort, "/healthz"), 503);
  assert.equal(await probe(first.workerPort, "/readyz"), 200);
  await command(first, "recover-worker");
  assert.equal(await probe(first.workerPort, "/healthz"), 200);
  await command(first, "drain");
  assert.equal(await probe(first.workerPort, "/readyz"), 503);
  checks.push({
    name: "real_worker_health_stall_recovery_drain",
    ok: true,
    sweepSource: "simulated state; no worker jobs run",
  });
  await command(first, "heartbeat");
  assert.deepEqual(receipts, [503]);
  assert.ok(first.child.logs.includes("worker.heartbeat.failed"));
  heartbeatStatus = 204;
  await command(first, "heartbeat");
  assert.deepEqual(receipts, [503, 204]);
  assert.ok(!first.child.logs.includes("synthetic-secret-heartbeat"));
  checks.push({
    name: "real_heartbeat_sender_failure_recovery_and_redaction",
    ok: true,
    delivery: "loopback HTTP receipts only",
  });
  await command(first, "fail-api");
  assert.equal((await verify(port, candidate)).code, 1);
  const restartStartedAt = Date.now();
  await stop(first);
  assert.equal((await verify(port, candidate)).code, 1);
  const restarted = await start(candidate, port);
  assert.notEqual(restarted.child.pid, first.child.pid);
  assert.equal((await verify(port, candidate)).code, 0);
  const localRestartMs = Date.now() - restartStartedAt;
  checks.push({ name: "local_process_kill_restart_on_same_origin", ok: true });
  const rollbackStartedAt = Date.now();
  await stop(restarted);
  const previous = await start(rollback, port);
  assert.equal((await verify(port, candidate)).code, 1);
  const verified = await verify(port, rollback, "scripts/release/rollback-verify.mjs", [
    "--verify-health",
  ]);
  assert.equal(verified.code, 0);
  assert.equal(verified.result.rollbackProven, false);
  const localRollbackMs = Date.now() - rollbackStartedAt;
  await stop(previous);
  checks.push({ name: "local_fixture_identity_rollback_on_same_origin", ok: true });
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    evidenceScope: "local-process-and-http-fixture-drill",
    candidate,
    rollback,
    localRestartMs,
    localRollbackMs,
    fixtureProcessIds: {
      initial: first.child.pid,
      restarted: restarted.child.pid,
      previous: previous.child.pid,
    },
    heartbeatReceiverStatuses: receipts,
    hostedDeploymentProven: false,
    productionArtifactsUsed: false,
    databaseRecoveryProven: false,
    providerAlertDeliveryProven: false,
    humanAcknowledgementProven: false,
    note: "Actual local process kill/restart and replacement; synthetic release endpoint and sweep state. Uses real heartbeat sender and worker health implementation. No provider or human alerts sent.",
    checks,
  };
  const outputIndex = process.argv.indexOf("--out");
  if (outputIndex !== -1 && process.argv[outputIndex + 1])
    writeFileSync(process.argv[outputIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error(
    JSON.stringify(
      {
        ok: false,
        evidenceScope: "local-process-and-http-fixture-drill",
        failure: "Local drill assertion or process failed; no hosted proof",
        checks,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  for (const child of children) child.kill();
  receiver.closeAllConnections();
  await new Promise((resolve) => receiver.close(resolve));
}
