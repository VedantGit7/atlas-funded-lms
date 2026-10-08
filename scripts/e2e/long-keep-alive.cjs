// Preloaded (NODE_OPTIONS --require) into the browser suite's API and web
// servers only; see scripts/e2e/browser-servers.mjs. Not used in production.
//
// Journeys failed with `socket hang up` that neither server logged: on a
// request from Playwright to the web server, and on the web server's /api/v1
// rewrite to the API ("Failed to proxy ... socket hang up"). Both clients keep
// idle connections alive with no idle timeout of their own (Playwright's
// request agent; the httpxy agent Next's rewrite proxy uses), so a connection
// is only ever closed by the server's keep-alive timer, about 6 s idle. A dev
// server is often busy compiling; while its event loop is blocked that timer
// fires late, the client writes its next request onto the connection in the
// meantime, and the overdue timer then closes it with the request unread.
// Reproduced with a stand-in server stalling 250 ms at a time: 3-11 of 48
// reused connections reset with the defaults, none with a long keep-alive.
//
// `next dev` has no keep-alive option (only `next start --keepAliveTimeout`),
// so this sets it on every HTTP server the process creates. Idle connections
// then outlast any pause in a test run instead of racing the client.
const http = require("node:http");
const https = require("node:https");

const KEEP_ALIVE_TIMEOUT_MS = 10 * 60_000;

for (const module of [http, https]) {
  const createServer = module.createServer;
  module.createServer = function createServerWithLongKeepAlive(...args) {
    const server = createServer.apply(this, args);
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    return server;
  };
}
