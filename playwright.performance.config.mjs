import { defineConfig } from "@playwright/test";
import process from "node:process";

// Explicit separate entry point: never starts or reuses the user's dev servers.
export default defineConfig({
  testDir: "tests/performance",
  testMatch: "mobile-lab.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 60_000 },
  outputDir: ".test-results/f17/mobile-artifacts",
  reporter: "list",
  use: {
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    baseURL: process.env["E2E_TENANT_BASE_URL"],
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
