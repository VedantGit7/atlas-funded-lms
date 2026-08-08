import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { assertPublicRouteMetadata } from "@atlas/authorization/route-metadata";
import { toSafeErrorEnvelope, enforcePublicRateLimit } from "@atlas/api";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { rejectClientTenantId } from "@atlas/domain-identity";
import { readDiagnosticSessionCookie } from "@atlas/security";
import {
  DiagnosticAnonParamsSchema,
  PublicDiagnosticMergeBodySchema,
  publicDiagnosticMergeResponseSchema,
} from "../../../../../../../server/diagnostics/diagnostic.schemas";
import { mergeAnonymousDiagnosticSession } from "../../../../../../../server/diagnostics/diagnostic-merge.service";
import { diagnosticSessionInvalid } from "../../../../../../../server/diagnostics/diagnostic-public-session.service";
import { routeMetadata } from "./route.metadata";

function readAnonIdFromRequest(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const anonId = segments.at(-2);
  return DiagnosticAnonParamsSchema.parse({ anonId }).anonId;
}

export async function POST(req: NextRequest) {
  assertPublicRouteMetadata(routeMetadata);
  const requestId = getOrCreateRequestId(req.headers);

  try {
    enforcePublicRateLimit({
      req,
      bucket: routeMetadata.rateLimit,
      requestId,
    });

    const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!idempotencyKey) {
      throw new AtlasHttpError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Idempotency-Key header is required.",
      });
    }

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

      const rawBody: unknown = await req.json();
      rejectClientTenantId(rawBody);
      PublicDiagnosticMergeBodySchema.parse(rawBody);
      const anonymousId = readAnonIdFromRequest(req);

      const cookie = readDiagnosticSessionCookie(req);
      if (!cookie || cookie.anonymousId !== anonymousId) {
        throw diagnosticSessionInvalid();
      }

      const body = await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        async (tx) => {
          const membership = await requireActiveMembership({
            tx,
            tenantId: tenant.tenantId,
            authPrincipalId: principal.id,
          });

          return mergeAnonymousDiagnosticSession({
            tx,
            ctx: {
              tenantId: tenant.tenantId,
              actorMembershipId: membership.membershipId,
              requestId,
            },
            anonymousId,
            secret: cookie.secret,
            idempotencyKey,
          });
        },
      );

      return NextResponse.json(publicDiagnosticMergeResponseSchema.parse(body));
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
}
