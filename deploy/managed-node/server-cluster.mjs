// Runs a Next.js standalone server, the API or the web app, as several Node
// processes sharing one port (node:cluster). A single Next process handles
// requests on one main thread. In the staging load test one API process
// saturated at about 75 requests a second while the host stayed at least 49%
// idle. With three API processes, the single web process, which every API
// call passes through, then saturated at the same moments
// (docs/engineering/staging-load-test-2026-11-07.md).
//
// Usage: node server-cluster.mjs <api|web> <server entry>
//   <NAME>_PROCESS_COUNT     processes to run, 1 to 16 (default 1), where NAME
//                            is API or WEB. With 1 the entry runs in this
//                            process, exactly as before.
//   <NAME>_PROCESS_HEAP_MB   old-space limit per process, 128 to 8192 (default
//                            1024), so the processes together stay inside the
//                            container's memory limit.
//
// Every process is a complete server. Rate limits, sessions and usage metering
// live in Redis and PostgreSQL, usage is durable before a request completes,
// and the web app keeps no cache that the other processes would need to see.
// So nothing is lost when one process stops.
import cluster from "node:cluster";
import { resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { pathToFileURL } from "node:url";

const CRASH_WINDOW_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 40_000; // Under the compose stop_grace_period (45 s).

const SERVICES = new Set(["api", "web"]);
// Messages are "<service>.cluster.*" from module "<service>-cluster", so the
// API's log lines are the same as before the web app used this too.
let service = "server";

function log(level, event, fields = {}) {
  const message = `${service}.cluster.${event}`;
  process.stdout.write(
    `${JSON.stringify({ level, message, module: `${service}-cluster`, time: new Date().toISOString(), ...fields })}\n`,
  );
}

function parseSetting(name, raw, { fallback, min, max }) {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${name} must be a whole number from ${min} to ${max}`);
  return value;
}

async function main() {
  const [name, entry] = process.argv.slice(2);
  if (!name || !SERVICES.has(name) || !entry)
    throw new Error("Usage: node server-cluster.mjs <api|web> <server entry>");
  service = name;
  const prefix = name.toUpperCase();

  if (!cluster.isPrimary) {
    await import(pathToFileURL(resolve(entry)).href);
    return;
  }

  const count = parseSetting(`${prefix}_PROCESS_COUNT`, process.env[`${prefix}_PROCESS_COUNT`], {
    fallback: 1,
    min: 1,
    max: 16,
  });
  if (count === 1) {
    await import(pathToFileURL(resolve(entry)).href);
    return;
  }
  const heapMb = parseSetting(
    `${prefix}_PROCESS_HEAP_MB`,
    process.env[`${prefix}_PROCESS_HEAP_MB`],
    {
      fallback: 1024,
      min: 128,
      max: 8192,
    },
  );

  cluster.setupPrimary({
    execArgv: [...process.execArgv, `--max-old-space-size=${heapMb}`],
  });

  let stopping = false;
  const recentExits = [];

  cluster.on("exit", (worker, code, signal) => {
    if (stopping) {
      if (Object.keys(cluster.workers ?? {}).length === 0) process.exit(0);
      return;
    }
    const now = Date.now();
    recentExits.push(now);
    while (recentExits.length && now - recentExits[0] > CRASH_WINDOW_MS) recentExits.shift();
    log("error", "process_exited", {
      pid: worker.process.pid,
      code,
      signal,
      exitsLastMinute: recentExits.length,
    });
    // A process that keeps dying will not be fixed by restarting it here: exit,
    // so the container restarts and the failure shows in Coolify.
    if (recentExits.length >= count * 3) {
      log("error", "crash_loop", { exitsLastMinute: recentExits.length });
      process.exit(1);
    }
    // Not unref()ed: with every process gone this timer is what keeps the
    // supervisor alive until the replacement starts.
    setTimeout(() => cluster.fork(), 1_000);
  });

  const stop = (sig) => {
    if (stopping) return;
    stopping = true;
    log("info", "stopping", { signal: sig });
    const workers = Object.values(cluster.workers ?? {});
    if (workers.length === 0) process.exit(0);
    for (const worker of workers) worker?.process.kill(sig);
    setTimeout(() => {
      log("error", "stop_timeout", {
        remaining: Object.keys(cluster.workers ?? {}).length,
      });
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));

  for (let index = 0; index < count; index++) cluster.fork();
  log("info", "started", { processes: count, heapMb });
}

main().catch((error) => {
  log("error", "failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
