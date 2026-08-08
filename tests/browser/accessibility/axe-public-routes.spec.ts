import { test, expect } from "../fixtures/axe";

test.describe("axe public learner routes", () => {
  test("login page has no serious axe violations", async ({ page, assertNoCriticalViolations }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await assertNoCriticalViolations();
  });

  test("public landing has no serious axe violations", async ({ page, assertNoCriticalViolations }) => {
    await page.goto("/p/home");
    await expect(page.getByRole("main")).toBeVisible();
    await assertNoCriticalViolations();
  });
});
