import type { RouteMetadata } from "@atlas/api/route-metadata";
import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { iapCourseNotFoundError } from "./iap.errors";
import { iapRepository } from "./iap.repository";
import type { VerifyIapBody } from "./iap.dto";

type LoaderCtx = { tenantId: string; actorMembershipId: string };

async function loadPublishedCourseRef(args: { tx: TenantTx; ctx: LoaderCtx; courseId: string }) {
  const course = await iapRepository.findCourseById(args.tx, args.courseId);
  if (!course || course.status !== "PUBLISHED") {
    throw iapCourseNotFoundError();
  }

  return createTenantResourceRef({
    type: "course",
    id: course.id,
    tenantId: args.ctx.tenantId,
    relationships: {
      publishedLearnerVisible: true,
    },
  });
}

export const verifyIapMetadata = {
  permission: "enrollment.create",
  entitlement: null,
  audit: "required",
  rateLimit: "authenticatedTenantWrite",
  idempotency: "required",
  resourceLoader: async ({
    tx,
    ctx,
    input,
  }: {
    tx: TenantTx;
    ctx: LoaderCtx;
    input: VerifyIapBody;
  }) =>
    loadPublishedCourseRef({
      tx,
      ctx,
      courseId: input.courseId,
    }),
} satisfies RouteMetadata<VerifyIapBody>;

export const getCourseStorePricingMetadata = {
  permission: "course.read",
  entitlement: null,
  audit: "none",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
  resourceLoader: async ({
    tx,
    ctx,
    params,
  }: {
    tx: TenantTx;
    ctx: LoaderCtx;
    params: Record<string, string>;
  }) => {
    const courseId = params["id"];
    if (!courseId) throw new Error("Missing course id");
    return loadPublishedCourseRef({ tx, ctx, courseId });
  },
} satisfies RouteMetadata;
