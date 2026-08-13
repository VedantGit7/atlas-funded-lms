/**
 * Scheduled expiry of due certificates.
 *
 * Iterates every active tenant, marks issued certificates whose `expires_at` has
 * passed as `expired`, and flips their bitstring status-list bit so the public
 * status-list credential reflects revocation-of-validity. Also best-effort drains
 * certificate.issued outbox events (PDF render) for each tenant.
 */

import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { certificateRepository } from "./certificate.repository";
import { setCertificateStatusBit } from "./certificate-status-list.service";
import { processCertificateOutboxBatch } from "./certificate-worker-router";

export async function expireDueCertificatesForActiveTenants(
  requestId: string,
): Promise<{ tenants: number; expired: number; drained: number }> {
  const tenants = await withGlobalDb(
    (db) =>
      db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE state = 'ACTIVE' AND deleted_at IS NULL
    `,
  );

  let expired = 0;
  let drained = 0;

  for (const tenant of tenants) {
    const tenantExpired = await withTenantTx(
      { tenantId: tenant.id, requestId, allowAnonymousTenantRead: true },
      async (tx) => {
        const due = await certificateRepository.listDueCertificates(tx);
        if (due.length === 0) return 0;

        await certificateRepository.expireDueCertificates(tx);

        for (const cert of due) {
          if (cert.status_list_index == null) continue;
          try {
            await setCertificateStatusBit({
              tx,
              tenantId: tenant.id,
              statusListIndex: cert.status_list_index,
              revoked: true,
            });
          } catch {
            // Status-list bit flip is best-effort; the certificate is still expired.
          }
        }

        return due.length;
      },
    );
    expired += tenantExpired;

    try {
      const drainResult = await processCertificateOutboxBatch({
        tenantId: tenant.id,
        requestId: `${requestId}:pdf:${tenant.id}`,
        limit: 25,
      });
      drained += drainResult.processed;
    } catch {
      // PDF drain is best-effort alongside expiry.
    }
  }

  return { tenants: tenants.length, expired, drained };
}
