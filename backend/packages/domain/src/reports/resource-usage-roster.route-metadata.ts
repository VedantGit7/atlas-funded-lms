import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadReportCatalogResourceRef } from "./reports.service";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export const listResourceUsageRosterMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const exportResourceUsageRosterMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;
