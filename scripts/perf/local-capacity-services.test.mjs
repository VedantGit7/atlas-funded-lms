import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { makeCapacityConfig } from "./capacity-fixture.mjs";
import { localWebEnvironment } from "./local-web.mjs";
import {
  prepareCapacityService,
  launchCapacityService,
  manageCapacityChild,
} from "./local-capacity-services.mjs";

const fixture = () =>
  makeCapacityConfig({
    courseId: "11111111-1111-4111-8111-111111111111",
    lessonId: "22222222-2222-4222-8222-222222222222",
  });
const dependencies = (config = fixture()) => ({
  readPrivateConfig: () => config,
  environmentFactory: () =>
    localWebEnvironment({ PATH: "local-path", REMOTE_API_KEY: "must-not-inherit" }),
  dotenvKeys: () => ["HOSTED_DATABASE_TOKEN", "DATABASE_URL", "NODE_OPTIONS"],
});
test("acknowledgment and exact service selection precede every file read or spawn", () => {
  let touched = false;
  const boundary = {
    readPrivateConfig: () => {
      touched = true;
    },
    spawn: () => {
      touched = true;
    },
  };
  for (const options of [{ service: "web" }, { service: "production", acknowledged: true }]) {
    assert.throws(() => launchCapacityService(options, boundary));
    assert.equal(touched, false);
  }
});
test("hosted, incomplete and forged private fixture configurations are rejected", () => {
  for (const change of [
    { mode: "staging" },
    { disposableFixtures: false },
    { origin: "https://fundedbeyond.example" },
    { fixtureProxyToken: "weak" },
    { fixture: {} },
    { users: [] },
  ])
    assert.throws(() =>
      prepareCapacityService(
        { service: "api", acknowledged: true },
        dependencies({ ...fixture(), ...change }),
      ),
    );
});
test("service plan fixes development mode and isolated targets while blocking dotenv and inherited hosted keys", () => {
  for (const service of ["api", "web"]) {
    const config = fixture();
    const plan = prepareCapacityService({ service, acknowledged: true }, dependencies(config));
    assert.equal(plan.env.REMOTE_API_KEY, undefined);
    assert.equal(plan.env.HOSTED_DATABASE_TOKEN, "");
    assert.equal(plan.env.NODE_ENV, "development");
    assert.equal(plan.env.APP_ENV, "test");
    assert.equal(plan.env.ATLAS_PERF_BUILD, "");
    assert.equal(plan.env.ATLAS_BROWSER_BUILD, "1");
    assert.equal(plan.env.DATABASE_QUERY_LOGS, "0");
    assert.equal(plan.env.ATLAS_ROUTE_STAGE_TIMINGS, "1");
    assert.equal(plan.env.TRUSTED_PROXY_HOPS, service === "web" ? "1" : "0");
    assert.equal(plan.env.API_PROXY_SECRET, config.fixtureProxyToken);
    assert.equal(plan.env.RATE_LIMIT_REDIS_URL, "redis://127.0.0.1:16387");
    assert.equal(plan.env.API_INTERNAL_URL, "http://127.0.0.1:3101");
    assert.equal(new URL(plan.env.DATABASE_URL).username, "atlas_app_login");
    assert.equal(new URL(plan.env.DATABASE_URL).port, "15436");
    assert.equal(plan.env.E2E_OWNER_DATABASE_URL, undefined);
    assert.deepEqual(plan.args.slice(-5), [
      "dev",
      "--hostname",
      "127.0.0.1",
      "-p",
      service === "web" ? "3102" : "3101",
    ]);
  }
});
test("an unexpected database or auth target fails before spawn", () => {
  for (const change of [
    { DATABASE_URL: "postgres://atlas_app_login@remote.example:15436/atlas_lms_e2e" },
    { PLATFORM_DATABASE_URL: "postgres://atlas@127.0.0.1:15436/atlas_lms_e2e" },
    { SUPABASE_URL: "http://127.0.0.1:54321" },
  ]) {
    const deps = dependencies();
    const original = deps.environmentFactory;
    deps.environmentFactory = () => ({ ...original(), ...change });
    assert.throws(() => prepareCapacityService({ service: "api", acknowledged: true }, deps));
  }
});
test("launch metadata contains only process identity and local artifact paths", () => {
  const child = new EventEmitter();
  child.pid = 321;
  child.kill = () => true;
  const files = [],
    calls = [],
    closes = [];
  const launched = launchCapacityService(
    { service: "web", acknowledged: true },
    {
      ...dependencies(),
      mkdir: () => {},
      openLog: () => 9,
      closeLog: (fd) => closes.push(fd),
      spawn: (executable, args, options) => {
        calls.push({ executable, args, options });
        return child;
      },
      writeMetadata: (path, metadata) => files.push({ path, metadata }),
      timer: () => ({ unref() {} }),
      clearTimer: () => {},
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.windowsHide, true);
  assert.deepEqual(calls[0].options.stdio, ["ignore", 9, 9]);
  assert.deepEqual(closes, [9]);
  assert.equal(launched.metadata.child, 321);
  const serialized = JSON.stringify(files);
  assert.equal(serialized.includes("fixtureProxyToken"), false);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes(calls[0].options.env.API_PROXY_SECRET), false);
});
test("shutdown only targets its own child and escalates once after a bounded grace period", () => {
  const child = new EventEmitter();
  child.pid = 321;
  const killed = [],
    timers = [];
  child.kill = (signal) => {
    killed.push(signal);
    return true;
  };
  const lifecycle = manageCapacityChild(child, {
    platform: "linux",
    timer: (fn, ms) => {
      timers.push({ fn, ms });
      return { unref() {} };
    },
    clearTimer: () => {},
  });
  lifecycle.stop();
  lifecycle.stop();
  assert.deepEqual(killed, ["SIGTERM"]);
  assert.equal(timers[0].ms, 10000);
  timers[0].fn();
  assert.deepEqual(killed, ["SIGTERM", "SIGKILL"]);
  child.emit("exit", 0, null);
  lifecycle.stop();
  assert.equal(killed.length, 2);
});
test("exited or failed child is never signaled again and errors are sanitized", () => {
  for (const kind of ["exit", "error"]) {
    const child = new EventEmitter();
    child.pid = 321;
    child.kill = () => {
      throw new Error("must not kill");
    };
    const events = [];
    const lifecycle = manageCapacityChild(child, { onFinish: (info) => events.push(info) });
    if (kind === "error") child.emit("error", new Error("secret-value"));
    else child.emit("exit", 0, null);
    lifecycle.stop();
    assert.equal(events.length, 1);
    assert.equal(JSON.stringify(events).includes("secret-value"), false);
  }
});

