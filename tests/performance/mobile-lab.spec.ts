import { test, expect, devices, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loginWithCredentials } from "../browser/helpers/auth";
import { waitForHydration } from "../browser/helpers/hydration";
import { scenario } from "../browser/helpers/scenario";
import { requiredCredential } from "../browser/helpers/env";
import {
  assertLabCoverage,
  normalizeLabSample,
  assertLocalLabTarget,
} from "../../scripts/perf/browser-lab-evidence.mjs";

const routes = ["catalog", "lesson", "assessment-attempt"];
const throttleNetwork = process.env["ATLAS_PERF_NETWORK"] !== "unthrottled";
const profile = {
  device: "Pixel 7",
  interactionMethod: "keyboard input after focus; mobile pointer usability is not measured",
  cpuSlowdown: 4,
  network: throttleNetwork ? "emulated-1.6Mbps-150ms" : "unthrottled-tooling-validation",
  latencyMs: 150,
  downloadBytesPerSecond: 200_000,
  uploadBytesPerSecond: 93_750,
};
type Sample = {
  route: string;
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  downloadedJsBytes: number | null;
  interactionCount: number;
};

async function installCollector(context: BrowserContext) {
  // Use the installed, versioned web-vitals implementation (Next bundles v4),
  // rather than approximating INP with the slowest event or CLS with a raw sum.
  const source = readFileSync(
    resolve("frontend/apps/web/node_modules/next/dist/compiled/web-vitals/web-vitals.js"),
    "utf8",
  );
  await context.addInitScript({
    content: `(() => {
    const module = { exports: {} }; const __dirname = '';
    ${source}
    window.__atlasLabMetrics = { lcpMs: null, inpMs: null, cls: null };
    window.__atlasLabInteractions = 0;
    addEventListener('click', event => { if (event.isTrusted) window.__atlasLabInteractions++; }, true);
    addEventListener('keydown', event => { if (event.isTrusted) window.__atlasLabInteractions++; }, true);
    module.exports.onLCP(m => { window.__atlasLabMetrics.lcpMs = m.value; }, { reportAllChanges: true });
    module.exports.onINP(m => { window.__atlasLabMetrics.inpMs = m.value; }, { reportAllChanges: true, durationThreshold: 16 });
    module.exports.onCLS(m => { window.__atlasLabMetrics.cls = m.value; }, { reportAllChanges: true });
  })();`,
  });
}

