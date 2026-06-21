import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { loadAssessmentResourceRef } from "../assessments/assessment.resource-loaders";
import { loadCourseResourceRef } from "../courses/load-course-resource-ref";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

type LoaderArgs<TInput> = {
  tx: TenantTx;
  ctx: LoaderCtx;
  input: TInput;
};

type AnalyticsDashboardQueryInput = {
  dashboardKey?: string | undefined;
  courseId?: string | undefined;
};

export type AnalyticsItemStatisticsQueryInput = {
  assessmentId: string;
};

export async function loadAnalyticsDashboardResourceRef(
  args: LoaderArgs<AnalyticsDashboardQueryInput>,
) {
  const dashboardKey = args.input.dashboardKey ?? "tenant.learning";

  if (dashboardKey === "course.learning" && args.input.courseId) {
    return loadCourseResourceRef({
      tx: args.tx,
      ctx: args.ctx,
      courseId: args.input.courseId,
      requirePublished: false,
    });
  }

  return createTenantResourceRef({
    type: "analytics_rollup",
    id: args.ctx.tenantId,
    tenantId: args.ctx.tenantId,
  });
}

export function loadAnalyticsFunnelResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "funnel_daily_rollup",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export async function loadAnalyticsItemStatisticsResourceRef(
  args: LoaderArgs<AnalyticsItemStatisticsQueryInput>,
) {
  return loadAssessmentResourceRef({
    tx: args.tx,
    ctx: args.ctx,
    assessmentId: args.input.assessmentId,
    requirePublished: false,
  });
}

export const analyticsDashboardMetadata = {
  permission: "analytics.dashboard.view",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadAnalyticsDashboardResourceRef,
} satisfies RouteMetadata<AnalyticsDashboardQueryInput>;

export const analyticsFunnelMetadata = {
  permission: "analytics.funnel.view",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({ ctx }: { ctx: LoaderCtx }) => loadAnalyticsFunnelResourceRef({ ctx }),
} satisfies RouteMetadata;

export const analyticsItemStatisticsMetadata = {
  permission: "analytics.dashboard.view",
  entitlement: "analytics.dashboard.view",
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: loadAnalyticsItemStatisticsResourceRef,
} satisfies RouteMetadata<AnalyticsItemStatisticsQueryInput>;
