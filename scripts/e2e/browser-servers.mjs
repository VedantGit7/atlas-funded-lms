import { spawn, spawnSync } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The API and web servers the browser suite runs against, shared by
 * playwright.config.ts (its `webServer` entries) and
 * scripts/e2e/verify-failure-probes.mjs.
 *
 * The failure probes run one Playwright process per probe. With Playwright
 * owning the servers, each of those processes started its own, so every page
 * of every probed journey was compiled cold by the dev server. A cold compile
 * occasionally outlasted a hydration wait, and the probe failed before its
 * fault was even applied, at a different probe on each run. The probe script
 * now starts these servers once, and each probe reuses them (the faults are
 * injected in the browser with page.route, so nothing on the servers differs
 * between probes).
 */

/** Playwright's own readiness rule for a webServer `url`. */
const READY_STATUSES = new Set([400, 401, 402, 403]);

/**
 * Environment for both servers: a preload that keeps idle connections open far
 * longer than Node's default, so a busy dev server cannot close one just as a
 * client reuses it (see long-keep-alive.cjs). Added to any existing NODE_OPTIONS.
 */
export function browserServerEnv(env = process.env) {
  const preload = fileURLToPath(new URL("./long-keep-alive.cjs", import.meta.url));
  const requirePreload = `--require ${JSON.stringify(preload)}`;
  return { NODE_OPTIONS: [env.NODE_OPTIONS, requirePreload].filter(Boolean).join(" ") };
}

export function browserServers(env = process.env) {
  const useDevServer = env.BROWSER_E2E_DEV === "1";
  // The primary tenant fixture's local dev host (browser-suite configuration).
  const tenantBaseUrl = env.E2E_TENANT_BASE_URL ?? "http://fundedbeyond.localhost.test:3000";
  const serverEnv = browserServerEnv(env);
  return [
    {
      name: "api",
      command: useDevServer
        ? "pnpm exec dotenv -e .env.local -- pnpm --filter @atlas/api-app dev"
        : "pnpm exec dotenv -e .env.local -- pnpm browser:serve:api",
      url: "http://127.0.0.1:3001/api/v1/health",
      env: serverEnv,
    },
    {
      name: "web",
      command: useDevServer
        ? "pnpm --filter @atlas/web dev"
        : "pnpm exec dotenv -e .env.local -- pnpm browser:serve:web",
      url: tenantBaseUrl,
      env: serverEnv,
    },
  ];
}

export async function isServerReady(url) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5000) });
    return (response.status >= 200 && response.status < 400) || READY_STATUSES.has(response.status);
  } catch {
    return false;
  }
}

/**
 * Start each server that is not already answering, and wait until all answer.
 * Server output goes straight to `logFile` (descriptors, not pipes): the probe
 * script blocks its event loop in spawnSync while a probe runs, and a piped
 * server would stall once the unread pipe filled. Throws if a server exits or
 * is not ready in time; the error carries the started handles to stop.
 */
export async function startBrowserServers(
  servers,
  { logFile, timeoutMs = 420_000, pollMs = 1000 } = {},
) {
  const handles = [];
  for (const server of servers) {
    if (await isServerReady(server.url)) continue;
    const fd = logFile ? openSync(logFile, "a") : "ignore";
    const child = spawn(server.command, {
      shell: true,
      env: { ...process.env, ...server.env },
      stdio: ["ignore", fd, fd],
      // Its own process group on POSIX, so stopping it stops pnpm and Next too.
      detached: process.platform !== "win32",
    });
    if (typeof fd === "number") closeSync(fd);
    // The probe script must be able to exit even if a server ignores SIGTERM.
    child.unref();
    const handle = { server, child, exited: false };
    child.on("exit", () => {
      handle.exited = true;
    });
    handles.push(handle);
  }

  const deadline = Date.now() + timeoutMs;
  for (const server of servers) {
    for (;;) {
      if (await isServerReady(server.url)) break;
      const handle = handles.find((candidate) => candidate.server === server);
      if (handle?.exited) {
        throw Object.assign(new Error(`The ${server.name} server exited before it was ready`), {
          handles,
        });
      }
      if (Date.now() > deadline) {
        throw Object.assign(new Error(`The ${server.name} server was not ready in time`), {
          handles,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
  return { handles };
}

export function stopBrowserServers(handles) {
  for (const { child, exited } of handles) {
    if (exited || child.pid === undefined) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
}
