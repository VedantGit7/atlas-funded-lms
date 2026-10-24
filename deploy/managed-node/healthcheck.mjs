// Container health check that also restarts a container stuck unhealthy.
//
// Docker marks a container unhealthy but never restarts it, and Coolify does
// not either. A web or API container whose startup validation failed keeps
// running and answers every request with 500, so being marked unhealthy is
// all that would happen. This probe counts consecutive failures in /tmp, a
// tmpfs that starts empty after every restart. After `--failures` in a row,
// once the container has run for `--grace` seconds, it sends SIGTERM to PID 1
// (the container's init, or the server itself). The container exits, and
// `restart: unless-stopped` starts it again. No Docker socket is involved.
//
//   node /app/healthcheck.mjs --url http://127.0.0.1:3001/api/v1/health \
//     [--failures 3] [--grace 60] [--timeout 4]
//
// Exit code 0 means healthy and 1 unhealthy, as Docker expects.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const STATE_FILE = "/tmp/atlas-health-failures";

/** Seconds since PID 1 started, from /proc (Linux clock ticks are 100 Hz). */
export function containerUptimeSeconds() {
  const uptime = Number(readFileSync("/proc/uptime", "utf8").split(" ")[0]);
  // Field 22 of /proc/1/stat, counted after the parenthesised command name.
  const stat = readFileSync("/proc/1/stat", "utf8");
  const startTicks = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19]);
  return uptime - startTicks / 100;
}

export async function runHealthCheck({
  url,
  failures = 3,
  graceSeconds = 60,
  timeoutMs = 4000,
  stateFile = STATE_FILE,
  uptimeSeconds = containerUptimeSeconds,
  stop = () => process.kill(1, "SIGTERM"),
}) {
  const healthy = await globalThis
    .fetch(url, { redirect: "manual", signal: globalThis.AbortSignal.timeout(timeoutMs) })
    .then((response) => response.ok)
    .catch(() => false);
  if (healthy) {
    rmSync(stateFile, { force: true });
    return { healthy, consecutiveFailures: 0, stopped: false };
  }
  const consecutiveFailures = readCount(stateFile) + 1;
  writeFileSync(stateFile, String(consecutiveFailures));
  const stopped = consecutiveFailures >= failures && uptimeSeconds() >= graceSeconds;
  if (stopped) stop();
  return { healthy, consecutiveFailures, stopped };
}

function readCount(stateFile) {
  try {
    return Number.parseInt(readFileSync(stateFile, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error(`Bad argument: ${name}`);
    options[name.slice(2)] = value;
  }
  if (!options.url) throw new Error("--url is required");
  const number = (key, fallback) => {
    if (options[key] === undefined) return fallback;
    const parsed = Number(options[key]);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`--${key} must be positive`);
    return parsed;
  };
  return {
    url: options.url,
    failures: number("failures", 3),
    graceSeconds: number("grace", 60),
    timeoutMs: number("timeout", 4) * 1000,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runHealthCheck(parseArguments(process.argv.slice(2)));
  if (result.stopped)
    process.stderr.write(`unhealthy ${result.consecutiveFailures} times in a row: restarting\n`);
  process.exit(result.healthy ? 0 : 1);
}
