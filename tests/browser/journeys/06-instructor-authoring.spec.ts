import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasInstructorCredentials, requiredCredential } from "../helpers/env";

test.describe("J06 instructor authoring", () => {
  test.beforeEach(() => {
    test.skip(!hasInstructorCredentials(), "Set E2E_INSTRUCTOR_EMAIL and E2E_INSTRUCTOR_PASSWORD");
  });

  test("studio shell loads for instructor", async ({ page }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_INSTRUCTOR_EMAIL"),
      requiredCredential("E2E_INSTRUCTOR_PASSWORD"),
    );
    await page.goto("/studio");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