test("synthetic mobile lab collects critical learner routes with real interactions", async ({
  browser,
}) => {
  const baseURL = requiredCredential("E2E_TENANT_BASE_URL");
  assertLocalLabTarget(
    baseURL,
    requiredCredential("SUPABASE_URL"),
    requiredCredential("DATABASE_URL"),
  );
  const fixture = scenario();
  const coursePath = `/courses/${fixture.courseId}`;
  const lessonPath = `${coursePath}/lessons/${fixture.lessonId}`;
  const setup = await browser.newContext({ baseURL });
  const setupPage = await setup.newPage();
  const samples: Sample[] = [];
  const startedAt = new Date().toISOString();
  try {
    // Fail with the actual HTTP outcome instead of timing out on hydration
    // when an isolated dev compile has failed before the login form renders.
    expect((await setupPage.request.get("/login")).status()).toBe(200);
    await loginWithCredentials(
      setupPage,
      requiredCredential("E2E_LEARNER_EMAIL"),
      requiredCredential("E2E_LEARNER_PASSWORD"),
      coursePath,
    );
    await setupPage.goto(coursePath);
    await waitForHydration(setupPage);
    const enroll = setupPage.getByRole("button", { name: "Enroll", exact: true });
    if (await enroll.isVisible()) {
      await enroll.click();
      await setupPage
        .getByRole("dialog", { name: "Confirm enrollment" })
        .getByRole("button", { name: "Confirm enrollment", exact: true })
        .click();
    }
    await expect(setupPage.getByText(/You are enrolled/)).toBeVisible();
    await setupPage.goto(`/assessments/${fixture.assessmentId}`);
    await waitForHydration(setupPage);
    await expect(
      setupPage.getByRole("button", { name: "Start attempt", exact: true }),
    ).toBeEnabled();
    await setupPage.getByRole("button", { name: "Start attempt", exact: true }).click();
    await expect(setupPage).toHaveURL(/\/attempts\/[\da-f-]+$/);
    const attemptPath = new URL(setupPage.url()).pathname;
    const storageState = await setup.storageState();

    async function measure(route: string, path: string, interact: (page: Page) => Promise<void>) {
      const context = await browser.newContext({
        ...devices["Pixel 7"],
        baseURL,
        storageState,
        serviceWorkers: "block",
      });
      const sample: Sample = normalizeLabSample({ route });
      samples.push(sample);
      console.info(`Mobile lab: measuring ${route}`);
      try {
        await installCollector(context);
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
        if (throttleNetwork) {
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: profile.latencyMs,
            downloadThroughput: profile.downloadBytesPerSecond,
            uploadThroughput: profile.uploadBytesPerSecond,
          });
        }
        const pending = new Set<string>();
        const completed = new Map<string, number>();
        let failedScript = false;
        cdp.on("Network.responseReceived", (event) => {
          if (event.type === "Script") pending.add(event.requestId);
        });
        cdp.on("Network.loadingFinished", (event) => {
          if (pending.delete(event.requestId))
            completed.set(event.requestId, event.encodedDataLength);
        });
        cdp.on("Network.loadingFailed", (event) => {
          if (pending.delete(event.requestId)) failedScript = true;
        });
        // Hydration and the exercised UI determine readiness. Waiting for every
        // image/analytics request can hang a usable page, especially in dev.
        const response = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
        expect(response?.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe(path);
        console.info(`Mobile lab: ${route} document ready`);
        await waitForHydration(page);
        console.info(`Mobile lab: ${route} hydrated`);
        await interact(page);
        // Allow the web-vitals event observer's idle callback and paint to run.
        await page.waitForTimeout(1_500);
        const values = await page.evaluate(() => {
          const state = window as unknown as {
            __atlasLabMetrics: Pick<Sample, "lcpMs" | "inpMs" | "cls">;
            __atlasLabInteractions: number;
          };
          return { ...state.__atlasLabMetrics, interactionCount: state.__atlasLabInteractions };
        });
        Object.assign(
          sample,
          normalizeLabSample({
            route,
            ...values,
            downloadedJsBytes:
              completed.size && !pending.size && !failedScript
                ? [...completed.values()].reduce((sum, bytes) => sum + bytes, 0)
                : null,
          }),
        );
      } finally {
        // Playwright may already have closed contexts at the test deadline.
        await context.close().catch(() => undefined);
      }
    }

    await measure("catalog", "/courses", async (page) => {
      const search = page.getByRole("searchbox", { name: "Search courses", exact: true });
      await search.focus();
      await search.pressSequentially("Browser", { delay: 40 });
      await expect(search).toHaveValue("Browser");
      await search.press("ControlOrMeta+A");
      await search.press("Backspace");
    });
    await measure("lesson", lessonPath, async (page) => {
      const progress = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/v1/lessons/${fixture.lessonId}/progress` &&
          response.request().method() === "POST" &&
          response.request().postDataJSON()?.completed === true,
      );
      const complete = page.getByRole("button", { name: "Mark complete", exact: true });
      await complete.focus();
      await complete.press("Enter");
      expect((await progress).status()).toBe(200);
      await expect(page.getByRole("status").filter({ hasText: "Lesson completed" })).toBeVisible();
    });
    await measure("assessment-attempt", attemptPath, async (page) => {
      const saved = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/api/v1${attemptPath}/answers` &&
          response.request().method() === "POST",
      );
      const answer = page.getByRole("radio", { name: "Paris", exact: true });
      await answer.focus();
      await answer.press("Space");
      expect((await saved).status()).toBe(200);
      await expect(page.getByText("Autosave: Saved", { exact: true })).toBeVisible();
    });
    assertLabCoverage(samples, routes);
  } finally {
    await setup.close().catch(() => undefined);
    let coverageError: string | null = null;
    try {
      assertLabCoverage(samples, routes);
    } catch (error) {
      coverageError = error instanceof Error ? error.message : "Missing metric coverage";
    }
    const directory = resolve(".test-results/f17");
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      resolve(directory, "mobile-lab.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          kind: throttleNetwork ? "synthetic-mobile-lab" : "synthetic-mobile-collector-validation",
          startedAt,
          finishedAt: new Date().toISOString(),
          environment:
            process.env["ATLAS_PERF_WEB_MODE"] === "production"
              ? "isolated-local-production-web-development-api"
              : "isolated-local-development",
          productionRepresentative: false,
          origin: baseURL,
          browser: browser.version(),
          profile: throttleNetwork
            ? profile
            : {
                ...profile,
                latencyMs: null,
                downloadBytesPerSecond: null,
                uploadBytesPerSecond: null,
              },
          cache: "fresh browser context per route; browser cache disabled; server may be warm",
          downloadedJsDefinition:
            "Chromium Network.loadingFinished encodedDataLength for Script responses, through interaction settlement; includes response headers and excludes unfinished or failed transfers",
          vitalsDefinition:
            "Installed Next web-vitals v4; reportAllChanges; latest observation 1.5 seconds after exercised interaction; short synthetic visit, not field p75",
          sampleCountPerRoute: 1,
          expectedRoutes: routes,
          samples,
          coverageError,
          limitations: [
            "Local host contention and development API affect timings; dev web runs also include compilation",
            "No production field p75 or supported user capacity claim",
            "Reset isolated fixtures before repeating lesson completion",
          ],
        },
        null,
        2,
      ) + "\n",
    );
  }
});
