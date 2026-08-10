import type { RouteMetadata } from "@atlas/api/route-metadata";
import { loadReportCatalogResourceRef } from "./reports.service";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export const listExportsRosterMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const exportExportsRosterMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const getExportRunDetailMetadata = {
  permission: "reports.run",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const deleteExportRunFileMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const cancelExportRunMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const retryExportRunMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const previewExportBuilderMetadata = {
  permission: "reports.run",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const listSchedulesRosterMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const runScheduleNowMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const bulkMutateSchedulesMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const getScheduleDetailMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const duplicateScheduleMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const listDestinationsRosterMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const createDestinationMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const updateDestinationMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const deleteDestinationMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const testDestinationMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const exportDestinationsListMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const getExportSettingsMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const updateExportSettingsMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const purgeExpiredExportsMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const retentionImpactMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;
