import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasAdminCredentials, requiredCredential } from "../helpers/env";

test.describe("J07 review approvals", () => {
  test.beforeEach(() => {
    test.skip(
      !hasAdminCredentials(),
      "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for review access",
    );
  });

  test("review queue surface loads", async ({ page }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_ADMIN_EMAIL"),
      requiredCredential("E2E_ADMIN_PASSWORD"),
    );
    await page.goto("/admin/review");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
