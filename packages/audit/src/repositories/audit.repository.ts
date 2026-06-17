import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { AuditListQuery, AuditWriteInput } from "../schemas/audit";
import type { AuditDbTx } from "../transaction";

export type AuditActorContext = {
  tenantId: string | null;
  actorMembershipId: string | null;
  platformPrincipalId: string | null;
  requestId: string;
  ipHash?: string | null;
  userAgentHash?: string | null;
};

export type AuditEntryRow = {
  id: string;
  occurred_at: Date;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_membership_id: string | null;
  actor_principal_id: string | null;
  request_id: string;
  reason: string | null;
  metadata_json: unknown;
};

type AuditCursor = {
  occurredAt: string;
  id: string;
};

function decodeAuditCursor(cursor?: string): AuditCursor | null {
  if (cursor == null || cursor.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as AuditCursor;

    if (typeof parsed.occurredAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function buildMetadataJson(input: AuditWriteInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = { ...input.metadata };

  if (input.reason != null) {
    metadata["reason"] = input.reason;
  }

  return metadata;
}

export async function insertAuditEntry(
  tx: AuditDbTx,
  ctx: AuditActorContext,
  input: AuditWriteInput,
): Promise<{ id: string }> {
  const id = createUuidV7();

  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO audit_entries (
      id,
      tenant_id,
      actor_membership_id,
      actor_principal_id,
      action,
      target_type,
      target_id,
      before_json,
      after_json,
      metadata_json,
      request_id,
      ip_hash,
      user_agent_hash,
      entry_hash
    )
    VALUES (
      ${id}::uuid,
      ${ctx.tenantId},
      ${ctx.actorMembershipId},
      ${ctx.platformPrincipalId},
      ${input.action},
      ${input.target.type},
      ${input.target.id},
      ${input.before},
      ${input.after},
      ${buildMetadataJson(input)},
      ${ctx.requestId},
      ${ctx.ipHash ?? null},
      ${ctx.userAgentHash ?? null},
      ${"pending-db-hash-chain"}
    )
    RETURNING id
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Failed to insert audit entry");
  }

  return row;
}

export async function listTenantAuditEntries(
  tx: AuditDbTx,
  query: AuditListQuery,
): Promise<AuditEntryRow[]> {
  const limitPlusOne = query.limit + 1;
  const cursor = decodeAuditCursor(query.cursor);

  return tx.$queryRaw<AuditEntryRow[]>`
    SELECT
      id,
      occurred_at,
      action,
      target_type,
      target_id,
      actor_membership_id,
      actor_principal_id,
      request_id,
      metadata_json->>'reason' AS reason,
      metadata_json
    FROM audit_entries
    WHERE (${query.action ?? null}::text IS NULL OR action = ${query.action ?? null})
      AND (${query.targetType ?? null}::text IS NULL OR target_type = ${query.targetType ?? null})
      AND (
        ${cursor?.occurredAt ?? null}::timestamptz IS NULL
        OR occurred_at < ${cursor?.occurredAt ?? null}::timestamptz
        OR (
          occurred_at = ${cursor?.occurredAt ?? null}::timestamptz
          AND id < ${cursor?.id ?? null}::uuid
        )
      )
    ORDER BY occurred_at DESC, id DESC
    LIMIT ${limitPlusOne}
  `;
}

export async function listPlatformAuditEntries(
  tx: AuditDbTx,
  query: AuditListQuery,
): Promise<AuditEntryRow[]> {
  const limitPlusOne = query.limit + 1;
  const cursor = decodeAuditCursor(query.cursor);

  return tx.$queryRaw<AuditEntryRow[]>`
    SELECT
      id,
      occurred_at,
      action,
      target_type,
      target_id,
      actor_membership_id,
      actor_principal_id,
      request_id,
      metadata_json->>'reason' AS reason,
      metadata_json
    FROM audit_entries
    WHERE tenant_id IS NULL
      AND (${query.action ?? null}::text IS NULL OR action = ${query.action ?? null})
      AND (${query.targetType ?? null}::text IS NULL OR target_type = ${query.targetType ?? null})
      AND (
        ${cursor?.occurredAt ?? null}::timestamptz IS NULL
        OR occurred_at < ${cursor?.occurredAt ?? null}::timestamptz
        OR (
          occurred_at = ${cursor?.occurredAt ?? null}::timestamptz
          AND id < ${cursor?.id ?? null}::uuid
        )
      )
    ORDER BY occurred_at DESC, id DESC
    LIMIT ${limitPlusOne}
  `;
}
