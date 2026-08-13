import { after } from "next/server";
import { isCertificateFeatureEnabled } from "./certificate-feature-flags";
import { processCertificateOutboxBatch } from "./certificate-worker-router";

/**
 * After the issue TX commits and the response is sent, drain certificate.issued
 * outbox events so PDF render/upload runs off the request path.
 * No-op unless CERTIFICATE_PDF_WORKER=true.
 */
export function scheduleCertificatePdfDrain(args: { tenantId: string; requestId: string }): void {
  if (!isCertificateFeatureEnabled("pdfWorker")) {
    return;
  }

  after(() => {
    void processCertificateOutboxBatch({
      tenantId: args.tenantId,
      requestId: `${args.requestId}:certificate-pdf`,
      limit: 10,
    }).catch((error: unknown) => {
      console.error("[certificates] PDF outbox drain failed", {
        tenantId: args.tenantId,
        requestId: args.requestId,
        message: error instanceof Error ? error.message : "unknown",
      });
    });
  });
}
