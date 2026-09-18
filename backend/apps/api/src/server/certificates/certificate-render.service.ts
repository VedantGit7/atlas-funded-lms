/**
 * Server-side certificate HTML preview render.
 * Used by POST /api/v1/certificates/render-preview.
 */

import type { TenantTx } from "@atlas/db";
import { certificateDesignDocumentSchema } from "./certificate-design-document";
import type { ServiceCtx } from "./certificate.types";
import { designDocumentToHtmlAsync, sampleDataFromVariables } from "./certificate-design-to-html";

export type CertificateRenderPreviewInput = {
  templateJson: unknown;
  data?: Record<string, string> | undefined;
  watermark?: boolean | undefined;
  showBleedSafe?: boolean | undefined;
};

export type CertificateRenderPreviewResult = {
  html: string;
};

export async function renderCertificatePreview(
  _tx: TenantTx,
  _ctx: ServiceCtx,
  input: CertificateRenderPreviewInput,
): Promise<CertificateRenderPreviewResult> {
  const doc = certificateDesignDocumentSchema.parse(input.templateJson);
  const data = input.data ?? sampleDataFromVariables(doc);
  const html = await designDocumentToHtmlAsync(doc, data, {
    watermark: input.watermark ?? true,
    ...(data["verification_url"] ? { verificationUrl: data["verification_url"] } : {}),
    showBleedSafe: input.showBleedSafe ?? false,
  });
  return { html };
}
