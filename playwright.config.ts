import { defineConfig, devices } from "@playwright/test";

const tenantBaseUrl =
  process.env["E2E_TENANT_BASE_URL"] ?? "http://fundedbeyond.localhost.test:3000";
const platformBaseUrl = process.env["E2E_PLATFORM_BASE_URL"] ?? "http://platform.localhost:3000";
const runBrowserE2e = process.env["BROWSER_E2E"] === "1";

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  use: {
    trace: "on-first-retry",
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
      testIgnore: [/10-platform/, /11-cross-tenant/],
    },
    {
      name: "chromium-platform",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: platformBaseUrl,
      },
      testMatch: /10-platform|11-cross-tenant/,
    },
  ],
  webServer: runBrowserE2e
    ? [
        {
          command: "pnpm --filter @atlas/api-app dev",
          url: "http://127.0.0.1:3001/api/v1/health",
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
        },
        {
          command: "pnpm --filter @atlas/web dev",
          url: tenantBaseUrl,
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
        },
      ]
    : undefined,
});
