import { beforeAll, describe, expect, it } from "vitest";
import { withTenantTx } from "@atlas/db";
import { LocalMockStorageProvider } from "@atlas/storage/providers/local-mock-storage-provider";
import {
  createCertificateTemplate,
  issueCertificate,
  publishCertificateTemplate,
} from "../../../backend/apps/api/src/server/certificates/certificate.service";
import { createEmptyDesignDocument } from "../../../backend/apps/api/src/server/certificates/certificate-design-document";
import type { CertificateDesignDocument } from "../../../backend/apps/api/src/server/certificates/certificate-design-document";
import type { RenderCertificatePdfInput } from "../../../backend/apps/api/src/server/certificates/certificate-pdf.service";
import { publishAssessmentForTests } from "../../../backend/apps/api/src/server/assessments/assessments.service";
import { BackfillRefused } from "../../../scripts/data/backfill-connection";
import { backfillCertificatePdfs } from "../../../scripts/data/certificate-pdf-backfill";
import {
  adminCtx,
  authoringTenantTx,
  createCertificateFixture,
  type CertificateFixture,
} from "../../fixtures/certificate-fixture";

/**
 * Certificate PDF re-render backfill against Postgres: stored PDFs at the wrong
 * page size are replaced in place, right-sized ones are left alone, and a
 * build that still renders A4 is refused before it writes anything.
 */
const suite =
  process.env["DATABASE_URL"] && process.env["PLATFORM_DATABASE_URL"] ? describe : describe.skip;

const BUCKET = "atlas-assets";
const MM = 72 / 25.4;

/** Just enough PDF for the backfill: Chromium writes /MediaBox uncompressed. */
const fakePdf = (widthPt: number, heightPt: number, tag = "") =>
  Buffer.from(
    `%PDF-1.4\n1 0 obj << /Type /Page /MediaBox [0 0 ${String(widthPt)} ${String(heightPt)}] >> endobj\n%${tag}\n%%EOF`,
  );
const A4_PORTRAIT = fakePdf(595.92, 842.88, "old");

/** Renders at the design's size, like the fixed renderer (with Chromium's rounding). */
const fixedRender = async (input: RenderCertificatePdfInput) => {
  const { page } = input.designSnapshotJson as CertificateDesignDocument;
  return fakePdf(page.width * MM + 0.03, page.height * MM + 0.64, "new");
};

