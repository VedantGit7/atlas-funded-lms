import { buildTenantStorageKey } from "../../backend/packages/storage/src/key-builder";
import type { StorageProvider } from "../../backend/packages/storage/src/providers/storage-provider";
import {
  certificateDesignDocumentSchema,
  createEmptyDesignDocument,
  type CertificateDesignPage,
} from "../../backend/apps/api/src/server/certificates/certificate-design-document";
import {
  certificatePdfMergeData,
  renderCertificatePdfBuffer,
  type RenderCertificatePdfInput,
} from "../../backend/apps/api/src/server/certificates/certificate-pdf.service";
import { BackfillRefused, connectWithCompleteVisibility, tenantScope } from "./backfill-connection";

/**
 * Re-renders certificate PDFs stored while the renderer printed every design
 * on portrait A4 (a 297x210 mm landscape design came out shrunk into the top
 * of the page). `scripts/data/rerender-certificate-pdfs.ts` is the command;
 * this is the work, so it can be tested against Postgres and a storage
 * provider.
 *
 * The worker never re-renders on its own: it skips a certificate whose
 * `r2_object_key` is set. This finds the stored PDFs whose page does not match
 * their design and renders them again from the same design snapshot and merge
 * data the worker uses.
 *
 * What makes it safe to point at production:
 *
 * - **It sees every certificate or refuses** (see `backfill-connection.ts`).
 * - **It judges by the stored file, not a date.** A PDF whose `/MediaBox`
 *   already matches its design (e.g. an A4 portrait design) is left alone, so
 *   a re-run only picks up what is still wrong.
 * - **It cannot write a wrong page.** Before applying it renders a sample and
 *   refuses unless the page comes out 297x210 mm, so a build without the
 *   page-size fix cannot overwrite PDFs with A4 again; and each new PDF is
 *   checked against its design before it replaces the stored one.
 * - **The old PDF goes only once the new one exists.** The object is
 *   overwritten in place, at the key the download route reads, after a
 *   successful render. A failed render leaves it untouched. No database row
 *   changes.
 * - **It writes only where the worker would.** A row whose key is not the
 *   worker's key for that tenant and certificate is reported, not written.
 *
 * It never prints PDF contents or recipient data; certificates are named by id.
 */

type Row = {
  id: string;
  tenant_id: string;
  r2_object_key: string;
  credential_id: string;
  recipient_name: string | null;
  course_title: string | null;
  design: unknown;
};

type Render = (input: RenderCertificatePdfInput) => Promise<Buffer>;

export type CertificatePdfBackfillReport = {
  database: string;
  apply: boolean;
  /** Certificates with a stored PDF. */
  scanned: number;
  /** Stored PDF already matches its design's page. */
  sizeOk: number;
  /** Stored PDF's page does not match its design (the A4 bug). */
  wrongSize: string[];
  /** Key is set but the object is gone; re-rendering restores it. */
  missing: string[];
  /** Stored object has no readable `/MediaBox`; re-rendered. */
  unreadable: string[];
  rerendered: number;
  /** Render or upload failed; the stored PDF is unchanged. */
  failed: string[];
  /** Key is not the worker's key for this certificate: needs review. */
  unexpectedKey: string[];
  /** Neither the snapshot nor the template is a design document: needs review. */
  unparseable: string[];
  /** Certificates still needing a re-render after this run. */
  remaining: number;
};

const POINTS_PER_UNIT: Record<CertificateDesignPage["unit"], number> = {
  mm: 72 / 25.4,
  in: 72,
  px: 72 / 96,
};

/** Chromium rounds page sizes up to its print grid (under 1pt seen). */
const TOLERANCE_PT = 2;

function expectedPagePoints(page: CertificateDesignPage): { width: number; height: number } {
  const factor = POINTS_PER_UNIT[page.unit];
  return { width: page.width * factor, height: page.height * factor };
}

