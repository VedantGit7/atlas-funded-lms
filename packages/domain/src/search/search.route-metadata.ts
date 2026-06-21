import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadSearchCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "search_index_entry",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export const searchQueryMetadata = {
  permission: "search.query",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }) => loadSearchCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const searchReindexMetadata = {
  permission: "search.reindex.manage",
  audit: "none",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }) => loadSearchCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;
