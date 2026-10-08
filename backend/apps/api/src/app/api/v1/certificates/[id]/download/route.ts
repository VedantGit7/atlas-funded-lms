import { enforceIngressRateLimit } from "@atlas/api/rate-limit";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authenticateTenantRequest,
  enforceTenantRouteRateLimit,
  runProtectedTenantRouteHandler,
  toSafeErrorEnvelope,
} from "@atlas/api";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { attachRequestIdHeader } from "@atlas/observability";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { certificateParamsSchema } from "../../../../../../server/certificates/certificate.params";
import {
  materializeCertificateDownload,
  planCertificateDownload,
} from "../../../../../../server/certificates/certificate.service";
import { downloadCertificateMetadata } from "../../../../../../server/certificates/certificate.route-metadata";

/**
 * GET /api/v1/certificates/[id]/download
 *
 * Returns the certificate as a downloadable attachment. Prefers the stored PDF
 * from R2 when `r2_object_key` is set; otherwise serves a generated HTML
 * preview. When neither is available, the service throws 409.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers);

  try {
    await enforceIngressRateLimit({ req, plane: "tenant", requestId });
    const { id: certificateId } = certificateParamsSchema.parse(await context.params);

    // Supabase verification, then tenant and principal, each releasing its
    // connection before the tenant transaction (audit H3).
    const { supabaseUser, tenant, principal } = await authenticateTenantRequest(req);
    await enforceTenantRouteRateLimit({
      tenantId: tenant.tenantId,
      principalId: principal.id,
      metadata: downloadCertificateMetadata,
      requestId,
    });

    const plan = await withTenantTx(
      { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
      async (tx) => {
        const membership = await requireActiveMembership({
          tx,
          tenantId: tenant.tenantId,
          authPrincipalId: principal.id,
        });

        return runProtectedTenantRouteHandler({
          sessionAssuranceLevel: supabaseUser.sessionAssuranceLevel,
          rateLimitEnforced: true,
          tx,
          ctx: {
            tenantId: tenant.tenantId,
            actorMembershipId: membership.membershipId,
            requestId,
          },
          metadata: downloadCertificateMetadata,
          params: { id: certificateId },
          input: {},
          handler: async ({ tx, ctx }) => planCertificateDownload(tx, ctx, certificateId),
        });
      },
    );
    // Object storage only after the transaction has returned its connection.
    const result = await materializeCertificateDownload(plan);

    const responseBody: BodyInit =
      typeof result.body === "string" ? result.body : new Uint8Array(result.body);

    return attachRequestIdHeader(
      new NextResponse(responseBody, {
        status: 200,
        headers: {
          "content-type": result.contentType,
          "content-disposition": `attachment; filename="${result.filename}"`,
          "cache-control": "private, no-store",
        },
      }),
      requestId,
    );
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return attachRequestIdHeader(
      NextResponse.json(safe.body, { status: safe.status, headers: safe.headers ?? {} }),
      requestId,
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
