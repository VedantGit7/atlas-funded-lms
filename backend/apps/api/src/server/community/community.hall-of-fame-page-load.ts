import { headers } from "next/headers";
import { getOrCreateRequestId } from "@atlas/core/request/request-id";
import { requireSupabaseUser, upsertAuthPrincipal } from "@atlas/auth";
import { withGlobalDb } from "@atlas/db/global-db";
import { withTenantTx } from "@atlas/db/with-tenant-tx";
import { requireActiveMembership } from "@atlas/membership";
import { resolveTenantFromRequest } from "@atlas/tenancy";
import { buildHallOfFameProjection } from "./community.hall-of-fame-service";
import type { ServiceCtx } from "./community.types";

export async function loadHallOfFamePageData() {
  const headerList = await headers();
  const requestId = getOrCreateRequestId(headerList);

  return withGlobalDb(async (db) => {
    const req = new Request("http://local", { headers: headerList });
    const tenant = await resolveTenantFromRequest({ req, db });
    const supabaseUser = await requireSupabaseUser(req);
    const principal = await upsertAuthPrincipal({
      db,
      supabaseUserId: supabaseUser.supabaseUserId,
      email: supabaseUser.email,
      mfaEnabled: supabaseUser.mfaEnabled,
      markLogin: false,
    });

    return withTenantTx(
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

        const ctx: ServiceCtx = {
          tenantId: tenant.tenantId,
          actorMembershipId: membership.membershipId,
          requestId,
        };

        return buildHallOfFameProjection(tx, ctx);
      },
    );
  });
}
