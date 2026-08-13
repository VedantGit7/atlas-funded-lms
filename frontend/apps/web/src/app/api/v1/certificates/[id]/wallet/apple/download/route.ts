import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runProtectedTenantRouteHandler, toSafeErrorEnvelope } from "@atlas/api";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { attachRequestIdHeader } from "@atlas/observability";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { ensurePlatformSuperAdminTenantAccess, requireActiveMembership } from "@atlas/membership";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { certificateParamsSchema } from "../../../../../../../../server/certificates/certificate.params";
import { getAppleWalletPassDownload } from "../../../../../../../../server/certificates/certificate-wallet.service";
import { downloadAppleWalletPassMetadata } from "../../../../../../../../server/certificates/certificate.route-metadata";

/**
 * GET /api/v1/certificates/[id]/wallet/apple/download
 *
 * Streams the stored Apple Wallet .pkpass for the certificate owner.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req.headers);
  const { id: certificateId } = certificateParamsSchema.parse(await context.params);

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
        { tenantId: tenant.tenantId, requestId, allowAnonymousTenantRead: true },
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
              actorMembershipId: membership.membershipId,
              requestId,
            },
            metadata: downloadAppleWalletPassMetadata,
            params: { id: certificateId },
            input: {},
            handler: async ({ tx, ctx }) => getAppleWalletPassDownload(tx, ctx, certificateId),
          });
        },
      );

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
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return attachRequestIdHeader(NextResponse.json(safe.body, { status: safe.status }), requestId);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
