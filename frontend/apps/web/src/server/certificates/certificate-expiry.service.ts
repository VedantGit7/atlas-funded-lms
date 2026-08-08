/**
 * Scheduled expiry of due certificates.
 *
 * Iterates every active tenant, marks issued certificates whose `expires_at` has
 * passed as `expired`, and flips their bitstring status-list bit so the public
 * status-list credential reflects revocation-of-validity. Intended to be driven
 * by a cron (see `/api/v1/internal/certificates/expire`). Tenant isolation is
 * enforced by RLS on each per-tenant transaction; there is no user actor.
 */

import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { certificateRepository } from "./certificate.repository";
import { setCertificateStatusBit } from "./certificate-status-list.service";

export async function expireDueCertificatesForActiveTenants(
  requestId: string,
): Promise<{ tenants: number; expired: number }> {
  const tenants = await withGlobalDb((db) =>
    db.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenants WHERE state = 'ACTIVE' AND deleted_at IS NULL
    `,
  );

  let expired = 0;

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
  }

  return { tenants: tenants.length, expired };
}
