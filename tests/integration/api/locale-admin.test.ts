import { describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import {
  deleteLocaleResource,
  exportLocaleResources,
  getLocaleCoverage,
  getLocaleOverview,
  importLocaleResources,
  listLocaleCanonicalKeys,
  listLocaleMetadata,
  listLocaleReviewQueue,
  previewLocaleImport,
  runLocaleQaChecksForTenant,
  updateLocaleReview,
  upsertLocaleMetadata,
  upsertLocaleResources,
} from "../../../backend/apps/api/src/server/locales/locale.service";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
} from "../../fixtures/certificate-fixture";

const describeWithDb =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

describeWithDb("locale admin integration", () => {
  it("registers canonical keys, metadata, review, QA, import/export, and delete", async () => {
    const fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_locale_admin");

    await withTenantTx(authoringTenantTx(fixture), async (tx) => {
      await upsertLocaleMetadata(tx, admin, "en", {
        nativeName: "English",
        isDefault: true,
        isFallback: true,
        isRtl: false,
      });
      await upsertLocaleMetadata(tx, admin, "fr", {
        nativeName: "Français",
        isDefault: false,
        isFallback: false,
        isRtl: false,
      });

      await upsertLocaleResources(tx, admin, "en", {
        resources: [
          { key: "welcome.title", value: "Hello {name}" },
          { key: "welcome.footer", value: "Footer" },
        ],
      });
      await upsertLocaleResources(tx, admin, "fr", {
        resources: [{ key: "welcome.title", value: "Bonjour" }],
      });

      const canonical = await listLocaleCanonicalKeys(tx, admin);
      expect(canonical.data.some((entry) => entry.key === "welcome.title")).toBe(true);

      const coverage = await getLocaleCoverage(tx, admin);
      const frCoverage = coverage.data.find((entry) => entry.locale === "fr");
      expect(frCoverage?.missingKeys).toContain("welcome.footer");

      const overview = await getLocaleOverview(tx, admin);
      expect(overview.data.canonicalKeyCount).toBeGreaterThan(0);
      expect(overview.data.defaultLocale).toBe("en");

      const metadata = await listLocaleMetadata(tx, admin);
      expect(metadata.data.some((entry) => entry.locale === "fr" && entry.nativeName === "Français")).toBe(
        true,
      );

      const queue = await listLocaleReviewQueue(tx, admin);
      expect(queue.data.some((entry) => entry.locale === "fr" && entry.key === "welcome.title")).toBe(true);

      const reviewed = await updateLocaleReview(tx, admin, "fr", "welcome.title", { status: "approved" });
      expect(reviewed.data.reviewStatus).toBe("approved");

      const qa = await runLocaleQaChecksForTenant(tx, admin);
      expect(qa.data.issues.some((issue) => issue.issueType === "missing_key")).toBe(true);

      const preview = await previewLocaleImport(tx, admin, {
        locale: "fr",
        resources: [{ key: "welcome.footer", value: "Pied de page" }],
      });
      expect(preview.data.summary.add).toBe(1);

      const imported = await importLocaleResources(tx, admin, {
        locale: "fr",
        resources: [{ key: "welcome.footer", value: "Pied de page" }],
      });
      expect(imported.data.applied).toBe(1);

      const exported = await exportLocaleResources(tx, admin, "fr");
      expect(exported.data.resources.some((entry) => entry.key === "welcome.footer")).toBe(true);

      const deleted = await deleteLocaleResource(tx, admin, "fr", "welcome.footer");
      expect(deleted.data.deleted).toBe(true);
    });
  });
});
