/**
 * Certificate HTML → PDF via Playwright Chromium.
 *
 * Used only by the async certificate.issued outbox worker — never on the
 * synchronous issue request path. Playwright may be unavailable in some
 * deploy environments; callers should treat PLAYWRIGHT_UNAVAILABLE as a
 * soft failure and leave the HTML download fallback in place.
 */

import { designDocumentToHtmlAsync, sampleDataFromVariables } from "./certificate-design-to-html";
import { certificateDesignDocumentSchema } from "./certificate-design-document";

export class CertificatePdfUnavailableError extends Error {
  constructor(message = "PLAYWRIGHT_UNAVAILABLE") {
    super(message);
    this.name = "CertificatePdfUnavailableError";
  }
}

export type RenderCertificatePdfInput = {
  designSnapshotJson: unknown;
  mergeData?: Record<string, string>;
  verificationUrl?: string;
};

/**
 * Render a certificate design snapshot to an A4 PDF buffer.
 * Throws CertificatePdfUnavailableError when Playwright cannot be loaded or launched.
 */
export async function renderCertificatePdfBuffer(
  input: RenderCertificatePdfInput,
): Promise<Buffer> {
  const doc = certificateDesignDocumentSchema.parse(input.designSnapshotJson);
  const data = {
    ...sampleDataFromVariables(doc),
    ...(input.mergeData ?? {}),
  };

  const html = await designDocumentToHtmlAsync(doc, data, {
    watermark: false,
    ...(input.verificationUrl ? { verificationUrl: input.verificationUrl } : {}),
  });

  return htmlToPdfBuffer(html);
}

async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof CertificatePdfUnavailableError) throw error;
    throw new CertificatePdfUnavailableError(
      error instanceof Error
        ? `PLAYWRIGHT_UNAVAILABLE: ${error.message}`
        : "PLAYWRIGHT_UNAVAILABLE",
    );
  }
}
