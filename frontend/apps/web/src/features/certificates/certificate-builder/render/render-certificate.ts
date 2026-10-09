/**
 * Certificate preview render helpers (MVP: HTML + QR).
 *
 * PDF generation is worker-only: set CERTIFICATE_PDF_WORKER=true and drain
 * certificate.issued via processCertificateOutboxBatch / scheduleCertificatePdfDrain.
 * Studio preview stays HTML (and optional PNG stub) — do not call Playwright here.
 */

import type { CertificateDesignDocument } from "@atlas/contracts/certificates/certificate-design-document";
import {
  designDocumentToHtmlAsync,
  sampleDataFromVariables,
  type DesignToHtmlOptions,
} from "./design-to-html";

export type CertificatePreviewResult = {
  html: string;
  /** Reserved for browser html-to-canvas / worker PNG. */
  pngBase64?: string;
};

export async function renderCertificatePreviewHtml(
  doc: CertificateDesignDocument,
  data?: Record<string, string>,
  options?: DesignToHtmlOptions,
): Promise<CertificatePreviewResult> {
  const mergeData = data ?? sampleDataFromVariables(doc);
  const html = await designDocumentToHtmlAsync(doc, mergeData, {
    watermark: options?.watermark ?? true,
    ...((options?.verificationUrl ?? mergeData["verification_url"])
      ? { verificationUrl: options?.verificationUrl ?? mergeData["verification_url"] }
      : {}),
    ...(options?.showBleedSafe != null ? { showBleedSafe: options.showBleedSafe } : {}),
  });
  return { html };
}

/**
 * MVP preview path — returns HTML with QR data URLs.
 * PNG generation is a TODO for html-to-canvas (browser) or a Playwright worker.
 */
export async function renderCertificatePreviewPng(
  doc: CertificateDesignDocument,
  data?: Record<string, string>,
  options?: DesignToHtmlOptions,
): Promise<CertificatePreviewResult> {
  return renderCertificatePreviewHtml(doc, data, options);
}

/**
 * PDF is produced asynchronously by the certificate.issued outbox worker
 * (Playwright → R2). Preview callers should use HTML; this helper returns the
 * same preview HTML buffer so studio/UI paths never throw.
 */
export async function renderCertificatePdf(
  doc: CertificateDesignDocument,
  data?: Record<string, string>,
  options?: DesignToHtmlOptions & { pdfa?: boolean },
): Promise<Buffer> {
  const preview = await renderCertificatePreviewHtml(doc, data, options);
  return Buffer.from(preview.html, "utf8");
}
