import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { toSafeErrorEnvelope } from "@atlas/api";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import {
  acceptInvitation,
  acceptInvitationInputSchema,
  acceptInvitationOutputSchema,
} from "@atlas/membership";

export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req.headers);

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
      const input = acceptInvitationInputSchema.parse(await req.json());

      const result = await withTenantTx(
        {
          tenantId: tenant.tenantId,
          requestId,
          allowAnonymousTenantRead: true,
        },
        async (tx) =>
          acceptInvitation({
            tx,
            tenantId: tenant.tenantId,
            requestId,
            input,
            principal: {
              id: principal.id,
              emailNormalized: principal.emailNormalized,
            },
          }),
      );

      const body = acceptInvitationOutputSchema.parse({
        data: {
          accepted: true,
          membership: result.membership,
          profile: {
            id: result.profile.id,
            displayName: result.profile.displayName,
            avatarUrl: result.profile.avatarUrl,
          },
        },
      });

      return NextResponse.json(body);
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
}
