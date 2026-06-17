import { auditWriter } from "@atlas/audit/services/audit-writer";
import type { Prisma } from "./generated/prisma/client";
import { getPlatformPrisma } from "./platform-client";
import type { PlatformContext, PlatformPermission } from "./platform-context";

export type PlatformTx = Prisma.TransactionClient;

export class PlatformScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformScopeError";
  }
}

function normalizeReason(reason: string): string {
  return reason.trim();
}

function hasPlatformPermission(
  grantedPermissions: readonly PlatformPermission[],
  requiredPermission: PlatformPermission,
): boolean {
  return (
    grantedPermissions.includes(requiredPermission) || grantedPermissions.includes("platform.*")
  );
}

function assertPlatformContext(ctx: PlatformContext, reason: string): string {
  if (!ctx.principalId) {
    throw new PlatformScopeError("Missing platform principal context");
  }

  if (!ctx.requestId) {
    throw new PlatformScopeError("Missing request context");
  }

  if (!ctx.requiredPermission.startsWith("platform.")) {
    throw new PlatformScopeError("Platform permission required");
  }

  if (!hasPlatformPermission(ctx.platformPermissions, ctx.requiredPermission)) {
    throw new PlatformScopeError("Platform permission denied");
  }

  const normalizedReason = normalizeReason(reason);

  if (normalizedReason.length < 10) {
    throw new PlatformScopeError("Platform-scope reason required");
  }

  return normalizedReason;
}

function platformScopeAuditMetadata(ctx: PlatformContext): Record<string, unknown> {
  return ctx.route != null ? { route: ctx.route } : {};
}

type PlatformScopeAuditContext = {
  tenantId: null;
  actorMembershipId: null;
  platformPrincipalId: string;
  requestId: string;
};

type PlatformScopeAuditInput = {
  action: string;
  target: { type: string; id: string | null };
  before: null;
  after: Record<string, unknown>;
  reason: string;
  metadata: Record<string, unknown>;
};

function platformScopeAuditContext(ctx: PlatformContext): PlatformScopeAuditContext {
  return {
    tenantId: null,
    actorMembershipId: null,
    platformPrincipalId: ctx.principalId,
    requestId: ctx.requestId,
  };
}

async function writePlatformScopeAudit(
  tx: PlatformTx,
  auditCtx: PlatformScopeAuditContext,
  input: PlatformScopeAuditInput,
): Promise<void> {
  await auditWriter.write(tx, auditCtx, input);
}

/**
 * Platform database work must run through this helper.
 *
 * Rules:
 * - Uses a dedicated platform Prisma client.
 * - Uses SET LOCAL ROLE atlas_platform inside the transaction.
 * - Sets app.platform_scope transaction-locally.
 * - Sets platform actor/request context transaction-locally.
 * - Sets app.tenant_id only when the platform action touches a tenant.
 * - Writes platform.scope.enter before the callback.
 * - Writes platform.scope.exit after success/failure.
 * - Never exposes the platform Prisma client to tenant code.
 */
export async function withPlatformScope<T>(
  ctx: PlatformContext,
  reason: string,
  fn: (tx: PlatformTx) => Promise<T>,
): Promise<T> {
  const normalizedReason = assertPlatformContext(ctx, reason);
  const platformPrisma = getPlatformPrisma();
  const auditCtx = platformScopeAuditContext(ctx);
  const auditMetadata = platformScopeAuditMetadata(ctx);

  return await platformPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE atlas_platform");

    await tx.$executeRaw`
      SELECT set_config('app.platform_scope', 'true', true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.actor_principal_id', ${ctx.principalId}, true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.platform_actor_id', ${ctx.principalId}, true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.request_id', ${ctx.requestId}, true)
    `;

    if (ctx.tenantId) {
      await tx.$executeRaw`
        SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)
      `;
    }

    await writePlatformScopeAudit(tx, auditCtx, {
      action: "platform.scope.enter",
      target: { type: "platform_scope", id: null },
      before: null,
      after: { reason: normalizedReason },
      reason: normalizedReason,
      metadata: auditMetadata,
    });

    try {
      const result = await fn(tx);

      await writePlatformScopeAudit(tx, auditCtx, {
        action: "platform.scope.exit",
        target: { type: "platform_scope", id: null },
        before: null,
        after: { status: "completed" },
        reason: normalizedReason,
        metadata: auditMetadata,
      });

      return result;
    } catch (error) {
      await writePlatformScopeAudit(tx, auditCtx, {
        action: "platform.scope.exit",
        target: { type: "platform_scope", id: null },
        before: null,
        after: { status: "failed" },
        reason: normalizedReason,
        metadata: {
          ...auditMetadata,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  });
}
