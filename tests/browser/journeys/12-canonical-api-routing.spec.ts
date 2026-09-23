import { test, expect } from "../fixtures/axe";
import { loginWithCredentials } from "../helpers/auth";
import { requiredCredential } from "../helpers/env";
import { scenario } from "../helpers/scenario";

test.describe("F18 preserved canonical endpoints", () => {
  test("serves brand kits through the web proxy only to authorized members", async ({ page }) => {
    const anonymous = await page.request.get("/api/v1/certificate-brand-kits");
    expect(anonymous.status()).toBe(401);
    await loginWithCredentials(
      page,
      requiredCredential("E2E_ADMIN_EMAIL"),
      requiredCredential("E2E_ADMIN_PASSWORD"),
    );
    const kits = await page.request.get("/api/v1/certificate-brand-kits");
    expect(kits.status()).toBe(200);
    expect(await kits.json()).toMatchObject({ data: expect.any(Array) });
  });

  test("serves public credential bytes without a session and denies a foreign credential", async ({
    page,
  }) => {
    const fixture = scenario();
    // The disposable scenario seeder assigns this public ID to its certificate.
    const own = await page.request.get(
      `/api/v1/public/credentials/F16-${fixture.ownCertificateId}/download`,
    );
    expect(own.status()).toBe(200);
    expect(own.headers()["cache-control"]).toBe("private, no-store");
    expect(own.headers()["content-disposition"]).toContain("attachment");
    expect((await own.body()).byteLength).toBeGreaterThan(0);
    const foreign = await page.request.get(
      `/api/v1/public/credentials/F16-${fixture.foreignCertificateId}/download`,
    );
    expect(foreign.status()).toBe(404);
    expect(foreign.headers()["cache-control"]).toBe("private, no-store");
    expect(foreign.headers()["content-disposition"]).toBeUndefined();
    expect(await foreign.text()).not.toContain(fixture.foreignSentinel);
  });
});
