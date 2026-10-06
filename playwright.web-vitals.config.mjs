import { defineConfig } from "@playwright/test";
import process from "node:process";

// Page-load budgets (pnpm perf:web-vitals). Explicit separate entry point: it
// never starts a server, and measures only the production build named by
// ATLAS_WEB_VITALS_BASE_URL.
export default defineConfig({
  testDir: "tests/performance",
  testMatch: "web-vitals.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 600_000,
  outputDir: ".test-results/perf/web-vitals-artifacts",
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL: process.env["ATLAS_WEB_VITALS_BASE_URL"],
    navigationTimeout: 60_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
