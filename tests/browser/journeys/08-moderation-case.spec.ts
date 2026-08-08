import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasAdminCredentials } from "../helpers/env";

test.describe("J08 moderation case decision", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  });

  test("moderation queue surface loads", async ({ page }) => {
    await loginWithCredentials(
      page,
      process.env["E2E_ADMIN_EMAIL"]!,
      process.env["E2E_ADMIN_PASSWORD"]!,
    );
    await page.goto("/admin/moderation/cases");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