/** First page's `/MediaBox`; Chromium writes it uncompressed. */
export function readPdfPageSize(pdf: Buffer): { width: number; height: number } | null {
  const match = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(
    pdf.toString("latin1"),
  );
  if (!match) return null;
  const [x1, y1, x2, y2] = match.slice(1).map(Number) as [number, number, number, number];
  return { width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

export function pdfMatchesPage(pdf: Buffer, page: CertificateDesignPage): boolean | null {
  const actual = readPdfPageSize(pdf);
  if (!actual) return null;
  const expected = expectedPagePoints(page);
  return (
    Math.abs(actual.width - expected.width) <= TOLERANCE_PT &&
    Math.abs(actual.height - expected.height) <= TOLERANCE_PT
  );
}

/** Refuse unless this build renders the default 297x210 mm design at that size. */
async function assertRendererFixed(render: Render): Promise<void> {
  const sample = createEmptyDesignDocument();
  let pdf: Buffer;
  try {
    pdf = await render({ designSnapshotJson: sample });
  } catch (error) {
    throw new BackfillRefused(
      `Cannot render a sample certificate PDF here (${error instanceof Error ? error.message : "unknown error"}). ` +
        "Run this in the managed-node worker image, which has Chromium.",
    );
  }
  if (pdfMatchesPage(pdf, sample.page) !== true) {
    throw new BackfillRefused(
      "This build still renders certificates at the wrong page size; deploy the page-size fix first.",
    );
  }
}

export async function backfillCertificatePdfs(options: {
  databaseUrl: string | undefined;
  apply: boolean;
  provider: StorageProvider;
  bucket: string;
  tenantIds?: readonly string[];
  /** Injected by tests; defaults to the worker's renderer. */
  render?: Render;
}): Promise<CertificatePdfBackfillReport> {
  const scope = tenantScope(options.tenantIds);
  const render = options.render ?? renderCertificatePdfBuffer;
  const { client, database } = await connectWithCompleteVisibility(
    options.databaseUrl,
    "certificates",
  );
  const report: CertificatePdfBackfillReport = {
    database,
    apply: options.apply,
    scanned: 0,
    sizeOk: 0,
    wrongSize: [],
    missing: [],
    unreadable: [],
    rerendered: 0,
    failed: [],
    unexpectedKey: [],
    unparseable: [],
    remaining: 0,
  };

  try {
    if (options.apply) await assertRendererFixed(render);

    // Same design the worker renders: the issue-time snapshot, else the template.
    const { rows } = await client.query<Row>(
      `select id::text, tenant_id::text, r2_object_key, credential_id, recipient_name, course_title,
              coalesce(
                design_snapshot_json,
                (select t.template_json
                   from certificate_templates t
                  where t.tenant_id = certificates.tenant_id and t.id = certificates.template_id)
              ) as design
         from certificates
        where r2_object_key is not null
          ${scope.sql(1)}
        order by tenant_id, id`,
      scope.params,
    );
    report.scanned = rows.length;

    for (const row of rows) {
      const workerKey = buildTenantStorageKey({
        tenantId: row.tenant_id,
        purpose: "certificate.render",
        resourceId: row.id,
        fileName: "certificate.pdf",
      });
      if (row.r2_object_key !== workerKey) {
        report.unexpectedKey.push(row.id);
        continue;
      }
      const parsed = certificateDesignDocumentSchema.safeParse(row.design);
      if (!parsed.success) {
        report.unparseable.push(row.id);
        continue;
      }
      const design = parsed.data;
      const location = { bucket: options.bucket, key: row.r2_object_key };

      const stored = await options.provider.getObjectBody(location);
      if (stored) {
        const matches = pdfMatchesPage(stored, design.page);
        if (matches === true) {
          report.sizeOk += 1;
          continue;
        }
        (matches === null ? report.unreadable : report.wrongSize).push(row.id);
      } else {
        report.missing.push(row.id);
      }
      if (!options.apply) continue;

      try {
        const mergeData = certificatePdfMergeData(design, row);
        const pdf = await render({
          designSnapshotJson: design,
          mergeData,
          ...(mergeData["verification_url"]
            ? { verificationUrl: mergeData["verification_url"] }
            : {}),
        });
        if (pdfMatchesPage(pdf, design.page) !== true) {
          throw new Error("Rendered PDF does not match its design's page.");
        }
        await options.provider.putObject({
          ...location,
          body: pdf,
          contentType: "application/pdf",
        });
        report.rerendered += 1;
      } catch {
        report.failed.push(row.id);
      }
    }

    const toRender = report.wrongSize.length + report.missing.length + report.unreadable.length;
    report.remaining = toRender - report.rerendered;
    return report;
  } finally {
    await client.end();
  }
}
