import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadLocaleResourceCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "locale_resource_catalog",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}
