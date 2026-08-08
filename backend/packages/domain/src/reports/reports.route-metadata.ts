import type { RouteMetadata } from "@atlas/api/route-metadata";
import {
  loadReportCatalogResourceRef,
  loadReportRunResourceRef,
  loadReportScheduleResourceRef,
} from "./reports.service";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export const listReportDefinitionsMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const createCustomReportDefinitionMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const createBiExportMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const listBiExportMetadata = {
  permission: "reports.run",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const getBiExportMetadata = {
  permission: "reports.run",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const listReportRunsMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const createReportRunMetadata = {
  permission: "reports.run",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const getReportRunMetadata = {
  permission: "reports.run",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: Parameters<typeof loadReportRunResourceRef>[0]["tx"];
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const reportRunId = params["runId"] ?? params["id"];
    if (!reportRunId) {
      throw new Error("Missing report run id");
    }
    return loadReportRunResourceRef({ tx, tenantId: ctx.tenantId, reportRunId });
  },
} satisfies RouteMetadata;

export const listReportSchedulesMetadata = {
  permission: "reports.library.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const createReportScheduleMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    loadReportCatalogResourceRef({ tenantId: ctx.tenantId }),
} satisfies RouteMetadata;

export const updateReportScheduleMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: Parameters<typeof loadReportScheduleResourceRef>[0]["tx"];
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const scheduleId = params["id"] ?? params["scheduleId"];
    if (!scheduleId) {
      throw new Error("Missing report schedule id");
    }
    return loadReportScheduleResourceRef({ tx, tenantId: ctx.tenantId, scheduleId });
  },
} satisfies RouteMetadata;

export const deleteReportScheduleMetadata = {
  permission: "reports.schedule.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: Parameters<typeof loadReportScheduleResourceRef>[0]["tx"];
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const scheduleId = params["id"] ?? params["scheduleId"];
    if (!scheduleId) {
      throw new Error("Missing report schedule id");
    }
    return loadReportScheduleResourceRef({ tx, tenantId: ctx.tenantId, scheduleId });
  },
} satisfies RouteMetadata;
