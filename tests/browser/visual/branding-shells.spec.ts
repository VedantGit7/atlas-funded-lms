import { test, expect } from "../fixtures/axe";
import { resolve } from "node:path";
import { waitForHydration } from "../helpers/hydration";

// Capture the auth shell for each configured tenant fixture. The slugs and
// hosts are test configuration; both hosts are overridable by environment.
const BRANDING_HOSTS = [
  {
    /* eslint-disable-next-line atlas/no-hardcoded-tenant-strings */
    name: "fundedbeyond",
    /* eslint-disable-next-line atlas/no-hardcoded-tenant-strings */
    baseURL: process.env["E2E_TENANT_BASE_URL"] ?? "http://fundedbeyond.localhost.test:3000",
  },
  {
    name: "second-smoke",
    baseURL: process.env["E2E_SECOND_TENANT_BASE_URL"] ?? "http://second-smoke.localhost.test:3000",
  },
] as const;

for (const fixture of BRANDING_HOSTS) {
  test.describe(`visual branding (${fixture.name})`, () => {
    test.use({ baseURL: fixture.baseURL });

    test("login shell light mode", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await waitForHydration(page);
      await page.addStyleTag({ path: resolve("tests/browser/visual/snapshot.css") });
      await expect(page.locator("nextjs-portal")).toBeHidden();
      await expect(page).toHaveScreenshot(`${fixture.name}-login-light.png`, {
        maxDiffPixelRatio: 0.03,
        mask: [page.getByText(/^Request ID:/)],
      });
    });

    test("login shell dark mode", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await waitForHydration(page);
      await page.addStyleTag({ path: resolve("tests/browser/visual/snapshot.css") });
      await expect(page.locator("nextjs-portal")).toBeHidden();
      await expect(page).toHaveScreenshot(`${fixture.name}-login-dark.png`, {
        maxDiffPixelRatio: 0.03,
        mask: [page.getByText(/^Request ID:/)],
      });
    });
  });
}
