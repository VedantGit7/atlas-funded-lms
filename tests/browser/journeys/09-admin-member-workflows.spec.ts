import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasAdminCredentials, requiredCredential } from "../helpers/env";

test.describe("J09 tenant admin workflows", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  });

  test("admin dashboard and member management surfaces load", async ({ page }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_ADMIN_EMAIL"),
      requiredCredential("E2E_ADMIN_PASSWORD"),
    );
    await page.goto("/admin");
    await expect(page.getByRole("main")).toBeVisible();
    await page.goto("/admin/members");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
