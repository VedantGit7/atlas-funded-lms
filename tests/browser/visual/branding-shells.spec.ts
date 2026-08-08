import { test, expect } from "../fixtures/axe";

const BRANDING_HOSTS = [
  {
    name: "fundedbeyond",
    baseURL: process.env["E2E_TENANT_BASE_URL"] ?? "http://fundedbeyond.localhost.test:3000",
  },
  {
    name: "second-smoke",
    baseURL: process.env["E2E_SECOND_TENANT_BASE_URL"] ?? "http://second-smoke.localhost.test:3000",
  },
] as const;

for (const fixture of BRANDING_HOSTS) {
  test.describe(`visual branding (${fixture.name})`, () => {
    test.beforeEach(() => {
      test.skip(
        Boolean(process.env["CI"]) && process.env["VISUAL_REGRESSION"] !== "1",
        "Set VISUAL_REGRESSION=1 in CI after snapshot baselines are committed",
      );
    });

    test.use({ baseURL: fixture.baseURL });

    test("login shell light mode", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page).toHaveScreenshot(`${fixture.name}-login-light.png`, {
        maxDiffPixelRatio: 0.03,
      });
    });

    test("login shell dark mode", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page).toHaveScreenshot(`${fixture.name}-login-dark.png`, {
        maxDiffPixelRatio: 0.03,
      });
    });
  });
}
