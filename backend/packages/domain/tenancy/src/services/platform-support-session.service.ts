import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import type { OpenSupportSessionRequestSchema } from "../schemas/platform-support";
import type { z } from "zod";

const SUPPORT_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

type OpenInput = z.infer<typeof OpenSupportSessionRequestSchema>;

function mapSupportSession(row: {
  session_id: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_display_name: string;
  opened_at: Date;
  expires_at: Date;
  status: "ACTIVE" | "EXPIRED";
}) {
  return {
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantDisplayName: row.tenant_display_name,
    openedAt: row.opened_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    status: row.status,
  };
}

export async function openPlatformSupportSession(
  tx: PlatformTx,
  ctx: { platformPrincipalId: string; requestId: string },
  input: OpenInput,
) {
  const tenantRows = await tx.$queryRaw<
    { id: string; slug: string; display_name: string; state: string }[]
  >`
    SELECT id::text, slug, display_name, state::text
    FROM tenants
    WHERE id = ${input.tenantId}::uuid
    LIMIT 1
  `;
  const tenant = tenantRows[0];
  if (!tenant || tenant.state === "DELETED") {
    throw new Error("Tenant not found");
  }

  const sessionId = createUuidV7();
  const openedAt = new Date();
  const expiresAt = new Date(openedAt.getTime() + SUPPORT_SESSION_TTL_MS);

  await auditWriter.write(
    tx,
    {
      tenantId: input.tenantId,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "platform.support.session.opened",
      target: { type: "tenant", id: input.tenantId },
      before: null,
      after: {
        sessionId,
        expiresAt: expiresAt.toISOString(),
        tenantSlug: tenant.slug,
      },
      reason: input.reason,
      metadata: {
        sessionId,
        expiresAt: expiresAt.toISOString(),
        tenantSlug: tenant.slug,
        tenantDisplayName: tenant.display_name,
      },
    },
  );

  return {
    data: mapSupportSession({
      session_id: sessionId,
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      tenant_display_name: tenant.display_name,
      opened_at: openedAt,
      expires_at: expiresAt,
      status: "ACTIVE",
    }),
  };
}

export async function listActivePlatformSupportSessions(tx: PlatformTx) {
  const rows = await tx.$queryRaw<
    {
      session_id: string;
      tenant_id: string;
      tenant_slug: string;
      tenant_display_name: string;
      opened_at: Date;
      expires_at: Date;
    }[]
  >`
    SELECT DISTINCT ON (metadata_json->>'sessionId')
      metadata_json->>'sessionId' AS session_id,
      tenant_id::text AS tenant_id,
      metadata_json->>'tenantSlug' AS tenant_slug,
      metadata_json->>'tenantDisplayName' AS tenant_display_name,
      occurred_at AS opened_at,
      (metadata_json->>'expiresAt')::timestamptz AS expires_at
    FROM audit_entries
    WHERE action = 'platform.support.session.opened'
      AND metadata_json->>'sessionId' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM audit_entries closed
        WHERE closed.action = 'platform.support.session.closed'
          AND closed.metadata_json->>'sessionId' = audit_entries.metadata_json->>'sessionId'
      )
    ORDER BY metadata_json->>'sessionId', occurred_at DESC
  `;

  const now = Date.now();
  return {
    data: rows
      .filter((row) => row.session_id && row.tenant_id)
      .map((row) =>
        mapSupportSession({
          session_id: row.session_id,
          tenant_id: row.tenant_id,
          tenant_slug: row.tenant_slug || "unknown",
          tenant_display_name: row.tenant_display_name || "Unknown tenant",
          opened_at: row.opened_at,
          expires_at: row.expires_at,
          status: row.expires_at.getTime() > now ? "ACTIVE" : "EXPIRED",
        }),
      )
      .filter((session) => session.status === "ACTIVE"),
  };
}
