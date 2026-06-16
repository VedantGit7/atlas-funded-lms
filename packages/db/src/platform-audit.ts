import { randomUUID } from "node:crypto";
import { Prisma } from "./generated/prisma/client";
import type { PlatformContext } from "./platform-context";
type PlatformAuditStatus = "started" | "success" | "failure";

type PlatformScopeAuditInput = {
  ctx: PlatformContext;
  reason: string;
  action: "platform.scope.enter" | "platform.scope.exit";
  status: PlatformAuditStatus;
  errorMessage?: string;
};

export async function writePlatformScopeAudit(
  tx: Prisma.TransactionClient,
  input: PlatformScopeAuditInput,
): Promise<void> {
  const { ctx, reason, action, status, errorMessage } = input;

  await tx.auditEntry.create({
    data: {
      id: randomUUID(),
      tenant_id: ctx.tenantId ?? null,
      actor_membership_id: null,
      actor_principal_id: ctx.principalId,
      action,
      target_type: "platform_scope",
      target_id: ctx.tenantId ?? null,
      request_id: ctx.requestId,
      ip_hash: null,
      user_agent_hash: null,
      before_json: Prisma.DbNull,
      after_json: Prisma.DbNull,
      metadata_json: {
        reason,
        status,
        requiredPermission: ctx.requiredPermission,
        touchedTenantIds: ctx.touchedTenantIds ?? [],
        errorMessage: errorMessage ?? null,
      },
      previous_hash: null,

      /**
       * Migration 006 hash-chain trigger may replace this value.
       * Keep a deterministic placeholder so Prisma can satisfy the required field.
       * Do not calculate trust-sensitive audit hashes in application code.
       */
      entry_hash: "pending-db-hash-chain",
    },
  });
}
