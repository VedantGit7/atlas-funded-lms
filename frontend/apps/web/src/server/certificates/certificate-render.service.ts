// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

/**
 * Server-side certificate HTML preview render.
 * Used by POST /api/v1/certificates/render-preview.
 */

import type { TenantTx } from "@atlas/db";
import { certificateDesignDocumentSchema } from "./certificate-design-document";
import type { ServiceCtx } from "./certificate.types";
import {
  designDocumentToHtmlAsync,
  sampleDataFromVariables,
} from "../../features/certificates/certificate-builder/render/design-to-html";

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
