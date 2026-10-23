// The API and web servers the browser suite runs against, shared by
// playwright.config.ts (its `webServer` entries) and browser-servers.mjs (the
// failure probes, which start them once for all probes).
//
// CommonJS on purpose: Playwright 1.63+ compiles the modules its config
// imports to CommonJS, where an ES module's `import.meta` is a syntax error,
// so the config cannot import browser-servers.mjs. This file has nothing
// ES-only in it, so it loads the same way under Playwright and under Node.
const path = require("node:path");

/**
 * Environment for both servers: a preload that keeps idle connections open far
 * longer than Node's default, so a busy dev server cannot close one just as a
 * client reuses it (see long-keep-alive.cjs). Added to any existing NODE_OPTIONS.
 */
function browserServerEnv(env = process.env) {
  const preload = path.join(__dirname, "long-keep-alive.cjs");
  const requirePreload = `--require ${JSON.stringify(preload)}`;
  return { NODE_OPTIONS: [env.NODE_OPTIONS, requirePreload].filter(Boolean).join(" ") };
}

function browserServers(env = process.env) {
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

module.exports = { browserServerEnv, browserServers };
