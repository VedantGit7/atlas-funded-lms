import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import {
  hasAdminCredentials,
  hasInstructorCredentials,
  hasLearnerCredentials,
  hasPlatformCredentials,
} from "../helpers/env";

test.describe("J02 learner dashboard and enrollment", () => {
  test.beforeEach(() => {
    test.skip(
      !hasLearnerCredentials(),
      "Set E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD for authenticated journeys",
    );
  });

  test("login reaches learner dashboard and course catalog", async ({ page, assertNoCriticalViolations }) => {
    await loginWithCredentials(
      page,
      process.env["E2E_LEARNER_EMAIL"]!,
      process.env["E2E_LEARNER_PASSWORD"]!,
    );
    await page.goto("/");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await assertNoCriticalViolations();
    await page.goto("/courses");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
