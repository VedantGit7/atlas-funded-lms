import { test, expect, type Browser } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DESKTOP_PROFILE,
  WEB_VITALS_BUDGETS,
  WEB_VITALS_ROUTES,
  assertProductionBuild,
  describeResult,
  evaluateWebVitals,
} from "../../scripts/perf/web-vitals-budget.mjs";

/**
 * Page-load budgets for the public tenant routes (replaces Lighthouse CI).
 *
 * Each route is loaded RUNS times, each in a fresh browser context with the
 * cache disabled, under Lighthouse's desktop throttling. Vitals come from the
 * web-vitals copy Next itself bundles (as in mobile-lab.spec.ts); Total
 * Blocking Time is the sum of each long task's time over 50 ms after First
 * Contentful Paint. Budgets and their evaluation live in
 * scripts/perf/web-vitals-budget.mjs.
 */

const runs = Number(process.env["ATLAS_WEB_VITALS_RUNS"] ?? "3");

/**
 * `collector-validation` proves the harness against any server, a dev server
 * included: every metric must be observed on every route, but budgets are not
 * applied and the report says so. Timings from such a run mean nothing; only
 * the default mode, against a production build, is a performance check.
 */
const validationOnly = process.env["ATLAS_WEB_VITALS_MODE"] === "collector-validation";

type Sample = {
  route: string;
  run: number;
  lcpMs: number | null;
  cls: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  tbtMs: number | null;
  downloadedJsBytes: number | null;
};

const webVitalsSource = readFileSync(
  resolve("frontend/apps/web/node_modules/next/dist/compiled/web-vitals/web-vitals.js"),
  "utf8",
);

const collector = `(() => {
  const module = { exports: {} }; const __dirname = '';
  ${webVitalsSource}
  const metrics = window.__atlasVitals = { lcpMs: null, cls: null, fcpMs: null, ttfbMs: null, longTasks: [] };
  module.exports.onLCP(m => { metrics.lcpMs = m.value; }, { reportAllChanges: true });
  module.exports.onCLS(m => { metrics.cls = m.value; }, { reportAllChanges: true });
  module.exports.onFCP(m => { metrics.fcpMs = m.value; });
  module.exports.onTTFB(m => { metrics.ttfbMs = m.value; });
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) metrics.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }).observe({ type: 'longtask', buffered: true });
})();`;

async function measure(browser: Browser, baseURL: string, route: string, run: number) {
  const context = await browser.newContext({
    baseURL,
    viewport: DESKTOP_PROFILE.viewport,
    deviceScaleFactor: DESKTOP_PROFILE.deviceScaleFactor,
    serviceWorkers: "block",
  });
  try {
    await context.addInitScript({ content: collector });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: DESKTOP_PROFILE.cpuSlowdown });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: DESKTOP_PROFILE.latencyMs,
      downloadThroughput: DESKTOP_PROFILE.downloadBytesPerSecond,
      uploadThroughput: DESKTOP_PROFILE.uploadBytesPerSecond,
    });
    const scripts = new Map<string, number>();
    cdp.on("Network.responseReceived", (event) => {
      if (event.type === "Script") scripts.set(event.requestId, 0);
    });
    cdp.on("Network.loadingFinished", (event) => {
      if (scripts.has(event.requestId)) scripts.set(event.requestId, event.encodedDataLength);
    });

    const response = await page.goto(route, { waitUntil: "load", timeout: 60_000 });
    expect(response?.status(), `${route} status`).toBe(200);
    if (run === 1 && !validationOnly) assertProductionBuild(await page.content());
    // Let late layout shifts, the final LCP candidate and post-load long tasks
    // land; then hide the page so web-vitals reports CLS and LCP.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1_500);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const raw = await page.evaluate(
      () =>
        (
          window as unknown as {
            __atlasVitals: {
              lcpMs: number | null;
              cls: number | null;
              fcpMs: number | null;
              ttfbMs: number | null;
              longTasks: Array<{ start: number; duration: number }>;
            };
          }
        ).__atlasVitals,
    );
    const fcp = raw.fcpMs;
    const sample: Sample = {
      route,
      run,
      lcpMs: raw.lcpMs,
      cls: raw.cls,
      fcpMs: fcp,
      ttfbMs: raw.ttfbMs,
      tbtMs:
        fcp === null
          ? null
          : raw.longTasks
              .filter((task) => task.start + task.duration > fcp)
              .reduce((total, task) => {
                // Only the part of a task after FCP counts, and only beyond 50 ms.
                const duration =
                  task.start < fcp ? task.start + task.duration - fcp : task.duration;
                return total + Math.max(0, duration - 50);
              }, 0),
      downloadedJsBytes: scripts.size ? [...scripts.values()].reduce((a, b) => a + b, 0) : null,
    };
    return sample;
  } finally {
    await context.close().catch(() => undefined);
  }
}

test("public routes load within their web-vitals budgets", async ({ browser, baseURL }) => {
  if (!baseURL) {
    throw new Error("Set ATLAS_WEB_VITALS_BASE_URL to the production build to measure.");
  }
  const samples: Sample[] = [];
  for (const route of WEB_VITALS_ROUTES) {
    for (let run = 1; run <= runs; run += 1) {
      samples.push(await measure(browser, baseURL, route, run));
    }
  }

  const report = evaluateWebVitals(samples, WEB_VITALS_BUDGETS);
  for (const warning of report.warnings) console.warn(`warn  ${describeResult(warning)}`);
  for (const failure of report.failures) console.error(`FAIL  ${describeResult(failure)}`);

  const directory = resolve(".test-results/perf");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, "web-vitals.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: validationOnly ? "collector-validation" : "synthetic-desktop-page-load",
        measuredAt: new Date().toISOString(),
        origin: baseURL,
        browser: browser.version(),
        profile: DESKTOP_PROFILE,
        runsPerRoute: runs,
        cache: "fresh browser context per run; browser cache disabled",
        passed: validationOnly ? null : report.passed,
        results: report.results,
        samples,
      },
      null,
      2,
    ) + "\n",
  );

  if (validationOnly) {
    const unobserved = report.results.filter((result) => result.status === "missing");
    expect(unobserved.map(describeResult), "metrics the collector never observed").toEqual([]);
    return;
  }
  expect(report.failures.map(describeResult), "routes over an error budget").toEqual([]);
});
