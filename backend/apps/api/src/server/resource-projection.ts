import type { ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";

type ProjectionContext = { tenantId: string; actorMembershipId: string };

/**
 * Private data accompanying a loader's resource, never serialized into it.
 * This is not an authorization cache: the pipeline still authorizes each load.
 * A handler can reuse data only with the exact transaction and request context
 * that loaded it. Standalone service calls fall back to their ordinary reads.
 */
export function createResourceProjection<T>() {
  const projections = new WeakMap<
    ResourceRef,
    {
      tx: TenantTx;
      ctx: ProjectionContext;
      tenantId: string;
      actorMembershipId: string;
      value: T;
    }
  >();
  return {
    set(resource: ResourceRef, tx: TenantTx, ctx: ProjectionContext, value: T): void {
      projections.set(resource, {
        tx,
        ctx,
        tenantId: ctx.tenantId,
        actorMembershipId: ctx.actorMembershipId,
        value,
      });
    },
    get(resource: ResourceRef | undefined, tx: TenantTx, ctx: ProjectionContext): T | undefined {
      const entry = resource && projections.get(resource);
      return entry &&
        entry.tx === tx &&
        entry.ctx === ctx &&
        entry.tenantId === ctx.tenantId &&
        entry.actorMembershipId === ctx.actorMembershipId &&
        resource.tenantId === ctx.tenantId
        ? entry.value
        : undefined;
    },
  };
}
