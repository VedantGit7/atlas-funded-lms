import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { hasLearnerCredentials, requiredCredential, secondTenantBaseUrl } from "../helpers/env";

test.describe("J11 cross-tenant negative", () => {
  test.beforeEach(() => {
    test.skip(!hasLearnerCredentials(), "Set E2E_LEARNER_EMAIL and E2E_LEARNER_PASSWORD");
  });

  test("tenant A session does not resolve tenant B host as same tenant", async ({
    page,
    context,
  }) => {
    await loginWithCredentials(
      page,
      requiredCredential("E2E_LEARNER_EMAIL"),
      requiredCredential("E2E_LEARNER_PASSWORD"),
    );
    await page.goto("/courses");
    await expect(page.getByRole("main")).toBeVisible();

    const secondPage = await context.newPage();
    await secondPage.goto(`${secondTenantBaseUrl()}/courses`);
    await expect(secondPage.getByRole("main")).toBeVisible();
    const primaryHost = new URL(page.url()).host;
    const secondaryHost = new URL(secondPage.url()).host;
    expect(primaryHost).not.toEqual(secondaryHost);
  });
});
