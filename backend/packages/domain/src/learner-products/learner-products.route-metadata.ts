import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";

type LoaderCtx = { tenantId: string; actorMembershipId: string };

function loadTenantCatalogRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "tenant_config",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export const listLearnerProductsMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantCatalogRef({ ctx }),
} satisfies RouteMetadata;

export const createLearnerProductMetadata = {
  permission: "course.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantCatalogRef({ ctx }),
} satisfies RouteMetadata;

export const enrollLearnerProductMetadata = {
  permission: "enrollment.manage",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantCatalogRef({ ctx }),
} satisfies RouteMetadata;

export const listMockTestsMetadata = listLearnerProductsMetadata;
export const createMockTestMetadata = createLearnerProductMetadata;
export const enrollMockTestMetadata = enrollLearnerProductMetadata;

export const listTestSeriesMetadata = listLearnerProductsMetadata;
export const createTestSeriesMetadata = createLearnerProductMetadata;
export const enrollTestSeriesMetadata = enrollLearnerProductMetadata;

export const listBundlesMetadata = listLearnerProductsMetadata;
export const createBundleMetadata = createLearnerProductMetadata;
export const enrollBundleMetadata = enrollLearnerProductMetadata;

export const listLearnerSubscriptionPlansMetadata = listLearnerProductsMetadata;
export const createLearnerSubscriptionPlanMetadata = createLearnerProductMetadata;
export const enrollLearnerSubscriptionPlanMetadata = enrollLearnerProductMetadata;
