import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadReportCatalogResourceRef } from "./reports.service";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export const listZoomInsightsRosterMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const exportZoomInsightsRosterMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;
