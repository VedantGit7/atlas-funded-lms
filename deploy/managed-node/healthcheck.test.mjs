import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runHealthCheck } from "./healthcheck.mjs";

/** A local server whose status the test sets, and a fresh failure counter. */
async function harness(t) {
  let status = 200;
  const server = createServer((_request, response) => response.writeHead(status).end());
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const directory = mkdtempSync(join(tmpdir(), "atlas-health-"));
  t.after(() => {
    server.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const stops = [];
  let uptime = 120;
  const check = () =>
    runHealthCheck({
      url: `http://127.0.0.1:${server.address().port}/health`,
      failures: 3,
      graceSeconds: 60,
      stateFile: join(directory, "failures"),
      uptimeSeconds: () => uptime,
      stop: () => stops.push(uptime),
    });
  return {
    check,
    stops,
    setStatus: (value) => (status = value),
    setUptime: (value) => (uptime = value),
  };
}

test("restarts only after the configured number of consecutive failures", async (t) => {
  const h = await harness(t);
  h.setStatus(500);
  assert.deepEqual(await h.check(), { healthy: false, consecutiveFailures: 1, stopped: false });
  assert.deepEqual(await h.check(), { healthy: false, consecutiveFailures: 2, stopped: false });
  assert.deepEqual(await h.check(), { healthy: false, consecutiveFailures: 3, stopped: true });
  assert.deepEqual(h.stops, [120]);
});

test("a healthy probe resets the count", async (t) => {
  const h = await harness(t);
  h.setStatus(500);
  await h.check();
  await h.check();
  h.setStatus(200);
  assert.deepEqual(await h.check(), { healthy: true, consecutiveFailures: 0, stopped: false });
  h.setStatus(500);
  assert.equal((await h.check()).consecutiveFailures, 1);
  assert.deepEqual(h.stops, []);
});

test("never restarts during the startup grace period", async (t) => {
  const h = await harness(t);
  h.setStatus(500);
  h.setUptime(30);
  for (let index = 0; index < 5; index += 1) await h.check();
  assert.deepEqual(h.stops, []);
  // Once past the grace period, the failures already counted still apply.
  h.setUptime(61);
  assert.equal((await h.check()).stopped, true);
});

test("treats an unreachable server and a redirect as unhealthy", async (t) => {
  const h = await harness(t);
  h.setStatus(302);
  assert.equal((await h.check()).healthy, false);
  const closed = await runHealthCheck({
    url: "http://127.0.0.1:9/unreachable",
    stateFile: join(mkdtempSync(join(tmpdir(), "atlas-health-")), "failures"),
    uptimeSeconds: () => 0,
    stop: () => assert.fail("must not stop during the grace period"),
  });
  assert.equal(closed.healthy, false);
});
