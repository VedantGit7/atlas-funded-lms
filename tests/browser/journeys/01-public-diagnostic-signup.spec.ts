import { test, expect } from "../fixtures/axe";

test.describe("J01 shell smoke: public landing, diagnostic and signup", () => {
  test("loads public landing shell", async ({ page, assertNoCriticalViolations }) => {
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
    // The password is chosen from the emailed link (security review 5.3,
    // finding 1), so the form has none.
    await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  });

  test("the page a sign-up link opens asks for the password", async ({ page }) => {
    await page.goto(`/signup/complete?token=${"t".repeat(43)}`);
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();
  });
});