suite("certificate PDF re-render backfill", () => {
  let fixture: CertificateFixture;
  let templateId: string;
  const design = createEmptyDesignDocument();
  const ownerUrl = () => process.env["DIRECT_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  const asAdmin = <T>(fn: Parameters<typeof withTenantTx<T>>[1]) =>
    withTenantTx(authoringTenantTx(fixture), fn);
  const workerKey = (id: string) =>
    `tenants/${fixture.tenantId}/certificates/${id}/certificate.pdf`;

  /** An issued certificate as the worker left it before the fix. */
  async function storedCertificate(
    provider: LocalMockStorageProvider,
    options: {
      pdf?: Buffer | null;
      key?: string;
      snapshot?: CertificateDesignDocument | null;
    } = {},
  ) {
    const issued = await asAdmin((tx) =>
      issueCertificate(
        tx,
        adminCtx(fixture, `req_${crypto.randomUUID()}`),
        {
          templateId,
          recipientMembershipId: fixture.learnerMembershipId,
          source: { type: "assessment", id: fixture.assessmentId },
        },
        crypto.randomUUID(),
      ),
    );
    const id = issued.data.id;
    const key = options.key ?? workerKey(id);
    const snapshot = options.snapshot === undefined ? design : options.snapshot;
    await asAdmin(
      (tx) => tx.$executeRaw`
        update certificates
           set r2_object_key = ${key},
               design_snapshot_json = ${snapshot === null ? null : JSON.stringify(snapshot)}::jsonb
         where id = ${id}::uuid
      `,
    );
    const pdf = options.pdf === undefined ? A4_PORTRAIT : options.pdf;
    if (pdf) {
      await provider.putObject({ bucket: BUCKET, key, body: pdf, contentType: "application/pdf" });
    }
    return { id, location: { bucket: BUCKET, key } };
  }

  const run = (
    provider: LocalMockStorageProvider,
    apply: boolean,
    render: (input: RenderCertificatePdfInput) => Promise<Buffer> = fixedRender,
  ) =>
    backfillCertificatePdfs({
      databaseUrl: ownerUrl(),
      apply,
      provider,
      bucket: BUCKET,
      tenantIds: [fixture.tenantId],
      render,
    });

  beforeAll(async () => {
    fixture = await createCertificateFixture();
    const admin = adminCtx(fixture, "req_cert_pdf_backfill");
    await asAdmin((tx) => publishAssessmentForTests(tx, fixture.assessmentId));
    // Not a design document: certificates without a snapshot cannot be rendered.
    const created = await asAdmin((tx) =>
      createCertificateTemplate(tx, admin, {
        key: "pdf-backfill-template",
        name: "PDF backfill template",
        templateJson: { headline: "Certificate", bodyLines: [] },
      }),
    );
    await asAdmin((tx) => publishCertificateTemplate(tx, admin, created.data.id, {}));
    templateId = created.data.id;
  }, 120_000);

  it("re-renders wrong-size and missing PDFs in place, leaves the rest, then is a no-op", async () => {
    const provider = new LocalMockStorageProvider();
    const wrong = await storedCertificate(provider);
    const right = await storedCertificate(provider, {
      pdf: fakePdf(297 * MM, 210 * MM, "kept"),
    });
    const missing = await storedCertificate(provider, { pdf: null });
    const odd = await storedCertificate(provider, {
      key: `tenants/${crypto.randomUUID()}/certificates/x/certificate.pdf`,
    });
    const noDesign = await storedCertificate(provider, { snapshot: null });

    const dryRun = await run(provider, false);
    expect(dryRun).toMatchObject({
      scanned: 5,
      sizeOk: 1,
      wrongSize: [wrong.id],
      missing: [missing.id],
      unreadable: [],
      unexpectedKey: [odd.id],
      unparseable: [noDesign.id],
      rerendered: 0,
      remaining: 2,
    });
    expect((await provider.getObjectBody(wrong.location))?.equals(A4_PORTRAIT)).toBe(true);

    const rendered: RenderCertificatePdfInput[] = [];
    const applied = await run(provider, true, (input) => {
      rendered.push(input);
      return fixedRender(input);
    });
    expect(applied).toMatchObject({ rerendered: 2, failed: [], remaining: 0 });
    for (const { location } of [wrong, missing]) {
      expect((await provider.getObjectBody(location))?.toString("latin1")).toContain("%new");
    }
    // Untouched: the right-sized PDF, the odd key and the undesignable certificate's object.
    expect((await provider.getObjectBody(right.location))?.toString("latin1")).toContain("%kept");
    expect((await provider.getObjectBody(odd.location))?.equals(A4_PORTRAIT)).toBe(true);
    expect((await provider.getObjectBody(noDesign.location))?.equals(A4_PORTRAIT)).toBe(true);
    // Rendered with the worker's merge data (after the sample render).
    const forWrong = rendered.slice(1).find((input) => input.mergeData?.["credential_id"]);
    expect(forWrong?.verificationUrl).toMatch(/^\/verify\//);

    const again = await run(provider, true);
    expect(again).toMatchObject({
      sizeOk: 3,
      wrongSize: [],
      missing: [],
      rerendered: 0,
      remaining: 0,
    });
  });

  it("refuses to apply with a renderer that still prints A4, writing nothing", async () => {
    const provider = new LocalMockStorageProvider();
    const wrong = await storedCertificate(provider);

    await expect(run(provider, true, async () => A4_PORTRAIT)).rejects.toBeInstanceOf(
      BackfillRefused,
    );
    expect((await provider.getObjectBody(wrong.location))?.equals(A4_PORTRAIT)).toBe(true);
  });

  it("leaves the stored PDF unchanged when a render fails", async () => {
    const provider = new LocalMockStorageProvider();
    const wrong = await storedCertificate(provider);

    const report = await run(provider, true, async (input) => {
      if (input.mergeData) throw new Error("render failed");
      return fixedRender(input);
    });
    expect(report.failed).toContain(wrong.id);
    expect((await provider.getObjectBody(wrong.location))?.equals(A4_PORTRAIT)).toBe(true);
  });
});
