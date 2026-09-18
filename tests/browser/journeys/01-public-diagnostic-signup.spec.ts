import { test, expect } from "../fixtures/axe";

test.describe("J01 public diagnostic and signup path", () => {
  test("loads public landing and diagnostic entry", async ({
    page,
    assertNoCriticalViolations,
  }) => {
    await page.goto("/p/home");
    await expect(page.getByRole("main")).toBeVisible();
    await assertNoCriticalViolations();
  });

  test("loads public diagnostic runner", async ({ page }) => {
    await page.goto("/diagnostic");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("signup screen is reachable from auth plane", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("Email")).toBeVisible();
    // `exact` matters here. The signup form carries "Password", "Confirm
    // password" and two "Show password" toggles, so a substring match resolves
    // to four elements and fails Playwright strict mode -- the assertion was
    // reporting a broken signup screen when the screen was fine.
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });
});
