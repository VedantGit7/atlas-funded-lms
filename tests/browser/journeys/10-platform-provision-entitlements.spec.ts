import { randomUUID } from "node:crypto";
import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { waitForHydration } from "../helpers/hydration";
import { coldRouteNavigationOptions } from "../helpers/navigation";
import { scenario } from "../helpers/scenario";
import { provisionedTenantPersistence } from "../helpers/persistence";

test.describe("J10 platform provision and entitlements", () => {
  test("provisions an isolated tenant and persists an entitlement change", async ({ page }) => {
    test.setTimeout(150_000);
    scenario();
    const slug = `browser-provision-${randomUUID().slice(0, 8)}`;
    const name = `Browser provision ${slug}`;
    const reason = "Verify isolated browser tenant provisioning";
    await loginWithCredentials(
      page,
      requiredCredential("E2E_PLATFORM_EMAIL"),
      requiredCredential("E2E_PLATFORM_PASSWORD"),
    );
    await page.goto("/platform/tenants/new");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Provide reason", exact: true }).click();
    const reasonDialog = page.getByRole("dialog", { name: "Platform operational reason" });
    await reasonDialog.getByLabel("Operational reason").fill(reason);
    await reasonDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByLabel("Display name", { exact: true }).fill(name);
    await page.getByLabel("Owner email", { exact: true }).fill(`${slug}@atlas-e2e.test`);
    await page.getByLabel("Owner display name", { exact: true }).fill("Browser provision owner");
    await page.getByRole("combobox", { name: "Seed profile", exact: true }).selectOption("EMPTY");
    await page.getByRole("button", { name: "Add entitlement", exact: true }).click();
    await page.getByLabel("Key", { exact: true }).fill("feature.community");
    await page.getByRole("button", { name: "Provision tenant", exact: true }).click();
    const provisioning = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/platform/tenants" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("dialog", { name: "Confirm provisioning" })
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    const provisioned = await provisioning;
    expect(provisioned.status()).toBe(200);
    expect(provisioned.request().postDataJSON()).toMatchObject({
      slug,
      owner: { email: `${slug}@atlas-e2e.test` },
      initialEntitlements: [
        { key: "feature.community", enabled: true, value: null, expiresAt: null },
      ],
    });
    const { data: tenant } = (await provisioned.json()) as { data: { id: string } };
    await expect(page).toHaveURL(new RegExp(`/platform/tenants/${tenant.id}$`));
    // Client navigation changes the URL at once; this heading is the first proof the tenant
    // detail route has rendered, and on a fresh dev server (each failure probe starts one)
    // that route compiles cold. The saved-state checks below keep their normal timeouts.
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible(
      coldRouteNavigationOptions(),
    );
    await expect(page.locator("dd").filter({ hasText: /^ACTIVE$/ })).toBeVisible();
    await expect(page.locator("dd").filter({ hasText: /^SUCCEEDED$/ })).toBeVisible();
    const headers = { "x-atlas-platform-reason": reason };
    const detail = await page.request.get(`/api/v1/platform/tenants/${tenant.id}`, { headers });
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({
      data: {
        id: tenant.id,
        slug,
        state: "ACTIVE",
        provisioning: { latestStatus: "SUCCEEDED" },
        primaryDomain: {
          hostname: expect.stringMatching(new RegExp(`^${slug}\\.`)),
          status: "ACTIVE",
        },
      },
    });
    const persisted = await provisionedTenantPersistence(tenant.id);
    expect(persisted.invitations).toEqual([{ status: "INVITED", email: `${slug}@atlas-e2e.test` }]);
    expect(persisted.roles.map((role) => role.key)).toEqual([
      "admin",
      "instructor",
      "learner",
      "moderator",
      "owner",
    ]);
    for (const role of persisted.roles) expect(role.permission_count).toBeGreaterThan(0);
    expect(persisted.audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "tenant.created",
          reason,
          request_id: provisioned.headers()["x-request-id"],
        }),
        expect.objectContaining({
          action: "tenant.state_changed",
          reason,
          request_id: provisioned.headers()["x-request-id"],
        }),
      ]),
    );
    await page.getByRole("tab", { name: "Entitlements", exact: true }).click();
    await expect(page.getByLabel("Key", { exact: true })).toHaveValue("feature.community");
    await page.getByLabel("Enabled", { exact: true }).uncheck();
    await page.getByRole("button", { name: "Save entitlements", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Confirm entitlement changes" })
      .getByLabel("Operational reason")
      .fill(reason);
    const saving = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/v1/platform/tenants/${tenant.id}/entitlements` &&
        response.request().method() === "PUT",
    );
    await page
      .getByRole("dialog", { name: "Confirm entitlement changes" })
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    expect((await saving).status()).toBe(200);
    const entitlement = await page.request.get(
      `/api/v1/platform/tenants/${tenant.id}/entitlements`,
      { headers },
    );
    expect(entitlement.status()).toBe(200);
    expect(await entitlement.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ key: "feature.community", enabled: false }),
      ]),
    });
    await page.reload();
    await waitForHydration(page);
    await page.getByRole("button", { name: "Provide reason", exact: true }).click();
    await reasonDialog.getByLabel("Operational reason").fill(reason);
    await reasonDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Entitlements", exact: true }).click();
    await expect(page.getByLabel("Key", { exact: true })).toHaveValue("feature.community");
    await expect(page.getByLabel("Enabled", { exact: true })).not.toBeChecked();
  });
});
