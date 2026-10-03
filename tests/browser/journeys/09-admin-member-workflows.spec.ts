import { randomUUID } from "node:crypto";
import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { waitForHydration } from "../helpers/hydration";
import { scenario } from "../helpers/scenario";

test.describe("J09 tenant admin role management", () => {
  test("grants and revokes a role with persisted membership changes", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(process.env["BROWSER_E2E_DEV"] === "1" ? 300_000 : 180_000);
    const fixture = scenario();
    const targetContext = await browser.newContext({ baseURL });
    try {
      const target = await targetContext.newPage();
      await loginWithCredentials(
        target,
        requiredCredential("E2E_ROLE_TARGET_EMAIL"),
        requiredCredential("E2E_ROLE_TARGET_PASSWORD"),
        "/courses",
      );
      const accessToken = (await targetContext.cookies()).find(
        (cookie) => cookie.name === "atlas_access_token",
      )?.value;
      expect(Boolean(accessToken)).toBe(true);
      const title = `Role permission control ${randomUUID()}`;
      const deniedBefore = await target.request.post("/api/v1/courses", {
        data: { title },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(deniedBefore.status()).toBe(403);
      expect(await deniedBefore.json()).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
      await loginWithCredentials(
        page,
        requiredCredential("E2E_ADMIN_EMAIL"),
        requiredCredential("E2E_ADMIN_PASSWORD"),
        `/admin/members/${fixture.roleTargetMembershipId}`,
      );
      const memberPath = `/api/v1/members/${fixture.roleTargetMembershipId}`;
      const before = await page.request.get(memberPath);
      expect(before.status()).toBe(200);
      const beforeBody = (await before.json()) as {
        data: { roles: Array<{ id: string; key: string }> };
      };
      expect(beforeBody.data.roles.some((role) => role.id === fixture.instructorRoleId)).toBe(
        false,
      );
      expect(beforeBody.data.roles.some((role) => role.key === "owner")).toBe(false);
      await waitForHydration(page);
      const roles = page.locator("#member-roles");
      await roles.getByRole("button", { name: "Manage roles", exact: true }).click();
      await roles.getByRole("combobox").selectOption(fixture.instructorRoleId);
      const roleName = await roles.getByRole("combobox").locator("option:checked").innerText();
      const assignment = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `${memberPath}/roles` &&
          response.request().method() === "POST",
      );
      await roles.getByRole("button", { name: "Assign role", exact: true }).click();
      const assigned = await assignment;
      expect(assigned.status()).toBe(200);
      expect(assigned.request().postDataJSON()).toEqual({ roleId: fixture.instructorRoleId });
      await expect(
        roles.getByRole("button", { name: `Revoke ${roleName}`, exact: true }),
      ).toBeVisible();
      await page.reload();
      await waitForHydration(page);
      await expect(
        roles.getByRole("button", { name: `Revoke ${roleName}`, exact: true }),
      ).toBeVisible();
      const granted = await page.request.get(memberPath);
      expect(granted.status()).toBe(200);
      expect(await granted.json()).toMatchObject({
        data: {
          roles: expect.arrayContaining([
            expect.objectContaining({ id: fixture.instructorRoleId }),
          ]),
        },
      });
      // The existing learner session gains the instructor permission without logging in again.
      const allowed = await target.request.post("/api/v1/courses", {
        data: { title },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(allowed.status()).toBe(200);
      const created = (await allowed.json()) as {
        data: { id: string; title: string; status: string };
      };
      expect(created.data).toMatchObject({ title, status: "DRAFT" });
      const saved = await target.request.get(`/api/v1/courses/${created.data.id}?view=studio`);
      expect(saved.status()).toBe(200);
      expect(await saved.json()).toMatchObject({
        data: { id: created.data.id, title, status: "DRAFT" },
      });
      const revocation = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `${memberPath}/roles/${fixture.instructorRoleId}` &&
          response.request().method() === "DELETE",
      );
      await roles.getByRole("button", { name: `Revoke ${roleName}`, exact: true }).click();
      expect((await revocation).status()).toBe(200);
      // The revoke button disappears while the request is busy. Wait for the
      // role chip itself to disappear so the server refresh has really landed.
      await expect(
        roles.getByText(roleName, { exact: true }),
        "Revoked role must disappear from assigned roles",
      ).toHaveCount(0);
      await page.reload();
      await expect(
        roles.getByRole("heading", { name: "Assigned Roles", exact: true }),
      ).toBeVisible();
      await expect(
        roles.getByText(roleName, { exact: true }),
        "Revoked role must disappear from assigned roles after reload",
      ).toHaveCount(0);
      const revoked = await page.request.get(memberPath);
      expect(revoked.status()).toBe(200);
      const revokedBody = (await revoked.json()) as { data: { roles: Array<{ id: string }> } };
      expect(revokedBody.data.roles.map((role) => role.id).sort()).toEqual(
        beforeBody.data.roles.map((role) => role.id).sort(),
      );
      const deniedAfter = await target.request.post("/api/v1/courses", {
        data: { title: `${title} after revocation` },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(deniedAfter.status()).toBe(403);
      expect(await deniedAfter.json()).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
      const currentToken = (await targetContext.cookies()).find(
        (cookie) => cookie.name === "atlas_access_token",
      )?.value;
      // Compare booleans so a failed assertion never writes a bearer token into test output.
      expect(currentToken === accessToken).toBe(true);
    } finally {
      await targetContext.close();
    }
  });
});
