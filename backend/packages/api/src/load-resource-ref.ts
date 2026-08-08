import { createTenantResourceRef } from "@atlas/authorization";
import type { ResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import type { RouteMetadata, TenantRouteContext } from "./route-metadata";

export async function loadResourceRefOrDefault<TInput>(args: {
  tx: TenantTx;
  metadata: RouteMetadata<TInput>;
  ctx: TenantRouteContext;
  params: Record<string, string>;
  input: TInput;
}): Promise<ResourceRef> {
  if (args.metadata.resourceLoader) {
    return args.metadata.resourceLoader({
      tx: args.tx,
      ctx: args.ctx,
      params: args.params,
      input: args.input,
    });
  }

  return createTenantResourceRef({
    type: "tenant",
    id: args.ctx.tenantId,
    tenantId: args.ctx.tenantId,
  });
}
