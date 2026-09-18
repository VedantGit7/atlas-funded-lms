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

/**
 * Publishing or archiving catalogue products changes what learners can see and
 * buy, so it carries the same audit and idempotency weight as creating one.
 * `course.update` rather than `course.publish`: this moves products between
 * DRAFT/PUBLISHED/ARCHIVED, which is catalogue curation, not course release.
 */
export const updateLearnerProductStatusMetadata = {
  permission: "course.update",
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

/**
 * Reading one product, and reading who is in it.
 *
 * Both are reads, so both stay on the read rate-limit bucket with no audit
 * entry. The enrolment roster is gated on `enrollment.read` rather than
 * `course.read`: seeing the catalogue and seeing which named learners are in it
 * are different disclosures.
 */
export const getLearnerProductMetadata = listLearnerProductsMetadata;

export const listProductEnrollmentsMetadata = {
  permission: "enrollment.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantCatalogRef({ ctx }),
} satisfies RouteMetadata;

/**
 * Rewriting what a product contains, and cloning one.
 *
 * A contents edit changes what every enrolled learner receives, so it carries
 * the same weight as a publish: `course.update`, audited, idempotent. A
 * duplicate creates a new catalogue row, so it is `course.create` — the same
 * permission that gates making one from scratch, because that is what it does.
 */
export const replaceLearnerProductContentsMetadata = {
  permission: "course.update",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantCatalogRef({ ctx }),
} satisfies RouteMetadata;

export const duplicateLearnerProductMetadata = {
  permission: "course.create",
  entitlement: null,
  audit: "required",
  rateLimit: "tenantMutation",
  idempotency: "required",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadTenantCatalogRef({ ctx }),
} satisfies RouteMetadata;

/**
 * Changing or revoking an existing enrolment.
 *
 * `enrollment.manage` — the same permission that grants access in the first
 * place, because taking it away or shortening it is the same authority in
 * reverse. Audited: an access change nobody can trace is the problem this
 * module already fixed for the initial grant.
 */
export const manageProductEnrollmentsMetadata = {
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
