import type { AuditDbTx } from "../transaction";
import { AuditListQuerySchema, type AuditListResponse } from "../schemas/audit";
import { listPlatformAuditEntries, listTenantAuditEntries } from "../repositories/audit.repository";

function toResponse(
  rows: Awaited<ReturnType<typeof listTenantAuditEntries>>,
  limit: number,
): AuditListResponse {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    data: pageRows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at.toISOString(),
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      actorMembershipId: row.actor_membership_id,
      platformPrincipalId: row.actor_principal_id,
      requestId: row.request_id,
      reason: row.reason,
      metadata: row.metadata_json as Record<string, unknown> | null,
    })),
    page: {
      hasMore,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ occurredAt: last.occurred_at.toISOString(), id: last.id }),
            ).toString("base64url")
          : null,
    },
  };
}

export async function readTenantAuditLog(
  tx: AuditDbTx,
  rawQuery: unknown,
): Promise<AuditListResponse> {
  const query = AuditListQuerySchema.parse(rawQuery);
  const rows = await listTenantAuditEntries(tx, query);
  return toResponse(rows, query.limit);
}

export async function readPlatformAuditLog(
  tx: AuditDbTx,
  rawQuery: unknown,
): Promise<AuditListResponse> {
  const query = AuditListQuerySchema.parse(rawQuery);
  const rows = await listPlatformAuditEntries(tx, query);
  return toResponse(rows, query.limit);
}
