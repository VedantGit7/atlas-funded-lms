import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasPlatformCredentials, requiredCredential } from "../helpers/env";

test.describe("J10 platform provision and entitlements", () => {
  test.beforeEach(() => {
    test.skip(!hasPlatformCredentials(), "Set E2E_PLATFORM_EMAIL and E2E_PLATFORM_PASSWORD");
  });

  test("platform tenant list loads on platform host", async ({ page }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_PLATFORM_EMAIL"),
      requiredCredential("E2E_PLATFORM_PASSWORD"),
    );
    await page.goto("/platform");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
