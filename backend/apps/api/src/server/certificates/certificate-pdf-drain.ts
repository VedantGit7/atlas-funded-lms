import { after } from "next/server";
import { isDeployedRuntime } from "@atlas/core/config/runtime-environment";
import { isCertificateFeatureEnabled } from "./certificate-feature-flags";
import { processCertificateOutboxBatch } from "./certificate-worker-router";

/**
 * After the issue TX commits and the response is sent, drain certificate.issued
 * outbox events so PDF render/upload runs off the request path.
 * No-op unless CERTIFICATE_PDF_WORKER=true.
 */
export function scheduleCertificatePdfDrain(args: { tenantId: string; requestId: string }): void {
  // Deployed PDF work belongs to the durable worker, never a response callback.
  if (isDeployedRuntime()) return;
  if (!isCertificateFeatureEnabled("pdfWorker")) {
    return;
  }

  after(() => {
    return processCertificateOutboxBatch({
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
