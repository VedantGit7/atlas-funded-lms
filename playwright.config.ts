import { defineConfig, devices } from "@playwright/test";

// The local dev host for the primary tenant fixture, overridable by environment.
// This is tenant configuration for the browser suite, not a brand in product code.
/* eslint-disable atlas/no-hardcoded-tenant-strings */
const tenantBaseUrl =
  process.env["E2E_TENANT_BASE_URL"] ?? "http://fundedbeyond.localhost.test:3000";
/* eslint-enable atlas/no-hardcoded-tenant-strings */
const platformBaseUrl = process.env["E2E_PLATFORM_BASE_URL"] ?? "http://platform.localhost:3000";
const runBrowserE2e = process.env["BROWSER_E2E"] === "1";

/** Production builds are the default; the isolated CI/local stack explicitly uses development mode. */
const useDevServer = process.env["BROWSER_E2E_DEV"] === "1";

/** Local troubleshooting may skip visuals; CI must compare committed Linux baselines. */
const skipVisualRegression = process.env["BROWSER_E2E_SKIP_VISUAL"] === "1";
if (process.env["CI"] && skipVisualRegression) {
  throw new Error("CI must compare the committed Linux visual baselines.");
}
const linuxBrowserEndpoint = process.env["E2E_LINUX_BROWSER_WS"];
/** A glob rather than a regex: it matches on either path separator without escaping. */
const visualSpecs = "**/tests/browser/visual/**";

/**
 * The build is part of the server command rather than a separate CI step so
 * that a local run and a pipeline run do the same thing. `next start` against a
 * stale or missing build fails in ways that read as application faults, and
 * that class of confusion is what this suite exists to remove.
 *
 * The build-then-start pair lives in a package script rather than inline here:
 * Playwright spawns this through the platform shell, and a nested `sh -c '...'`
 * does not survive cmd.exe on Windows.
 */
const apiServerCommand = useDevServer
  ? "pnpm exec dotenv -e .env.local -- pnpm --filter @atlas/api-app dev"
  : "pnpm exec dotenv -e .env.local -- pnpm browser:serve:api";

const webServerCommand = useDevServer
  ? "pnpm --filter @atlas/web dev"
  : "pnpm exec dotenv -e .env.local -- pnpm browser:serve:web";

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  // A partially completed journey must not retry against the same mutable fixture.
  retries: 0,
  updateSnapshots: process.env["CI"] ? "none" : "missing",
  ...(linuxBrowserEndpoint
    ? {
        snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-linux{ext}",
      }
    : {}),
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // A cold Turbopack dev compile of a route costs ten to twenty seconds before
  // React attaches, and an authenticated journey visits several routes. 60s was
  // set when only the public journeys ran and was never exercised by anything
  // that had to log in first. See tests/browser/helpers/hydration.ts.
  // A production build hydrates in about a second, so these are sized for an
  // application again rather than for a compiler. The dev-server escape hatch
  // needs the larger numbers, which is most of the reason it is an escape hatch.
  // An authenticated journey logs in, waits for hydration, then visits two or
  // three routes; 60s left no headroom on a loaded machine.
  timeout: useDevServer ? 150_000 : 90_000,
  expect: {
    timeout: useDevServer ? 30_000 : 10_000,
  },
  use: {
    ...(linuxBrowserEndpoint
      ? { connectOptions: { wsEndpoint: linuxBrowserEndpoint, exposeNetwork: "<loopback>" } }
      : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-tenant",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: tenantBaseUrl,
      },
      // Only J10 belongs on the platform host. J11 is a tenant journey — it
      // logs in as a learner on tenant A and then visits tenant B through
      // `secondTenantBaseUrl()` — so running it against the platform baseURL
      // made its first navigation a 404 on a plane that has no /courses. It had
      // been mis-projected since it was written, invisible because it never ran.
      testIgnore: skipVisualRegression ? [/10-platform/, visualSpecs] : [/10-platform/],
    },
    {
      name: "chromium-platform",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: platformBaseUrl,
      },
      testMatch: /10-platform/,
    },
  ],
  webServer: runBrowserE2e
    ? [
        {
          // Wrapped in dotenv to match `dev:backend`. Started bare, the API gets
          // no DATABASE_URL -- Next only reads .env files from the app
          // directory, and there are none under backend/apps/api -- so Prisma
          // falls back to localhost:5432 and every database-backed route
          // answers 500. The accessibility suite then fails on toBeVisible()
          // long before axe runs, which reads as a broken page rather than a
          // misconfigured harness.
          command: apiServerCommand,
          url: "http://127.0.0.1:3001/api/v1/health",
          reuseExistingServer: !process.env["CI"],
          // Long enough to cover a cold production build of both apps.
          timeout: 420_000,
        },
        {
          // NEXT_PUBLIC_* values are inlined at build time, so this build has to
          // run with the same Supabase configuration the journeys authenticate
          // against. Building first and configuring later would ship the wrong
          // auth endpoint into the client bundle.
          command: webServerCommand,
          url: tenantBaseUrl,
          reuseExistingServer: !process.env["CI"],
          timeout: 420_000,
        },
      ]
    : undefined,
});
