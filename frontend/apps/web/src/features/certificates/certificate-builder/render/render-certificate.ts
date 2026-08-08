/**
 * Certificate preview render helpers (MVP: HTML + QR).
 * PDF via Playwright is deferred to a dedicated worker.
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
    ...(options?.verificationUrl ?? mergeData["verification_url"]
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
  // TODO(worker): HTML → PNG via Playwright Chromium or browser html-to-canvas.
  return renderCertificatePreviewHtml(doc, data, options);
}

/**
 * Playwright PDF stub. Playwright is a root e2e dependency, not of @atlas/web.
 * When wired, prefer PDF/A-2b (embedded fonts, tagged reading order) for archival
 * exports; set `CERTIFICATE_PDF_WORKER=true` once the worker is live.
 */
export async function renderCertificatePdf(
  _doc: CertificateDesignDocument,
  _data?: Record<string, string>,
  _options?: DesignToHtmlOptions & { pdfa?: boolean },
): Promise<Buffer> {
  throw new Error(
    "Certificate PDF rendering is not configured. TODO: wire Playwright Chromium in a render worker (setContent → pdf, optional PDF/A).",
  );
}
