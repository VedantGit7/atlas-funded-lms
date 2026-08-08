import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import {
  loadDeletionRequestMembershipResourceRef,
  loadDeletionRequestResourceRef,
  loadExportJobResourceRef,
} from "./data-rights.service";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export function loadExportCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "export_job",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export const listExportsMetadata = {
  permission: "data.export.run",
  entitlement: "data.export.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadExportCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const createExportMetadata = {
  permission: "data.export.run",
  entitlement: "data.export.enable",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadExportCatalogResourceRef({ ctx }),
} satisfies RouteMetadata;

export const getExportMetadata = {
  permission: "data.export.run",
  entitlement: "data.export.enable",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: Parameters<typeof loadExportJobResourceRef>[0]["tx"];
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const exportJobId = params["id"];
    if (!exportJobId) {
      throw new Error("Missing export job id");
    }
    return loadExportJobResourceRef({ tx, tenantId: ctx.tenantId, exportJobId });
  },
} satisfies RouteMetadata;

export const listDeletionRequestsMetadata = {
  permission: "data.deletion.manage",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) =>
    Promise.resolve(
      createTenantResourceRef({
        type: "deletion_request",
        id: ctx.tenantId,
        tenantId: ctx.tenantId,
      }),
    ),
} satisfies RouteMetadata;

export const createDeletionRequestMetadata = {
  permission: "data.deletion.request",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadDeletionRequestMembershipResourceRef({
      tx,
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      input: input as { targetMembershipId?: string },
    }),
} satisfies RouteMetadata;

export const getMyDeletionRequestStatusMetadata = {
  permission: "data.deletion.request",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ tx, ctx, input }) =>
    loadDeletionRequestMembershipResourceRef({
      tx,
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      input: (input ?? {}) as { targetMembershipId?: string },
    }),
} satisfies RouteMetadata;

export const processDeletionRequestMetadata = {
  permission: "data.deletion.manage",
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: Parameters<typeof loadDeletionRequestResourceRef>[0]["tx"];
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const deletionRequestId = params["id"];
    if (!deletionRequestId) {
      throw new Error("Missing deletion request id");
    }
    return loadDeletionRequestResourceRef({
      tx,
      tenantId: ctx.tenantId,
      deletionRequestId,
    });
  },
} satisfies RouteMetadata;
