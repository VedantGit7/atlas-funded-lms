import { auditWriter } from "@atlas/audit/services/audit-writer";
import type { Prisma } from "./generated/prisma/client";
import { getPlatformPrisma } from "./platform-client";
import type { PlatformContext, PlatformPermission } from "./platform-context";
import { DEFAULT_PLATFORM_TX_TIMEOUT_MS, interactiveTxOptions } from "./transaction-options";

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
 * The session a platform-scope transaction runs under: the platform role and
 * the transaction-local context GUCs. Shared by the scope transaction and the
 * failure-audit transaction so both writes are made as the same actor.
 */
async function applyPlatformSession(tx: PlatformTx, ctx: PlatformContext): Promise<void> {
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
}

const MAX_AUDITED_ERROR_MESSAGE = 500;

function describeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.slice(0, MAX_AUDITED_ERROR_MESSAGE);
}

/**
 * Records that a platform scope failed, in its own transaction.
 *
 * It cannot be written in the scope transaction. When `fn` fails on a SQL
 * statement, Postgres has already aborted that transaction, so any further
 * statement fails with 25P02 -- and that second error used to replace the
 * real one. When `fn` fails for any other reason, the rethrow rolls the
 * transaction back and takes the audit row with it. Either way a failed
 * platform action left no record, which is the case an auditor most needs.
 *
 * The rows written inside the scope (including `platform.scope.enter`) are
 * rolled back with the work they described, so this exit row stands alone and
 * carries the reason and route itself. The audit hash chain is computed by the
 * `audit_entries_hash_chain` trigger against the latest committed entry, so a
 * row written after a rollback links correctly.
 *
 * Best effort by design: if this write also fails (the database is gone), the
 * failure is logged and swallowed, because the caller must see the original
 * error, not a secondary one about auditing it.
 */
async function recordFailedScope(
  ctx: PlatformContext,
  auditCtx: PlatformScopeAuditContext,
  reason: string,
  metadata: Record<string, unknown>,
  error: unknown,
): Promise<void> {
  try {
    await getPlatformPrisma().$transaction(async (tx) => {
      await applyPlatformSession(tx, ctx);
      await writePlatformScopeAudit(tx, auditCtx, {
        action: "platform.scope.exit",
        target: { type: "platform_scope", id: null },
        before: null,
        after: { status: "failed" },
        reason,
        metadata: { ...metadata, errorMessage: describeFailure(error) },
      });
    }, interactiveTxOptions(DEFAULT_PLATFORM_TX_TIMEOUT_MS));
  } catch (auditError) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "platform_scope.failure_audit_failed",
        module: "with-platform-scope",
        requestId: ctx.requestId,
        error: describeFailure(auditError),
        originalError: describeFailure(error),
        timestamp: new Date().toISOString(),
      }),
    );
  }
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
 * - Writes platform.scope.exit after success (in the scope transaction) and
 *   after failure (in a separate transaction, once the scope has rolled back).
 * - A failure always surfaces as the original error.
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

  try {
    return await platformPrisma.$transaction(async (tx) => {
      await applyPlatformSession(tx, ctx);

      await writePlatformScopeAudit(tx, auditCtx, {
        action: "platform.scope.enter",
        target: { type: "platform_scope", id: null },
        before: null,
        after: { reason: normalizedReason },
        reason: normalizedReason,
        metadata: auditMetadata,
      });

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
    }, interactiveTxOptions(DEFAULT_PLATFORM_TX_TIMEOUT_MS));
  } catch (error) {
    // Outside $transaction on purpose: by now the scope transaction has rolled
    // back, so the failure record can be written and committed on its own.
    await recordFailedScope(ctx, auditCtx, normalizedReason, auditMetadata, error);
    throw error;
  }
}
