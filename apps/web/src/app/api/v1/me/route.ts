import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { toSafeErrorEnvelope } from "@atlas/core/http/errors";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import {
  meOutputSchema,
  requireSupabaseUser,
  toSessionSafeIdentity,
  upsertAuthPrincipal,
} from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";

export const routeMetadata = {
  permission: "profile.read",
  rateLimit: "authenticatedTenantRead",
  idempotency: "none",
} as const;

export async function GET(req: NextRequest) {
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

      const body = meOutputSchema.parse({
        data: {
          tenant: {
            id: tenant.tenantId,
            slug: tenant.tenantSlug,
            state: tenant.tenantState,
          },
          identity: toSessionSafeIdentity(principal),
        },
      });

      return NextResponse.json(body);
    });
  } catch (error) {
    const safe = toSafeErrorEnvelope(error, requestId);
    return NextResponse.json(safe.body, { status: safe.status });
  }
}