test("Windows shutdown requests only the owned process tree and waits for cleanup after child exit", async () => {
  const child = new EventEmitter();
  child.pid = 321;
  child.kill = () => {
    throw new Error("Windows must terminate the owned tree");
  };
  const calls = [],
    finished = [];
  let complete;
  const lifecycle = manageCapacityChild(child, {
    platform: "win32",
    runProcess: (file, args, options) => {
      calls.push({ file, args, options });
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
    timer: () => ({ unref() {} }),
    clearTimer: () => {},
    onFinish: (info) => finished.push(info),
  });
  lifecycle.stop();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "taskkill.exe");
  assert.deepEqual(calls[0].args, ["/PID", "321", "/T"]);
  assert.equal(calls[0].options.windowsHide, true);
  assert.equal(calls[0].options.timeout, 5000);
  child.emit("exit", 0, null);
  assert.equal(finished.length, 0);
  complete();
  await Promise.resolve();
  assert.equal(finished.length, 1);
  assert.equal(finished[0].status, "exited");
  lifecycle.stop();
  assert.equal(calls.length, 1);
});

test("Windows tree shutdown forces only after its grace period and remains bounded if cleanup hangs", async () => {
  const child = new EventEmitter();
  child.pid = 654;
  child.kill = () => {
    throw new Error("must not signal single process");
  };
  const calls = [],
    timers = [],
    finished = [];
  const lifecycle = manageCapacityChild(child, {
    platform: "win32",
    runProcess: (file, args) => {
      calls.push({ file, args });
      return new Promise(() => {});
    },
    timer: (fn, ms) => {
      timers.push({ fn, ms });
      return { unref() {} };
    },
    clearTimer: () => {},
    onFinish: (info) => finished.push(info),
  });
  lifecycle.stop();
  assert.equal(calls.length, 1);
  assert.equal(timers[0].ms, 10000);
  timers[0].fn();
  assert.deepEqual(calls[1].args, ["/PID", "654", "/T", "/F"]);
  assert.equal(timers[1].ms, 6000);
  timers[1].fn();
  assert.equal(finished.length, 1);
  assert.equal(finished[0].status, "stop-failed");
  lifecycle.stop();
  assert.equal(calls.length, 2);
});

test("Windows cleanup never reuses an exited child PID for forced termination", () => {
  const child = new EventEmitter();
  child.pid = 987;
  child.kill = () => {
    throw new Error("must not signal single process");
  };
  const calls = [],
    timers = [],
    finished = [];
  const lifecycle = manageCapacityChild(child, {
    platform: "win32",
    runProcess: (file, args) => {
      calls.push(args);
      return new Promise(() => {});
    },
    timer: (fn, ms) => {
      timers.push({ fn, ms });
      return { unref() {} };
    },
    clearTimer: () => {},
    onFinish: (info) => finished.push(info),
  });
  lifecycle.stop();
  child.emit("exit", 0, null);
  assert.equal(finished.length, 0);
  timers[0].fn();
  assert.equal(calls.length, 1);
  assert.equal(finished[0].status, "stop-failed");
});

test("Windows forced cleanup ignores stale graceful completion and awaits its own result", async () => {
  const child = new EventEmitter();
  child.pid = 432;
  const completions = [],
    timers = [],
    finished = [];
  const lifecycle = manageCapacityChild(child, {
    platform: "win32",
    runProcess: () => new Promise((resolve) => completions.push(resolve)),
    timer: (fn, ms) => {
      timers.push({ fn, ms });
      return { unref() {} };
    },
    clearTimer: () => {},
    onFinish: (info) => finished.push(info),
  });
  lifecycle.stop();
  timers[0].fn();
  completions[0]();
  await Promise.resolve();
  child.emit("exit", 0, null);
  assert.equal(finished.length, 0);
  completions[1]();
  await Promise.resolve();
  assert.equal(finished.length, 1);
  assert.equal(finished[0].status, "exited");
});
