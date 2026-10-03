import { randomUUID } from "node:crypto";
import type { APIResponse } from "@playwright/test";
import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential, secondTenantBaseUrl } from "../helpers/env";
import { foreignPersistenceSnapshot } from "../helpers/persistence";
import { scenario } from "../helpers/scenario";
import { browserRequest } from "../helpers/browser-request";

async function expectForeignDenial(
  response: Pick<APIResponse, "status" | "headers" | "text">,
  sentinel: string,
) {
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["content-disposition"]).toBeUndefined();
  const text = await response.text();
  expect(text).not.toContain(sentinel);
  expect(JSON.parse(text)).toMatchObject({ error: { code: "PERMISSION_DENIED" } });
}

test.describe("J11 cross-tenant resource isolation", () => {
  test("denies foreign read, update, delete and download without changing foreign records", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const fixture = scenario();
    await loginWithCredentials(
      page,
      requiredCredential("E2E_ADMIN_EMAIL"),
      requiredCredential("E2E_ADMIN_PASSWORD"),
    );
    const foreignContext = await browser.newContext({ baseURL: secondTenantBaseUrl() });
    try {
      const foreign = await foreignContext.newPage();
      await loginWithCredentials(
        foreign,
        requiredCredential("E2E_FOREIGN_ADMIN_EMAIL"),
        requiredCredential("E2E_FOREIGN_ADMIN_PASSWORD"),
      );
      const foreignPath = `/api/v1/courses/${fixture.foreignCourseId}`;
      const foreignRead = await foreign.request.get(`${foreignPath}?view=studio`);
      expect(foreignRead.status()).toBe(200);
      expect(await foreignRead.text()).toContain(fixture.foreignSentinel);
      const foreignDownload = await foreign.request.get(
        `/api/v1/certificates/${fixture.foreignCertificateId}/download`,
      );
      expect(foreignDownload.status()).toBe(200);
      expect(foreignDownload.headers()["content-disposition"]).toContain("attachment");
      expect((await foreignDownload.body()).byteLength).toBeGreaterThan(0);
      const before = await foreignPersistenceSnapshot(
        fixture.foreignTenantId,
        fixture.foreignCourseId,
        fixture.foreignCertificateId,
      );

      // Each negative has a successful same-tenant control using the same actor.
      const ownTitle = `Isolation control ${randomUUID()}`;
      const created = await page.request.post("/api/v1/courses", {
        data: { title: ownTitle },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(created.status()).toBe(200);
      const { data: own } = (await created.json()) as { data: { id: string } };
      const ownPath = `/api/v1/courses/${own.id}`;
      const ownRead = await page.request.get(`${ownPath}?view=studio`);
      expect(ownRead.status()).toBe(200);
      expect(await ownRead.json()).toMatchObject({
        data: { id: own.id, title: ownTitle, status: "DRAFT" },
      });
      await expectForeignDenial(
        await browserRequest(page, `${foreignPath}?view=studio`),
        fixture.foreignSentinel,
      );
      const updatedTitle = `${ownTitle} updated`;
      const ownUpdate = await page.request.put(ownPath, {
        data: { title: updatedTitle },
        headers: { "idempotency-key": randomUUID() },
      });
      expect(ownUpdate.status()).toBe(200);
      expect(await ownUpdate.json()).toMatchObject({ data: { title: updatedTitle } });
      await expectForeignDenial(
        await browserRequest(page, foreignPath, {
          method: "PUT",
          data: { title: "Forbidden cross-tenant overwrite" },
          headers: { "idempotency-key": randomUUID() },
        }),
        fixture.foreignSentinel,
      );
      const ownDelete = await page.request.delete(ownPath, {
        headers: { "idempotency-key": randomUUID() },
      });
      expect(ownDelete.status()).toBe(200);
      expect(await ownDelete.json()).toMatchObject({ data: { id: own.id, status: "ARCHIVED" } });
      await expectForeignDenial(
        await browserRequest(page, foreignPath, {
          method: "DELETE",
          headers: { "idempotency-key": randomUUID() },
        }),
        fixture.foreignSentinel,
      );
      const ownDownload = await page.request.get(
        `/api/v1/certificates/${fixture.ownCertificateId}/download`,
      );
      expect(ownDownload.status()).toBe(200);
      expect(ownDownload.headers()["content-disposition"]).toContain("attachment");
      expect((await ownDownload.body()).byteLength).toBeGreaterThan(0);
      await expectForeignDenial(
        await browserRequest(page, `/api/v1/certificates/${fixture.foreignCertificateId}/download`),
        fixture.foreignSentinel,
      );
      expect(
        await foreignPersistenceSnapshot(
          fixture.foreignTenantId,
          fixture.foreignCourseId,
          fixture.foreignCertificateId,
        ),
      ).toEqual(before);
      const unchanged = await foreign.request.get(`${foreignPath}?view=studio`);
      expect(unchanged.status()).toBe(200);
      expect(await unchanged.text()).toContain(fixture.foreignSentinel);
      await page.goto(`/studio/courses/${fixture.foreignCourseId}`);
      await expect(
        page.getByText(/Course not found|not found or access denied/i).first(),
      ).toBeVisible();
      await expect(page.getByRole("main")).not.toContainText(fixture.foreignSentinel);
    } finally {
      await foreignContext.close();
    }
  });
});
