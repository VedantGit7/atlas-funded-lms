import {
  certificateIssuedOutboxPayloadSchema,
  certificateRevokedOutboxPayloadSchema,
} from "./certificate.dto";
import type { TenantTx } from "@atlas/db";
import { withTenantTx } from "@atlas/db";
import { certificateRepository } from "./certificate.repository";
import { CERTIFICATE_ISSUED_EVENT, CERTIFICATE_REVOKED_EVENT } from "./certificate.events";
import { isCertificateFeatureEnabled } from "./certificate-feature-flags";
import {
  CertificatePdfUnavailableError,
  certificatePdfMergeData,
  renderCertificatePdfBuffer,
} from "./certificate-pdf.service";
import { storeCertificatePdfArtifact } from "./certificate-pdf-store";
import { certificateDesignDocumentSchema } from "./certificate-design-document";
import type { CertificateDesignDocument } from "./certificate-design-document";

export const CERTIFICATE_WORKER_DESTINATION = "certificates";

type PreparedRender = {
  certificateId: string;
  templateId: string;
  jobId: string;
  design: CertificateDesignDocument;
  mergeData: Record<string, string>;
};

/**
 * Claim a render job and load design snapshot (short TX).
 * Returns null when there is nothing to render.
 */
async function prepareCertificatePdfRender(
  tx: TenantTx,
  args: { tenantId: string; certificateId: string },
): Promise<PreparedRender | null> {
  const certificate = await certificateRepository.findCertificateById(tx, args.certificateId);
  if (!certificate || certificate.tenant_id !== args.tenantId) {
    return null;
  }
  if (certificate.r2_object_key) {
    return null;
  }

  const snapshot =
    certificate.design_snapshot_json ??
    (await certificateRepository.findTemplateById(tx, certificate.template_id))?.template_json;

  const parsed = certificateDesignDocumentSchema.safeParse(snapshot);
  if (!parsed.success) {
    return null;
  }

  const jobId = await certificateRepository.insertRenderJob(tx, {
    tenantId: args.tenantId,
    certificateId: certificate.id,
    templateId: certificate.template_id,
    format: "pdf",
  });

  const mergeData = certificatePdfMergeData(parsed.data, certificate);

  return {
    certificateId: certificate.id,
    templateId: certificate.template_id,
    jobId,
    design: parsed.data,
    mergeData,
  };
}

/**
 * Render PDF for an issued certificate and upload to R2.
 * No-op when CERTIFICATE_PDF_WORKER is not enabled.
 * Playwright runs outside the DB transaction.
 */
export async function processCertificateIssuedPdf(args: {
  tenantId: string;
  certificateId: string;
  requestId: string;
}): Promise<void> {
  if (!isCertificateFeatureEnabled("pdfWorker")) {
    return;
  }

  const prepared = await withTenantTx(
    {
      tenantId: args.tenantId,
      requestId: args.requestId,
      allowAnonymousTenantRead: true,
    },
    (tx) =>
      prepareCertificatePdfRender(tx, {
        tenantId: args.tenantId,
        certificateId: args.certificateId,
      }),
  );

  if (!prepared) {
    return;
  }

  let pdf: Buffer;
  try {
    pdf = await renderCertificatePdfBuffer({
      designSnapshotJson: prepared.design,
      mergeData: prepared.mergeData,
      ...(prepared.mergeData["verification_url"]
        ? { verificationUrl: prepared.mergeData["verification_url"] }
        : {}),
    });
  } catch (error) {
    const message =
      error instanceof CertificatePdfUnavailableError
        ? error.message
        : error instanceof Error
          ? error.message
          : "CERTIFICATE_PDF_RENDER_FAILED";

    await withTenantTx(
      {
        tenantId: args.tenantId,
        requestId: `${args.requestId}:pdf-fail`,
        allowAnonymousTenantRead: true,
      },
      (tx) =>
        certificateRepository.failRenderJob(tx, {
          jobId: prepared.jobId,
          errorMessage: message,
        }),
    );

    if (error instanceof CertificatePdfUnavailableError) {
      return;
    }
    throw error;
  }

  try {
    const stored = await storeCertificatePdfArtifact({
      tenantId: args.tenantId,
      certificateId: prepared.certificateId,
      content: pdf,
    });

    await withTenantTx(
      {
        tenantId: args.tenantId,
        requestId: `${args.requestId}:pdf-ok`,
        allowAnonymousTenantRead: true,
      },
      async (tx) => {
        await certificateRepository.setCertificateR2ObjectKey(tx, {
          certificateId: prepared.certificateId,
          objectKey: stored.objectKey,
        });
        await certificateRepository.completeRenderJob(tx, {
          jobId: prepared.jobId,
          objectKey: stored.objectKey,
        });
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "CERTIFICATE_PDF_UPLOAD_FAILED";
    await withTenantTx(
      {
        tenantId: args.tenantId,
        requestId: `${args.requestId}:pdf-upload-fail`,
        allowAnonymousTenantRead: true,
      },
      (tx) =>
        certificateRepository.failRenderJob(tx, {
          jobId: prepared.jobId,
          errorMessage: message,
        }),
    );
    throw error;
  }
}

export async function handleCertificateOutboxEvent(event: {
  id: string;
  eventType: string;
  tenantId: string | null;
  payload: unknown;
  requestId: string;
}): Promise<void> {
  if (event.tenantId == null) {
    return Promise.reject(new Error("Certificate worker requires tenant-scoped events."));
  }

  if (event.eventType === CERTIFICATE_ISSUED_EVENT) {
    const payload = certificateIssuedOutboxPayloadSchema.parse(event.payload);

    if (!isCertificateFeatureEnabled("pdfWorker")) {
      return;
    }

    await processCertificateIssuedPdf({
      tenantId: event.tenantId,
      certificateId: payload.certificateId,
      requestId: event.requestId,
    });
    return;
  }

  if (event.eventType === CERTIFICATE_REVOKED_EVENT) {
    certificateRevokedOutboxPayloadSchema.parse(event.payload);
    return;
  }
}

export const certificateOutboxHandlers = [
  {
    destinationKey: CERTIFICATE_WORKER_DESTINATION,
    handle: handleCertificateOutboxEvent,
  },
];

export async function expireDueCertificates(tx: TenantTx): Promise<number> {
  return certificateRepository.expireDueCertificates(tx);
}
