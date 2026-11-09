import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { after, test } from "node:test";

/**
 * server-cluster.mjs runs the API or the web app as several processes on one port. These start it
 * against tiny stand-in servers, so a broken fork, port share, shutdown or
 * crash-loop exit fails here instead of after a deploy.
 */
const script = resolve("deploy/managed-node/server-cluster.mjs");
const dir = mkdtempSync(join(tmpdir(), "server-cluster-"));
after(() => rmSync(dir, { recursive: true, force: true }));

// Like the Next standalone server: CommonJS, listens on PORT when loaded.
const server = join(dir, "server.cjs");
writeFileSync(
  server,
  `const http = require("node:http");
const s = http.createServer((req, res) => {
  res.setHeader("connection", "close");
  res.end(String(process.pid));
});
s.listen(Number(process.env.PORT), "127.0.0.1", () => {
  process.stdout.write("listening " + s.address().port + "\\n");
});
process.on("SIGTERM", () => s.close(() => process.exit(0)));
`,
);
const crashing = join(dir, "crash.cjs");
writeFileSync(crashing, "process.exit(3);\n");

function start(entry, env, service = "api") {
  const child = spawn(process.execPath, [script, service, entry].filter(Boolean), {
    env: { ...process.env, NODE_CLUSTER_SCHED_POLICY: "rr", PORT: "0", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const exited = new Promise((done) => child.on("exit", (code) => done(code)));
  const listening = async (count) => {
    for (let waited = 0; waited < 20_000; waited += 50) {
      const ports = [...output.matchAll(/listening (\d+)/g)].map((match) => Number(match[1]));
      if (ports.length >= count) return ports;
      await new Promise((done) => setTimeout(done, 50));
    }
    throw new Error(`not listening: ${output}`);
  };
  return { child, exited, listening, output: () => output };
}

function pidAt(port) {
  return new Promise((done, fail) => {
    http
      .get({ host: "127.0.0.1", port, agent: false }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => done(Number(body)));
      })
      .on("error", fail);
  });
}

test("one process runs the server in place, exactly as before", async () => {
  const run = start(server, { API_PROCESS_COUNT: "" });
  try {
    const [port] = await run.listening(1);
    assert.equal(await pidAt(port), run.child.pid);
  } finally {
    run.child.kill();
    await run.exited;
  }
});

test("several processes share one port and all take requests", async () => {
  const run = start(server, { API_PROCESS_COUNT: "3" });
  try {
    const ports = await run.listening(3);
    assert.equal(new Set(ports).size, 1, "one shared port");
    const pids = new Set();
    for (let index = 0; index < 30; index++) pids.add(await pidAt(ports[0]));
    assert.equal(pids.size, 3);
    assert.ok(!pids.has(run.child.pid), "the primary only supervises");
    assert.match(run.output(), /"message":"api.cluster.started","module":"api-cluster"/);
    assert.match(run.output(), /--max-old-space-size|"heapMb":1024/);
  } finally {
    run.child.kill("SIGKILL");
    await run.exited;
  }
});

test(
  "SIGTERM stops every process and exits cleanly",
  { skip: process.platform === "win32" && "Windows has no catchable SIGTERM" },
  async () => {
    const run = start(server, { API_PROCESS_COUNT: "2" });
    await run.listening(2);
    run.child.kill("SIGTERM");
    assert.equal(await run.exited, 0);
    assert.match(run.output(), /api.cluster.stopping/);
  },
);

test("a process that keeps crashing takes the container down instead of looping", async () => {
  const run = start(crashing, { API_PROCESS_COUNT: "2" });
  assert.equal(await run.exited, 1);
  assert.match(run.output(), /api.cluster.crash_loop/);
});

test("runs the web app from its own settings and logs as web", async () => {
  const run = start(server, { WEB_PROCESS_COUNT: "2", API_PROCESS_COUNT: "3" }, "web");
  try {
    const ports = await run.listening(2);
    const pids = new Set();
    for (let index = 0; index < 20; index++) pids.add(await pidAt(ports[0]));
    assert.equal(pids.size, 2, "WEB_PROCESS_COUNT, not API_PROCESS_COUNT");
    assert.match(run.output(), /"message":"web.cluster.started","module":"web-cluster"/);
  } finally {
    run.child.kill("SIGKILL");
    await run.exited;
  }
});

test("refuses to start without a known service and an entry", async () => {
  for (const [service, entry] of [
    ["worker", server],
    ["", server],
    ["web", ""],
  ]) {
    const run = start(entry, {}, service);
    assert.equal(await run.exited, 1, `${service} ${entry}`);
    assert.match(run.output(), /Usage: node server-cluster\.mjs <api\|web> <server entry>/);
  }
});

test("rejects a process count or heap size out of range", async () => {
  for (const env of [
    { API_PROCESS_COUNT: "0" },
    { API_PROCESS_COUNT: "2.5" },
    { API_PROCESS_COUNT: "17" },
    { API_PROCESS_COUNT: "2", API_PROCESS_HEAP_MB: "64" },
  ]) {
    const run = start(server, env);
    assert.equal(await run.exited, 1, JSON.stringify(env));
    assert.match(run.output(), /api.cluster.failed/);
  }
});
