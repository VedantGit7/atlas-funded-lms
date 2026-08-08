import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  runProtectedTenantRouteHandler,
  toSafeErrorEnvelope,
  type RouteMetadata,
} from "@atlas/api";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { attachRequestIdHeader } from "@atlas/observability";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { ensurePlatformSuperAdminTenantAccess, requireActiveMembership } from "@atlas/membership";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getModuleScormContentForLearner } from "../../../../../../server/courses/module-scorm-learner.service";
import { loadModuleLessonsResourceRef } from "../../../../../../server/courses/load-course-resource-ref";
import { uuidParamSchema } from "@atlas/membership/schemas/shared";

const scormContentQuerySchema = z
  .object({
    path: z.string().min(1),
  })
  .strict();

const routeMetadata = {
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
    tx: Parameters<typeof loadModuleLessonsResourceRef>[0]["tx"];
    ctx: Parameters<typeof loadModuleLessonsResourceRef>[0]["ctx"];
    params: Record<string, string>;
  }) => {
    const moduleId = params["id"];
    if (!moduleId) throw new Error("Missing module id");

    return await loadModuleLessonsResourceRef({
      tx,
      ctx,
      moduleId,
      requirePublished: true,
    });
  },
} satisfies RouteMetadata;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getOrCreateRequestId(req.headers);
  const params = uuidParamSchema.parse(await context.params);
  const moduleId = params.id;
  const query = scormContentQuerySchema.parse({
    path: new URL(req.url).searchParams.get("path"),
  });

  try {
    return await withGlobalDb(async (db) => {
      const tenant = await resolveTenantFromRequest({ req, db });
      const supabaseUser = await requireSupabaseUser(req);
      const principal = await upsertAuthPrincipal({
        db,
        supabaseUserId: supabaseUser.supabaseUserId,
        email: supabaseUser.email,
        mfaEnabled: supabaseUser.mfaEnabled,
        markLogin: false,
      });

      await ensurePlatformSuperAdminTenantAccess({
        db,
        tenantId: tenant.tenantId,
        requestId,
        email: supabaseUser.email,
      });

      const result = await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
        },
        async (tx) => {
          const membership = await requireActiveMembership({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principal.id,
          });

          return runProtectedTenantRouteHandler({
            tx,
            ctx: {
              tenantId: tenant.tenantId,
              actorMembershipId: membership.id,
              requestId,
            },
            metadata: routeMetadata,
            params: { id: moduleId },
            input: {},
            handler: async ({ tx, ctx }) =>
              getModuleScormContentForLearner(tx, ctx, moduleId, query.path),
          });
        },
      );

      return attachRequestIdHeader(
        new NextResponse(result.body, {
          status: 200,
          headers: {
            "content-type": result.contentType,
            "cache-control": "private, max-age=60",
          },
        }),
        requestId,
      );
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return attachRequestIdHeader(NextResponse.json(safe.body, { status: safe.status }), requestId);
  }
}
