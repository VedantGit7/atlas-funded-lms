import type { Prisma } from "./generated/prisma/client";
import { prisma } from "./client";
import { assertNoHeldConnection, holdingConnection } from "./connection-scope";
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
 * - Switches to atlas_app for the transaction only (set_config('role', ..., true))
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
  assertNoHeldConnection("withTenantTx");

  const statementTimeoutMs = resolveStatementTimeoutMs(ctx.statementTimeoutMs);
  const txOptions = interactiveTxOptions(resolveInteractiveTimeoutMs(statementTimeoutMs));

  return await prisma.$transaction(
    async (tx) =>
      holdingConnection("withTenantTx", async () => {
        // The role and the four GUCs are set in ONE round trip rather than five.
        // Latency per request converts directly into how long the pooled
        // connection is held, which converts directly into concurrent capacity,
        // so against a remote database this saves four round trips on every
        // tenant request.
        //
        // set_config('role', ..., true) is SET LOCAL ROLE: it runs the same
        // membership check and is reverted at transaction end. The role comes
        // first, though nothing here depends on it until the next statement.
        //
        // statement_timeout is a transaction-local per-statement guard in
        // milliseconds, independent of the Prisma interactive transaction
        // wall-clock in `txOptions.timeout`.
        await tx.$executeRaw`
      SELECT
        set_config('role', 'atlas_app', true),
        set_config('app.tenant_id', ${ctx.tenantId}, true),
        set_config('app.actor_membership_id', ${ctx.actorMembershipId ?? ""}, true),
        set_config('app.request_id', ${ctx.requestId}, true),
        set_config('statement_timeout', ${String(statementTimeoutMs)}, true)
    `;

        return fn(tx);
      }),
    txOptions,
  );
}
