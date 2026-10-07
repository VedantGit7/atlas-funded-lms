import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  browserServers,
  isServerReady,
  startBrowserServers,
  stopBrowserServers,
} from "./browser-servers.mjs";

/** Servers for the browser suite: started once, reused, and stopped (failure-probe flakiness). */

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function fakeServer(port, { exitImmediately = false } = {}) {
  const script = exitImmediately
    ? "process.exit(3)"
    : `console.log('fake server up'); require('node:http').createServer((q, s) => s.end('ok')).listen(${port}, '127.0.0.1')`;
  return {
    name: "fake",
    command: `"${process.execPath}" -e "${script}"`,
    url: `http://127.0.0.1:${port}/`,
  };
}

test("uses the same commands Playwright used before, dev or production", () => {
  const dev = browserServers({
    BROWSER_E2E_DEV: "1",
    E2E_TENANT_BASE_URL: "http://t.localhost.test:3000",
  });
  assert.deepEqual(
    dev.map((server) => [server.name, server.command, server.url]),
    [
      [
        "api",
        "pnpm exec dotenv -e .env.local -- pnpm --filter @atlas/api-app dev",
        "http://127.0.0.1:3001/api/v1/health",
      ],
      ["web", "pnpm --filter @atlas/web dev", "http://t.localhost.test:3000"],
    ],
  );
  const production = browserServers({});
  assert.match(production[0].command, /browser:serve:api$/);
  assert.match(production[1].command, /browser:serve:web$/);
});

test("starts a server once, waits until it answers, logs to a file, and stops it", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-browser-servers-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const logFile = join(directory, "servers.log");
  const port = await freePort();
  const server = fakeServer(port);

  const { handles } = await startBrowserServers([server], {
    logFile,
    pollMs: 50,
    timeoutMs: 20_000,
  });
  assert.equal(handles.length, 1);
  assert.equal(await isServerReady(server.url), true);

  // Already answering: a second start reuses it rather than starting another.
  const again = await startBrowserServers([server], { logFile, pollMs: 50 });
  assert.equal(again.handles.length, 0);

  stopBrowserServers(handles);
  const deadline = Date.now() + 10_000;
  while ((await isServerReady(server.url)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(await isServerReady(server.url), false);
  assert.match(readFileSync(logFile, "utf8"), /fake server up/);
});

test("fails fast, with the started handles, when a server exits before it is ready", async () => {
  const port = await freePort();
  await assert.rejects(
    startBrowserServers([fakeServer(port, { exitImmediately: true })], {
      pollMs: 50,
      timeoutMs: 20_000,
    }),
    (error) => /exited before it was ready/.test(error.message) && Array.isArray(error.handles),
  );
});
