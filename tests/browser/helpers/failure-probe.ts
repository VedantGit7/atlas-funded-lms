import type { Page } from "@playwright/test";
import { assertIsolatedFixtureTarget } from "../../../scripts/e2e/isolated-target.mjs";
import { scenario } from "./scenario";

/** Test-only fault injection. The normal suite must reject these false successes. */
export async function installFailureProbe(
  page: Page,
  applied: (fault: string) => void,
): Promise<void> {
  const fault = process.env["E2E_FAILURE_PROBE"];
  if (!fault) return;
  assertIsolatedFixtureTarget({
    databaseUrl: process.env["E2E_OWNER_DATABASE_URL"],
    authUrl: process.env["SUPABASE_URL"],
  });
  if (fault === "completion-not-saved") {
    await page.route("**/api/v1/lessons/*/progress", async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || request.postDataJSON()?.completed !== true)
        return route.continue();
      // Tell the UI it succeeded while deliberately omitting the database write.
      await route.fulfill({
        json: { data: { status: "completed", progressPct: 100, positionSeconds: 600 } },
      });
      applied(fault);
    });
  } else if (fault === "wrong-grade") {
    await page.route("**/api/v1/attempts/*/submit", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, data: { ...body.data, scorePercent: 0, passed: false } },
      });
      applied(fault);
    });
  } else if (fault === "role-not-revoked") {
    await page.route("**/api/v1/members/*/roles/*", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      await route.fulfill({ json: { data: { revoked: true } } });
      applied(fault);
    });
  } else if (fault === "review-skipped") {
    await page.route("**/api/v1/courses/*/publish", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, data: { ...body.data, status: "PUBLISHED" } },
      });
      applied(fault);
    });
  } else if (fault === "review-return-not-saved") {
    await page.route("**/api/v1/workflows/*/transition", async (route) => {
      if (
        route.request().method() !== "POST" ||
        route.request().postDataJSON()?.action !== "return"
      )
        return route.continue();
      await route.fulfill({ json: { data: { status: "DRAFT" } } });
      applied(fault);
    });
  } else if (fault === "entitlement-not-saved") {
    await page.route("**/api/v1/platform/tenants/*/entitlements", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await route.fulfill({ json: { data: [] } });
      applied(fault);
    });
  } else if (fault === "foreign-read-allowed") {
    const fixture = scenario();
    await page.route(`**/api/v1/courses/${fixture.foreignCourseId}?view=studio`, async (route) => {
      await route.fulfill({
        json: { data: { id: fixture.foreignCourseId, title: fixture.foreignSentinel } },
      });
      applied(fault);
    });
  } else {
    throw new Error(`Unknown browser failure probe: ${fault}`);
  }
}
