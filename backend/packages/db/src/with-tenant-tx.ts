import type { Prisma } from "./generated/prisma/client";
import { prisma } from "./client";
import type { TenantRequestContext } from "./tenant-context";
import {
  interactiveTxOptions,
  resolveInteractiveTimeoutMs,
  resolveStatementTimeoutMs,
} from "./transaction-options";

export type TenantTx = Prisma.TransactionClient;

export class TenantTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantTransactionError";
  }
}

function assertTenantContext(ctx: TenantRequestContext): void {
  if (!ctx.tenantId) {
    throw new TenantTransactionError("Missing tenant context");
  }

  if (!ctx.requestId) {
    throw new TenantTransactionError("Missing request context");
  }

  if (!ctx.actorMembershipId && !ctx.allowAnonymousTenantRead) {
    throw new TenantTransactionError("Missing actor membership context");
  }
}

/**
 * All tenant-scoped database work must run through this helper.
 *
 * Rules:
 * - Uses SET LOCAL ROLE atlas_app inside the transaction
 * - Uses transaction-local set_config(..., true)
 * - Never uses session-level SET
 * - Does not accept client-supplied tenant_id
 * - Provides a Prisma TransactionClient to callers
 * - RLS reads app.tenant_id inside the transaction
 * - Applies per-statement statement_timeout (tenant default / override)
 * - Uses an interactive transaction timeout above the per-statement budget
 */
export async function withTenantTx<T>(
  ctx: TenantRequestContext,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  assertTenantContext(ctx);

  const statementTimeoutMs = resolveStatementTimeoutMs(ctx.statementTimeoutMs);
  const txOptions = interactiveTxOptions(resolveInteractiveTimeoutMs(statementTimeoutMs));

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE atlas_app");

    await tx.$executeRaw`
      SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.actor_membership_id', ${ctx.actorMembershipId ?? ""}, true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.request_id', ${ctx.requestId}, true)
    `;

    // Transaction-local per-statement guard (milliseconds). Independent of the
    // Prisma interactive transaction wall-clock in `txOptions.timeout`.
    await tx.$executeRaw`
      SELECT set_config('statement_timeout', ${String(statementTimeoutMs)}, true)
    `;

    return fn(tx);
  }, txOptions);
}
