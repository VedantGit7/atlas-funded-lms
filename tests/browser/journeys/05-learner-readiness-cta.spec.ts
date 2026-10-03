import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasLearnerCredentials, requiredCredential } from "../helpers/env";

test.describe("J05 shell smoke: learner readiness page", () => {
  test.beforeEach(() => {
    test.skip(!hasLearnerCredentials(), "Set E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD");
  });

  test("readiness surface loads for authenticated learner", async ({ page }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_LEARNER_EMAIL"),
      requiredCredential("E2E_LEARNER_PASSWORD"),
    );
    await page.goto("/readiness");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
