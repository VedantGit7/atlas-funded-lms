import { test, expect } from "../fixtures/axe";

test.describe("axe learner critical routes", () => {
  test("courses catalog shell has no serious axe violations when public", async ({
    page,
    assertNoCriticalViolations,
  }) => {
    await page.goto("/courses");
    await expect(page.getByRole("main")).toBeVisible();
    await assertNoCriticalViolations();
  });
});
