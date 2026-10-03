// Disposable development feature lab only. This does not start a production runtime.
import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { localWebEnvironment } from "./local-web.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifacts = resolve(root, ".test-results/performance-2026-09-26");
const privateConfigPath = resolve(artifacts, "capacity-private.json");
function assertOptions({ service, acknowledged } = {}) {
  if (acknowledged !== true || !["api", "web"].includes(service))
    throw new Error("Choose api or web and explicitly acknowledge --ack-local-disposable.");
  if (resolve(process.cwd()) !== root)
    throw new Error("Run local capacity services from the repository root.");
}
function assertPrivateConfig(config) {
  const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  if (
    config?.mode !== "local-endurance" ||
    config.disposableFixtures !== true ||
    config.origin !== "http://fundedbeyond.localhost:3100" ||
    !/^[a-f\d]{64}$/.test(config.fixtureProxyToken ?? "") ||
    !uuid.test(config.fixture?.courseId ?? "") ||
    !uuid.test(config.fixture?.lessonId ?? "") ||
    !Array.isArray(config.users) ||
    config.users.length !== 200 ||
    config.users.some(
      (user, i) =>
        user.actorIndex !== i ||
        user.email !== `perf20260926-${String(i).padStart(3, "0")}+fundedbeyond@atlas-e2e.test` ||
        typeof user.password !== "string" ||
        user.password.length < 12,
    )
  )
    throw new Error("Only the complete private isolated capacity fixture is accepted.");
}
function allDotenvKeys() {
  const keys = new Set();
  for (const directory of [".", "backend/apps/api", "frontend/apps/web"])
    for (const name of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.production.local",
      ".env.development",
      ".env.development.local",
      ".env.test",
      ".env.test.local",
    ]) {
      const file = resolve(root, directory, name);
      if (existsSync(file)) for (const key of Object.keys(parse(readFileSync(file)))) keys.add(key);
    }
  return keys;
}
function assertServiceEnvironment(env) {
  for (const key of ["DATABASE_URL", "DIRECT_DATABASE_URL", "PLATFORM_DATABASE_URL"]) {
    const url = new URL(env[key]);
    const expectedUser =
      key === "PLATFORM_DATABASE_URL" ? "atlas_platform_login" : "atlas_app_login";
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "15436" ||
      url.pathname !== "/atlas_lms_e2e" ||
      url.username !== expectedUser ||
      url.search ||
      url.hash
    )
      throw new Error("Service database must use its scoped role on the isolated local database.");
  }
  for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"])
    if (env[key] !== "http://127.0.0.1:54326")
      throw new Error("Service auth must use the isolated local auth port.");
  if (env.E2E_OWNER_DATABASE_URL)
    throw new Error("Service must not receive the owner database URL.");
}
export function prepareCapacityService(options, dependencies = {}) {
  // Guard before reading the private config, app dotenv files or creating outputs.
  assertOptions(options);
  const config = (
    dependencies.readPrivateConfig ?? (() => JSON.parse(readFileSync(privateConfigPath, "utf8")))
  )();
  assertPrivateConfig(config);
  const env = (dependencies.environmentFactory ?? (() => localWebEnvironment()))();
  for (const key of (dependencies.dotenvKeys ?? allDotenvKeys)()) if (!(key in env)) env[key] = "";
  Object.assign(env, {
    NODE_ENV: "development",
    APP_ENV: "test",
    ATLAS_PERF_BUILD: "",
    ATLAS_BROWSER_BUILD: "1",
    TRUSTED_PROXY_HOPS: options.service === "web" ? "1" : "0",
    TRUSTED_CLIENT_IP_HEADER: "",
    API_PROXY_SECRET: config.fixtureProxyToken,
    RATE_LIMIT_REDIS_URL: "redis://127.0.0.1:16387",
    REDIS_URL: "redis://127.0.0.1:16387",
    DATABASE_POOL_METRICS: "1",
    DATABASE_QUERY_LOGS: "0",
    ATLAS_ROUTE_STAGE_TIMINGS: "1",
    DATABASE_POOL_MAX: "20",
    PLATFORM_DATABASE_POOL_MAX: "10",
    USAGE_DATABASE_POOL_MAX: "2",
    API_INTERNAL_URL: "http://127.0.0.1:3101",
    NODE_OPTIONS: "--max-old-space-size=4096",
  });
  assertServiceEnvironment(env);
  const app = options.service === "api" ? "backend/apps/api" : "frontend/apps/web";
  return {
    service: options.service,
    env,
    cwd: resolve(root, app),
    executable: process.execPath,
    args: [
      resolve(root, app, "node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      "-p",
      options.service === "api" ? "3101" : "3102",
    ],
  };
}
function runCleanupProcess(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error) => {
      if (error) reject(new Error("Owned process tree cleanup failed"));
      else resolve();
    });
  });
}
/** Only targets the ChildProcess returned by this launcher; never searches for PIDs. */
export function manageCapacityChild(
  child,
  {
    timer = setTimeout,
    clearTimer = clearTimeout,
    onFinish = () => {},
    platform = process.platform,
    runProcess = runCleanupProcess,
  } = {},
) {
  let finished = false,
    stopping = false,
    shutdownTimer,
    forceTimer,
    lifetimeTimer;
  const ownedPid = child.pid;
  let observedExit = null,
    treeCleanup = null,
    cleanupAttempt = 0;
  function finish(code, signal, status = "exited") {
    if (finished) return;
    finished = true;
    if (shutdownTimer) clearTimer(shutdownTimer);
    if (forceTimer) clearTimer(forceTimer);
    if (lifetimeTimer) clearTimer(lifetimeTimer);
    onFinish({
      status,
      exitCode: Number.isInteger(code) ? code : 1,
      signal: ["SIGTERM", "SIGINT", "SIGKILL"].includes(signal) ? signal : null,
    });
  }
  const childHasExited = () =>
    observedExit !== null ||
    (child.exitCode !== null && child.exitCode !== undefined) ||
    (child.signalCode !== null && child.signalCode !== undefined);
  function finishTreeCleanup() {
    if (!observedExit || treeCleanup === null) return;
    if (treeCleanup) finish(observedExit.code, observedExit.signal);
    else finish(1, observedExit.signal, "stop-failed");
  }
  function terminateOwnedTree(force) {
    if (finished) return;
    // Never issue another PID-based command after the owned root has exited.
    if (childHasExited() || !Number.isInteger(ownedPid) || ownedPid <= 0) {
      finish(1, null, "stop-failed");
      return;
    }
    const attempt = ++cleanupAttempt;
    treeCleanup = null;
    const settle = (success) => {
      if (finished || attempt !== cleanupAttempt) return;
      treeCleanup = success;
      finishTreeCleanup();
    };
    try {
      Promise.resolve(
        runProcess("taskkill.exe", ["/PID", String(ownedPid), "/T", ...(force ? ["/F"] : [])], {
          windowsHide: true,
          timeout: 5000,
        }),
      ).then(
        () => settle(true),
        () => settle(false),
      );
    } catch {
      settle(false);
    }
  }
  function stop() {
    if (finished || stopping) return;
    stopping = true;
    if (platform === "win32") {
      shutdownTimer = timer(() => {
        if (finished) return;
        if (childHasExited()) {
          finish(1, null, "stop-failed");
          return;
        }
        forceTimer = timer(() => finish(1, null, "stop-failed"), 6000);
        forceTimer.unref?.();
        terminateOwnedTree(true);
      }, 10000);
      shutdownTimer.unref?.();
      terminateOwnedTree(false);
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      finish(1, null, "stop-failed");
      return;
    }
    shutdownTimer = timer(() => {
      if (!finished) {
        try {
          child.kill("SIGKILL");
        } catch {
          finish(1, null, "stop-failed");
        }
      }
    }, 10000);
    shutdownTimer.unref?.();
  }
  child.once("error", () => finish(1, null, "start-failed"));
  child.once("exit", (code, signal) => {
    if (platform === "win32" && stopping) {
      observedExit = { code, signal };
      finishTreeCleanup();
    } else finish(code, signal);
  });
  return {
    stop,
    limitLifetime() {
      lifetimeTimer = timer(stop, 4 * 60 * 60 * 1000);
      lifetimeTimer.unref?.();
    },
  };
}
export function launchCapacityService(options, dependencies = {}) {
  const plan = prepareCapacityService(options, dependencies);
  const run = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const logPath = resolve(artifacts, `${plan.service}-${run}.log`);
  const metadataPath = resolve(artifacts, `${plan.service}-${run}-process.json`);
  (dependencies.mkdir ?? mkdirSync)(artifacts, { recursive: true });
  const descriptor = (dependencies.openLog ?? openSync)(logPath, "wx", 0o600);
  let child;
  try {
    child = (dependencies.spawn ?? spawn)(plan.executable, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      windowsHide: true,
      stdio: ["ignore", descriptor, descriptor],
    });
  } finally {
    (dependencies.closeLog ?? closeSync)(descriptor);
  }
  const metadata = {
    wrapper: process.pid,
    child: Number.isInteger(child.pid) ? child.pid : null,
    service: plan.service,
    startedAt: new Date().toISOString(),
    mode: "development",
    appEnv: "test",
    log: logPath,
    status: "starting",
  };
  const writeMetadata =
    dependencies.writeMetadata ??
    ((path, data) => writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 }));
  const lifecycle = manageCapacityChild(child, {
    timer: dependencies.timer,
    clearTimer: dependencies.clearTimer,
    platform: dependencies.platform,
    runProcess: dependencies.runProcess,
    onFinish(info) {
      Object.assign(metadata, info, { finishedAt: new Date().toISOString() });
      try {
        writeMetadata(metadataPath, metadata);
      } catch {
        /* Child lifecycle remains bounded if evidence cannot be written. */
      }
      dependencies.onFinish?.(info);
    },
  });
  try {
    writeMetadata(metadataPath, metadata);
  } catch {
    lifecycle.stop();
    throw new Error("Could not record local child metadata.");
  }
  return { child, metadata, metadataPath, ...lifecycle };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || !args.includes("--ack-local-disposable")) throw new Error();
    let running;
    const stop = () => running?.stop();
    running = launchCapacityService(
      { service: args.find((value) => value !== "--ack-local-disposable"), acknowledged: true },
      {
        onFinish(info) {
          process.exitCode = info.exitCode;
          process.removeListener("SIGTERM", stop);
          process.removeListener("SIGINT", stop);
        },
      },
    );
    running.limitLifetime();
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
    console.log(
      JSON.stringify({
        service: running.metadata.service,
        pid: running.metadata.child,
        mode: "development",
        appEnv: "test",
        metadataPath: running.metadataPath,
        log: running.metadata.log,
      }),
    );
  } catch {
    console.error(
      "Local capacity service could not start. Run api|web --ack-local-disposable from the repository root with the isolated private fixture ready.",
    );
    process.exitCode = 1;
  }
}
