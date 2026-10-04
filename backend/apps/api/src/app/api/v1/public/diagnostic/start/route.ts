import { NextResponse } from "next/server";
import { createPublicRouteHandler, resolveRequestTenant } from "@atlas/api";
import { rejectClientTenantId } from "@atlas/domain-identity";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { readDiagnosticSessionCookie, setDiagnosticSessionCookie } from "@atlas/security";
import {
  PublicDiagnosticCompleteOperationSchema,
  PublicDiagnosticStartBodySchema,
  publicDiagnosticStartUnionResponseSchema,
} from "../../../../../../server/diagnostics/diagnostic.schemas";
import {
  completePublicDiagnosticSession,
  startPublicDiagnosticSession,
} from "../../../../../../server/diagnostics/diagnostic-public-session.service";
import { routeMetadata } from "./route.metadata";

export const POST = createPublicRouteHandler(routeMetadata, async ({ req, requestId }) => {
  const tenant = await resolveRequestTenant(req);
  const rawBody: unknown = await req.json();
  rejectClientTenantId(rawBody);
  const input = PublicDiagnosticStartBodySchema.parse(rawBody);

  if (input.operation === "start") {
    const result = await withTenantTx(
      {
        tenantId: tenant.tenantId,
        requestId,
        allowAnonymousTenantRead: true,
      },
      async (tx) =>
        startPublicDiagnosticSession({
          tx,
          ctx: { tenantId: tenant.tenantId, requestId },
          req,
        }),
    );

    const anonymousId = result.session.anonymous_id;
    if (!anonymousId) {
      throw new Error("Failed to create diagnostic session.");
    }

    const body = publicDiagnosticStartUnionResponseSchema.parse(result.response);
    const response = NextResponse.json(body);
    setDiagnosticSessionCookie({
      response,
      anonymousId,
      secret: result.proof.secret,
      expiresAt: result.proof.expiresAt,
    });
    return response;
  }

  const completeInput = PublicDiagnosticCompleteOperationSchema.parse(input);
  const cookie = readDiagnosticSessionCookie(req);
  if (!cookie || cookie.anonymousId !== completeInput.anonymousId) {
    throw new Error("Diagnostic session is invalid or expired.");
  }

  const body = await withTenantTx(
    {
      tenantId: tenant.tenantId,
      requestId,
      allowAnonymousTenantRead: true,
    },
    async (tx) =>
      completePublicDiagnosticSession({
        tx,
        ctx: { tenantId: tenant.tenantId, requestId },
        input: completeInput,
        secret: cookie.secret,
      }),
  );

  return NextResponse.json(publicDiagnosticStartUnionResponseSchema.parse(body));
});
