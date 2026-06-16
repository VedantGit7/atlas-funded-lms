import type { Prisma } from "./generated/prisma/client";
import { prisma } from "./client";
import type { TenantRequestContext } from "./tenant-context";

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
 * - Uses transaction-local set_config(..., true)
 * - Never uses session-level SET
 * - Does not accept client-supplied tenant_id
 * - Provides a Prisma TransactionClient to callers
 * - RLS reads app.tenant_id inside the transaction
 */
export async function withTenantTx<T>(
  ctx: TenantRequestContext,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  assertTenantContext(ctx);

  return await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.actor_membership_id', ${ctx.actorMembershipId ?? ""}, true)
    `;

    await tx.$executeRaw`
      SELECT set_config('app.request_id', ${ctx.requestId}, true)
    `;

    return fn(tx);
  });
}
