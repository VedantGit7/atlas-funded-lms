import { enforceIngressRateLimit } from "@atlas/api/rate-limit";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authenticateTenantRequest,
  runProtectedTenantRouteHandler,
  toSafeErrorEnvelope,
} from "@atlas/api";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { attachRequestIdHeader } from "@atlas/observability";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { certificateParamsSchema } from "../../../../../../../../server/certificates/certificate.params";
import {
  materializeAppleWalletPassDownload,
  planAppleWalletPassDownload,
} from "../../../../../../../../server/certificates/certificate-wallet.service";
import { downloadAppleWalletPassMetadata } from "../../../../../../../../server/certificates/certificate.route-metadata";

/**
 * GET /api/v1/certificates/[id]/wallet/apple/download
 *
 * Streams the stored Apple Wallet .pkpass for the certificate owner.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers);

  try {
    await enforceIngressRateLimit({ req, plane: "tenant", requestId });
    const { id: certificateId } = certificateParamsSchema.parse(await context.params);

    // Supabase verification, then tenant and principal, each releasing its
    // connection before the tenant transaction (audit H3).
    const { supabaseUser, tenant, principal } = await authenticateTenantRequest(req);

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
          tx,
          ctx: {
            tenantId: tenant.tenantId,
            actorMembershipId: membership.membershipId,
            requestId,
          },
          metadata: downloadAppleWalletPassMetadata,
          params: { id: certificateId },
          input: {},
          handler: async ({ tx, ctx }) => ({
            ...(await planAppleWalletPassDownload(tx, ctx, certificateId)),
            actorMembershipId: ctx.actorMembershipId,
          }),
        });
      },
    );
    // Signing, upload and the object read only after the transaction has
    // returned its connection.
    const result = await materializeAppleWalletPassDownload(plan, {
      tenantId: tenant.tenantId,
      actorMembershipId: plan.actorMembershipId,
      requestId,
    });

    return attachRequestIdHeader(
      new NextResponse(new Uint8Array(result.body), {
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
