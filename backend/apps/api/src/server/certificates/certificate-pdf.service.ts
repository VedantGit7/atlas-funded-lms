/**
 * Certificate HTML → PDF via Playwright Chromium.
 *
 * Used only by the async certificate.issued outbox worker — never on the
 * synchronous issue request path. Playwright may be unavailable in some
 * deploy environments; callers should treat PLAYWRIGHT_UNAVAILABLE as a
 * soft failure and leave the HTML download fallback in place.
 */

import type { Page } from "playwright-core";
import {
  designDocumentToHtmlAsync,
  pageCssSize,
  sampleDataFromVariables,
} from "./certificate-design-to-html";
import {
  certificateDesignDocumentSchema,
  type CertificateDesignPage,
} from "./certificate-design-document";

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
 * Render a certificate design snapshot to a single-page PDF sized to the
 * design's page (e.g. 297×210 mm landscape).
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

  return htmlToPdfBuffer(html, doc.page);
}

/**
 * page.pdf options matching the HTML page box. Elements are absolutely
 * positioned against `.cert-page`, so margins must be zero or content shifts
 * and clips. The HTML's `@page` rule comes from the same `pageCssSize`, so
 * the two sizes cannot disagree. `landscape` is omitted because Chromium would
 * swap the explicit dimensions. `pageRanges` drops a spill-over blank page
 * caused by Chromium rounding the page size; `.cert-page` clips its overflow,
 * so page 1 always holds the whole certificate.
 */
function certificatePdfOptions(page: CertificateDesignPage): Parameters<Page["pdf"]>[0] {
  const { width, height } = pageCssSize(page);
  return {
    width,
    height,
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    pageRanges: "1",
  };
}

async function htmlToPdfBuffer(html: string, designPage: CertificateDesignPage): Promise<Buffer> {
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdf = await page.pdf(certificatePdfOptions(designPage));
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
