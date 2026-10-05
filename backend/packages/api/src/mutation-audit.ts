import { auditWriter } from "@atlas/audit";
import type { ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { structuredLogger } from "@atlas/observability/logger";
import type { RouteMetadata, TenantRouteContext } from "./route-metadata";

export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Set by the audit_entries statement trigger (migration 119) in the inserting transaction. */
async function auditWrittenInTransaction(tx: TenantTx): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ written: string | null }>>`
    select current_setting('atlas.audit_written', true) as written
  `;
  return rows[0]?.written === "on";
}

/**
 * Makes `audit: "required"` true of every mutation (audit M7).
 *
 * The flag used to be declarative only: nothing checked that a route declaring
 * it wrote an entry, so a service that forgot left the change untraceable.
 * After the handler runs, in its transaction, this checks whether any audit
 * entry was written. If not, it records the mutation itself (who, which
 * permission, which route, which resource) so the request is still on the
 * record, and logs it so the missing domain entry gets written.
 *
 * Not run for an idempotent replay: the handler does not run again, and the
 * original request is already on the record.
 */
export async function ensureMutationAudited<TInput>(
  tx: TenantTx,
  args: {
    ctx: TenantRouteContext;
    metadata: RouteMetadata<TInput>;
    method: string;
    route: string;
    resource: ResourceRef;
  },
): Promise<void> {
  if (args.metadata.audit !== "required" || !MUTATING_METHODS.has(args.method)) return;
  if (await auditWrittenInTransaction(tx)) return;

  const resourceId = UUID.test(args.resource.id) ? args.resource.id : null;
  await auditWriter.write(
    tx,
    {
      tenantId: args.ctx.tenantId,
      actorMembershipId: args.ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: args.ctx.requestId,
    },
    {
      action: "api.mutation",
      target: { type: args.resource.type, id: resourceId },
      before: null,
      after: null,
      metadata: {
        permission: args.metadata.permission,
        method: args.method,
        route: args.route,
        ...(resourceId ? {} : { resourceKey: args.resource.id }),
        recordedBy: "route_wrapper",
      },
    },
  );

  structuredLogger.warn({
    message: "Mutation declared audit: required but wrote no audit entry; recorded by the route.",
    module: "api.audit",
    eventType: "audit.route_fallback_entry",
    requestId: args.ctx.requestId,
    route: args.route,
    method: args.method,
    permission: args.metadata.permission,
  });
}
